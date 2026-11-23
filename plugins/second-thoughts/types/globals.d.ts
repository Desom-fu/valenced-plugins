// Type aliases for this ported plugin.
//
// These are not Valenced globals: the source plugin declared them itself. They are
// re-declared here under Valenced names so the ported source keeps its precise types.

import type { JsonStorage } from '@valenced/json-storage'
import type { PluginApi } from '@valenced/plugins/types'

declare global {
	/** The scoped plugin API handed to `start` and to the settings component. */
	type ValencedPluginStartApi<S extends object> = PluginApi<{ jsonStorage: S }>

	/** The plugin's JSON storage handle; `cache` may be undefined while it loads. */
	type ValencedJsonStorageApi<S extends object> = JsonStorage<S>
}
