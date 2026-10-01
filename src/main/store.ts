import Store from 'electron-store'
import { DEFAULT_SETTINGS, withDefaults, type Settings } from '../shared/settings'

export type { Identity } from '../shared/settings'

export const store = new Store<Settings>({ defaults: DEFAULT_SETTINGS })

// electron-store only fills missing top-level keys; fill nested ones added in newer versions too.
store.store = withDefaults(DEFAULT_SETTINGS, store.store)
