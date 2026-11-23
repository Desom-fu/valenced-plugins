/**
 * Two pure decisions the chat bar patch makes, kept out of `patches/composerBar.tsx` so they can be
 * tested without a Discord runtime.
 *
 * Both of these were wrong in the first release, and both failed *silently*: the button simply was
 * not there, with nothing in the log to say why. Pinning them down in a test is cheaper than
 * rediscovering that on a phone.
 */

/**
 * Does this module export the `memo`ed component called [name]?
 *
 * `withName` (the obvious filter) checks `exports.name`, and a `memo` object has no `name` — the
 * name Discord set lives on the render function inside it. So `withName('ChatInputRightActions')`
 * matches nothing, and a plugin that trusts it installs no button at all.
 *
 * Two shapes have to be handled:
 *
 * - `memo(render)` — React 19 / Discord 350.2 dropped `forwardRef` app-wide, so `exports.type` *is*
 *   the render function.
 * - `memo(forwardRef(render))` — older builds, where `exports.type.render` is the render function.
 *
 * `exports` may be a Proxy, nullish, or a primitive (the finder walks everything), so every read is
 * guarded and a throwing Proxy counts as "no".
 */
export function matchesMemoName(name: string, exports: any): boolean {
	try {
		if (!exports) return false

		// `memo(render)`: the export is the memo object and `type` *is* the render function.
		const inner = exports.type
		if (typeof inner === 'function') return named(inner, name)

		// `memo(forwardRef(render))`: `type.render` is the render function.
		if (typeof inner?.render === 'function') return named(inner.render, name)

		// A component exported as itself rather than wrapped in `memo`.
		if (typeof exports === 'function') return named(exports, name)

		return exports.displayName === name
	} catch {
		return false
	}
}

/**
 * A component's own name, whichever of the two React lets it carry.
 *
 * `displayName` wins when it is set, because that is the name Discord assigned deliberately; the
 * function name is only a fallback for a build that stripped `displayName`. Checking both at once
 * would let a renamed function win over a component that plainly calls itself something else.
 */
function named(component: any, name: string): boolean {
	const displayName = component.displayName
	if (typeof displayName === 'string' && displayName)
		return displayName === name
	return component.name === name
}

/**
 * Where the render function actually lives, so `before`/`after` can patch it.
 *
 * The patcher works on `parent[key]`, and the key is not the same for both memo shapes:
 *
 * - `memo(render)` → `{ host: exports, key: 'type' }`
 * - `memo(forwardRef(render))` → `{ host: exports.type, key: 'render' }`
 *
 * Getting this wrong means patching an object rather than a function, which throws — and a thrown
 * install is one more way for the surface to be silently absent. Also accepts a `{ default: … }`
 * module shape, which is how some of these are exported.
 */
export function renderHost(
	exports: any,
): { host: any; key: 'render' | 'type' } | undefined {
	try {
		const candidate = exports?.default ?? exports
		const inner = candidate?.type

		if (typeof inner?.render === 'function')
			return { host: inner, key: 'render' }
		if (typeof inner === 'function') return { host: candidate, key: 'type' }
		return undefined
	} catch {
		return undefined
	}
}

/**
 * Puts [child] before whatever the row already had.
 *
 * The row is a `View`, so its children arrive as an array when there are several, as a single
 * element when there is one, and as `undefined` when there are none. All three have to come back as
 * something the row can lay out left to right with the new child first.
 *
 * Note this is *prepend*, not append: the row ends in the send button, and the whole point is to
 * land to its left.
 */
export function prependChild(children: any, child: any): any {
	if (Array.isArray(children)) return [child, ...children]
	return children ? [child, children] : child
}
