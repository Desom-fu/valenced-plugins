/**
 * Translating one message, and putting it back.
 *
 * The result rewrites the row rather than arriving as a second message, so the two directions are
 * symmetrical: the same sheet row translates and untranslates, and untranslating restores the
 * original exactly because the original was never changed — only what `RowManager.generate`
 * produced from it was.
 *
 * A translation is fetched once and kept, so toggling back and forth after that is instant and
 * free.
 */

import { Stores } from '@valenced/discord/flux'
import { aiLastError, translateWithAi } from './ai'
import { providerPlan, translateWithChain } from './providers'
import { repaintMessage } from './repaint'
import { aiConfigFromStorage, debug, settings, toast } from './state'
import { mask } from './tokens'
import {
	hasFailed,
	isInFlight,
	isShowing,
	markFailed,
	markInFlight,
	remember,
	setShowing,
	showingIds,
	translationFor,
} from './translations'

/** Records the last outcome for the Debug page. Porting rule 3: report outcomes, not attempts. */
let lastOutcome = 'Nothing translated yet'

export function lastTranslateOutcome(): string {
	return lastOutcome
}

/**
 * Whether two codes name the same language, ignoring region and script.
 *
 * Compared on the base code because the services spell things differently: Bing reports
 * `zh-Hans` for text the plugin stores as `zh-CN`, and a prefix match on the full string would
 * decide those were different languages and "translate" Chinese into Chinese.
 */
function sameLanguage(detected: string | undefined, target: string): boolean {
	if (!detected) return false
	const base = (code: string) => code.toLowerCase().split(/[-_]/)[0]
	return base(detected) === base(target)
}

/** What the sheet row should say for this message right now. */
export type RowState = 'translate' | 'show-original' | 'working'

export function rowStateFor(messageId: string): RowState {
	if (isInFlight(messageId)) return 'working'
	return isShowing(messageId) ? 'show-original' : 'translate'
}

/** What `translateText` came back with. */
export interface TextTranslation {
	/** The translation, unmasked and ready to show or to write into the box. */
	text: string
	detected?: string
	provider: any
	/** Only set for the AI provider, whose answer depends on which model was picked. */
	model?: string
	/** Which services were tried, worst-last, for the Debug page. */
	trail: string
	/** The service said the text is already in the target language. */
	alreadyTarget: boolean
}

/**
 * Translates one piece of text. The single place the provider decision is made.
 *
 * Both callers go through here — a message on screen (`fetchTranslation`) and a draft in the chat
 * box (`lib/composerTranslate.ts`) — so "translate what I typed" cannot drift from "translate that
 * message": same mask, same provider order, same same-language rule, same restore.
 *
 * `automatic` mode never reaches a paid endpoint; a pinned provider is tried first with the free
 * services behind it. Returns `undefined` when nothing answered.
 */
export async function translateText(
	text: string,
	target: string,
): Promise<TextTranslation | undefined> {
	const trimmed = typeof text === 'string' ? text.trim() : ''
	if (!trimmed) return undefined

	const s = settings()

	// Mentions, emoji, links, code and spoilers never reach the service (see `tokens.ts`).
	const masked = mask(trimmed.slice(0, 2000))
	// Nothing but markup: there is no prose to translate.
	if (!masked.text.replace(/⟦\s*\d+\s*⟧/g, '').trim()) return undefined

	let result: { text: string; detected?: string; provider: any } | undefined
	let trail = ''

	const plan = providerPlan(s.provider)

	if (plan.model) {
		// The AI path needs the masked text itself, not `(text, to, from)`, so it is called here
		// rather than through the chain. Bad key, no credit, model down, unsupported field: any of
		// those falls through to the free services below rather than failing the translation.
		const translated = await translateWithAi(
			masked,
			target,
			aiConfigFromStorage(),
		)
		if (translated) {
			result = { text: translated, provider: 'ai' }
			trail = 'ai:ok'
		} else {
			trail = `ai:failed (${aiLastError()})`
		}
	}

	// The model is the top of the chain, not the end of it: when it did not answer — or was not
	// asked — the free services run exactly as automatic mode would.
	if (!result) {
		const outcome = await translateWithChain(
			masked.text,
			target,
			'auto',
			plan.free,
		)
		result = outcome.result
		const freeTrail = outcome.attempts
			.map(a => `${a.id}:${a.outcome}`)
			.join(' ')
		trail = trail ? `${trail} ${freeTrail}` : freeTrail
	}

	debug(`translateText: ${trail || 'no providers tried'}`)

	if (!result) {
		lastOutcome = `all providers failed (${trail})`
		return undefined
	}

	return {
		text: masked.restore(result.text),
		detected: result.detected,
		provider: result.provider,
		model: result.provider === 'ai' ? s.aiModel : undefined,
		trail,
		alreadyTarget: s.skipSameLanguage && sameLanguage(result.detected, target),
	}
}

/**
 * Fetches a translation and stores it. Does not decide whether to show it.
 *
 * @returns whether there is now a translation to show.
 */
export async function fetchTranslation(
	messageId: string,
	text: string,
	automatic: boolean,
): Promise<boolean> {
	if (translationFor(messageId)) return true
	if (isInFlight(messageId)) return false
	if (automatic && hasFailed(messageId)) return false

	const trimmed = typeof text === 'string' ? text.trim() : ''
	if (!trimmed) return false

	const s = settings()
	markInFlight(messageId, true)

	try {
		const outcome = await translateText(trimmed, s.target)

		if (!outcome) {
			markFailed(messageId, true)
			return false
		}
		markFailed(messageId, false)

		// Same language in and out means the service found nothing to do. Worth remembering so
		// the auto sweep does not ask about it again, but not worth showing.
		if (outcome.alreadyTarget) {
			lastOutcome = `${outcome.provider}: already ${s.target}`
			remember(messageId, {
				text: outcome.text,
				detected: outcome.detected,
				provider: outcome.provider,
				automatic,
				model: outcome.model,
			})
			return false
		}

		lastOutcome = `${outcome.provider} answered (${outcome.trail})`
		remember(messageId, {
			text: outcome.text,
			detected: outcome.detected,
			provider: outcome.provider,
			automatic,
			model: outcome.model,
		})
		return true
	} finally {
		markInFlight(messageId, false)
	}
}

/**
 * The sheet row's action: translate if it is showing the original, restore if it is not.
 */
export async function toggleTranslation(
	channelId: string,
	messageId: string,
	text: string,
) {
	if (isInFlight(messageId)) return

	if (isShowing(messageId)) {
		setShowing(messageId, false)
		repaintMessage(channelId, messageId)
		return
	}

	const cached = translationFor(messageId)
	if (cached) {
		setShowing(messageId, true)
		repaintMessage(channelId, messageId)
		return
	}

	toast('Translating…')
	const ok = await fetchTranslation(messageId, text, false)

	if (!ok) {
		const stored = translationFor(messageId)
		toast(
			stored
				? `Already in ${settings().target}`
				: 'Could not translate that — see Translate > Debug',
		)
		return
	}

	setShowing(messageId, true)
	repaintMessage(channelId, messageId)
}

/** Restores every message currently showing a translation, in the open channel. */
export function showAllOriginals(channelId: string): number {
	const ids = showingIds()
	for (const id of ids) {
		setShowing(id, false)
		repaintMessage(channelId, id)
	}
	return ids.length
}

/**
 * Redraws every translated row in the open channel, so a change to how translations are shown
 * applies to the ones already on screen rather than only to the next one.
 */
export function repaintShowing(ids: string[] = showingIds()): number {
	let channelId: string | undefined
	try {
		const id = (Stores as any)?.SelectedChannelStore?.getChannelId?.()
		channelId = typeof id === 'string' && id ? id : undefined
	} catch {
		channelId = undefined
	}
	if (!channelId) return 0

	let count = 0
	for (const id of ids) {
		// Ids from other channels are simply not in this channel's store, and repaintMessage
		// declines them without a dispatch.
		if (repaintMessage(channelId, id)) count++
	}
	return count
}
