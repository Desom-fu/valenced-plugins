import { lookupModule } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { Alert } from 'react-native'

export const TAG = '[ReadAll+]'

/**
 * `lookupModule` returns `[exports, id]` on a hit and a not-found object on a miss, so the
 * `modules?.[0]` this plugin was written against picked the exports on one path and `undefined` on
 * the other. This unwraps either shape by checking that the first element is not itself the
 * marked miss object.
 */
export function firstExport(found: any): any {
	if (!found) return undefined
	if (Array.isArray(found)) return found[0]
	if (found.found === false || found.result === 'notfound') return undefined
	return found
}

/**
 * Finds a module by checking if it has the specified properties.
 * Returns the first match, or undefined if not found.
 */
export const findByProps = (prop: string, ...props: string[]): any => {
	try {
		return firstExport(lookupModule(withProps(prop, ...props)))
	} catch {
		return undefined
	}
}

/**
 * Finds a module by its internal Discord store name (e.g., 'UserStore').
 * Returns the first match, or undefined if not found.
 */
export const findByStoreName = (name: string): any => {
	try {
		return firstExport(lookupModule(withName(name)))
	} catch {
		return undefined
	}
}

/**
 * Shows a native Discord toast notification.
 * Falls back to console.log if the Toast module cannot be found.
 */
export function toast(message: string) {
	try {
		const t = findByProps('showToast')
		if (t?.showToast) {
			return void t.showToast({ content: message })
		}
	} catch {}
	console.log(TAG, message)
}

/**
 * Wrapper for React Native's Alert.alert to show a choice dialog.
 */
export function choose(
	title: string,
	message: string,
	options: {
		text: string
		style?: 'default' | 'cancel' | 'destructive'
		onPress?: () => void
	}[],
) {
	Alert.alert(title, message, options)
}
