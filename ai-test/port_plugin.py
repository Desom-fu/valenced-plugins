#!/usr/bin/env python3
"""
Brings one Revenge Next source plugin into this repo as a Valenced plugin.

Same shape the Translate port used, generalised:

  * copy the plugin's `js/` tree,
  * copy only the `shared/` files its imports actually reach (the import closure), not the whole
    shared directory,
  * rewrite `@revenge-mod/*` to `@valenced/*` and flatten the `../../../shared/x` escapes into the
    plugin's own `shared/`,
  * rename the id into this repo's namespace and give it a manifest version that reflects the port.

Usage:
  python port_plugin.py --src <plugin dir> --name <repo dir name> --id <new id> --out <repo root>
"""

import argparse
import json
import os
import re
import shutil
import sys

REVENGE_PREFIX = '@revenge-mod/'
VALENCED_PREFIX = '@valenced/'

# Import forms the shared files are reached through: `../../../shared/foo` (from js/ui/...),
# `../../shared/foo` (from js/x), `./shared/foo`.
SHARED_RE = re.compile(r'^(?:\.\./)+shared/(.+)$')
RELATIVE_RE = re.compile(r"""(?:from|import|require\()\s*['"](\.[^'"]+)['"]""")


def read(path):
    with open(path, encoding='utf-8', errors='replace') as fh:
        return fh.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)


def iter_js(root):
    for base, _dirs, files in os.walk(root):
        for name in files:
            if name.endswith(('.ts', '.tsx', '.js', '.jsx')):
                yield os.path.join(base, name)


def resolve_relative(from_file, spec):
    """`./x` or `../x` relative to `from_file`, with the extensions this repo uses."""
    target = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
    for candidate in (
        target,
        target + '.ts',
        target + '.tsx',
        target + '.js',
        target + '.jsx',
        os.path.join(target, 'index.ts'),
        os.path.join(target, 'index.tsx'),
    ):
        if os.path.isfile(candidate):
            return candidate
    return None


def shared_closure(plugin_js, shared_root):
    """Every file under shared/ the plugin's imports reach, transitively."""
    needed = set()
    queue = []

    for path in iter_js(plugin_js):
        for spec in RELATIVE_RE.findall(read(path)):
            match = SHARED_RE.match(spec)
            if match:
                queue.append(('shared', match.group(1)))

    while queue:
        kind, rel = queue.pop()
        base = shared_root if kind == 'shared' else None
        if base is None:
            continue
        for candidate in (rel, rel + '.ts', rel + '.tsx', rel + '.js'):
            full = os.path.normpath(os.path.join(base, candidate))
            if os.path.isfile(full) and full not in needed:
                needed.add(full)
                # A shared file may itself import another shared file relatively.
                for spec in RELATIVE_RE.findall(read(full)):
                    target = resolve_relative(full, spec)
                    if target and os.path.normpath(target).startswith(os.path.normpath(shared_root)):
                        queue.append(('rel', os.path.relpath(target, shared_root)))
    return needed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True, help='source plugin directory (contains js/ and manifest.json)')
    ap.add_argument('--shared', required=True, help='the source repo shared/ directory')
    ap.add_argument('--name', required=True, help='directory name under plugins/')
    ap.add_argument('--id', required=True, help='new plugin id')
    ap.add_argument('--display', required=True, help='new display name')
    ap.add_argument('--author', required=True)
    ap.add_argument('--version', default='1.0.0')
    ap.add_argument('--description', default=None)
    ap.add_argument('--out', required=True, help='repo root')
    args = ap.parse_args()

    src = os.path.abspath(args.src)
    src_manifest = json.loads(read(os.path.join(src, 'manifest.json')))
    dest = os.path.join(os.path.abspath(args.out), 'plugins', args.name)

    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)

    # --- js tree ------------------------------------------------------------
    shutil.copytree(os.path.join(src, 'js'), os.path.join(dest, 'js'))

    # --- shared closure -----------------------------------------------------
    closure = shared_closure(os.path.join(dest, 'js'), os.path.abspath(args.shared))
    for path in sorted(closure):
        rel = os.path.relpath(path, os.path.abspath(args.shared))
        write(os.path.join(dest, 'shared', rel), read(path))

    # --- rewrite imports ----------------------------------------------------
    rewritten = 0
    for path in iter_js(dest):
        text = read(path)
        original = text

        # Only the module specifier is touched, never a relative one: `@revenge-mod/x` ->
        # `@valenced/x`. A blanket string replace would also hit `./x` style specifiers that
        # happen to contain the prefix, and did during the first run.
        text = re.sub(
            r"""(['"])@revenge-mod/""",
            lambda m: f'{m.group(1)}@valenced/',
            text,
        )

        def fix(match):
            spec = match.group(2)
            # A bare relative import has nothing to do with the prefix rename; only rewrite the
            # ones that escaped into the source repo's shared/ directory.
            hit = SHARED_RE.match(spec)
            if not hit:
                return match.group(0)
            # Find where the file sits relative to the plugin root.
            depth = os.path.relpath(os.path.dirname(path), dest).count(os.sep)
            prefix = '../' * (depth + 1)
            return f'{match.group(1)}{prefix}shared/{hit.group(1)}{match.group(3)}'

        text = re.sub(r"""((?:from|import|require\()\s*['"])(\.[^'"]+)(['"])""", fix, text)
        if text != original:
            write(path, text)
            rewritten += 1

    # --- tsconfig -----------------------------------------------------------
    write(
        os.path.join(dest, 'tsconfig.json'),
        json.dumps({'extends': '../../tsconfig.base.json'}, indent='\t') + '\n',
    )

    # --- type aliases -------------------------------------------------------
    # The source repos declared `RevengePluginStartApi` / `RevengeJsonStorageApi` in their own
    # globals; Valenced has no such names. Every ported plugin that mentions them gets the
    # Valenced-named pair instead, so the ported source keeps compiling unedited.
    aliases = (
        "// Type aliases for this ported plugin.\n"
        "//\n"
        "// These are not Valenced globals: the source plugin declared them itself. They are\n"
        "// re-declared here under Valenced names so the ported source keeps its precise types.\n"
        "\n"
        "import type { JsonStorage } from '@valenced/json-storage'\n"
        "import type { PluginApi } from '@valenced/plugins/types'\n"
        "\n"
        "declare global {\n"
        "\t/** The scoped plugin API handed to `start` and to the settings component. */\n"
        "\ttype ValencedPluginStartApi<S extends object> = PluginApi<{ jsonStorage: S }>\n"
        "\n"
        "\t/** The plugin's JSON storage handle; `cache` may be undefined while it loads. */\n"
        "\ttype ValencedJsonStorageApi<S extends object> = JsonStorage<S>\n"
        "}\n"
    )
    uses_aliases = False
    for path in iter_js(dest):
        for old, new in (
            ('RevengeJsonStorageApi', 'ValencedJsonStorageApi'),
            ('RevengePluginStartApi', 'ValencedPluginStartApi'),
        ):
            text = read(path)
            if old in text:
                write(path, text.replace(old, new))
                uses_aliases = True
    if uses_aliases:
        write(os.path.join(dest, 'types', 'globals.d.ts'), aliases)

    # --- manifest -----------------------------------------------------------
    manifest = {
        'format': 1,
        'id': args.id,
        'name': args.display,
        'description': args.description or src_manifest.get('description', ''),
        'author': args.author,
        'icon': src_manifest.get('icon', 'PuzzlePieceIcon'),
        'version': args.version,
        'dependencies': {
            'valenced.api': {'version': '>=1 <2'},
            'discord': {'version': '*'},
        },
        'dist': {'script': 'index.js'},
    }
    # Carry over optional plugin dependencies the source declared (they must be ported too).
    for dep, spec in (src_manifest.get('dependencies') or {}).items():
        if dep in ('revenge.api', 'valenced.api', 'discord'):
            continue
        manifest['dependencies'][dep] = spec

    write(os.path.join(dest, 'manifest.json'), json.dumps(manifest, indent='\t', ensure_ascii=False) + '\n')

    print(f'{args.name}: js files rewritten={rewritten}, shared files={len(closure)}')
    print(f'  id       {src_manifest.get("id")} -> {args.id}')
    print(f'  version  {src_manifest.get("version")} -> {args.version}')
    leftover = 0
    for path in iter_js(dest):
        leftover += read(path).count('@revenge-mod')
    print(f'  leftover @revenge-mod: {leftover}')
    if leftover:
        sys.exit(1)


if __name__ == '__main__':
    main()
