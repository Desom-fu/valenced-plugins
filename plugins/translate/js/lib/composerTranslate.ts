/**
 * Translating what is in the chat box.
 *
 * ## The same pipeline as a message
 *
 * Both directions go through `translateText` in `lib/translate.ts`: same token mask, same provider
 * order, same cooldowns, same same-language rule, same restore. That is deliberate — "translate
 * what I typed" must not become a second, subtly different translator. All this file adds is the
 * two ends: read the draft, and write the answer back.
 *
 * ## What gets sent
 *
 * The draft is masked inside `translateText`, exactly like a message. That matters more here than
 * it looks: a draft is where people type @mentions, emoji and links, and a model handed `@someone`
 * may translate the name. The mask swaps each for `⟦0⟧` and the restore puts it back afterwards, so
 * what lands in the box still pings the right person.
 *
 * ## Outcomes
 *
 * Every failure ends in a toast naming the reason, because the alternative — the button does
 * nothing — is indistinguishable from the button being broken. That is not hypothetical: the first
 * release read the draft through one API that this build does not have, bailed out before doing
 * anything, and looked dead.
 */

import { t } from '../i18n'
import { composerLanguage, readDraft, setDraft } from './composer'
import { languageFor } from './languages'
import { settings, toast } from './state'
import { translateText } from './translate'

/** One translation at a time: a second tap while one is running would race on the draft. */
let busy = false

export function composerBusy(): boolean {
	return busy
}

/**
 * Translates the draft into `target` and puts the result back in the box.
 *
 * `target` defaults to whatever the language button has picked, then to the language in settings.
 * Returns whether the box was changed.
 */
export async function translateComposer(target?: string): Promise<boolean> {
	if (busy) return false

	const language = target ?? composerLanguage() ?? settings().target
	const draft = readDraft()

	// One message per cause, and each says which part failed. `readDraft` tries three routes, so
	// getting here means the box genuinely cannot be seen.
	if (draft === undefined) {
		toast(t('toast.cannotRead'))
		return false
	}
	if (!draft.trim()) {
		toast(t('toast.nothing'))
		return false
	}

	busy = true
	try {
		const outcome = await translateText(draft, language)

		if (!outcome) {
			toast(t('toast.failed'))
			return false
		}
		// The service decided the text is already in the target language. Say so: silently
		// leaving the box unchanged looks exactly like a broken button.
		if (outcome.alreadyTarget) {
			toast(
				t('toast.already', {
					language: languageFor(language)?.name ?? language,
				}),
			)
			return false
		}

		const restored = outcome.text.trim()
		if (!restored) {
			toast(t('toast.emptyReply'))
			return false
		}
		// The whole draft, replaced in place: the person keeps their attachments and their cursor
		// does not jump to the front of an empty box.
		if (!setDraft(restored)) {
			toast(t('toast.cannotWrite'))
			return false
		}
		return true
	} catch {
		toast(t('toast.failed'))
		return false
	} finally {
		busy = false
	}
}
