# Privacy

YouputDesk has **no accounts, no analytics, no telemetry and no servers of its own**. Nothing about you is
collected by the people who make it.

## What stays on your PC

Everything YouputDesk keeps is stored in your Windows user profile, in `%APPDATA%\YouputDesk`. The portable
version uses a `YouputDesk-data` folder next to the exe instead.

| What | Why |
| --- | --- |
| Your Google sign-in (cookies) | So you stay signed in to YouTube Music. Encrypted with Windows (DPAPI), so only your Windows account on this PC can use it |
| Settings, themes, EQ presets, shortcuts | Your preferences |
| Lyrics cache | Lyrics you've already viewed, so they load instantly and work offline |
| Window and mini player position | To reopen where you left it |

## What goes where

| Service | When | What it receives |
| --- | --- | --- |
| **YouTube Music / Google** | Always. YouputDesk is a window onto music.youtube.com | The same as using YouTube Music in a browser. Governed by [Google's privacy policy](https://policies.google.com/privacy) |
| **lrclib.net** | Only if **Online lyrics** is on, when you view lyrics for a song that isn't cached | The song title, artist, album and length. Nothing about you |
| **Discord** | Only if **Show what I'm listening to on Discord** is on (off by default) | The current song, artist and cover, sent to the Discord app on your PC, which shows it on your profile |
| **GitHub** | Only if **Automatic updates** is on (installed version only) | A request for the latest version number, then the update download |

None of the optional features run until you've made your choice on the privacy screen shown the first time
YouputDesk opens. Change them anytime in **Settings → Privacy**.

YouputDesk also blocks YouTube Music from using your camera, microphone, location or connected devices.

## Deleting your data

- **Settings → Privacy → Delete all my data** signs you out and erases everything listed above.
- **Uninstalling** YouputDesk (Windows Settings → Apps) removes the app and all of its data.
- For the portable version, delete the exe and its `YouputDesk-data` folder.
