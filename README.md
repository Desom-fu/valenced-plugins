# Valenced Plugins

A [Valenced](https://github.com/Valenced/valenced) plugin repository, hosted on GitHub Pages.

**Repository URL to add in Valenced:**

```
https://desom-fu.github.io/valenced-plugins/index.json
```

## Plugins

| Plugin | ID | Version | What it does |
| --- | --- | --- | --- |
| Translate+ | `desom-fu.translate` | 0.7.0 | Long-press a message and read it in your language. Four free services by default, or your own OpenAI-compatible model, plus a translate button in the chat bar. |
| Read All+ | `desom-fu.read-all-plus` | 1.0.0 | Mark every channel as read from the drawer. |
| Second Thoughts | `desom-fu.second-thoughts` | 1.0.0 | Ask before a message with a typo or an unfinished thought goes out. |
| Picture Links | `desom-fu.picture-links` | 1.0.0 | Copy or open the link behind an avatar, banner or attachment. |
| Markdown Toolbar | `desom-fu.markdown-toolbar` | 1.0.0 | Floating markdown formatting bar under the chat input. |
| Split Messages | `desom-fu.split-messages` | 1.0.0 | Split a long message at a chosen point instead of letting it be cut. |
| RoseLib | `desom-fu.rose-lib` | 1.0.0 | Shared library the two Rosie ports above talk to. |

Install order matters for the Rosie ports: add RoseLib first, then Markdown Toolbar and Split
Messages, which list it as an optional dependency.

## Translate+

A port of [bleelblep's Translate](https://github.com/bleelblep/revenge-next-plugins) from Revenge Next
to the Valenced plugin API. The translation core is unchanged: four free services (Google, Bing,
Yandex, MyMemory) behind one interface, a cooldown that fails over to the next service instead of
dying, and row-level rewriting so translated messages look like they were always in your language.

On top of the port, this fork adds a bring-your-own-model channel and a button in the chat bar:

- **Your own model** — any OpenAI-compatible endpoint (`/v1/chat/completions` and `GET /v1/models`).
  Base URL, API key, model, reasoning effort and prompt are configured on their own page, with a
  model list fetch and a **Test connection** that sends one real translation so a wrong URL, key,
  model or field shows up before you spend anything on real messages.
- **Automatic mode never uses it.** `auto` stays on the four free services; the AI channel only runs
  when it is explicitly selected as the provider. That is deliberate — automatic mode must not start
  costing money on its own.
- **Translate button** in the chat bar: tap to translate what is in the input, long-press to pick the
  target language. The same provider setting applies as for received messages.

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
carries the port to the Valenced API, the own-model channel and the chat bar button.

Read All+, Second Thoughts and Picture Links are ports of Revenge Next plugins by
[bleelblep](https://github.com/bleelblep) and [btmc727](https://github.com/btmc727).

Markdown Toolbar, Split Messages and RoseLib come from Rosie's plugin collection, originally by
[kmmiio99o](https://github.com/kmmiio99o). Their source repository is gone, so these three are ports
of the published bundles rather than rebuilds: `ai-test/port_bundle.py` renames every `revenge`
identifier to `valenced` and otherwise leaves the bytes alone, and `plugins/<name>/bundle.js` is that
file verbatim. The native half of those bundles is not shipped — its Kotlin imports
`io.github.revenge.xposed.api` while Valenced exposes `app.valenced.xposed.api`, so it cannot be
reused without a recompile. The JS guards those calls behind `typeof` checks, so the affected extras
report as unavailable and everything else runs.

The template scaffolding comes from
[Valenced/valenced-plugin-template](https://github.com/Valenced/valenced-plugin-template).
