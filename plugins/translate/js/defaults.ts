import type { TranslateStorage } from './types'

/**
 * Also the fallback for every read: `load: true` starts the storage read without awaiting it,
 * so `jsonStorage.cache` is genuinely undefined for a short window after start.
 */
export const DEFAULTS: TranslateStorage = {
	target: 'en',
	// Automatic by default. Any one of these services can start refusing requests without
	// notice, and a plugin that dies with it would be worse than one that quietly moves on.
	provider: 'auto',
	// Off: it is a request per foreign message, and that should be a decision.
	autoTranslate: false,
	markTranslated: true,
	highlightTranslated: true,
	showProvider: false,
	showDetected: true,
	skipSameLanguage: true,
	debugLogging: false,

	// Nothing filled in: the AI provider is a deliberate choice, not a default.
	aiBaseUrl: '',
	aiApiKey: '',
	aiModel: '',
	aiEffort: 'default',
	aiPrompt: '',
	aiTemperature: 0.2,
	aiTimeoutMs: 30_000,

	composerButton: true,

	// One glance, not a scroll: the languages someone actually picks mid-sentence. Everything else
	// is still reachable from the settings page's full list, and this list is editable there.
	pickerLanguages: ['zh-CN', 'zh-TW', 'ja', 'en', 'ko', 'fr', 'de', 'ru', 'es'],

	// Empty: the chat bar buttons follow `target` until the user picks something else there.
	composerTarget: '',

	// The plugin was English-only before this setting existed, so English stays the default;
	// switching is one tap at the top of the settings page.
	uiLanguage: 'en',
}
