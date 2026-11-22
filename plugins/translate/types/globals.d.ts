// Globals and convenience aliases for this ported plugin.
//
// Ported from `bleelblep/revenge-next-plugins`, where the host injected a `revenge` global and the
// plugin-local `types/globals.d.ts` defined two aliases on top of the vendored Revenge Next types.
// Valenced declares `valenced` and `plugin` itself (via `@valenced/types`), so only the aliases are
// repeated here. They keep the ported source readable and its types precise.

import type { JsonStorage } from '@valenced/json-storage'
import type { PluginApi } from '@valenced/plugins/types'

declare global {
	/** The scoped plugin API handed to `start` and to the settings component. */
	type ValencedPluginStartApi<S extends object> = PluginApi<{ jsonStorage: S }>

	/**
	 * The plugin's JSON storage handle.
	 *
	 * `cache` and `use()` are both possibly-`undefined`, and that is not pedantry: `load: true`
	 * calls `get()` without awaiting it, so there is a real window during which the storage has
	 * not loaded yet. Every read site falls back to `DEFAULTS` rather than assuming a value.
	 */
	type ValencedJsonStorageApi<S extends object> = JsonStorage<S>
}
