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
import { FREE_PROVIDERS, providerById, translateWithChain } from './providers'
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
import type { Provider } from './providers'

/** Records the last outcome for the Debug page. Porting rule 3: report outcomes, not attempts. */
let lastOutcome = 'Nothing translated yet'

export function lastTranslateOutcome(): string {
	return lastOutcome
}

/**
 * The provider order for this run.
 *
 * `auto` is the four free services, full stop: a model must never be reached by falling back,
 * because that turns a free service's bad minute into a bill. `ai` is therefore only ever run when
 * it was named, and a named provider is tried first with the free ones behind it — a pin is a
 * preference, not an instruction to fail.
 */
function orderFor(pinned: string): Provider[] {
	if (pinned === 'auto') return FREE_PROVIDERS
	const first = providerById(pinned)
	if (!first) return FREE_PROVIDERS
	if (first.id === 'ai') return [first]
	return [first, ...FREE_PROVIDERS.filter(provider => provider.id !== first.id)]
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

	// Mentions, emoji, links, code and spoilers never reach the service (see `tokens.ts`).
	const masked = mask(trimmed.slice(0, 2000))
	// Nothing but markup: there is no prose to translate.
	if (!masked.text.replace(/⟦\s*\d+\s*⟧/g, '').trim()) {
		markInFlight(messageId, false)
		return false
	}

	try {
		let result: { text: string; detected?: string; provider: any } | undefined
		let trail = ''

		if (s.provider === 'ai') {
			// The AI path needs the masked message itself, not `(text, to, from)`, so it is called
			// here rather than through the chain. Automatic mode never reaches this branch.
			const translated = await translateWithAi(
				masked,
				s.target,
				aiConfigFromStorage(),
			)
			if (translated) {
				result = { text: translated, provider: 'ai' }
				trail = 'ai:ok'
			} else {
				trail = `ai:failed (${aiLastError()})`
			}
		} else {
			const outcome = await translateWithChain(
				masked.text,
				s.target,
				'auto',
				orderFor(s.provider),
			)
			result = outcome.result
			trail = outcome.attempts.map(a => `${a.id}:${a.outcome}`).join(' ')
		}

		debug(`${messageId}: ${trail || 'no providers tried'}`)

		if (!result) {
			lastOutcome = `all providers failed (${trail})`
			markFailed(messageId, true)
			return false
		}
		markFailed(messageId, false)

		// Same language in and out means the service found nothing to do. Worth remembering so
		// the auto sweep does not ask about it again, but not worth showing.
		if (s.skipSameLanguage && sameLanguage(result.detected, s.target)) {
			lastOutcome = `${result.provider}: already ${s.target}`
			remember(messageId, { ...result, automatic })
			return false
		}

		lastOutcome = `${result.provider} answered (${trail})`
		remember(messageId, {
			text: masked.restore(result.text),
			detected: result.detected,
			provider: result.provider,
			automatic,
			// Only for the AI provider: it is the one whose answer depends on which model was
			// picked, so the row names it instead of saying "AI".
			model: result.provider === 'ai' ? settings().aiModel : undefined,
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
