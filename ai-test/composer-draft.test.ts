/**
 * Reading the draft when the build has no `getText`.
 *
 * The chat bar button did nothing at all on a real device for exactly this reason: `readDraft`
 * asked `handle.getText()`, this build does not have it, the function returned `undefined`, and
 * `translateComposer` bailed out before doing anything. Nothing threw, so nothing was reported.
 *
 * These tests hold the three read routes to their contract, and check that the fallback really does
 * see what the user typed rather than only claiming to.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import {
	attachComposer,
	detachComposer,
	readDraft,
	setDraft,
	writeDraft,
} from '../plugins/translate/js/lib/composer'

const noop = () => undefined

afterEach(() => detachComposer())

/** A handle shaped like the build that broke: no `getText`, only `handleTextChanged`. */
function typedOnlyHandle() {
	return {
		text: '',
		handleTextChanged(text: string) {
			this.text = text
		},
	}
}

describe('reading the draft', () => {
	test('uses getText when the build has it', () => {
		const handle = { getText: () => 'hello' }
		attachComposer({ current: handle } as any, undefined)
		expect(readDraft()).toBe('hello')
	})

	/** The regression: no getText, so the text has to come from the edit callback. */
	test('falls back to what handleTextChanged reported', () => {
		const handle = typedOnlyHandle()
		attachComposer({ current: handle } as any, undefined)

		handle.handleTextChanged('你好')
		expect(readDraft()).toBe('你好')

		handle.handleTextChanged('你好 world')
		expect(readDraft()).toBe('你好 world')
	})

	test('falls back to the state ref text', () => {
		const state = {
			current: { text: 'from state', selectionStart: 0, selectionEnd: 0 },
		}
		attachComposer({ current: {} } as any, state as any)
		expect(readDraft()).toBe('from state')
	})

	test('falls back to a plain currentText property', () => {
		attachComposer(
			{ current: { currentText: 'plain property' } } as any,
			undefined,
		)
		expect(readDraft()).toBe('plain property')
	})

	test('is undefined when no route can answer', () => {
		attachComposer({ current: {} } as any, undefined)
		expect(readDraft()).toBeUndefined()
	})

	test('is undefined with no composer attached', () => {
		expect(readDraft()).toBeUndefined()
	})

	test('a getText that throws does not block the fallback', () => {
		const handle = {
			getText() {
				throw new Error('nope')
			},
			currentText: 'still here',
		}
		attachComposer({ current: handle } as any, undefined)
		expect(readDraft()).toBe('still here')
	})

	test('capture is installed once, not stacked per render', () => {
		const handle = typedOnlyHandle()
		const ref = { current: handle } as any
		attachComposer(ref, undefined)
		const first = handle.handleTextChanged
		attachComposer(ref, undefined)
		attachComposer(ref, undefined)
		expect(handle.handleTextChanged).toBe(first)

		// Still exactly one hop from the original: a stacked wrapper would still work here, so the
		// identity check above is what actually proves it.
		handle.handleTextChanged('ok')
		expect(readDraft()).toBe('ok')
	})
})

describe('writing the draft', () => {
	test('replaceRange gets the text, the range and the editId', () => {
		const calls: any[] = []
		const handle = {
			replaceRange: (edit: any) => calls.push(edit),
			handleTextChanged: noop,
		}
		const state = { current: { text: 'abc', editId: 'edit-1' } }
		attachComposer({ current: handle } as any, state as any)

		expect(setDraft('xyz')).toBe(true)
		expect(calls).toHaveLength(1)
		expect(calls[0]).toEqual({
			location: 0,
			length: 3,
			text: 'xyz',
			editId: 'edit-1',
		})
	})

	test('a second write sees what the first one wrote', () => {
		const handle: any = { replaceRange: noop, handleTextChanged: noop }
		attachComposer({ current: handle } as any, undefined)
		const seen: any[] = []
		handle.replaceRange = (edit: any) => seen.push(edit)

		setDraft('first')
		setDraft('second')
		// Without the optimistic update the second call would still think the draft was empty.
		expect(seen[1].length).toBe('first'.length)
	})

	test('insertText is used when there is no replaceRange', () => {
		const calls: any[] = []
		const handle = {
			insertText: (...args: any[]) => calls.push(args),
			handleTextChanged: noop,
		}
		attachComposer({ current: handle } as any, undefined)
		expect(writeDraft('hi', 0, 0)).toBe(true)
		expect(calls).toHaveLength(1)
		expect(calls[0][0]).toBe('hi')
	})

	test('a handle with neither refuses instead of pretending', () => {
		attachComposer({ current: { handleTextChanged: noop } } as any, undefined)
		expect(setDraft('nope')).toBe(false)
	})
})
