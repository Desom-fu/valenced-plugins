import * as components from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { ReactNavigationNative } from '@valenced/externals/react-navigation'
import * as ReactNative from 'react-native'
import { DEFAULTS } from '../../defaults'
import { t } from '../../i18n'
import { PROVIDERS } from '../../lib/providers'
import { getStorage } from '../../lib/state'
import { useBottomPadding } from '../safeArea'
import type { TranslateStorage } from '../../types'

/**
 * Which service to ask first.
 *
 * Automatic is the first option and the default. Picking one only changes the *order*: a chosen
 * service that is down still falls through to the rest, because a plugin that stops working to
 * honour a setting is misreading the setting, not respecting it.
 */
export default function Service() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = components
	const { ScrollView } = ReactNative
	const { Stack, Text, TableRowGroup, TableRadioGroup, TableRadioRow } = Design
	const { useNavigation } = ReactNavigationNative

	const navigation = useNavigation() as { goBack: () => void }
	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<TableRowGroup>
						<TableRadioGroup
							defaultValue={s.provider}
							onChange={(value: string) => {
								storage?.set({
									provider: value as TranslateStorage['provider'],
								})
								navigation.goBack()
							}}
						>
							<TableRadioRow
								label={t('service.auto')}
								subLabel={t('service.autoBody')}
								value="auto"
							/>
							{PROVIDERS.map(provider => (
								<TableRadioRow
									key={provider.id}
									label={provider.name}
									subLabel={provider.note}
									value={provider.id}
								/>
							))}
						</TableRadioGroup>
					</TableRowGroup>

					<Text color="text-muted" variant="text-sm/normal">
						{t('service.note')}
					</Text>
				</Stack>
			</ScrollView>
		</Page>
	)
}
