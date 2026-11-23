/**
 * The chat bar picker's list, and the edits the settings page makes to it.
 *
 * Kept as pure functions so the ordering rules are testable without a Discord runtime: the
 * reorder/remove/add operations are exactly the kind of off-by-one that is invisible until someone
 * taps "Move up" on the first row and watches it disappear.
 *
 * The configured list is the whole truth. An empty list means "no configuration yet", which shows
 * everything — that is what a fresh install gets, and it is also what a user gets if they clear the
 * list by accident, which is friendlier than an empty sheet.
 */

import { LANGUAGES } from './languages'

/** The codes to show, in order. */
export function pickerLanguages(configured: string[] | undefined): string[] {
	if (!Array.isArray(configured)) return []
	const list = configured.filter(code => typeof code === 'string' && code)
	// A code the catalogue does not know is still honoured: the services accept more codes than the
	// list documents, and dropping one silently would lose a setting the user typed.
	return list
}

/** Every known language, for the "add" list. */
export function allLanguageCodes(): string[] {
	return LANGUAGES.map(language => language.code)
}

/** Is this code already in the configured list? */
export function isConfigured(
	configured: string[] | undefined,
	code: string,
): boolean {
	return pickerLanguages(configured).includes(code)
}

/**
 * Moves [code] by [delta] places, clamped.
 *
 * Returns a new array; the order is the setting, so nothing mutates in place.
 */
export function moveLanguage(
	list: string[],
	code: string,
	delta: number,
): string[] {
	const at = list.indexOf(code)
	if (at < 0) return list
	const to = Math.min(list.length - 1, Math.max(0, at + delta))
	if (to === at) return list
	const next = [...list]
	next.splice(at, 1)
	next.splice(to, 0, code)
	return next
}

export function removeLanguage(list: string[], code: string): string[] {
	return list.filter(entry => entry !== code)
}

/** Appends [code] if it is not already there. */
export function addLanguage(list: string[], code: string): string[] {
	if (!code || list.includes(code)) return list
	return [...list, code]
}
