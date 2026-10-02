# Show HN

**Title** (80 chars max): Show HN: YouputDesk – YouTube Music for Windows with an EQ and synced lyrics

**URL:** https://github.com/roderio/youputdesk

**Text** (post as the first comment right after submitting):

I listen to YouTube Music all day and kept missing an equalizer, synced lyrics and global hotkeys, so I built
a desktop client for Windows.

It loads the real music.youtube.com (so Google sign-in and Premium just work) and adds an overlay through an
Electron preload running in an isolated world. The page never gets Node access.

A few parts that might interest HN:

- Audio: the media element is routed through Web Audio. 10 peaking biquads, then loudness normalization, then a
  limiter, so a +12 dB bass boost can't clip.
- Lyrics: synced LRC from LRCLIB, matched on title, artist and duration.
- Updates: electron-updater, but installed at launch behind a small window rather than on quit, because YTM's
  `beforeunload` guard made quit-time installs unreliable.
- Privacy: no telemetry. Every feature that talks to another service (Discord, lyrics, update checks) is opt-in
  on first launch.

It's MIT licensed. Releases are built only by GitHub Actions; they're unsigned for now (SignPath application
pending), so `winget install roderio.YouputDesk` is the smoothest way to try it.

I'd love feedback, especially on what breaks when YouTube changes its markup.
