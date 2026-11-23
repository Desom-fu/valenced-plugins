/**
 * Translating what is in the chat box.
 *
 * ## The same pipeline as a message, minus the row
 *
 * A message translation rewrites a row on screen. This one writes back into the composer, so it
 * cannot reuse `fetchTranslation` — that one is keyed by message id and stores a translation for
 * the row hook to draw. Everything around it is shared: the provider order, the cooldown chain, the
 * token mask, and which provider the settings choose. So the AI-vs-free decision made in
 * `translate.ts` is made here too, by calling the same two things.
 *
 * ## What gets sent
 *
 * The draft is masked first (`tokens.ts`), exactly like a message. That matters more here than it
 * looks: a draft is where people type @mentions, emoji and links, and a model handed `@someone`
 * may translate the name. The mask swaps each for `⟦0⟧` and `restore` puts it back afterwards, so
 * what lands in the box still pings the right person.
 *
 * ## Outcomes
 *
 * Every failure ends in a toast with a reason, because the alternative — the button does nothing —
 * is indistinguishable from the button being broken. On success the box is replaced in one
 * `replaceRange`, so undo is a normal undo and the caret stays sane.
 */

import { translateWithAi } from './ai'
import { composerLanguage, readDraft, setDraft } from './composer'
import { FREE_PROVIDERS, providerById, translateWithChain } from './providers'
import { aiConfigFromStorage, settings, toast } from './state'
import { mask } from './tokens'

/** One translation at a time: a second tap while one is running would race on the draft. */
let busy = false

export function composerBusy(): boolean {
	return busy
}

/**
 * Translates the draft into `target` and puts the result back in the box.
 *
 * `target` defaults to whatever the composer button has picked, then to the language in settings.
 * Returns whether the box was changed.
 */
export async function translateComposer(target?: string): Promise<boolean> {
	if (busy) return false

	const language = target ?? composerLanguage() ?? settings().target
	const draft = readDraft()
	if (draft === undefined) {
		toast('Could not read the message box')
		return false
	}
	const trimmed = draft.trim()
	if (!trimmed) {
		toast('Nothing to translate')
		return false
	}

	busy = true
	try {
		const masked = mask(trimmed.slice(0, 4000))
		// Nothing but markup: there is no prose in here.
		if (!masked.text.replace(/⟦\s*\d+\s*⟧/g, '').trim()) {
			toast('Nothing to translate')
			return false
		}

		const s = settings()
		let translated: string | undefined

		if (s.provider === 'ai') {
			translated = await translateWithAi(
				masked,
				language,
				aiConfigFromStorage(),
			)
			if (!translated) {
				toast('Could not translate — check the AI settings')
				return false
			}
		} else {
			const first = s.provider === 'auto' ? undefined : providerById(s.provider)
			// Same rule as message translation: automatic never reaches a paid endpoint.
			const order = first
				? [first, ...FREE_PROVIDERS.filter(p => p.id !== first.id)]
				: FREE_PROVIDERS
			const { result } = await translateWithChain(
				masked.text,
				language,
				'auto',
				order,
			)
			if (!result) {
				toast('Could not translate — see Translate+ > Debug')
				return false
			}
			translated = result.text
		}

		const restored = masked.restore(translated).trim()
		if (!restored) {
			toast('The service returned nothing')
			return false
		}
		// The whole draft, replaced in place: the person keeps their attachments and their cursor
		// does not jump to the front of an empty box.
		if (!setDraft(restored)) {
			toast('Could not write to the message box')
			return false
		}
		return true
	} catch {
		toast('Could not translate — see Translate+ > Debug')
		return false
	} finally {
		busy = false
	}
}
