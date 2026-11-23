/**
 * The two decisions that made the chat bar button silently absent, pinned down.
 *
 * "Silently" is the operative word: nothing threw, nothing logged, the plugin loaded and every other
 * feature worked — the button was simply not in the row. Both causes were matching/insertion bugs,
 * which is exactly the kind that a test catches and a device test does not.
 */

import { describe, expect, test } from 'bun:test'
import {
	matchesMemoName,
	prependChild,
	renderHost,
} from '../plugins/translate/js/lib/composerRow'
import { shortLabel } from '../plugins/translate/js/lib/languages'

const NAME = 'ChatInputRightActions'

/** `memo(render)` — React 19 / Discord 350.2, where `forwardRef` is gone app-wide. */
const memoOfRender = (name: string) => {
	const render = function ChatInputRightActions() {}
	Object.defineProperty(render, 'displayName', {
		value: name,
		configurable: true,
	})
	return { $$typeof: Symbol.for('react.memo'), type: render, compare: null }
}

/** `memo(forwardRef(render))` — older builds. */
const memoOfForwardRef = (name: string) => {
	const render = function ChatInputRightActions() {}
	Object.defineProperty(render, 'displayName', {
		value: name,
		configurable: true,
	})
	return {
		$$typeof: Symbol.for('react.memo'),
		type: { $$typeof: Symbol.for('react.forward_ref'), render },
		compare: null,
	}
}

describe('matchesMemoName', () => {
	test('finds the name on memo(render)', () => {
		expect(matchesMemoName(NAME, memoOfRender(NAME))).toBe(true)
	})

	test('finds the name on memo(forwardRef(render))', () => {
		expect(matchesMemoName(NAME, memoOfForwardRef(NAME))).toBe(true)
	})

	test('finds a plain named function component', () => {
		const Component = function ChatInputRightActions() {}
		expect(matchesMemoName(NAME, Component)).toBe(true)
	})

	test('finds a bare exports-level displayName', () => {
		expect(matchesMemoName(NAME, { displayName: NAME })).toBe(true)
	})

	test('does not match a different component', () => {
		expect(matchesMemoName(NAME, memoOfRender('ChatInputSendButton'))).toBe(
			false,
		)
	})

	/**
	 * The actual release bug: `withName` looks at `exports.name`, and a memo object does not have
	 * one. If this ever starts being true again, the filter would be redundant — and if the filter
	 * regresses to the same mistake, this stays green while the button disappears. So it is asserted
	 * explicitly rather than left implicit.
	 */
	test('a memo export has no name to match on — which is why withName misses it', () => {
		expect((memoOfRender(NAME) as any).name).toBeUndefined()
	})

	test('nullish and primitive exports are just "no"', () => {
		expect(matchesMemoName(NAME, null)).toBe(false)
		expect(matchesMemoName(NAME, undefined)).toBe(false)
		expect(matchesMemoName(NAME, 0)).toBe(false)
		expect(matchesMemoName(NAME, 'ChatInputRightActions')).toBe(false)
	})

	test('a throwing Proxy is "no", not a crash', () => {
		const hostile = new Proxy(
			{},
			{
				get() {
					throw new Error('nope')
				},
			},
		)
		expect(matchesMemoName(NAME, hostile)).toBe(false)
	})
})

describe('prependChild', () => {
	const button = { kind: 'button' }
	const send = { kind: 'send' }
	const emoji = { kind: 'emoji' }

	test('goes before a single child', () => {
		expect(prependChild(send, button)).toEqual([button, send])
	})

	test('goes before an array, first', () => {
		expect(prependChild([emoji, send], button)).toEqual([button, emoji, send])
	})

	test('becomes the only child when the row was empty', () => {
		expect(prependChild(undefined, button)).toEqual(button)
		expect(prependChild(null, button)).toEqual(button)
	})

	test('keeps the row order intact after the button', () => {
		const children = [emoji, send]
		const result = prependChild(children, button)
		expect(result.slice(1)).toEqual(children)
	})
})

describe('renderHost', () => {
	test('patches `type` on memo(render)', () => {
		const exports = memoOfRender(NAME)
		expect(renderHost(exports)).toEqual({ host: exports, key: 'type' })
	})

	test('patches `render` on memo(forwardRef(render))', () => {
		const exports = memoOfForwardRef(NAME)
		expect(renderHost(exports)).toEqual({ host: exports.type, key: 'render' })
	})

	test('unwraps a `{ default: … }` module shape', () => {
		const exports = memoOfRender(NAME)
		expect(renderHost({ default: exports })).toEqual({
			host: exports,
			key: 'type',
		})
	})

	test('an unrecognisable shape is undefined, not a throw', () => {
		expect(renderHost({})).toBeUndefined()
		expect(renderHost(null)).toBeUndefined()
		expect(renderHost({ type: 42 })).toBeUndefined()
	})
})

describe('shortLabel', () => {
	test('uses the primary subtag, uppercase', () => {
		expect(shortLabel('en')).toBe('EN')
		expect(shortLabel('ja')).toBe('JA')
	})

	/** Four characters on a 32dp button pushes the row out of shape. */
	test('drops the region so it never grows past three characters', () => {
		expect(shortLabel('zh-CN')).toBe('ZH')
		expect(shortLabel('zh-TW')).toBe('ZH')
		expect(shortLabel('pt-BR')).toBe('PT')
	})

	test('never returns an empty label', () => {
		expect(shortLabel('')).toBe('?')
	})

	test('an unknown code still shows something', () => {
		expect(shortLabel('xx-YY')).toBe('XX')
	})
})

describe('prependChild with a pair of buttons', () => {
	const language = { kind: 'language' }
	const translate = { kind: 'translate' }
	const send = { kind: 'send' }

	test('puts both before the row, in the given order', () => {
		expect(prependChild(send, [language, translate])).toEqual([
			language,
			translate,
			send,
		])
	})

	test('keeps an existing array order after them', () => {
		const emoji = { kind: 'emoji' }
		expect(prependChild([emoji, send], [language, translate])).toEqual([
			language,
			translate,
			emoji,
			send,
		])
	})

	test('works on an empty row', () => {
		expect(prependChild(undefined, [language, translate])).toEqual([
			language,
			translate,
		])
	})
})
