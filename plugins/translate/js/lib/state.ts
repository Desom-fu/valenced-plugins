import { showToast } from '../../shared/toast'
import { DEFAULTS } from '../defaults'
import { bindLocaleSource } from '../i18n'
import type { TranslateStorage } from '../types'

const DEBUG: boolean = false

export const TAG = '[Translate]'

type Storage = ValencedJsonStorageApi<TranslateStorage>

let storage: Storage | undefined

export function setStorage(value: Storage) {
	storage = value
}

/**
 * Locale comes through the storage cache rather than a stored copy.
 *
 * `i18n` imports nothing from the plugin, so this is the only edge — and reading the cache on each
 * `t()` call means a language change applies on the very next render with no subscription to keep
 * in sync. An unloaded cache answers English, which is also the fallback for every missing string.
 */
bindLocaleSource(() => {
	const value = storage?.cache?.uiLanguage
	return typeof value === 'string' ? value : undefined
})

/** Sub-pages are plain navigator routes with no plugin `api` prop, so they read through this. */
export function getStorage(): Storage | undefined {
	return storage
}

/** Never reads `cache` without a fallback. */
export function settings(): TranslateStorage {
	return { ...DEFAULTS, ...(storage?.cache ?? {}) }
}

export function debug(...args: unknown[]) {
	if (settings().debugLogging) {
		if (DEBUG) console.log(TAG, ...args)
	}
}

export function toast(content: string) {
	try {
		showToast(content, 'TranslateToast')
	} catch {
		/* a missing toast must never turn a translation into a crash */
	}
}

/**
 * The AI settings as `lib/ai.ts` wants them.
 *
 * `ai.ts` cannot import this file: `state` -> `types` -> `providers` -> `ai` is already a chain,
 * and closing the loop would make the module graph circular. So the plugin hands `ai.ts` this
 * accessor at `start()` and it reads fresh storage on every call — which also means a change on the
 * settings page applies to the next translation instead of after a reload.
 */
export function aiConfigFromStorage(): import('./ai').AiConfig {
	const s = settings()
	return {
		baseUrl: s.aiBaseUrl,
		apiKey: s.aiApiKey,
		model: s.aiModel,
		effort: (s.aiEffort || 'default') as import('./ai').ReasoningEffort,
		prompt: s.aiPrompt,
		temperature: s.aiTemperature,
		timeoutMs: s.aiTimeoutMs,
	}
}
