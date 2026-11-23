/**
 * Entry point for this ported bundle.
 *
 * The source plugin exists only as a compiled bundle (its repository is gone), so this repo
 * ports the published `index.js`: every `revenge` identifier renamed to `valenced`, plus the
 * exports object the IIFE wrote into being kept reachable. See `ai-test/port_bundle.py`.
 *
 * The bundle calls itself as `(function (exports, jsxRuntime) { ... })({}, ...)` and sets
 * `exports.default = plugin({...})`. Its exports object was a throwaway literal, so the port
 * points it at a global; this file imports the bundle for its side effect and re-exports what
 * landed there. That gives the Valenced build step the `export default plugin(...)` it needs
 * without editing the bundle's own code.
 *
 * The native half of the bundle is deliberately not shipped: its Kotlin imports
 * `io.github.revenge.xposed.api`, Valenced exposes `app.valenced.xposed.api`, so the jar
 * cannot be reused without a recompile. The JS guards every native call behind a typeof
 * check, so those extras report as unavailable and the rest works.
 */

import './bundle'

export default (globalThis as any).__ported_markdown_toolbar.default
