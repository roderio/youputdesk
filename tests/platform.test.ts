import { describe, expect, it } from 'vitest'
import { defaultCloseToTray, shouldWarnNoSandbox, firefoxPlatformToken, isLinux, notificationsHelp, superKeyName, windowIconName } from '../src/shared/platform'

describe('isLinux', () => {
  it('is true only for linux', () => {
    expect(isLinux('linux')).toBe(true)
    expect(isLinux('win32')).toBe(false)
  })
})

describe('firefoxPlatformToken', () => {
  it('matches the real OS', () => {
    expect(firefoxPlatformToken('win32', 'x64')).toBe('Windows NT 10.0; Win64; x64')
    // Firefox on Windows ARM reports x64 too.
    expect(firefoxPlatformToken('win32', 'arm64')).toBe('Windows NT 10.0; Win64; x64')
    expect(firefoxPlatformToken('linux', 'x64')).toBe('X11; Linux x86_64')
    expect(firefoxPlatformToken('linux', 'arm64')).toBe('X11; Linux aarch64')
  })
})

describe('superKeyName', () => {
  it('says Win on Windows and Super on Linux', () => {
    expect(superKeyName('win32')).toBe('Win')
    expect(superKeyName('linux')).toBe('Super')
  })
})

describe('defaultCloseToTray', () => {
  it('is on for Windows and off for Linux, where GNOME may have no tray', () => {
    expect(defaultCloseToTray('win32')).toBe(true)
    expect(defaultCloseToTray('linux')).toBe(false)
  })
})

describe('windowIconName', () => {
  it('uses ico on Windows and png on Linux', () => {
    expect(windowIconName('win32')).toBe('icon.ico')
    expect(windowIconName('linux')).toBe('icon.png')
  })
})

describe('notificationsHelp', () => {
  it('points at the right settings', () => {
    expect(notificationsHelp('win32')).toBe('Nothing appears? Check Windows Settings → System → Notifications, and Do not disturb')
    expect(notificationsHelp('linux')).toBe("Nothing appears? Check your desktop's notification settings, and Do not disturb")
  })
})

describe('shouldWarnNoSandbox', () => {
  it('warns once on Linux when Chromium runs without its sandbox', () => {
    expect(shouldWarnNoSandbox('linux', true, false)).toBe(true)
    expect(shouldWarnNoSandbox('linux', true, true)).toBe(false)
    expect(shouldWarnNoSandbox('linux', false, false)).toBe(false)
    expect(shouldWarnNoSandbox('win32', true, false)).toBe(false)
  })
})
