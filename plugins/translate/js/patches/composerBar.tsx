/**
 * The chat bar: capturing the composer, and putting the button in the row.
 *
 * ## Why two components
 *
 * - `ChatInput` (`modules/chat_input/native/ChatInput.tsx`) is where the refs are created. Wrapping
 *   its render is the only way to see `chatInputRef` — reading and writing the draft — and
 *   `chatInputStateRef`, which carries the `editId` a write needs.
 * - `ChatInputRightActions` is the row that holds send. A child prepended to what it returns lands
 *   immediately to the left of send, because a row lays its children out left to right.
 *
 * Both are wrapped with `lib/wrapRender.ts`, which handles the two shapes Discord has built memos
 * in (`memo(forwardRef(render))` and, from 350.2, `memo(render)`). Using the patcher's `instead`
 * here would join its recursion problem for no benefit: nothing else needs to compose with this.
 *
 * ## Failure stays local
 *
 * The two patches are installed independently and each reports its own failure, so a build that
 * moves one of these components costs one feature rather than the plugin. That is the same rule the
 * rest of this plugin's patches follow.
 */

import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { lookupModule } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import * as React from 'react'
import { reportError } from '../../shared/report'
import { attachComposer, detachComposer, findRef } from '../lib/composer'
import { settings } from '../lib/state'
import { wrapRender } from '../lib/wrapRender'
import { ComposerTranslateButton } from '../ui/composer_button'
import type { ReactElement, ReactNode } from 'react'

const CHAT_INPUT = 'modules/chat_input/native/ChatInput.tsx'

/** What actually happened, for the Debug page. */
const status = {
	input: false,
	row: false,
	inserted: false,
	lastError: '',
}

export function composerStatus() {
	return { ...status }
}

/**
 * Captures the two refs `ChatInput` passes to its children.
 *
 * The effect is deliberately not a hook: `attachComposer` is a plain module-level assignment, and
 * the refs are stable objects that Discord reuses, so writing on every render is cheap and keeps
 * the module pointed at the box currently on screen.
 */
function patchChatInput(): () => void {
	let done = false
	const unsubscribe = getModuleWithImportedPath(CHAT_INPUT, (exports: any) => {
		if (done) return
		const undo = wrapRender(
			exports,
			original =>
				function (this: unknown, ...args: any[]) {
					const tree = Reflect.apply(original, this, args) as ReactNode
					try {
						attachComposer(
							findRef(tree as ReactElement, 'chatInputRef'),
							findRef(tree as ReactElement, 'chatInputStateRef'),
						)
						status.input = true
					} catch (error) {
						status.lastError = String(error)
					}
					return tree
				},
		)
		if (!undo) {
			status.lastError = 'ChatInput had an unknown component shape'
			return
		}
		done = true
		pending.push(undo)
	})

	return () => {
		unsubscribe?.()
	}
}

/**
 * Prepends the button to `ChatInputRightActions`.
 *
 * Found by name (`withName`), which is what that filter exists for and what Better Chat Buttons
 * matches on for this same component. It is a `memo`, so the export shape is the same two variants
 * `wrapRender` handles.
 *
 * If the module is not initialized yet, `lookupModule` returns nothing; the settings page is not
 * open at that point in a cold start, but the chat bar is, so the practical case is a miss caused by
 * a renamed component. That is recorded and costs only the button.
 */
function patchRightActions(): () => void {
	const found: any = lookupModule(withName('ChatInputRightActions'))
	const exports = Array.isArray(found) ? found[0] : found
	if (!exports) {
		status.lastError = 'ChatInputRightActions not found'
		return () => undefined
	}

	const undo = wrapRender(
		exports,
		original =>
			function (this: unknown, ...args: any[]) {
				const tree = Reflect.apply(original, this, args) as ReactElement
				if (!settings().composerButton) return tree
				if (!tree || typeof tree !== 'object') return tree
				try {
					const button = React.createElement(ComposerTranslateButton, {
						key: 'translate-composer',
					})
					const children: any = (tree as any).props?.children
					const next = Array.isArray(children)
						? [button, ...children]
						: children
							? [button, children]
							: button
					status.inserted = true
					return React.cloneElement(tree as any, undefined, next)
				} catch (error) {
					status.lastError = String(error)
					return tree
				}
			},
	)

	if (!undo) {
		status.lastError = 'ChatInputRightActions had an unknown component shape'
		return () => undefined
	}
	status.row = true
	pending.push(undo)
	return () => undefined
}

/** Undos collected by the wrapped calls, applied on unload. */
const pending: Array<() => void> = []

export default function patchComposer(): () => void {
	pending.length = 0
	const unsubs: Array<() => void> = []

	try {
		unsubs.push(patchChatInput())
	} catch (error) {
		reportError('[Translate] could not hook the chat input:', error)
	}
	try {
		unsubs.push(patchRightActions())
	} catch (error) {
		reportError('[Translate] could not hook the chat bar row:', error)
	}

	return () => {
		for (const unsubscribe of unsubs) {
			try {
				unsubscribe()
			} catch {
				/* each hook unwinds on its own */
			}
		}
		for (const undo of pending) {
			try {
				undo()
			} catch {
				/* ditto */
			}
		}
		pending.length = 0
		detachComposer()
		status.input = false
		status.row = false
		status.inserted = false
	}
}
