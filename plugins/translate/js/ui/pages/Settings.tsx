import * as components from '@valenced/components'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import { ReactNavigationNative } from '@valenced/externals/react-navigation'
import * as React from 'react'
import * as ReactNative from 'react-native'
import { useChangelog } from '../../../shared/changelog'
import { DEFAULTS } from '../../defaults'
import { currentUiLocale, t, UI_LOCALES } from '../../i18n'
import { languageFor } from '../../lib/languages'
import { pickerLanguages } from '../../lib/picker'
import { providerById } from '../../lib/providers'
import { getStorage } from '../../lib/state'
import { sweepNow } from '../../patches/autoTranslate'
import { composerStatus } from '../../patches/composerBar'
import { rowIcon } from '../icon'
import {
	AI_ROUTE,
	APPEARANCE_ROUTE,
	DEBUG_ROUTE,
	LANGUAGE_ROUTE,
	PICKER_ROUTE,
	SERVICE_ROUTE,
} from '../routes'
import { useBottomPadding } from '../safeArea'
import type { TranslateStorage } from '../../types'

const DEBUG: boolean = false
const UI_LANGUAGE_SHEET = 'translate-ui-language'

/** The name of a language for display: the catalogue's name, else the raw code. */
function nameOf(code: string): string {
	return languageFor(code)?.name ?? code
}

/**
 * The interface-language sheet.
 *
 * A component because `openLazy` renders it (see `ui/composer_button.tsx` for why a promise and not
 * a function). Two rows is all it needs — the setting exists so the plugin's menus can be read, and
 * the translation target is a separate question on the row above it.
 */
function UiLanguageSheet() {
	const { ActionSheet, BottomSheetTitleHeader, TableRowGroup, TableRow } =
		Design as any
	const current = currentUiLocale()

	const pick = (code: string) => {
		try {
			ActionSheetActionCreators.hideActionSheet(UI_LANGUAGE_SHEET)
		} catch {
			/* already closed */
		}
		getStorage()?.set({ uiLanguage: code })
	}

	return React.createElement(
		ActionSheet,
		null,
		BottomSheetTitleHeader
			? React.createElement(BottomSheetTitleHeader, {
					title: t('settings.uiLanguage'),
				})
			: null,
		React.createElement(
			TableRowGroup,
			null,
			UI_LOCALES.map(locale =>
				React.createElement(TableRow, {
					key: locale.code,
					label: locale.name,
					subLabel: locale.code,
					icon:
						locale.code === current ? rowIcon('CheckmarkSmallIcon') : undefined,
					onPress: () => pick(locale.code),
				}),
			),
		),
	)
}

/**
 * The root page.
 *
 * The two choices people actually come here to make — which language, and whether to translate
 * automatically — are on this page, each one tap away. Everything about how a translation looks is a
 * level down, because it is set once and forgotten.
 */
export default function Settings({
	api,
}: {
	api: ValencedPluginStartApi<TranslateStorage>
}) {
	// The changelog icon at the top right, and "What's new" once after an update.
	useChangelog()
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = components
	const { ScrollView, View } = ReactNative
	const { Stack, Text, Card, TableRowGroup, TableRow, TableSwitchRow } = Design
	const { useNavigation } = ReactNavigationNative

	const navigation = useNavigation() as { navigate: (route: string) => void }
	const s = { ...DEFAULTS, ...(api.jsonStorage.use() ?? {}) }
	const set = (patch: Partial<TranslateStorage>) => api.jsonStorage.set(patch)

	const serviceLabel =
		s.provider === 'auto'
			? t('settings.serviceAuto')
			: t('settings.servicePinned', {
					name: providerById(s.provider)?.name ?? s.provider,
				})

	const pickerCount = pickerLanguages(s.pickerLanguages).length

	const openUiLanguage = () => {
		try {
			ActionSheetActionCreators.openLazy(
				Promise.resolve({ default: UiLanguageSheet }),
				UI_LANGUAGE_SHEET,
				{},
			)
		} catch {
			/* no sheet system on this build; the pages stay in their current language */
		}
	}

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<Card variant="secondary" border="none">
						<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
							<Text color="text-default" variant="text-md/semibold">
								{t('settings.helpTitle')}
							</Text>
							<Text
								color="text-muted"
								variant="text-sm/normal"
								style={{ marginTop: 8 }}
							>
								{t('settings.helpBody')}
							</Text>
						</View>
					</Card>

					<TableRowGroup hasIcons>
						<TableRow
							label={t('settings.target')}
							subLabel={nameOf(s.target)}
							icon={rowIcon('GlobeEarthIcon')}
							arrow
							onPress={() => navigation.navigate(LANGUAGE_ROUTE)}
						/>
						<TableRow
							label={t('settings.service')}
							subLabel={serviceLabel}
							icon={rowIcon('LinkIcon', 'ic_link')}
							arrow
							onPress={() => navigation.navigate(SERVICE_ROUTE)}
						/>
						<TableRow
							label={t('settings.ownModel')}
							subLabel={
								s.aiModel && s.aiBaseUrl
									? t('settings.ownModelSet', {
											model: s.aiModel,
											url: s.aiBaseUrl,
										})
									: t('settings.ownModelUnset')
							}
							icon={rowIcon('SparklesIcon', 'MagicWandIcon')}
							arrow
							onPress={() => navigation.navigate(AI_ROUTE)}
						/>
					</TableRowGroup>

					<TableRowGroup hasIcons>
						<TableSwitchRow
							label={t('settings.autoTranslate')}
							subLabel={t('settings.autoTranslateBody', {
								language: nameOf(s.target),
							})}
							icon={rowIcon('RetryIcon', 'RefreshIcon')}
							value={!!s.autoTranslate}
							onValueChange={value => {
								set({ autoTranslate: value })
								if (value) sweepNow()
							}}
						/>
						<TableSwitchRow
							label={t('settings.composer')}
							subLabel={
								s.composerButton && !composerStatus().row
									? t('settings.composerNotFound')
									: t('settings.composerBody')
							}
							icon={rowIcon('GlobeEarthIcon')}
							value={!!s.composerButton}
							onValueChange={value => set({ composerButton: value })}
						/>
						<TableRow
							label={t('settings.pickerLanguages')}
							subLabel={t('settings.pickerLanguagesBody', {
								count: pickerCount,
							})}
							icon={rowIcon('ListIcon', 'ic_list')}
							arrow
							onPress={() => navigation.navigate(PICKER_ROUTE)}
						/>
						<TableRow
							label={t('settings.appearance')}
							subLabel={t('settings.appearanceBody')}
							icon={rowIcon('PaintPaletteIcon')}
							arrow
							onPress={() => navigation.navigate(APPEARANCE_ROUTE)}
						/>
					</TableRowGroup>

					<TableRowGroup hasIcons>
						<TableRow
							label={t('settings.uiLanguage')}
							subLabel={
								UI_LOCALES.find(locale => locale.code === s.uiLanguage)?.name ??
								s.uiLanguage
							}
							icon={rowIcon('ChatIcon', 'ic_message')}
							arrow
							onPress={openUiLanguage}
						/>
					</TableRowGroup>

					<Text color="text-muted" variant="text-sm/normal">
						{t('settings.freeServicesNote')}
					</Text>

					{DEBUG && (
						<TableRowGroup title={t('settings.developer')} hasIcons>
							<TableRow
								label={t('settings.debug')}
								subLabel={t('settings.debugBody')}
								icon={rowIcon('BugIcon', 'ic_debug')}
								arrow
								onPress={() => navigation.navigate(DEBUG_ROUTE)}
							/>
						</TableRowGroup>
					)}
				</Stack>
			</ScrollView>
		</Page>
	)
}
