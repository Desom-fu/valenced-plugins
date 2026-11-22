# Valenced Plugins

A [Valenced](https://github.com/Valenced/valenced) plugin repository, hosted on GitHub Pages.

**Repository URL to add in Valenced:**

```
https://desom-fu.github.io/valenced-plugins/index.json
```

## Plugins

| Plugin | ID | Version | What it does |
| --- | --- | --- | --- |
| Translate | `bleelblep.translate` | 0.6.4 | Long-press a message and read it in your language, using free translation services. No key, no account, no AI Core. |

## Translate

A port of [bleelblep's Translate](https://github.com/bleelblep/revenge-next-plugins) from Revenge Next
to the Valenced plugin API. The plugin itself is unchanged: four free services (Google, Bing, Yandex,
MyMemory) behind one interface, a cooldown that fails over to the next service instead of dying, and
row-level rewriting so translated messages look like they were always in your language.

The port is a mechanical one — the package prefix is the only thing that changed:

| Revenge Next | Valenced |
| --- | --- |
| `import … from '@revenge-mod/x'` | `import … from '@valenced/x'` |
| `"revenge.api": { "version": ">=1 <2" }` | `"valenced.api": { "version": ">=1 <2" }` |
| `revenge` global | `valenced` global |
| `RevengeJsonStorageApi` / `RevengePluginStartApi` | `ValencedJsonStorageApi` / `ValencedPluginStartApi` |

Module ids map one to one, so no call site had to be rewritten: the CLI inlines each import into a
`valenced.*` global read at the point of use, which is what the original plugin already relied on.

## Building

```sh
bun install
bun run lint:types    # type-check every plugin against @valenced/types
bun run lint          # biome: format + lint
bun run build         # JS bundles -> plugins/<name>/build/js/
```

Release the plugins locally, without GitHub:

```sh
mkdir -p pool
bun run plan-releases --pool ./pool --out releases.json
python3 .github/scripts/package.py          # -> build/dist/<id>@<version>.zip
bun run generate-index -- --dist build/dist --base-url http://127.0.0.1:8080/pool --out index.json
bun run serve                               # serves the pool on :8080
```

Then add `http://127.0.0.1:8080` as a repository. Over a cable, forward the port first:

```sh
adb reverse tcp:8080 tcp:8080
```

## Releasing

Push to `main`. `.github/workflows/release.yml` plans the release against the published pool, builds
the bundles, packages the planned plugins, copies them into the pool on `gh-pages` and regenerates
`index.json` in a single commit. A version already in the pool is skipped, so re-running is safe.

There is no JDK, Android SDK or `READ_PACKAGES_TOKEN` in that path: these are JS-only plugins, and the
Gradle packaging step in the upstream template is only needed for native (`src/main`) plugins.

To unpublish a version, delete its ZIP from the `gh-pages` pool and run the **Publish repository
index** workflow.

## Attribution

Translate is the work of [bleelblep](https://github.com/bleelblep), published under CC0-1.0 in
[bleelblep/revenge-next-plugins](https://github.com/bleelblep/revenge-next-plugins). This repository
carries the port to the Valenced API. The template scaffolding comes from
[Valenced/valenced-plugin-template](https://github.com/Valenced/valenced-plugin-template).
