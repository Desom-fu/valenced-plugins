import * as components from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { ReactNavigationNative } from '@valenced/externals/react-navigation'
import * as ReactNative from 'react-native'
import { useChangelog } from '../../../shared/changelog'
import { DEFAULTS } from '../../defaults'
import { describeCode } from '../../lib/languages'
import { providerById } from '../../lib/providers'
import { sweepNow } from '../../patches/autoTranslate'
import { composerStatus } from '../../patches/composerBar'
import { rowIcon } from '../icon'
import {
	AI_ROUTE,
	APPEARANCE_ROUTE,
	DEBUG_ROUTE,
	LANGUAGE_ROUTE,
	SERVICE_ROUTE,
} from '../routes'
import { useBottomPadding } from '../safeArea'
import type { TranslateStorage } from '../../types'

const DEBUG: boolean = false

/**
 * The root page.
 *
 * The two choices people actually come here to make -- which language, and whether to translate
 * automatically -- are on this page, each one tap away. Everything about how a translation looks
 * is a level down, because it is set once and forgotten.
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
			? 'Automatic — tries each until one answers'
			: `${providerById(s.provider)?.name ?? s.provider}, then the others if it fails`

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<Card variant="secondary" border="none">
						<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
							<Text color="text-default" variant="text-md/semibold">
								Long-press a message, tap Translate
							</Text>
							<Text
								color="text-muted"
								variant="text-sm/normal"
								style={{ marginTop: 8 }}
							>
								The message is translated where it sits, and only for you —
								nothing is sent to Discord. Long-press it again to put the
								original back.
							</Text>
						</View>
					</Card>

					<TableRowGroup hasIcons>
						<TableRow
							label="Translate into"
							subLabel={describeCode(s.target)}
							icon={rowIcon('GlobeEarthIcon')}
							arrow
							onPress={() => navigation.navigate(LANGUAGE_ROUTE)}
						/>
						<TableRow
							label="Service"
							subLabel={serviceLabel}
							icon={rowIcon('LinkIcon', 'ic_link')}
							arrow
							onPress={() => navigation.navigate(SERVICE_ROUTE)}
						/>
						<TableRow
							label="Your own model"
							subLabel={
								s.aiModel && s.aiBaseUrl
									? `${s.aiModel} at ${s.aiBaseUrl}`
									: 'Not set up — any OpenAI-compatible endpoint, with a test'
							}
							icon={rowIcon('SparklesIcon', 'MagicWandIcon')}
							arrow
							onPress={() => navigation.navigate(AI_ROUTE)}
						/>
					</TableRowGroup>

					<TableRowGroup hasIcons>
						<TableSwitchRow
							label="Translate automatically"
							subLabel={`Every message that isn't already in ${describeCode(s.target)} is translated as it arrives. Ones that clearly are get skipped on your phone, so they cost nothing.`}
							icon={rowIcon('RetryIcon', 'RefreshIcon')}
							value={!!s.autoTranslate}
							onValueChange={value => {
								set({ autoTranslate: value })
								if (value) sweepNow()
							}}
						/>
						<TableSwitchRow
							label="Translate button in the chat bar"
							subLabel={
								s.composerButton && !composerStatus().row
									? 'On — but the chat bar row was not found in this Discord build, so there is nothing to draw it in. Open the chat once; if this stays, the build moved the component.'
									: 'A button left of send. Tap it to translate what you have typed; hold it to pick the language for this message.'
							}
							icon={rowIcon('GlobeEarthIcon')}
							value={!!s.composerButton}
							onValueChange={value => set({ composerButton: value })}
						/>
						<TableRow
							label="Appearance"
							subLabel="The Translated label, the blue highlight, and what the label says"
							icon={rowIcon('PaintPaletteIcon')}
							arrow
							onPress={() => navigation.navigate(APPEARANCE_ROUTE)}
						/>
					</TableRowGroup>

					<Text color="text-muted" variant="text-sm/normal">
						Free services need no key and no account. Only MyMemory is an
						official public API; Google, Bing and Yandex are used the way their
						own websites use them, which is against their terms and can stop
						working without warning. That is why there are four, and why a
						broken one is skipped automatically. If you would rather not rely on
						them, set up your own model above and pick it on the Service page.
					</Text>

					{DEBUG && (
						<TableRowGroup title="Developer" hasIcons>
							<TableRow
								label="Debug"
								subLabel="Which service answered, and what is being skipped"
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
