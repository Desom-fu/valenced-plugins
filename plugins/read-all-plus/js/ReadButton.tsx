import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import React from 'react'
import { Text, View } from 'react-native'
import { executeClearAll } from './ClearAll'
import { firstExport } from './compat'

/**
 * The pill that sits over the chat input.
 *
 * A plain pressable view rather than a fetched button component: the only thing it needs is a tap
 * that runs the same action the slash command does.
 */
export default function ReadButton() {
	return React.createElement(
		View,
		{
			style: {
				marginHorizontal: 12,
				marginVertical: 8,
				paddingVertical: 10,
				paddingHorizontal: 14,
				borderRadius: 8,
				backgroundColor: 'rgba(255,255,255,0.08)',
			},
			onStartShouldSetResponder: () => true,
			onResponderRelease: () => {
				void executeClearAll()
			},
		},
		React.createElement(
			Text,
			{ style: { color: '#fff', fontWeight: '600', textAlign: 'center' } },
			'Read All',
		),
	)
}

// 一个适配抽屉布局的行按钮（非绝对定位）
export function DrawerReadAllButton() {
	return React.createElement(
		View,
		{
			style: {
				marginHorizontal: 12,
				marginVertical: 8,
				paddingVertical: 10,
				paddingHorizontal: 14,
				borderRadius: 8,
				backgroundColor: 'rgba(255,255,255,0.08)',
			},
			onStartShouldSetResponder: () => true,
			onResponderRelease: () => {
				void executeClearAll()
			},
		},
		React.createElement(
			Text,
			{ style: { color: '#fff', fontWeight: '600', textAlign: 'center' } },
			'Read All',
		),
	)
}

/**
 * 在抽屉容器 children 末尾追加 Read All 按钮。
 * 依赖调用方已有的抽屉容器判据 isDrawerContainer。
 */
export function patchReadAllInDrawer(
	cleanups: (() => void)[],
	isDrawerContainer: (type: any, props: any) => boolean,
) {
	const target = firstExport(lookupModule(withProps('createElement')))
	if (!target) return false

	const orig = target.createElement
	target.createElement = function (type: any, props: any, ...rest: any[]) {
		const el = orig.call(this, type, props, ...rest)
		if (!isDrawerContainer(type, props)) return el
		if (!React.isValidElement(el)) return el

		const kids = (el.props as any)?.children
		const arr = Array.isArray(kids) ? kids : kids ? [kids] : []
		return React.cloneElement(el as any, {
			children: [
				...arr,
				React.createElement(DrawerReadAllButton, { key: 'readall-drawer' }),
			],
		})
	}
	cleanups.push(() => {
		target.createElement = orig
	})
	return true
}
