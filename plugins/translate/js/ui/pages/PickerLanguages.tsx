/**
 * Which languages the chat bar offers, and in what order.
 *
 * ## Dragging, not arrows
 *
 * Ordering a list with "move up / move down" means a tap per place — eleven taps to move the last
 * item to the top, and no sense of where it will land. So each row carries a grip on its left that
 * drags directly, and the row follows the finger. On release the list is committed with one
 * `moveLanguage`.
 *
 * ## Why a grip and not the whole row
 *
 * The page is a `ScrollView`. If the row itself claimed the vertical gesture, dragging a row and
 * scrolling the page would be the same gesture and the scroll would lose — every list that does that
 * ends up unscrollable. The grip claims the gesture on touch-down (`onStartShouldSetPanResponder`),
 * so the rest of the row still scrolls normally and still takes taps.
 *
 * The tap is kept, and it opens the same sheet as before: drag for the quick move, the sheet for
 * "remove", plus up/down as a fallback for anyone who cannot drag.
 *
 * ## Adding
 *
 * The add list is searchable and shows only what is not already there. Selecting one appends it,
 * which is the only order that is not a guess.
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
/** Fallback until the first row reports its height. */
const ROW_FALLBACK = 64

/**
 * The per-language actions, for tapping a row.
 *
 * A component because `openLazy` renders it (see `ui/composer_button.tsx`). Dragging is the fast
 * path; this is the precise one, and the only way to remove.
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

/**
 * One draggable row.
 *
 * Owns its own gesture state and animated offset, because hooks cannot be created inside the list's
 * `map`. `onDrop` reports how many places the row travelled; the parent turns that into
 * `moveLanguage` so the ordering rules stay in one tested place.
 */
function DraggableRow({
	index,
	label,
	subLabel,
	rowHeight,
	dragging,
	onLift,
	onDrop,
	onTap,
	onMeasure,
}: {
	index: number
	label: string
	subLabel: string
	rowHeight: number
	dragging: boolean
	onLift: (index: number) => void
	onDrop: (index: number, delta: number) => void
	onTap: () => void
	onMeasure: (height: number) => void
}) {
	const { View, Animated, PanResponder, Text } = ReactNative as any
	const { TableRow } = Design as any
	const offset = React.useRef(new Animated.Value(0)).current
	const travelled = React.useRef(0)
	const [active, setActive] = React.useState(false)

	// Read inside the gesture, never captured: a re-render mid-drag (which happens the moment the
	// row lifts, because the parent re-renders) would otherwise rebuild the responder and drop the
	// gesture the finger is still holding.
	const indexRef = React.useRef(index)
	indexRef.current = index
	const rowHeightRef = React.useRef(rowHeight)
	rowHeightRef.current = rowHeight
	const onLiftRef = React.useRef(onLift)
	onLiftRef.current = onLift
	const onDropRef = React.useRef(onDrop)
	onDropRef.current = onDrop

	const responder = React.useMemo(
		() =>
			PanResponder.create({
				// Claimed on touch-down, on the grip only: the row keeps scrolling normally.
				onStartShouldSetPanResponder: () => true,
				onMoveShouldSetPanResponder: () => true,
				onPanResponderGrant: () => {
					setActive(true)
					travelled.current = 0
					onLiftRef.current(indexRef.current)
				},
				onPanResponderMove: (_event: any, gesture: any) => {
					travelled.current = gesture.dy
					offset.setValue(gesture.dy)
				},
				onPanResponderRelease: () => {
					setActive(false)
					offset.setValue(0)
					const height = rowHeightRef.current || ROW_FALLBACK
					onDropRef.current(
						indexRef.current,
						Math.round(travelled.current / height),
					)
				},
				onPanResponderTerminate: () => {
					setActive(false)
					offset.setValue(0)
					onDropRef.current(indexRef.current, 0)
				},
			}),
		[offset],
	)

	const lifted = active || dragging

	return React.createElement(
		Animated.View,
		{
			onLayout: (event: any) => {
				const height = event?.nativeEvent?.layout?.height
				if (height > 0) onMeasure(height)
			},
			style: {
				transform: [{ translateY: offset }],
				// Above its neighbours while lifted, so it visibly floats over them.
				zIndex: lifted ? 10 : 0,
				elevation: lifted ? 10 : 0,
				opacity: lifted ? 0.95 : 1,
			},
		},
		React.createElement(
			View,
			{ style: { alignItems: 'center', flexDirection: 'row' } },
			React.createElement(
				View,
				{
					...responder.panHandlers,
					accessibilityRole: 'adjustable',
					accessibilityLabel: `Reorder ${label}`,
					style: {
						alignItems: 'center',
						alignSelf: 'stretch',
						justifyContent: 'center',
						paddingHorizontal: 4,
						width: 34,
					},
				},
				Text
					? React.createElement(
							Text,
							{ color: 'text-muted', variant: 'text-md/semibold' },
							'≡',
						)
					: null,
			),
			React.createElement(
				View,
				{ style: { flex: 1 } },
				React.createElement(TableRow, {
					label,
					subLabel,
					icon: rowIcon('GlobeEarthIcon'),
					onPress: onTap,
				}),
			),
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

	const [rowHeight, setRowHeight] = React.useState(ROW_FALLBACK)
	const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)

	// The list as it is right now, for the drop handler: the drag began against an older render and
	// committing to that stale array would undo anything changed while the finger was down.
	const codesRef = React.useRef(codes)
	codesRef.current = codes

	const save = (next: string[]) => storage?.set({ pickerLanguages: next })

	// Stable identities, so the per-row PanResponders are not rebuilt on every keystroke in the
	// search field below.
	const onMeasure = React.useCallback((height: number) => {
		setRowHeight(current => (Math.abs(current - height) > 1 ? height : current))
	}, [])
	const onLift = React.useCallback(
		(index: number) => setDraggingIndex(index),
		[],
	)
	const onDrop = React.useCallback((index: number, delta: number) => {
		setDraggingIndex(null)
		if (!delta) return
		const list = codesRef.current
		const code = list[index]
		if (!code) return
		getStorage()?.set({ pickerLanguages: moveLanguage(list, code, delta) })
	}, [])

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
			/* no sheet system on this build; dragging still works */
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

					<TableRowGroup title={t('picker.count', { count: codes.length })}>
						{codes.map((code, index) => {
							const language = languageFor(code)
							return (
								<DraggableRow
									key={code}
									index={index}
									label={language?.name ?? code}
									subLabel={
										language && language.native !== language.name
											? `${language.native} · ${code}`
											: code
									}
									rowHeight={rowHeight}
									dragging={draggingIndex === index}
									onLift={onLift}
									onDrop={onDrop}
									onTap={() => openOrder(code)}
									onMeasure={onMeasure}
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
