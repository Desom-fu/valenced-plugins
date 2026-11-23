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
 * ## Reading the draft is not one call
 *
 * `getText()` is the obvious way and it is not always there. Reading only it is why the first
 * release of the chat bar button did nothing at all when tapped: the read came back `undefined`,
 * the translate function bailed out early, and a toast that the build also did not show made the
 * failure indistinguishable from a dead button.
 *
 * So the text is taken from the first of these that answers:
 *
 * 1. `handle.getText()` — authoritative when the build has it;
 * 2. `handleTextChanged` — the call Discord makes on *every* edit, wrapped here so the last text is
 *    always known (SendTweaks wraps this same method for its replace-as-you-type). This is the
 *    fallback that keeps working on a build without `getText`;
 * 3. `chatInputStateRef.current.text` — the live state, seeded on every render.
 *
 * ## Writing
 *
 * `replaceRange({ location, length, text, editId })` is the same call Discord's own emoji
 * suggestion bar uses to write back, and the native side drops it when `editId` no longer matches
 * the box — so a replacement computed against text the user has since changed cannot land in the
 * wrong place. `insertText` with an explicit range is the fallback for a build without it.
 */

import { reportError } from '../../shared/report'

export interface ComposerHandle {
	getText?: () => unknown
	getCurrentText?: () => unknown
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
	/** Some builds keep the draft as a plain property. */
	currentText?: unknown
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

/** Marks the `handleTextChanged` we installed, and keeps what it replaced for the unload. */
const CAPTURED = Symbol.for('desom-fu.translate.draftCapture')

let inputRef: Ref | undefined
let stateRef: StateRef | undefined
/** The last text the box reported. Kept because `getText` may not exist. */
let lastText: string | undefined
/** The `handleTextChanged` that was there before us, so `detachComposer` can put it back. */
let restoreTextCapture: (() => void) | undefined

/**
 * Starts recording the draft, when the handle does not offer a reader of its own.
 *
 * Wrapping is skipped when `getText` exists — there is then a reader, and adding a second source of
 * truth only invites the two to disagree. It is also skipped when the handle is already wrapped, so
 * a re-render cannot stack wrappers.
 */
function captureDraftFrom(handle: any) {
	if (!handle || typeof handle !== 'object') return
	if (typeof handle.getText === 'function') return
	if (handle[CAPTURED]) return
	const original = handle.handleTextChanged
	if (typeof original !== 'function') return

	const wrapper = function (this: unknown, ...args: any[]) {
		const result = Reflect.apply(original, this, args)
		if (typeof args[0] === 'string') lastText = args[0]
		return result
	}
	try {
		handle.handleTextChanged = wrapper
		handle[CAPTURED] = original
		restoreTextCapture = () => {
			try {
				if (handle.handleTextChanged === wrapper)
					handle.handleTextChanged = original
				delete handle[CAPTURED]
			} catch {
				/* the handle is gone with the screen; nothing to restore */
			}
			restoreTextCapture = undefined
		}
	} catch {
		/* a frozen handle leaves `getText`/state as the only routes */
	}
}

/** Called from the `ChatInput` render patch with the refs it just created. */
export function attachComposer(
	input: Ref | undefined,
	state: StateRef | undefined,
) {
	if (input) {
		inputRef = input
		captureDraftFrom(input.current)
	}
	if (state) {
		stateRef = state
		const text = state.current?.text
		if (typeof text === 'string') lastText = text
	}
}

export function detachComposer() {
	restoreTextCapture?.()
	inputRef = undefined
	stateRef = undefined
	lastText = undefined
}

/** Whether there is a chat box on screen to act on. */
export function hasComposer(): boolean {
	return Boolean(inputRef?.current)
}

/** Which read routes exist, for the settings page when something goes wrong. */
export function composerReadRoutes() {
	const handle: any = inputRef?.current
	return {
		handle: Boolean(handle),
		getText: typeof handle?.getText === 'function',
		captured: Boolean(handle?.[CAPTURED]) || typeof lastText === 'string',
		state: typeof stateRef?.current?.text === 'string',
	}
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

/** The current draft, or `undefined` when no route can answer. */
export function readDraft(): string | undefined {
	const handle: any = inputRef?.current

	for (const read of [handle?.getText, handle?.getCurrentText]) {
		if (typeof read !== 'function') continue
		try {
			const text = read.call(handle)
			if (typeof text === 'string') return text
		} catch {
			/* try the next route */
		}
	}

	const state = stateRef?.current
	if (typeof state?.text === 'string') return state.text

	if (typeof lastText === 'string') return lastText

	if (typeof handle?.currentText === 'string') return handle.currentText

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
	const handle: any = inputRef?.current
	if (!handle) return false

	const state = stateRef?.current
	const current = readDraft() ?? ''
	const rangeLength = length ?? current.length

	try {
		if (typeof handle.replaceRange === 'function') {
			// Optimistic: the box is now this text, so a second tap reads what the first wrote.
			lastText = text
			handle.replaceRange({
				location,
				length: rangeLength,
				text,
				editId: state?.editId ?? undefined,
			})
			return true
		}
		if (typeof handle.insertText === 'function') {
			lastText = text
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
 * The language the composer buttons should translate into.
 *
 * Kept here rather than in storage on purpose: it is a per-message choice ("translate this one to
 * Japanese"), not a setting, and persisting it would silently change what the next message does.
 * It starts as `undefined`, which the buttons read as "use the target from settings".
 */
let composerTarget: string | undefined

export function composerLanguage(): string | undefined {
	return composerTarget
}

export function setComposerLanguage(code: string | undefined) {
	composerTarget = code
}

/** Listeners, so the buttons re-render when the language is picked. */
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
