# Reddit

Post as a video/image post with the demo GIF or MP4, then add the text below as the first comment (or as the
body where text is allowed). Be upfront that you made it; most subs remove posts that hide that.

## r/YoutubeMusic

**Title:** I made a free Windows app for YouTube Music with an equalizer, synced lyrics and a mini player

**Body:**

I wanted a few things the YTM web player doesn't have, so I built YouputDesk. It's the real
music.youtube.com in a desktop window (so your account, library and Premium work as usual) with these added:

- 10-band equalizer with presets, bass boost, loudness normalization and a limiter
- Synced lyrics (from LRCLIB) with click-to-seek and full-screen mode
- Themes, including one that follows the album art, plus a theme editor
- Keeps playing in the tray; small always-on-top mini player
- Global hotkeys, media keys, taskbar buttons, Discord status
- Alerts you when an ad starts, and one-key skip when YouTube shows the Skip button (it doesn't block ads)

It's free and open source (MIT), with no accounts or analytics. Windows 10/11, x64 and ARM.

Download: https://roderio.github.io/youputdesk/
Source: https://github.com/roderio/youputdesk

The installer isn't code-signed yet, so Windows shows a SmartScreen warning ("More info → Run anyway"), or you
can install with `winget install roderio.YouputDesk`. Feedback and bug reports are very welcome.

## r/windows / r/software

**Title:** YouputDesk: a free, open-source YouTube Music desktop app for Windows (EQ, synced lyrics, tray mini player)

Use the same body, but lead with the Windows integration: tray, mini player, taskbar thumbnail buttons, media
overlay, global hotkeys, winget/Scoop install, ARM64 build.

## r/electronjs

**Title:** Built a YouTube Music desktop client in Electron: Web Audio EQ, isolated overlay, launch-time updates

**Body:**

- The overlay UI is injected through a preload in an isolated world; the YTM page itself never gets Node.
- The audio chain is Web Audio: 10 peaking filters, then loudness normalization, then a limiter, so boosts can't clip.
- Updates install at launch behind a small updater window instead of on quit (quitting while YTM is playing was
  unreliable because of its `beforeunload` guard).
- Synced lyrics come from LRCLIB, matched on title, artist and duration.

Happy to answer questions about any of it. Source: https://github.com/roderio/youputdesk
