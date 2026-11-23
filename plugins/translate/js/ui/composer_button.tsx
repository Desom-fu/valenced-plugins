/**
 * The two buttons in the chat bar, and the language picker behind them.
 *
 * ## Why two, not one long-press
 *
 * One button with a tap and a hold hid half its function: nothing on screen says "hold me to choose
 * a language", so the picker was effectively undiscoverable. Two buttons say what they do — one
 * shows the language it will translate into and opens the picker when tapped, the other translates.
 *
 * ## What they are built from
 *
 * `ChatInputActionButton` (the component that draws send and the other round buttons) takes an icon
 * asset and no label, so the language button — which has to *show a code* — is a `Pressable` of its
 * own with the same 32dp footprint. The translate button uses a generated icon when the build has
 * one, and a text glyph when it does not, because a `TableRowIcon` with no source draws nothing and
 * an invisible 32dp target reads as a missing button.
 *
 * ## The picker
 *
 * A searchable list of languages in the client's own sheet, because they do not fit on one phone
 * screen. `ActionSheetActionCreators.openLazy` is how every sheet in this app opens and
 * `TableRow`/`TableRowGroup` are the rows inside them — the same parts the message sheet already
 * uses for its Translate row, so it matches the rest of the client and closes the way people expect.
 */

import * as assets from '@valenced/assets'
import * as actions from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import * as React from 'react'
import * as ReactNative from 'react-native'
import {
	composerLanguage,
	setComposerLanguageAndNotify,
	subscribeComposerLanguage,
} from '../lib/composer'
import { composerBusy, translateComposer } from '../lib/composerTranslate'
import { describeCode, LANGUAGES, shortLabel } from '../lib/languages'
import { settings } from '../lib/state'

const BUTTON_SIZE = 32

/** The language these buttons will translate into: the per-message pick, else the setting. */
function useTargetLanguage(): string {
	const picked = React.useSyncExternalStore(
		subscribeComposerLanguage,
		() => composerLanguage(),
		() => composerLanguage(),
	)
	return picked ?? settings().target
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

/** Shared shape: a 32dp round-ish touch target that matches the other chat bar buttons. */
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
		label: `Translate into ${describeCode(language)}`,
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
		label: `Language: ${describeCode(language)}. Tap to change.`,
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
 * The language picker.
 *
 * `openLazy` is called with a render function whose result becomes the sheet's content, which is how
 * the client's own sheets are built. Tapping a row writes the choice and closes the sheet; there is
 * no confirm step, because picking a language *is* the decision.
 */
export function openLanguagePicker(current: string) {
	const content = () => {
		const { TableRow, TableRowGroup } = Design as any
		const { getAssetIdByName } = assets as any
		const check = getAssetIdByName?.('CheckmarkSmallIcon')
		const Icon = (Design as any).TableRowIcon ?? (Design as any).TableRow?.Icon

		return React.createElement(
			TableRowGroup,
			null,
			LANGUAGES.map(language =>
				React.createElement(TableRow, {
					key: language.code,
					label: language.name,
					subLabel: language.native,
					// Only the current one gets a tick; the rest keep the same left gutter.
					...(Icon && check && language.code === current
						? { icon: React.createElement(Icon, { source: check }) }
						: {}),
					onPress: () => {
						setComposerLanguageAndNotify(language.code)
						try {
							;(actions as any).ActionSheetActionCreators?.hideActionSheet()
						} catch {
							/* the sheet closes itself in some builds */
						}
					},
				}),
			),
		)
	}

	try {
		;(actions as any).ActionSheetActionCreators?.openLazy(
			content,
			'translate-language',
			{},
		)
	} catch {
		/* no sheet available on this build; the button keeps its current language */
	}
}
