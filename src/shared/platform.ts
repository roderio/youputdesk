/**
 * Every OS-specific choice, in one place. Pure (no Electron import), so the main process, the sandboxed
 * preloads (which have process.platform) and the tests can all use it. Anything that isn't Linux gets the
 * Windows answer.
 */

export const isLinux = (platform: string = process.platform): boolean => platform === 'linux'

/** The OS part of a Firefox user agent. Firefox on Windows ARM reports x64 too. */
export const firefoxPlatformToken = (platform: string, arch: string): string =>
  isLinux(platform) ? `X11; Linux ${arch === 'arm64' ? 'aarch64' : 'x86_64'}` : 'Windows NT 10.0; Win64; x64'

/** What people call the logo key. Electron's accelerator calls it Super everywhere. */
export const superKeyName = (platform: string): 'Win' | 'Super' => (isLinux(platform) ? 'Super' : 'Win')

/** GNOME shows no tray icon without an extension, so closing to the tray could leave no way back. */
export const defaultCloseToTray = (platform: string): boolean => !isLinux(platform)

/** Window icons: .ico on Windows, PNG elsewhere. */
export const windowIconName = (platform: string): 'icon.ico' | 'icon.png' => (isLinux(platform) ? 'icon.png' : 'icon.ico')

/** Where to look when test notifications don't show up. */
export const notificationsHelp = (platform: string): string =>
  isLinux(platform)
    ? "Nothing appears? Check your desktop's notification settings, and Do not disturb"
    : 'Nothing appears? Check Windows Settings → System → Notifications, and Do not disturb'

/**
 * Whether to tell the user, once, that Chromium is running without its sandbox. On Linux that happens when
 * the system blocks unprivileged user namespaces (Ubuntu 24.04+ by default): the AppImage launcher then
 * adds --no-sandbox so the app can start at all. The .deb installs an AppArmor profile and keeps the sandbox.
 */
export const shouldWarnNoSandbox = (platform: string, noSandbox: boolean, alreadyWarned: boolean): boolean =>
  isLinux(platform) && noSandbox && !alreadyWarned
