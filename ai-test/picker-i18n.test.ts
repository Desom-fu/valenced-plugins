/**
 * The chat bar picker's list rules, and the interface language.
 *
 * Both are pure and both have a failure mode that looks like a crash or a blank screen rather than
 * an error: an off-by-one in "Move up" silently reorders someone's list, and a missing translation
 * key renders the raw key in the middle of a settings row. Cheap to pin down here.
 */

import { describe, expect, test } from 'bun:test'
import { DEFAULTS } from '../plugins/translate/js/defaults'
import {
	bindLocaleSource,
	dictionaryFor,
	t,
} from '../plugins/translate/js/i18n'
import {
	addLanguage,
	moveLanguage,
	pickerLanguages,
	removeLanguage,
} from '../plugins/translate/js/lib/picker'

describe('pickerLanguages', () => {
	test('keeps the configured order', () => {
		expect(pickerLanguages(['ja', 'en', 'zh-CN'])).toEqual([
			'ja',
			'en',
			'zh-CN',
		])
	})

	/** A code the catalogue does not know was typed deliberately; dropping it loses a setting. */
	test('keeps codes the catalogue has never heard of', () => {
		expect(pickerLanguages(['en', 'haw'])).toEqual(['en', 'haw'])
	})

	/** The setting says "show only these". Cleared means cleared, not "show everything". */
	test('an empty configuration shows nothing', () => {
		expect(pickerLanguages([])).toEqual([])
	})

	test('undefined shows nothing too; the caller passes merged defaults', () => {
		expect(pickerLanguages(undefined)).toEqual([])
	})

	test('DEFAULTS is a usable starting list', () => {
		const defaults = pickerLanguages(DEFAULTS.pickerLanguages)
		expect(defaults.length).toBeGreaterThanOrEqual(5)
		expect(defaults).toContain('zh-CN')
		expect(defaults).toContain('ja')
		expect(defaults).toContain('en')
	})

	test('junk entries are ignored rather than shown as blank rows', () => {
		expect(pickerLanguages(['en', 42 as any, null as any, '', 'ja'])).toEqual([
			'en',
			'ja',
		])
	})
})

describe('reordering', () => {
	const base = ['zh-CN', 'ja', 'en']

	test('moves one place up', () => {
		expect(moveLanguage(base, 'ja', -1)).toEqual(['ja', 'zh-CN', 'en'])
	})

	test('moves one place down', () => {
		expect(moveLanguage(base, 'ja', 1)).toEqual(['zh-CN', 'en', 'ja'])
	})

	test('the first row cannot move up, and the list is unchanged', () => {
		expect(moveLanguage(base, 'zh-CN', -1)).toEqual(base)
	})

	test('the last row cannot move down', () => {
		expect(moveLanguage(base, 'en', 1)).toEqual(base)
	})

	test('does not mutate the list it was given', () => {
		const input = [...base]
		moveLanguage(input, 'ja', -1)
		expect(input).toEqual(base)
	})

	test('an unknown code changes nothing', () => {
		expect(moveLanguage(base, 'ko', -1)).toEqual(base)
	})
})

describe('adding and removing', () => {
	const base = ['zh-CN', 'ja', 'en']

	test('adds to the end', () => {
		expect(addLanguage(base, 'ko')).toEqual(['zh-CN', 'ja', 'en', 'ko'])
	})

	test('adding something already there is a no-op', () => {
		expect(addLanguage(base, 'ja')).toEqual(base)
	})

	test('adding an empty code is a no-op', () => {
		expect(addLanguage(base, '')).toEqual(base)
	})

	test('removes by code', () => {
		expect(removeLanguage(base, 'ja')).toEqual(['zh-CN', 'en'])
	})

	test('removing something absent is a no-op', () => {
		expect(removeLanguage(base, 'ko')).toEqual(base)
	})

	test('add then remove round-trips', () => {
		expect(removeLanguage(addLanguage(base, 'ko'), 'ko')).toEqual(base)
	})
})

describe('t()', () => {
	test('answers English when nothing is bound', () => {
		bindLocaleSource(() => undefined)
		expect(t('settings.target')).toBe('Translate into')
	})

	test('follows the bound locale', () => {
		bindLocaleSource(() => 'zh-CN')
		expect(t('settings.target')).toBe('翻译成')
		bindLocaleSource(() => undefined)
	})

	test('an unknown locale falls back to English rather than blank', () => {
		bindLocaleSource(() => 'tlh')
		expect(t('settings.target')).toBe('Translate into')
		bindLocaleSource(() => undefined)
	})

	test('interpolates, and leaves an unknown placeholder alone', () => {
		bindLocaleSource(() => undefined)
		expect(t('settings.pickerLanguagesBody', { count: 9 })).toBe(
			'9 languages, in this order',
		)
		expect(t('settings.pickerLanguagesBody', {})).toBe(
			'{count} languages, in this order',
		)
	})

	test('a missing key returns the key, not undefined', () => {
		bindLocaleSource(() => undefined)
		expect(t('nothing.here')).toBe('nothing.here')
	})

	test('both dictionaries carry exactly the same keys', () => {
		// A key added to one dictionary and not the other renders the raw key in that locale, which
		// is how a settings row ends up saying `settings.composerBody`.
		const english = Object.keys(dictionaryFor('en')).sort()
		const chinese = Object.keys(dictionaryFor('zh-CN')).sort()
		const missingInChinese = english.filter(key => !chinese.includes(key))
		const missingInEnglish = chinese.filter(key => !english.includes(key))
		expect(missingInChinese).toEqual([])
		expect(missingInEnglish).toEqual([])
	})

	test('no Chinese string was left as its English source', () => {
		// Catches a pasted-but-untranslated entry, which reads as "i18n is broken" to a user.
		const english = dictionaryFor('en')
		const chinese = dictionaryFor('zh-CN')
		const untranslated = Object.keys(english).filter(
			key => chinese[key] === english[key] && /[a-z]{4}/.test(english[key]),
		)
		expect(untranslated).toEqual([])
	})
})
