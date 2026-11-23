#!/usr/bin/env python3
"""
Ports a compiled Revenge Next plugin bundle into this repo.

Why bundles and not source: Rosie's repository (`git.gay/SheWhoReignsSupreme/revenge-next-plugs`)
returns "not found" now, so the published `index.js` is the only artifact left. That is workable
because these bundles reach the host exclusively through the injected global — `revenge.modules...`
— and Valenced injects the same tree as `valenced`, which `port-rosie.spike.ts` verified path by
path against Valenced's own import maps.

The rename has to be total, not just dot-prefixed: the bundles also contain
`typeof revenge < 'u' ? revenge : globalThis.revenge`, which a `\\brevenge\\.` pattern misses and
which would otherwise resolve to `undefined` on Valenced and silently disable the plugin.

Usage:
  python port_bundle.py --zip <published zip> --name <repo dir> --id <new id> --display <name>
                        --author <author> --version <ver> --out <repo root>
"""

import argparse
import json
import os
import re
import shutil
import sys
import zipfile

IDENT = re.compile(r'(?<![\w$])revenge(?![\w$])')

# A bundle that checks for the native bridge before using it degrades gracefully without the jar.
# Rosie's libraries do exactly that (`typeof revenge?.modules?.native?.callNativeMethod == 'function'`),
# so their jar is an enhancement, not a requirement.
JS_TOLERATES_MISSING_NATIVE = re.compile(
    r"""typeof\s+revenge\?*\.modules\?*\.native\?*\.callNativeMethod\s*==\s*[`'"]function[`'"]"""
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', required=True)
    ap.add_argument('--name', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--display', required=True)
    ap.add_argument('--author', required=True)
    ap.add_argument('--version', required=True)
    ap.add_argument('--description', default=None)
    ap.add_argument('--icon', default=None)
    ap.add_argument('--out', required=True)
    ap.add_argument('--dep', action='append', default=[], help='extra dependency id, any version')
    args = ap.parse_args()

    dest = os.path.join(os.path.abspath(args.out), 'plugins', args.name)
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest, exist_ok=True)

    with zipfile.ZipFile(args.zip) as zf:
        names = zf.namelist()
        if 'index.js' not in names or 'manifest.json' not in names:
            sys.exit(f'{args.zip}: expected index.js + manifest.json, got {names}')
        src_manifest = json.loads(zf.read('manifest.json').decode('utf-8'))
        bundle = zf.read('index.js').decode('utf-8')

        # A native half cannot be renamed into working code: the kotlin imports are
        # `io.github.revenge.xposed.api`, and Valenced's are `app.valenced.xposed.api`. So the jar
        # is dropped rather than carried — but only after checking the JS tolerates its absence.
        native = (src_manifest.get('dist') or {}).get('android')
        if native:
            if not JS_TOLERATES_MISSING_NATIVE.search(bundle):
                sys.exit(
                    f'{args.name}: ships a native half ({native.get("path")}) and the JS does not '
                    f'guard for its absence; needs a recompile, not a port'
                )
            print(f'{args.name}: dropping native {native.get("path")} (JS guards for it)')

    before = len(IDENT.findall(bundle))
    ported = IDENT.sub('valenced', bundle)
    after = len(IDENT.findall(ported))
    if after:
        sys.exit(f'{args.name}: {after} `revenge` identifier(s) survived the rename')

    # The bundle is an IIFE that calls itself with a throwaway `{}` as its exports object and then
    # reads `exports.default` — so nothing survives the call and `require` yields `{}`. Point that
    # one argument at a global instead, which is a one-token change and leaves every other byte as
    # published. `index.ts` then re-exports what the factory put there.
    marker = '})({},'
    if marker not in ported:
        sys.exit(f'{args.name}: bundle does not end in the expected `}})({{}},` shape')
    slot = f'__ported_{args.name.replace("-", "_")}'
    ported = ported.replace(
        marker,
        f'}})((globalThis.{slot} = {{}}),',
        1,
    )
    with open(os.path.join(dest, 'index.js'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(ported)

    # The bundle is a UMD factory invoked with an empty exports object and the JSX runtime, so it
    # has no ESM default export for the build step to find. Keep the file byte-for-byte as published
    # and give it a one-line ESM entry instead.
    entry = (
        "/**\n"
        " * Entry point for this ported bundle.\n"
        " *\n"
        " * The source plugin exists only as a compiled bundle (its repository is gone), so this repo\n"
        " * ports the published `index.js`: every `revenge` identifier renamed to `valenced`, plus the\n"
        " * exports object the IIFE wrote into being kept reachable. See `ai-test/port_bundle.py`.\n"
        " *\n"
        " * The bundle calls itself as `(function (exports, jsxRuntime) { ... })({}, ...)` and sets\n"
        " * `exports.default = plugin({...})`. Its exports object was a throwaway literal, so the port\n"
        " * points it at a global; this file imports the bundle for its side effect and re-exports what\n"
        " * landed there. That gives the Valenced build step the `export default plugin(...)` it needs\n"
        " * without editing the bundle's own code.\n"
        " *\n"
        " * The native half of the bundle is deliberately not shipped: its Kotlin imports\n"
        " * `io.github.revenge.xposed.api`, Valenced exposes `app.valenced.xposed.api`, so the jar\n"
        " * cannot be reused without a recompile. The JS guards every native call behind a typeof\n"
        " * check, so those extras report as unavailable and the rest works.\n"
        " */\n"
        "\n"
        "import './bundle'\n"
        "\n"
        f"export default (globalThis as any).{slot}.default\n"
    )
    with open(os.path.join(dest, 'index.ts'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(entry)
    os.replace(os.path.join(dest, 'index.js'), os.path.join(dest, 'bundle.js'))

    manifest = {
        'format': 1,
        'id': args.id,
        'name': args.display,
        'description': args.description or src_manifest.get('description', ''),
        'author': args.author,
        'icon': args.icon or src_manifest.get('icon') or 'PuzzlePieceIcon',
        'version': args.version,
        'dependencies': {
            'valenced.api': {'version': '>=1 <2'},
            'discord': {'version': '*'},
        },
        'dist': {'script': 'index.js'},
    }
    for dep in args.dep:
        manifest['dependencies'][dep] = {'version': '*', 'optional': True}

    with open(os.path.join(dest, 'manifest.json'), 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(manifest, fh, indent='\t', ensure_ascii=False)
        fh.write('\n')

    print(f'{args.name}: {before} `revenge` identifier(s) renamed, {after} left')
    print(f'  id       {src_manifest.get("id")} -> {args.id}')
    print(f'  version  {src_manifest.get("version")} -> {args.version}')
    print(f'  bytes    {len(ported)}')


if __name__ == '__main__':
    main()
