# Third-party notices

## Translate (`bleelblep.translate`)

- Original work: [bleelblep/revenge-next-plugins](https://github.com/bleelblep/revenge-next-plugins),
  plugin `plugins/translate/`, version 0.6.4.
- Author: bleelblep.
- License: CC0-1.0 (stated in that repository's `docs/licensing.md`).
- Change made here: ported from the Revenge Next plugin API to the Valenced plugin API. Imports were
  renamed from `@revenge-mod/*` to `@valenced/*`, the manifest dependency from `revenge.api` to
  `valenced.api`, and two plugin-local type aliases from `Revenge*` to `Valenced*`. Plugin behaviour is
  unchanged.

## Template scaffolding

- [Valenced/valenced-plugin-template](https://github.com/Valenced/valenced-plugin-template), licensed
  under the terms in its `LICENSE` file (carried over unchanged in this repository).
- Build tooling: [Valenced/valenced-plugin-cli](https://github.com/Valenced/valenced-plugin-cli),
  GPL-3.0-or-later, consumed as a build dependency and not redistributed here.
