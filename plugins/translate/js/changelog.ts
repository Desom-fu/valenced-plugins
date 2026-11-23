import type { ChangelogEntry } from '../shared/changelog'

/** Newest first. Every version users got gets an entry; see shared/changelog.tsx. */
export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.7.0',
		date: '2026-11-23',
		title: 'Your own model, and a button in the chat bar',
		changes: [
			'Your own OpenAI-compatible endpoint: URL, key, model, and a Test connection button.',
			'The model list can be loaded from the endpoint, or typed by hand.',
			'Reasoning effort is selectable, defaulting to none at all (the cheapest option).',
			'The system prompt is editable; left empty it uses a faithful-translation prompt.',
			'A translate button left of send: tap to translate your draft, hold to pick the language.',
			'Translated rows say which model answered, not just "AI".',
			'Automatic mode still only ever uses the free services.',
			'Renamed to Translate+ with the desom-fu.translate id, so it installs alongside the original.',
		],
	},
	{
		version: '0.6.5',
		date: '2026-11-23',
		title: 'Valenced port',
		changes: [
			'Moved to the Valenced plugin API (was Revenge Next), with no change in behaviour.',
		],
	},
	{
		version: '0.6.4',
		date: '2026-10-23',
		title: 'Discord version limit removed',
		changes: ['Installs on any Discord version again.'],
	},
	{
		version: '0.6.3',
		date: '2026-10-22',
		title: 'Discord 352.2',
		changes: ['Also starts on Discord 352.2 (was 351.6 or older).'],
	},
	{
		version: '0.6.2',
		date: '2026-10-21',
		title: 'Discord version limit',
		changes: [
			"Only starts on Discord 351.6 or older, so a newer Discord build can't break it.",
		],
	},
	{
		version: '0.5.13',
		date: '2026-10-13',
		title: 'Tidy-up',
		changes: [
			'Errors now show in the Valenced plugin list instead of only the log, and the developer Debug page is gone from normal builds.',
		],
	},
	{
		version: '0.5.12',
		date: '2026-10-13',
		title: 'Discord 350.4',
		changes: [
			'Pop-up messages work on Discord 350.4. Before, showing one could crash Discord.',
		],
	},
	{
		version: '0.5.11',
		date: '2026-10-05',
		title: 'Message menu placement',
		changes: [
			'Keep Translate inside the message menu on Discord builds with unnamed components, instead of beneath the status bar.',
		],
	},
	{
		version: '0.5.10',
		date: '2026-10-03',
		title: 'Changelog',
		changes: [
			'The clock icon at the top right of the settings shows what changed in every version.',
			'After an update, a short "What\'s new" dialog lists the changes the next time you open the settings.',
		],
	},
	{
		version: '0.5.9',
		date: '2026-10-02',
		title: 'Language field',
		changes: [
			'The language code field sits in a row like the rest of the settings.',
		],
	},
	{
		version: '0.5.7',
		date: '2026-09-27',
		title: 'No more closing',
		changes: ['Long-pressing a message no longer closes Discord.'],
	},
	{
		version: '0.5.4',
		date: '2026-09-24',
		title: 'Menu fix',
		changes: [
			'The Translate row has round corners like the rest of the menu again.',
		],
	},
	{
		version: '0.5.2',
		date: '2026-09-22',
		title: 'Right message',
		changes: ['Long-press translates the message you pressed.'],
	},
	{
		version: '0.5.1',
		date: '2026-09-22',
		title: 'First release',
		changes: [
			'Translate a message in place with a long-press, and back again.',
			'Google, Bing, Yandex and MyMemory, no key needed.',
		],
	},
]
