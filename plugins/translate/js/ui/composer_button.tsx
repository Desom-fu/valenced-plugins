/**
 * The two buttons in the chat bar, and the language sheet behind them.
 *
 * ## Why two, not one long-press
 *
 * One button with a tap and a hold hid half its function: nothing on screen says "hold me to choose
 * a language", so the picker was effectively undiscoverable. Two buttons say what they do — one
 * shows the language it will translate into and opens the sheet, the other translates.
 *
 * ## Why the sheet never opened
 *
 * `ActionSheetActionCreators.openLazy` does not take a render function. Its first argument is a
 * **promise resolving to `{ default: Component }`** — the sheet is a real component rendered by the
 * action-sheet host, not a callback. The first version passed a function, so the call did nothing at
 * all and every tap looked ignored. This passes `Promise.resolve({ default: LanguageSheet })`, which
 * is the shape the rest of the ecosystem uses.
 *
 * ## Why the list is short and not searchable
 *
 * The sheet is what someone opens mid-sentence, so it shows exactly the languages configured in
 * settings, in that order, and nothing else. The searchable full catalogue lives in the settings
 * page, where there is room for it. Tapping a row picks the language and closes the sheet — one
 * decision, no confirm step.
 */

import * as assets from '@valenced/assets'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import * as React from 'react'
import * as ReactNative from 'react-native'
import { t } from '../i18n'
import {
	composerLanguage,
	setComposerLanguageAndNotify,
	subscribeComposerLanguage,
} from '../lib/composer'
import { composerBusy, translateComposer } from '../lib/composerTranslate'
import { languageFor, shortLabel } from '../lib/languages'
import { pickerLanguages } from '../lib/picker'
import { settings } from '../lib/state'

const BUTTON_SIZE = 32
const SHEET_KEY = 'translate-language'

/** The language these buttons will translate into: the per-message pick, else the setting. */
function useTargetLanguage(): string {
	const picked = React.useSyncExternalStore(
		subscribeComposerLanguage,
		() => composerLanguage(),
		() => composerLanguage(),
	)
	return picked ?? settings().target
}

/** A display name for a code, falling back to the code itself for anything unlisted. */
function nameOf(code: string): string {
	return languageFor(code)?.name ?? code
}

/**
 * An icon for the translate button, resolved the way the settings rows resolve theirs.
 *
 * `getAssetIdByName('GlobeEarthIcon')` returns `0` on a build where that name is not a registry
 * asset, and `TableRowIcon` with no source draws nothing at all. So the generated-component path is
 * tried too, and a text glyph is the last resort: something visible always ships.
 */
function translateGlyph(): any {
	const { TableRowIcon, Text } = Design as any
	const { getAssetIdByName } = assets as any
	const Icon = TableRowIcon ?? (Design as any).TableRow?.Icon

	const source = (() => {
		try {
			return getAssetIdByName?.('GlobeEarthIcon') || undefined
		} catch {
			return undefined
		}
	})()
	if (source && Icon) return React.createElement(Icon, { source })

	const Component = (() => {
		try {
			return (lookupGeneratedIconComponent as any)?.('GlobeEarthIcon')
		} catch {
			return undefined
		}
	})()
	if (Component) return React.createElement(Component, null)

	if (Text) {
		return React.createElement(
			Text,
			{
				color: 'text-default',
				variant: 'text-md/semibold',
				style: { textAlign: 'center' },
			},
			'文',
		)
	}
	return null
}

/** Shared shape: a 32dp touch target that matches the other chat bar buttons. */
function barButton(options: {
	key: string
	label: string
	onPress: () => void
	children: any
	busy?: boolean
}) {
	const { Pressable } = ReactNative
	return React.createElement(
		Pressable,
		{
			key: options.key,
			onPress: options.onPress,
			accessibilityRole: 'button',
			accessibilityLabel: options.label,
			style: {
				alignItems: 'center',
				height: BUTTON_SIZE,
				justifyContent: 'center',
				opacity: options.busy ? 0.5 : 1,
				width: BUTTON_SIZE,
			},
		},
		options.children,
	)
}

/** Tap to translate what is in the box, into the language the other button shows. */
export function ComposerTranslateButton(): any {
	const language = useTargetLanguage()
	const [busy, setBusy] = React.useState(false)

	const onPress = React.useCallback(() => {
		if (busy || composerBusy()) return
		setBusy(true)
		translateComposer(language)
			.catch(() => undefined)
			.finally(() => setBusy(false))
	}, [busy, language])

	return barButton({
		key: 'translate-composer',
		label: t('bar.translateInto', { language: nameOf(language) }),
		onPress,
		busy,
		children: translateGlyph(),
	})
}

/** Tap to choose the language; the code on it is what the translate button will use. */
export function ComposerLanguageButton(): any {
	const language = useTargetLanguage()
	const { Text } = Design as any

	const onPress = React.useCallback(() => {
		openLanguagePicker(language)
	}, [language])

	return barButton({
		key: 'translate-composer-language',
		label: t('bar.languageLabel', { language: nameOf(language) }),
		onPress,
		children: Text
			? React.createElement(
					Text,
					{
						color: 'text-default',
						variant: 'text-xs/semibold',
						style: { textAlign: 'center' },
					},
					shortLabel(language),
				)
			: null,
	})
}

/**
 * The sheet itself.
 *
 * A component, because `openLazy` renders it — see the note at the top of this file. It reads the
 * configured list at render time, so editing that list in settings changes the sheet without a
 * reload.
 */
function LanguageSheet({ current }: { current: string }) {
	const { ActionSheet, BottomSheetTitleHeader, TableRowGroup, TableRow } =
		Design as any
	const { getAssetIdByName } = assets as any
	const check = getAssetIdByName?.('CheckmarkSmallIcon')
	const Icon = (Design as any).TableRowIcon ?? (Design as any).TableRow?.Icon

	// The configured order, resolved to names. A code with no catalogue entry still shows — someone
	// may have typed `haw` deliberately.
	const codes = pickerLanguages(settings().pickerLanguages)
	const rows = codes.map(code => {
		const language = languageFor(code)
		return {
			code,
			label: language?.name ?? code,
			subLabel:
				language && language.native !== language.name
					? `${language.native} · ${code}`
					: code,
		}
	})

	const pick = (code: string) => {
		setComposerLanguageAndNotify(code)
		try {
			ActionSheetActionCreators.hideActionSheet(SHEET_KEY)
		} catch {
			/* the sheet closes itself in some builds */
		}
	}

	return React.createElement(
		ActionSheet,
		null,
		BottomSheetTitleHeader
			? React.createElement(BottomSheetTitleHeader, {
					title: t('bar.pickTitle'),
				})
			: null,
		rows.length
			? React.createElement(
					TableRowGroup,
					{ hasIcons: true },
					rows.map(row =>
						React.createElement(TableRow, {
							key: row.code,
							label: row.label,
							subLabel: row.subLabel,
							...(Icon && check && row.code === current
								? { icon: React.createElement(Icon, { source: check }) }
								: {}),
							onPress: () => pick(row.code),
						}),
					),
				)
			: React.createElement(
					TableRowGroup,
					null,
					React.createElement(TableRow, {
						label: t('bar.noLanguages'),
						disabled: true,
					}),
				),
	)
}

/** Opens the sheet. `openLazy(sheetPromise, key, props)` — a promise, not a function. */
export function openLanguagePicker(current: string) {
	try {
		ActionSheetActionCreators.openLazy(
			Promise.resolve({ default: LanguageSheet }),
			SHEET_KEY,
			{ current } as any,
		)
	} catch {
		/* no sheet system on this build; the buttons keep the current language */
	}
}
