import * as modulesSettings from '@valenced/discord/modules/settings'
import { t } from '../i18n'
import Ai from './pages/Ai'
import Appearance from './pages/Appearance'
import Debug from './pages/Debug'
import Language from './pages/Language'
import PickerLanguages from './pages/PickerLanguages'
import Service from './pages/Service'

const DEBUG: boolean = false

/**
 * Route keys are namespaced by plugin id. Renaming the id therefore renames every route, which is
 * what makes a fork's pages distinguishable from the original's in a shared settings navigator.
 */
const PREFIX = 'desom-fu.translate'

export const LANGUAGE_ROUTE = `${PREFIX}.language`
export const SERVICE_ROUTE = `${PREFIX}.service`
export const APPEARANCE_ROUTE = `${PREFIX}.appearance`
export const AI_ROUTE = `${PREFIX}.ai`
export const PICKER_ROUTE = `${PREFIX}.picker`
export const DEBUG_ROUTE = `${PREFIX}.debug`

/**
 * Upstream commit 10371ff merged `refreshSettingsNavigator` + `refreshSettingsOverviewScreen`
 * into `refreshSettings`. Which exists depends on the bundle the user is running.
 */
function refreshSettingsUI() {
	const settings = modulesSettings as any
	if (typeof settings.refreshSettings === 'function') {
		settings.refreshSettings()
		return
	}
	settings.refreshSettingsNavigator?.()
	settings.refreshSettingsOverviewScreen?.()
}

export function registerPages(): () => void {
	const { registerSettingsItem, onSettingsModulesLoaded } = modulesSettings

	// The title is a translation key resolved at render, not a string captured at registration:
	// this runs once at start, and the interface language can change afterwards.
	const route = (key: string, titleKey: string, component: any) =>
		registerSettingsItem(key, {
			parent: null,
			type: 'route',
			useTitle: () => t(titleKey),
			screen: { route: key, getComponent: () => component },
		})

	// Registered inside `onSettingsModulesLoaded`: it fires immediately when Discord's
	// settings modules are already loaded, and waits when they are not. Registering
	// before they exist is how a page ends up missing until the app is restarted.
	let unregister: Array<() => void> = []
	const unsubscribe = onSettingsModulesLoaded(() => {
		unregister = [
			route(LANGUAGE_ROUTE, 'settings.target', Language),
			route(PICKER_ROUTE, 'settings.pickerLanguages', PickerLanguages),
			route(SERVICE_ROUTE, 'settings.service', Service),
			route(AI_ROUTE, 'settings.ownModel', Ai),
			route(APPEARANCE_ROUTE, 'settings.appearance', Appearance),
			...(DEBUG ? [route(DEBUG_ROUTE, 'settings.debug', Debug)] : []),
		]

		refreshSettingsUI()
	})

	return () => {
		unsubscribe()
		for (const remove of unregister) remove()
		unregister = []
		refreshSettingsUI()
	}
}
