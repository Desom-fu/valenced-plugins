/**
 * The translate button in the chat bar, and the language picker behind it.
 *
 * ## The button
 *
 * Drawn from the design system's own parts rather than by reusing `ChatInputActionButton`: that
 * component takes an `icon` asset and no `onLongPress`, and this button needs both a tap and a
 * hold. A 32dp pressable with the same globe the sheet row uses sits in the row without looking
 * foreign, and holding it is what opens the picker.
 *
 * ## The picker
 *
 * A searchable list of languages in the client's own sheet, because the languages don't fit on one
 * screen on a phone. The picker writes the code into `lib/composer.ts` (which is where the per
 * message choice lives) and the button re-renders through a subscription, so the two do not need to
 * share a tree.
 *
 * ## Why the picker is the client's action sheet
 *
 * `ActionSheetActionCreators.openLazy` is how every sheet in this app is opened, and
 * `TableRow`/`TableRowGroup` are the rows inside them — the same components the message sheet here
 * already uses for its Translate row. Building it from those means the picker matches the rest of
 * the client and closes the way the user expects.
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
import { describeCode, LANGUAGES } from '../lib/languages'
import { settings } from '../lib/state'

const BUTTON_SIZE = 32

/**
 * The icon, resolved the same way the settings rows resolve theirs.
 *
 * `getAssetIdByName('GlobeEarthIcon')` returns `0` on a build where that name is not a registry
 * asset, and a `TableRowIcon` with no source draws nothing — a 32dp invisible tap target, which
 * reads as "the button is missing" rather than as an icon lookup miss. So the generated-component
 * path is tried too, and a plain text glyph is the last resort: something visible always ships.
 */
function buttonGlyph(): any {
	const { TableRowIcon, Text } = Design as any
	const { getAssetIdByName } = assets as any
	const lookupComponent = lookupGeneratedIconComponent as any

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
			return lookupComponent?.('GlobeEarthIcon')
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
				style: { lineHeight: BUTTON_SIZE, textAlign: 'center' },
			},
			'A文',
		)
	}
	return null
}

/**
 * The button.
 *
 * `useSyncExternalStore` so the picker, which lives in a sheet outside this tree, can change the
 * language and have the label follow.
 */
export function ComposerTranslateButton(): any {
	const target = React.useSyncExternalStore(subscribeComposerLanguage, () =>
		composerLanguage(),
	)
	const [busy, setBusy] = React.useState(false)

	const { Pressable } = ReactNative

	const language = target ?? settings().target

	const onPress = React.useCallback(() => {
		if (busy || composerBusy()) return
		setBusy(true)
		translateComposer(language)
			.catch(() => undefined)
			.finally(() => setBusy(false))
	}, [busy, language])

	const onLongPress = React.useCallback(() => {
		openLanguagePicker(language)
	}, [language])

	return React.createElement(
		Pressable,
		{
			onPress,
			onLongPress,
			delayLongPress: 400,
			accessibilityRole: 'button',
			accessibilityLabel: `Translate into ${describeCode(language)}. Hold to change the language.`,
			style: {
				alignItems: 'center',
				height: BUTTON_SIZE,
				justifyContent: 'center',
				opacity: busy ? 0.5 : 1,
				width: BUTTON_SIZE,
			},
		},
		buttonGlyph(),
	)
}

/**
 * The language picker.
 *
 * `openLazy` is called with a render function whose result becomes the sheet's content, which is
 * how the client's own sheets are built. Tapping a row writes the choice and closes the sheet;
 * there is no confirm step, because picking a language *is* the decision.
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
