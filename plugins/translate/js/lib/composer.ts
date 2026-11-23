/**
 * The composer handle: reading the draft, and putting a translation back into it.
 *
 * ## How the handle is reached
 *
 * Discord's `ChatInput` (`modules/chat_input/native/ChatInput.tsx`) renders and passes two refs
 * down to its children: `chatInputRef`, the input's imperative handle, and `chatInputStateRef`,
 * its live text / caret / `editId`. Other plugins in this ecosystem read them exactly this way, so
 * this is the established route rather than a guess.
 *
 * What the handle offers, as used here:
 *
 * - `getText()` — the current draft, which is what has to be translated.
 * - `replaceRange({ location, length, text, editId })` — the same call Discord's own emoji
 *   suggestion bar uses to write back. The native side drops the call when `editId` no longer
 *   matches the box, so a replacement computed against text the user has since changed cannot land
 *   in the wrong place.
 * - `insertText(text, location?, addSpace?)` — the fallback for a build without `replaceRange`.
 * - `handleTextChanged(text)` — what Discord calls on every edit; wrapped here only so `editId`
 *   stays current.
 *
 * ## Why a module-level ref and not a prop
 *
 * `ChatInputRightActions` (where the button lives) is rendered *inside* `ChatInput`, so the tree it
 * is patched on contains the ref that the outer component created. The ref is captured on every
 * render of the input itself and kept here, which is also why the button always acts on the box
 * that is actually on screen.
 */

import { reportError } from '../../shared/report'

export interface ComposerHandle {
	getText?: () => unknown
	replaceRange?: (edit: {
		location: number
		length: number
		text: string
		editId?: string
	}) => void
	insertText?: (
		text: string,
		location?: number,
		addSpace?: boolean,
		...rest: unknown[]
	) => void
	handleTextChanged?: (text: string) => void
}

interface Ref {
	current?: ComposerHandle | null
}

interface StateRef {
	current?: {
		text?: string
		selectionStart?: number
		selectionEnd?: number
		editId?: string
	} | null
}

let inputRef: Ref | undefined
let stateRef: StateRef | undefined

/** Called from the `ChatInput` render patch with the refs it just created. */
export function attachComposer(
	input: Ref | undefined,
	state: StateRef | undefined,
) {
	if (input) inputRef = input
	if (state) stateRef = state
}

export function detachComposer() {
	inputRef = undefined
	stateRef = undefined
}

/** Whether there is a chat box on screen to act on. */
export function hasComposer(): boolean {
	return Boolean(inputRef?.current)
}

/** Find a ref Discord passes down, without relying on component names. */
export function findRef(node: any, prop: string, depth = 0): any {
	if (!node || typeof node !== 'object' || depth > 12) return undefined
	if (Array.isArray(node)) {
		for (const child of node) {
			const ref = findRef(child, prop, depth + 1)
			if (ref) return ref
		}
		return undefined
	}
	const ref = node.props?.[prop]
	if (ref && typeof ref === 'object' && 'current' in ref) return ref
	return findRef(node.props?.children, prop, depth + 1)
}

/** The current draft, or `undefined` when the box cannot be read. */
export function readDraft(): string | undefined {
	const handle = inputRef?.current
	if (!handle) return undefined
	try {
		const text = handle.getText?.()
		if (typeof text === 'string') return text
	} catch {
		/* fall through to the state ref */
	}
	// A build without `getText` still keeps the live text on the state ref.
	const state = stateRef?.current
	if (state && typeof state.text === 'string') return state.text
	return undefined
}

/**
 * Replaces the whole draft, or a range of it.
 *
 * Returns whether it landed. `replaceRange` is preferred because it goes through the same path the
 * suggestion bar uses and keeps the caret sane; `insertText` with an explicit range is the
 * fallback for a build that lacks it.
 */
export function writeDraft(
	text: string,
	location = 0,
	length?: number,
): boolean {
	const handle = inputRef?.current
	if (!handle) return false

	const state = stateRef?.current
	const current = readDraft() ?? ''
	const rangeLength = length ?? current.length

	try {
		if (typeof handle.replaceRange === 'function') {
			handle.replaceRange({
				location,
				length: rangeLength,
				text,
				editId: state?.editId ?? undefined,
			})
			return true
		}
		if (typeof handle.insertText === 'function') {
			handle.insertText(
				text,
				location,
				false,
				undefined,
				location + rangeLength,
			)
			return true
		}
	} catch (error) {
		reportError('[Translate] writing to the chat box failed:', error)
	}
	return false
}

/** Replaces the entire draft with `text`. */
export function setDraft(text: string): boolean {
	return writeDraft(text, 0, (readDraft() ?? '').length)
}

/**
 * The language the composer button should translate into.
 *
 * Kept here rather than in storage on purpose: it is a per-message choice ("translate this one to
 * Japanese"), not a setting, and persisting it would silently change what the next message does.
 * It starts as `undefined`, which the button reads as "use the target from settings".
 */
let composerTarget: string | undefined

export function composerLanguage(): string | undefined {
	return composerTarget
}

export function setComposerLanguage(code: string | undefined) {
	composerTarget = code
}

/** Listeners, so the button re-renders when the language is picked. */
const listeners = new Set<() => void>()

export function subscribeComposerLanguage(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function setComposerLanguageAndNotify(code: string | undefined) {
	composerTarget = code
	for (const listener of listeners) {
		try {
			listener()
		} catch {
			/* a listener must never break the picker */
		}
	}
}
