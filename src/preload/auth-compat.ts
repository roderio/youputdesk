// Loaded only in the auth window in compat mode, where we present as Firefox.
// Firefox has no navigator.userAgentData; leaving Chromium's in place would contradict the UA.
import { contextBridge } from 'electron'

contextBridge.executeInMainWorld({
  func: () => {
    delete (Navigator.prototype as { userAgentData?: unknown }).userAgentData
  },
})
