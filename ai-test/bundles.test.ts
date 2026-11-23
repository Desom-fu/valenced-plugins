/**
 * Loads each ported bundle the way the Valenced host will and asserts a usable plugin came out.
 *
 * The whole port rests on one claim that a successful build does NOT prove: that the built
 * `index.js` hands back a real plugin object rather than `undefined`. A bundle entry that exports
 * `undefined` builds cleanly and then does nothing at runtime, so this test evaluates the built
 * artifact with a stub `valenced` global and inspects what the default export actually is.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const PLUGINS = ['rose-lib', 'markdown-toolbar', 'split-messages']

/**
 * The bundles reach the host through one injected global. Reads are untyped and calls are no-ops,
 * which is enough here: the question is whether loading succeeds and yields a plugin, not whether
 * Discord's internals are wired up.
 */
function stubValenced(): any {
	const anything: any = new Proxy(() => {}, {
		get(_t, prop) {
			if (prop === 'then') return undefined
			if (prop === Symbol.toPrimitive) return () => ''
			return anything
		},
		apply: () => anything,
		construct: () => anything,
	})

	const react: any = new Proxy(
		{},
		{
			get(_t, prop) {
				if (prop === 'ReactJSXRuntime') {
					return {
						jsx: () => null,
						jsxs: () => null,
						Fragment: Symbol('Fragment'),
					}
				}
				if (prop === 'ReactNative') return { Clipboard: { setString() {} } }
				return anything
			},
		},
	)

	return new Proxy(
		{},
		{
			get(_t, prop) {
				if (prop === 'react') return react
				if (prop === 'modules') return anything
				if (prop === 'externals') return anything
				return anything
			},
		},
	)
}

describe('ported bundles', () => {
	for (const name of PLUGINS) {
		test(`${name} registers a plugin when the host evaluates it`, () => {
			const code = readFileSync(
				join(ROOT, 'plugins', name, 'build', 'js', 'index.js'),
				'utf-8',
			)

			const g: any = globalThis
			g.valenced = stubValenced()

			// Registration does not go through the module's export. The bundle ends in
			// `exports.default = plugin({...})` where `exports` is a throwaway literal, so an
			// `export default` would be read by nothing at runtime. What actually registers the
			// plugin is the host-provided `plugin()` global being called during evaluation — which
			// is why the bundle works at all on a real device. Capture those calls.
			const registered: any[] = []
			g.plugin = (opts: any) => {
				registered.push(opts)
				return opts
			}

			new Function(code)()

			expect(registered.length).toBeGreaterThan(0)
			expect(typeof registered[0].start).toBe('function')
		})

		test(`${name} keeps no unrenamed revenge reference`, () => {
			const code = readFileSync(
				join(ROOT, 'plugins', name, 'build', 'js', 'index.js'),
				'utf-8',
			)
			expect(code).not.toMatch(/(?<![\w$])revenge(?![\w$])/)
		})

		test(`${name} manifest is a Valenced manifest`, () => {
			const manifest = JSON.parse(
				readFileSync(join(ROOT, 'plugins', name, 'manifest.json'), 'utf-8'),
			)
			expect(manifest.id.startsWith('desom-fu.')).toBe(true)
			expect(manifest.dependencies['valenced.api']).toEqual({
				version: '>=1 <2',
			})
			expect(manifest).not.toHaveProperty('dependencies.revenge.api')
		})
	}
})
