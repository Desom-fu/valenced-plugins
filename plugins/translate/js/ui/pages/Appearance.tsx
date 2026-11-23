import * as components from '@valenced/components'
import { Design } from '@valenced/discord/design'
import * as ReactNative from 'react-native'
import { DEFAULTS } from '../../defaults'
import { t } from '../../i18n'
import { getStorage } from '../../lib/state'
import { repaintShowing } from '../../lib/translate'
import { rowIcon } from '../icon'
import { useBottomPadding } from '../safeArea'
import type { TranslateStorage } from '../../types'

/**
 * How a translated message looks.
 *
 * Every switch here repaints the translations already on screen, so the effect is visible as soon
 * as it is flipped rather than on the next translation.
 */
export default function Appearance() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = components
	const { ScrollView } = ReactNative
	const { Stack, Text, TableRowGroup, TableSwitchRow } = Design

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const set = (patch: Partial<TranslateStorage>) => {
		storage?.set(patch)
		repaintShowing()
	}

	const labelOn = s.markTranslated || s.showDetected || s.showProvider

	// A live preview of the label, built the same way the row hook builds it.
	const parts: string[] = []
	if (s.markTranslated) parts.push('🌐 Translated')
	if (s.showDetected) parts.push('from Spanish')
	if (s.showProvider) parts.push('Google')
	const preview = parts.length
		? `${s.markTranslated ? '' : '🌐 '}${parts.join(' · ')}`
		: t('appearance.noLabelShort')

	return (
		<Page>
			<ScrollView contentContainerStyle={{ paddingBottom: useBottomPadding() }}>
				<Stack spacing={24}>
					<TableRowGroup title={t('appearance.marking')} hasIcons>
						<TableSwitchRow
							label={t('appearance.highlight')}
							subLabel={t('appearance.highlightBody')}
							icon={rowIcon('PaintPaletteIcon')}
							value={!!s.highlightTranslated}
							onValueChange={value => set({ highlightTranslated: value })}
						/>
						<TableSwitchRow
							label={t('appearance.label')}
							subLabel={t('appearance.labelBody')}
							icon={rowIcon('GlobeEarthIcon')}
							value={!!s.markTranslated}
							onValueChange={value => set({ markTranslated: value })}
						/>
					</TableRowGroup>

					<TableRowGroup title={t('appearance.detail')} hasIcons>
						<TableSwitchRow
							label={t('appearance.detected')}
							subLabel={t('appearance.detectedBody')}
							icon={rowIcon('ChatIcon', 'ic_message')}
							value={!!s.showDetected}
							onValueChange={value => set({ showDetected: value })}
						/>
						<TableSwitchRow
							label={t('appearance.provider')}
							subLabel={t('appearance.providerBody')}
							icon={rowIcon('LinkIcon', 'ic_link')}
							value={!!s.showProvider}
							onValueChange={value => set({ showProvider: value })}
						/>
					</TableRowGroup>

					<Text color="text-muted" variant="text-sm/normal">
						{labelOn
							? t('appearance.preview', { preview })
							: t('appearance.noLabel')}
					</Text>

					<TableRowGroup title={t('appearance.behaviour')} hasIcons>
						<TableSwitchRow
							label={t('appearance.skipSame')}
							subLabel={t('appearance.skipSameBody')}
							icon={rowIcon('CircleCheckIcon', 'ic_check')}
							value={!!s.skipSameLanguage}
							onValueChange={value => set({ skipSameLanguage: value })}
						/>
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
