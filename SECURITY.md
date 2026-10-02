# Security

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately through
[GitHub Security Advisories](https://github.com/roderio/youputdesk/security/advisories/new) with steps to
reproduce. You'll get a reply within a few days, and fixed versions reach users through automatic updates.

## How YouputDesk protects you

- **YouTube's page is untrusted.** It runs sandboxed, with context isolation and no Node.js access. The app's
  own code runs in an isolated world that the page's scripts can't see.
- **Messages from the page are checked.** Only the main window's top frame is listened to, and every value is
  validated. Ads and embedded frames can't control the app.
- **Navigation is allowlisted.** The window shows only YouTube and Google sign-in pages. Other links open in your
  browser, and only `http`/`https` links: schemes that can start programs on Windows are dropped.
- **Browser permissions are denied** except fullscreen and copying to the clipboard. That means no camera,
  microphone, location, USB, HID or serial access.
- **The app can't be repurposed.** Electron fuses turn off `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and
  `--inspect`. The app code is integrity-checked at launch, so a modified `app.asar` won't load.
- **Your sign-in is encrypted at rest** with Windows DPAPI.
- **Updates are verified.** Each update's SHA-512 is checked against the release feed before it installs, and
  releases are built only by GitHub Actions from tagged commits.

No software can protect data from malware that is already running as your Windows user. Keep Windows and your
antivirus up to date.
