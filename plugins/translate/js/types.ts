import type { ProviderId } from './lib/providers'

export interface TranslateStorage {
	/** Language to translate into. An ISO code Discord's users would recognise, e.g. "en". */
	target: string
	/**
	 * `auto` lets the chain pick: every provider is tried in order until one answers.
	 *
	 * Anything else pins a single service. Pinning is for when you have a preference; automatic
	 * is for when you want it to keep working.
	 */
	provider: ProviderId | 'auto'
	/**
	 * A line under every translated message saying so. On by default: a rewritten row is
	 * otherwise indistinguishable from what the author actually wrote.
	 */
	markTranslated: boolean
	/**
	 * A blue background and left bar on translated messages, the same way a mention is
	 * highlighted. Never replaces a highlight the message already has.
	 */
	highlightTranslated: boolean
	/** Say which service answered, under the translation. */
	showProvider: boolean
	/** Say what language it came from, when the service reports one. */
	showDetected: boolean
	/**
	 * Translate every message that does not look like it is already in the target language,
	 * without being asked.
	 *
	 * Filtered locally first (`lib/detect.ts`) so the obvious majority costs nothing, then
	 * capped per sweep -- see the note at the top of `patches/autoTranslate.ts`.
	 */
	autoTranslate: boolean
	/** Skip the work when the message is already in the target language. */
	skipSameLanguage: boolean
	debugLogging: boolean

	// --- your own model -----------------------------------------------------

	/**
	 * Base URL of an OpenAI-compatible endpoint, e.g. `https://api.openai.com/v1`.
	 *
	 * Stored in the plugin's own storage file, which is local to the device. Empty means the AI
	 * provider is not configured and the settings row says so.
	 */
	aiBaseUrl: string
	/** Bearer token for that endpoint. Sent only to `aiBaseUrl`. */
	aiApiKey: string
	/** Model id as the server names it. */
	aiModel: string
	/**
	 * Passed through as `reasoning_effort` when it is not `default`.
	 *
	 * `default` sends no field at all, which is what the cheaper models expect and what costs the
	 * least to get a translation out of. See `lib/ai.ts`.
	 */
	aiEffort: string
	/** System prompt. Empty means the built-in faithful-translation prompt. */
	aiPrompt: string
	/** Sampling temperature. */
	aiTemperature: number
	/** Per-request timeout, in milliseconds. */
	aiTimeoutMs: number

	// --- the composer button ------------------------------------------------

	/**
	 * Show the translate button at the left of send.
	 *
	 * On by default: it is the whole point of the feature, and it costs one square of chat bar.
	 */
	composerButton: boolean

	// --- the chat bar picker ------------------------------------------------

	/**
	 * Which languages the chat bar picker offers, in the order it offers them.
	 *
	 * Only these are shown — the picker is a short list, not a searchable catalogue (that is the
	 * settings page). Deliberately limited to what someone actually reaches for while typing, so
	 * the sheet is one glance instead of a scroll.
	 */
	pickerLanguages: string[]

	/**
	 * The language the chat bar buttons translate into. Empty means "use `target`".
	 *
	 * Stored rather than per-message: a pick made in the chat bar is meant to stick, including
	 * across a restart.
	 */
	composerTarget: string

	// --- the plugin's own interface -----------------------------------------

	/**
	 * Language of the settings pages. Not the translation target — see `target`.
	 *
	 * `'en'` or `'zh-CN'`; unknown values fall back to English.
	 */
	uiLanguage: string
}
