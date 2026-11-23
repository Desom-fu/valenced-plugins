/**
 * The chat bar: capturing the composer, and putting the button in the row.
 *
 * ## Two components, two different problems
 *
 * - `ChatInput` (`modules/chat_input/native/ChatInput.tsx`) is where the refs are created. Wrapping
 *   its render is the only way to see `chatInputRef` — reading and writing the draft — and
 *   `chatInputStateRef`, which carries the `editId` a write needs. Found by imported path, which is
 *   how SendTweaks hooks the same component.
 * - `ChatInputRightActions` is the row that holds send. A child prepended to what it returns lands
 *   to the left of send, because a row lays its children out left to right.
 *
 * ## Why `withName` is the wrong filter here
 *
 * `withName` matches a module whose *exports* carry that name. `ChatInputRightActions` is a
 * `memo(render)` object: the export has no `name`, the name lives on `exports.type.displayName`. So
 * `withName('ChatInputRightActions')` finds nothing at all — silently, which is exactly how the
 * button came to be missing while every other part of the plugin worked. Better Chat Buttons binds
 * the same component and matches on `exports.type.displayName`; that is what this does.
 *
 * A `memo(forwardRef(render))` build instead puts the name on `exports.type.render.displayName`, so
 * both are checked.
 *
 * ## Why `getModules` and not `lookupModule`
 *
 * `lookupModule` answers once, from whatever happens to be initialised at that moment. This plugin
 * starts before Discord's chat modules finish initialising, so that answer is usually "nothing" —
 * and nothing is a permanent answer. `getModules` subscribes: it fires when the module appears, even
 * seconds later.
 *
 * ## The button follows the switch
 *
 * Patching a render function does not re-render what is already on screen, so flipping the switch
 * would not produce the button until the chat was reopened. `useReRender()` is captured inside a
 * `before` hook — that runs within the row's own hook chain, the same trick Better Chat Buttons
 * uses — and calling it re-renders the row. Storage is subscribed so the call happens on the change.
 *
 * ## Failure stays local
 *
 * The two patches are installed independently and each reports its own failure, so a build that
 * moves one of these components costs one feature rather than the plugin.
 */

import { getModuleWithImportedPath } from '@valenced/discord/utils/modules/finders'
import { getModules } from '@valenced/modules/finders'
import {
	createFilterGenerator,
	withName,
} from '@valenced/modules/finders/filters'
import { after, before } from '@valenced/patcher'
import { useReRender } from '@valenced/utils/react'
import * as React from 'react'
import { reportError } from '../../shared/report'
import { attachComposer, detachComposer, findRef } from '../lib/composer'
import { matchesMemoName, prependChild } from '../lib/composerRow'
import { getStorage, settings } from '../lib/state'
import { wrapRender } from '../lib/wrapRender'
import { ComposerTranslateButton } from '../ui/composer_button'
import type { ReactElement, ReactNode } from 'react'

const CHAT_INPUT = 'modules/chat_input/native/ChatInput.tsx'

/** What actually happened, for the Debug page and the settings warning. */
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
 * Matches a `memo`ed component by the name Discord put on it — see `lib/composerRow.ts`.
 *
 * `withName` cannot do this: it checks `exports.name`, and a `memo` object has none, which is how
 * the button came to be silently absent. That is why the match is a filter of our own.
 */
const withMemoName = createFilterGenerator<[name: string]>(
	([name], _id, exports: any) => matchesMemoName(name, exports),
	([name]) => `withMemoName(${name})`,
)

/**
 * Captures the two refs `ChatInput` passes to its children.
 *
 * `attachComposer` is a plain module-level assignment and the refs are stable objects Discord
 * reuses, so writing on every render is cheap and keeps the module pointed at the box on screen.
 */
function patchChatInput(): () => void {
	let undone: (() => void) | undefined
	const unsubscribe = getModuleWithImportedPath(CHAT_INPUT, (exports: any) => {
		if (undone) return
		undone = wrapRender(
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
		if (!undone) status.lastError = 'ChatInput had an unknown component shape'
	})

	return () => {
		unsubscribe?.()
		undone?.()
		status.input = false
	}
}

/** Prepends the button to whatever the row rendered. Exported for its test. */
export function withButton(tree: any): any {
	if (!React.isValidElement(tree)) return tree
	try {
		const button = React.createElement(ComposerTranslateButton, {
			key: 'translate-composer',
		})
		const children: any = (tree as any).props?.children
		status.inserted = true
		return React.cloneElement(
			tree as any,
			undefined,
			prependChild(children, button),
		)
	} catch (error) {
		status.lastError = String(error)
		return tree
	}
}

/** Set from the row's own render; calling it re-renders that row. */
let reRender: (() => void) | undefined

function patchRightActions(): () => void {
	const undos: Array<() => void> = []
	const install = (exports: any, how: string) => {
		if (status.row) return
		try {
			// `before` on `type` runs inside the row's render, so a hook is legal here.
			undos.push(
				before(exports, 'type', (args: any[]) => {
					try {
						reRender = useReRender()
					} catch {
						/* no hook context in this build; the switch then needs a reopen */
					}
					return args
				}),
			)
			undos.push(
				after(exports, 'type', (tree: any) =>
					settings().composerButton ? withButton(tree) : tree,
				),
			)
			status.row = true
			status.lastError = how === 'withMemoName' ? '' : `matched by ${how}`
		} catch (error) {
			status.lastError = String(error)
		}
	}

	// The memo-name filter first: it is the one that actually matches this component. The `withName`
	// pass is a fallback for a build that exports the render function under its own name.
	const unsubs = [
		getModules(withMemoName('ChatInputRightActions'), (exports: any) =>
			install(exports, 'withMemoName'),
		),
		getModules(withName('ChatInputRightActions'), (exports: any) =>
			install(exports, 'withName'),
		),
	]

	const unsubscribeStorage = getStorage()?.subscribe?.(() => {
		try {
			reRender?.()
		} catch {
			/* nothing on screen to re-render */
		}
	})

	return () => {
		for (const unsubscribe of unsubs) {
			try {
				unsubscribe?.()
			} catch {
				/* already gone */
			}
		}
		try {
			unsubscribeStorage?.()
		} catch {
			/* ditto */
		}
		for (const undo of undos) {
			try {
				undo?.()
			} catch {
				/* each patch unwinds on its own */
			}
		}
		status.row = false
		status.inserted = false
	}
}

export default function patchComposer(): () => void {
	reRender = undefined
	status.inserted = false
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
		reRender = undefined
		for (const unsubscribe of unsubs) {
			try {
				unsubscribe()
			} catch {
				/* each hook unwinds on its own */
			}
		}
		detachComposer()
		status.input = false
		status.row = false
		status.inserted = false
	}
}
