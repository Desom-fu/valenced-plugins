/**
 * Which languages the chat bar offers, and in what order.
 *
 * The chat bar sheet is deliberately a short list — the few languages someone actually reaches for
 * mid-sentence — so this page is where that list is decided. It is ordered, because "Chinese, then
 * Japanese" is a real preference and alphabetical order ignores it.
 *
 * Tapping a shown language opens a small sheet with Move up / Move down / Remove: three actions on
 * one row would need trailing buttons, and the sheet is what this client uses for exactly this.
 */

import * as components from '@valenced/components'
import { ActionSheetActionCreators } from '@valenced/discord/actions'
import { Design } from '@valenced/discord/design'
import * as React from 'react'
import * as ReactNative from 'react-native'
import { DEFAULTS } from '../../defaults'
import { t } from '../../i18n'
import { LANGUAGES, languageFor } from '../../lib/languages'
import {
	addLanguage,
	moveLanguage,
	pickerLanguages,
	removeLanguage,
} from '../../lib/picker'
import { getStorage } from '../../lib/state'
import { rowIcon } from '../icon'
import { useBottomPadding } from '../safeArea'

const SHEET_KEY = 'translate-picker-order'

/**
 * The per-language actions.
 *
 * A component because `openLazy` renders it; the props carry the code and the positions so the rows
 * can disable themselves at the ends.
 */
function OrderSheet({
	code,
	at,
	last,
	onMove,
	onRemove,
}: {
	code: string
	at: number
	last: number
	onMove: (delta: number) => void
	onRemove: () => void
}) {
	const { ActionSheet, BottomSheetTitleHeader, TableRowGroup, TableRow } =
		Design as any
	const language = languageFor(code)

	const run = (fn: () => void) => () => {
		try {
			ActionSheetActionCreators.hideActionSheet(SHEET_KEY)
		} catch {
			/* already closed */
		}
		fn()
	}

	return React.createElement(
		ActionSheet,
		null,
		BottomSheetTitleHeader
			? React.createElement(BottomSheetTitleHeader, {
					title: language?.name ?? code,
				})
			: null,
		React.createElement(
			TableRowGroup,
			{ hasIcons: true },
			React.createElement(TableRow, {
				label: t('picker.moveUp'),
				icon: rowIcon('ArrowAngleUpIcon', 'ArrowUpIcon'),
				disabled: at <= 0,
				onPress: run(() => onMove(-1)),
			}),
			React.createElement(TableRow, {
				label: t('picker.moveDown'),
				icon: rowIcon('ArrowAngleDownIcon', 'ArrowDownIcon'),
				disabled: at >= last,
				onPress: run(() => onMove(1)),
			}),
			React.createElement(TableRow, {
				label: t('picker.remove'),
				variant: 'danger',
				icon: rowIcon('TrashIcon'),
				onPress: run(onRemove),
			}),
		),
	)
}

export default function PickerLanguages() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = components
	const { ScrollView } = ReactNative
	const { Stack, Text, TableRowGroup, TableRow, TextInput } = Design

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const codes = pickerLanguages(s.pickerLanguages)

	const save = (next: string[]) => storage?.set({ pickerLanguages: next })

	const [query, setQuery] = React.useState('')
	const needle = query.trim().toLowerCase()
	const addable = LANGUAGES.filter(
		language =>
			!codes.includes(language.code) &&
			(!needle ||
				language.name.toLowerCase().includes(needle) ||
				language.native.toLowerCase().includes(needle) ||
				language.code.toLowerCase().startsWith(needle)),
	)

	const openOrder = (code: string) => {
		const at = codes.indexOf(code)
		try {
			ActionSheetActionCreators.openLazy(
				Promise.resolve({ default: OrderSheet }),
				SHEET_KEY,
				{
					code,
					at,
					last: codes.length - 1,
					onMove: (delta: number) => save(moveLanguage(codes, code, delta)),
					onRemove: () => save(removeLanguage(codes, code)),
				} as any,
			)
		} catch {
			/* no sheet system on this build; the list stays as it is */
		}
	}

	return (
		<Page>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: useBottomPadding() }}
			>
				<Stack spacing={24}>
					<Text color="text-muted" variant="text-sm/normal">
						{t('picker.note')}
					</Text>

					<TableRowGroup
						title={t('picker.count', { count: codes.length })}
						hasIcons
					>
						{codes.map((code, index) => {
							const language = languageFor(code)
							return (
								<TableRow
									key={code}
									label={language?.name ?? code}
									subLabel={
										language && language.native !== language.name
											? `${index + 1} · ${language.native}`
											: `${index + 1} · ${code}`
									}
									icon={rowIcon('GlobeEarthIcon')}
									arrow
									onPress={() => openOrder(code)}
								/>
							)
						})}
						{!codes.length && <TableRow label={t('picker.empty')} disabled />}
					</TableRowGroup>

					<TableRowGroup title={t('picker.add')} hasIcons>
						<TextInput
							placeholder={t('language.search')}
							value={query}
							isClearable
							onChange={setQuery}
						/>
						{addable.slice(0, 40).map(language => (
							<TableRow
								key={language.code}
								label={language.name}
								subLabel={
									language.native === language.name
										? language.code
										: `${language.native} · ${language.code}`
								}
								icon={rowIcon('PlusSmallIcon', 'PlusIcon')}
								onPress={() => save(addLanguage(codes, language.code))}
							/>
						))}
						{!addable.length && <TableRow label={t('picker.empty')} disabled />}
					</TableRowGroup>
				</Stack>
			</ScrollView>
		</Page>
	)
}
