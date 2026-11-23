/**
 * Can a compiled Revenge plugin bundle be moved to Valenced by renaming the injected global?
 *
 * The question matters because Rosie's source repository is gone (git.gay returns nothing), so the
 * only artifact is the published `index.js`. If the bundles reach the host through the injected
 * global — `revenge.modules.finders.getModules` — and Valenced injects the same tree under
 * `valenced`, then the migration is a rename of that one identifier plus the manifest dependency.
 *
 * This is a spike: it reads the real bundles, rewrites them, and reports every global path used,
 * checked against the import maps Valenced actually ships. It does not write anything back into the
 * repository.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'C:/Users/Administrator/AppData/Local/Temp/rosie-zip'
const OUT = 'C:/Users/Administrator/AppData/Local/Temp/rosie-port'
const TYPES =
	'C:/Users/Administrator/AppData/Local/Temp/vrepo/node_modules/@valenced/types'

const bundles = [
	'rosie.markdown-toolbar',
	'rosie.split-messages',
	'rosie.roselib',
	'rosie.live-markdown',
]

// Every global path Valenced exposes, from its own import maps.
function valencedGlobals(): Set<string> {
	const out = new Set<string>()
	for (const name of [
		'modules.importmap.json',
		'modules.hidden.importmap.json',
	]) {
		const map = JSON.parse(readFileSync(join(TYPES, name), 'utf8'))
		for (const value of Object.values(map) as any[]) {
			if (typeof value === 'string') out.add(value)
			else if (value?.global) out.add(value.global)
		}
	}
	// The plugin API object itself is not in the import map: it is the `valenced` global.
	out.add('valenced')
	return out
}

const globals = valencedGlobals()

/** `revenge.a.b.c` -> the longest global prefix that exists. */
function pathsIn(source: string): string[] {
	const found = new Set<string>()
	for (const match of source.matchAll(
		/\brevenge((?:\.[A-Za-z_$][A-Za-z0-9_$]*)+)/g,
	)) {
		found.add(`valenced${match[1]}`)
	}
	return [...found].sort()
}

/** The global it resolves through, e.g. `valenced.modules.finders`. */
function rootGlobal(path: string, candidates: Set<string>): string | undefined {
	const parts = path.split('.')
	while (parts.length > 1) {
		const candidate = parts.join('.')
		if (candidates.has(candidate)) return candidate
		parts.pop()
	}
	return candidates.has(parts[0]) ? parts[0] : undefined
}

mkdirSync(OUT, { recursive: true })

let allResolved = true
for (const bundle of bundles) {
	const file = join(SRC, bundle, 'index.js')
	if (!existsSync(file)) {
		console.log(`\n${bundle}: MISSING`)
		continue
	}
	const source = readFileSync(file, 'utf8')
	const paths = pathsIn(source)

	// Count the rename sites, and make sure no bare `revenge` identifier is left behind.
	const renamed = source.replace(/\brevenge(?=\.)/g, 'valenced')
	const leftovers = (renamed.match(/\brevenge\b/g) ?? []).length

	const roots = new Set<string>()
	const unresolved: string[] = []
	for (const path of paths) {
		const root = rootGlobal(path, globals)
		if (root) roots.add(root)
		else unresolved.push(path)
	}

	console.log(`\n${bundle}`)
	console.log(
		`  rename sites : ${(source.match(/\brevenge(?=\.)/g) ?? []).length}`,
	)
	console.log(`  leftovers    : ${leftovers}`)
	console.log(`  globals used : ${[...roots].sort().join(', ') || '(none)'}`)
	if (unresolved.length) {
		allResolved = false
		console.log(`  UNRESOLVED   : ${unresolved.join(', ')}`)
	} else {
		console.log('  all resolved against Valenced import maps')
	}

	// Also note any native bridge calls, which no rename can fix.
	const nativeHits = [
		...new Set(
			(
				renamed.match(/valenced\.modules\.native\.\w+|\bcallNativeMethod\b/g) ??
				[]
			).sort(),
		),
	]
	if (nativeHits.length)
		console.log(`  native calls : ${nativeHits.join(', ')}`)

	writeFileSync(join(OUT, `${bundle}.index.js`), renamed)
}

console.log(
	`\n${allResolved ? 'PASS' : 'FAIL'}: every global path ${allResolved ? 'resolves' : 'does not resolve'} on Valenced`,
)
console.log(`rewritten bundles in ${OUT}`)
