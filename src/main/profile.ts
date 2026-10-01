// Dev/testing: YOUPUTDESK_PROFILE=name runs a separate, isolated profile (own login, settings and
// instance lock). This must run before any module that touches userData (the settings store is
// created on import), which is why it is its own module and index.ts imports it first.
import { app } from 'electron'

if (process.env.YOUPUTDESK_PROFILE) {
  app.setPath('userData', `${app.getPath('userData')}-${process.env.YOUPUTDESK_PROFILE}`)
}
