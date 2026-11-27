# Word-synced lyrics: design

Date: 2026-11-28. Status: agreed in conversation, waiting for approval of this document.

## Why

The lyrics should look better. Other apps (Spicy Lyrics on Spotify, Better Lyrics and YouLy+ on YouTube Music)
light up each word as it's sung. YouputDesk only highlights whole lines, from LRCLIB. We want word-by-word
lyrics in YouputDesk's own style, without losing any of the songs LRCLIB covers today.

Spicy Lyrics itself can't be used: it only runs inside Spotify, finds lyrics by Spotify track, is AGPL-3.0 (copying
its code would force YouputDesk off Apache 2.0), and some of its lyrics come from Apple Music and Spotify, which we
have no rights to show.

## Goals

- Word-by-word lyrics for songs that [Unison](https://github.com/better-lyrics/unison) has word timing for. Unison
  is the community lyrics database behind Better Lyrics, looked up by YouTube video ID.
- Every song that has lyrics today still has them: LRCLIB stays the fallback.
- One look, called **Lift**, for both kinds of lyrics:
  - Word timing: each word turns white and lifts slightly (about 2px) when it starts, and the word being sung
    glows in the theme's accent colour.
  - Line timing only: the whole line brightens, lifts and glows.
- Smoother line view for everyone: smooth scrolling that keeps the current line centred, a gentle blur on lines
  far from the current one, and past lines a little brighter than upcoming ones.
- Respect the Unison data licence: credit Unison and the submitter, and honour removals.
- Keep the privacy promise: nothing goes to Unison until the user has agreed to it.

## Non-goals

- Translation, romanization, or showing the songwriters from the TTML metadata.
- Submitting, voting on or reporting lyrics from inside the app. The credit links to Unison's site for that.
- Any lyrics source other than Unison and LRCLIB. In particular, no source that serves Apple Music, Spotify,
  Musixmatch or QQ Music lyrics (including YouLy+'s Lyrics+ backend).
- Lyrics in the mini player.
- The other ideas from the Velvetone video (sidebar folders, crossfade and so on). They're a separate project.

## Anti-goals (it fails even if it works)

- Lyrics from the internet reach the page as HTML. All lyric text must end up as text nodes.
- The YouTube Music page (which we don't control) can make the app open an arbitrary link through the new credit links.
- Existing users start sending video IDs to Unison without being asked.
- A song that had synced lyrics before this change shows worse lyrics after it.
- Animations that stutter on modest PCs, or ignore Performance mode or Reduce motion.

## Constraints

- **Unison licence** ([README](https://github.com/better-lyrics/unison), `LICENSE-DATA.md`, Unison Community
  License 1.0):
  - Use is allowed: YouputDesk is open source under an OSI licence and lyrics are free to every user.
  - Credit wherever the lyrics are shown: "Lyrics from Unison" linked to `https://unison.betterlyrics.org/song/<videoId>`,
    and the submitter's `submitter.displayName` linked to `https://unison.betterlyrics.org/curator/<submitter.keyId>`.
    The credit can sit at the end of the lyrics; it needn't stay on screen. It's required from **7 February 2027**,
    and this feature ships with it from the start.
  - Honour removals: when Unison removes a lyric, our saved copy must go too.
- **API facts** (checked against the live API on 2026-11-28):
  - `GET https://unison.betterlyrics.org/lyrics?v=<videoId>`. No key needed for reading.
  - 200 response: `{ success, data }`. The fields we use are `data.format` (`ttml`, `lrc` or `plain`),
    `data.syncType` (`richsync`, `linesync` or `plain`), `data.lyrics` (the text), `data.videoId` and
    `data.submitter.{displayName,keyId}`.
  - 404 when Unison has nothing. `503 LOOKUP_PENDING` with `Retry-After` is possible in general, but not
    documented for `v` lookups.
  - Each response sends an `ETag`. Sending it back as `If-None-Match` gets a `304` with no body when nothing changed.
- **TTML as Unison serves it:**
  - `<tt>` with `ttp:timeBase="media"`, plus `itunes:timing="Word"` (or `"Line"`).
  - `<head><metadata>` holds `<ttm:agent xml:id="v1">` entries.
  - `<body><div><p begin end ttm:agent="v1">`, and inside each `<p>`, `<span begin end>` per word or syllable.
  - Syllables of one word are adjacent spans with no whitespace between them (`<span>No</span><span>thing</span>`).
    Words are separated by whitespace text nodes.
  - Background vocals are `<span ttm:role="x-bg">` wrapping more timed spans.
  - Times look like `2:30.140`. Accept `ss.mmm`, `m:ss.mmm` and `h:mm:ss.mmm`.
- **Privacy:**
  - Today's "Online lyrics" switch, the first-launch privacy screen, PRIVACY.md and the README promise that only
    lrclib.net receives the song title, artist, album and length.
  - Unison would receive the YouTube video ID.
- **Security:**
  - The overlay runs in the YouTube Music page's renderer, in an isolated world, sandboxed.
  - Anything the page sends to main is untrusted (see `fromMain` and the settings IPC in `src/main/ipc.ts`).
  - External links go through `openExternal`, which only checks for http(s).
- **Style:** animations only touch `transform`, `opacity`, `color`, `text-shadow` and `filter`. `:host(.perf)` and
  `:host(.rm)` already switch transitions off, so the new styles must fit that.

## Approaches

**Reading the TTML (the user's choice: option 1).**

1. **The lyrics overlay reads it with the browser's built-in XML reader** (`DOMParser`, `application/xml`). Picked:
   - It's the browser engine's own tested parser, so the app ships no new runtime dependency.
   - Untrusted XML stays out of the privileged main process.
   - Cost: parser tests need a DOM, so `jsdom` becomes a devDependency, used by those tests only.
2. The main process parses with `fast-xml-parser` and sends ready-made lines to the overlay. It's simple to test,
   but it adds a shipped dependency that needs security updates, and untrusted input gets parsed in main.
3. A hand-written XML reader. Rejected: it's the most code and the easiest place to let a bug in.

**Settled without a real alternative:**

- **Fetching and saving** stays in main (`src/main/lyrics.ts`): main already owns network access, the cache and the
  privacy check.
- **Animation timing** follows the `<video>` clock every frame, as `useActiveLine` does today. A binary search finds
  the current line and word, and classes change only when one of them changes. Lift only needs each word's start
  time, so seeking, pausing and speed changes need no extra handling.
- **Rejected for timing:** scheduling CSS animations with delays (YouLy+'s approach). It gives smoother partial-word
  fills, which Lift doesn't use, and it must be re-synced on every seek, pause and speed change.

## The design

### Which lyrics a song gets

If Unison is allowed (see Privacy), main asks Unison by video ID. Then the best result in this order is shown:

1. **Unison word timing:** `format: 'ttml'` and the TTML has timed word spans. Unison marks this `syncType:
   'richsync'`, but the content decides, not the label.
2. **LRCLIB synced lines** that match this recording's length (today's `synced` with `otherVersion: false`).
3. **Unison line timing:**
   - `linesync` LRC, or TTML with timed lines but no word spans. This includes `richsync`-labelled data in any format
     other than TTML.
   - It ranks above LRCLIB's unsynced text because Unison is keyed by this exact video, so its timing fits.
4. **LRCLIB unsynced lyrics:** plain, or synced lines from another version, shown unsynced as today.
5. **Unison `plain`.**
6. **Nothing:** today's "No lyrics found" screen.

Rule of thumb: LRCLIB's synced lines stay ahead of Unison's line timing, so no song gets worse lyrics than it had
before. Unison only moves ahead where it adds word timing or fills a gap. *(My call: the order of 3 and 4.)*

- **LRCLIB fails** (network or 5xx) **while Unison has something:** show Unison's result, credited to it. LRCLIB is
  asked again next time, because only a real LRCLIB answer is saved (see the saved file).
- **Both fail:** today's "Couldn't reach the lyrics service".

### Privacy and consent

- **New settings fields** (in `privacy`):
  - `unison: boolean`, default `false`.
  - `unisonAsked: boolean`, default `false`.
- **Rules:**
  - "Online lyrics" (`onlineLyrics`) is the master switch.
  - `unison` is a sub-switch under it: Unison is used only when both are on.
  - `allows(settings, 'unison')` is true only when `consented && onlineLyrics && unison`.
  - Main checks it before every Unison request, as it does for LRCLIB today.
  - Turning the master switch on in Settings does not turn `unison` on by itself.
- **Wording per place.** Any switch or button whose text names Unison sets `unison` and `unisonAsked` when used.
  Text that doesn't name Unison never turns it on.
  - **First-launch privacy screen** (new users): the one "Online lyrics" switch names both services. Saving the
    screen with it **on** sets `unison: true, unisonAsked: true`. With it **off**, it changes neither, so the card
    asks if they turn lyrics on later.
    - That screen gets its own hint text: "Looks up lyrics on lrclib.net and unison.betterlyrics.org. They receive
      the song's title, artist and YouTube video ID, nothing about you."
  - **Settings, Online lyrics row:** keeps today's LRCLIB-only hint.
  - **Settings, the new "Word-by-word lyrics (Unison)" row:** names Unison and the video ID in its own hint.
  - **The "Online lyrics are off" empty state** in `Lyrics.tsx`: its text names both services, so its "Turn on" sets
    `onlineLyrics`, `unison` and `unisonAsked` all to true.
  - So `PRIVACY_TEXT` needs separate entries for the first-launch screen, the Settings row and the Unison row.
    *(My call.)*
- **Existing users, and anyone who turns lyrics on later without having been asked**
  (`consented && onlineLyrics && !unisonAsked`):
  - The first time the lyrics panel or full-screen lyrics open, a card covers the lyrics. Title: "Word-by-word lyrics".
  - Text: "Unison has lyrics timed word by word for many songs. To look them up, YouputDesk sends the song's YouTube
    video ID to unison.betterlyrics.org. Nothing about you."
  - Buttons: **Turn on** and **Not now**. Either one sets `unisonAsked: true`. Turn on also sets `unison: true` and
    reloads the current song's lyrics.
  - Until they answer, lyrics load from LRCLIB as before, and show under the card.
- **Settings panel:** a second switch under "Online lyrics", "Word-by-word lyrics (Unison)", bound to `unison` and
  disabled while Online lyrics is off. *(My call: after "Not now" there must be a way back.)*
- **"Delete all my data"** already clears settings and the lyrics cache, so it needs no change.

### Fetching and saving (main, `src/main/lyrics.ts`)

- **The request:**
  - `GET /lyrics?v=<videoId>` with the existing `YouputDesk/<version>` User-Agent.
  - Through `net.fetch`, with a timeout like LRCLIB's.
  - Only `v`: never send the title or artist to Unison.
- **Handling the response:**
  - Accept only `success: true`, a `data.videoId` equal to the requested one, `format` in `ttml`/`lrc`/`plain`, and
    `lyrics` under 512 KB. Anything else counts as "Unison has nothing".
  - 404 means nothing. 429, 5xx, network errors and `503` count as "Unison unavailable": fall through to LRCLIB, and
    don't record a miss.
- **Result type:** `LyricsResult` gains:
  - `source: 'lrclib' | 'unison'`.
  - For Unison: `format`, `syncType`, `text` (raw), `credit: { videoId, submitterName, submitterKeyId }` and `etag`.
- **Saved file:** two slots per video. *(My call.)*
  - The new file is `lyrics-cache-v3/<videoId>.json`:

    ```ts
    {
      lrclib?: LyricsResult | null   // today's result; absent = never asked; null = asked, not found
      unison?: { result: LyricsResult | null, etag?: string, checkedAt: number }  // null = Unison had nothing
    }
    ```

  - An old `lyrics-cache-v2` file is read as the `lrclib` slot when no v3 file exists. It is never deleted, so a
    downgrade still works.
  - LRCLIB "not found" stays a session-only memory, as today. Only found results go in the `lrclib` slot.
  - The overlay gets the best result of the two slots, ranked as above.
- **Re-checking:**
  - When Unison is allowed and the `unison` slot is missing or older than 7 days, ask Unison. Send
    `If-None-Match` when there's an etag.
    - 304: keep it.
    - 200: replace it.
    - 404: set `result: null`. This honours removals.
    - Unavailable: keep what's there.
  - This happens in the background after the saved result has been returned, so lyrics still appear instantly. If
    the best result changes, push the new one to the overlay (a `lyricsUpdated` message keyed by video ID) or let the
    next open pick it up. The builder decides which.
- **Unison turned off:** the `unison` slot is ignored, not deleted. The overlay gets the `lrclib` slot (or a fresh
  LRCLIB lookup), and that is saved normally.
- **Bad TTML:** the query gets an `exclude: 'unison'` option. If the overlay can't parse a Unison result, it asks again
  with that option and gets LRCLIB's result. Main doesn't save that as the song's answer.

### Reading TTML (overlay, new `src/shared/ttml.ts`)

The parser is pure apart from taking a `DOMParser`, so jsdom can drive it in tests.

- `parseTtml(text: string, parser: DOMParser): RichLyrics | null`. It returns `null` if the XML doesn't parse (a
  `parsererror` element), has no timed lines, or has nonsense times.
- **The model:**

  ```ts
  interface RichLyrics { lines: RichLine[] }
  interface RichLine {
    begin: number; end: number          // seconds
    side: 'left' | 'right'              // the first agent seen is left, any other agent right
    words: RichWord[]                   // empty for a line-timed <p>
    text: string                        // the whole line, for line-timed TTML and screen readers
    background?: RichLine               // the x-bg part, shown as a smaller line under it
  }
  interface RichWord {
    text: string; begin: number; end: number
    joinNext: boolean                   // a syllable: no space before the next one, keep them on one line
  }
  ```

- **Reading rules:**
  - Times can be `ss.mmm`, `m:ss.mmm` or `h:mm:ss.mmm`.
  - Whitespace text between spans sets `joinNext: false` on the span before it.
  - Text inside `x-bg` spans goes to `background`, never into the main line.
  - Untimed text inside a `<p>` is kept as part of the neighbouring word.
- **Unison `lrc`/`linesync` results** go through the existing `parseLrc`. `plain` is shown as today's unsynced view.

### Drawing it (overlay, `src/preload/overlay/Lyrics.tsx` and `styles.ts`)

- **Text:** every word is its own `<span>`, created through Preact, so the text is a text node. No `innerHTML`, no
  `dangerouslySetInnerHTML`.
- **Syllables:** the syllables of one word are wrapped together with `white-space: nowrap`, so a word never breaks
  across lines.
- **Timing:**
  - A `useActiveWord` hook (next to today's `useActiveLine`, and replacing it for rich lyrics) reads
    `video.currentTime + 0.25` every frame.
  - It finds the line, and inside the line the last word whose `begin` has passed.
  - It updates state only when either index changes.
  - Pure helpers for the searches go in `src/shared/` with tests.
- **Classes:**
  - Line: `now`, `past`, `far` (more than 2 lines from the current one).
  - Word: `sung` (it has started) and `cur` (it's being sung, until `end + 0.15s`).
  - The current line's background vocals light up with it.
- **The Lift look**, matching the mockup the user picked:
  - Upcoming words and lines: `rgba(255,255,255,.32)`. Past lines: about `.45` to `.55`.
  - A sung word: white and `translateY(-2px)`, with a 180 to 260ms ease (`--ease`).
  - The current word: an accent glow, `text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 80%, transparent)`.
  - Line-timed lyrics: the current line goes white, `translateY(-2px) scale(1.03)`, with a softer accent glow.
  - Lines more than 2 away from the current one: `blur(1.2px)`.
  - Background lines: smaller (about 0.75em) and italic.
  - `side: 'right'` lines: right-aligned, with `transform-origin` on the right.
- **Scrolling:** keeps the current line centred, smooth unless in Performance mode. This is today's behaviour, kept.
- **Performance mode and Reduce motion:** no lift, glow or blur, and scrolling jumps. Only colour changes. The
  existing `:host(.perf)`/`:host(.rm)` rules already cancel transitions; the new transform, filter and text-shadow
  rules must be cancelled under them too.
- **Clicking:** clicking a line seeks to its `begin`, as today. Words have no click of their own.
- **Where:** both the side panel and full-screen lyrics (the `big` variant) get it.

### Credit

- **Where:** at the bottom of the lyrics panel (replacing today's fixed "Lyrics from LRCLIB · click a line to jump to
  it"), and under the last line in full-screen.
- **Text by source:**
  - Unison: "Lyrics from **Unison** · submitted by **\<displayName\>** · click a line to jump to it". Both bold parts
    are links.
  - LRCLIB: as today.
- **Links:**
  - They call a new IPC, `IPC.openLyricsCredit` with `{ kind: 'song' | 'curator', id }`.
  - Main checks the id: a video ID matches `^[\w-]{6,20}$`, and a key ID matches `^[0-9a-f]{64}$`.
  - Main builds the `https://unison.betterlyrics.org/...` URL itself and opens it with `openExternal`.
  - The page never passes a URL.
- **Display name:** shown as text, capped at about 40 characters.

### Copy to update

- `PRIVACY.md`: a unison.betterlyrics.org row. Sent: the YouTube video ID, only while both switches are on, when
  viewing lyrics for a song that isn't saved, or when re-checking a saved one about once a week.
- The privacy screen and Settings hints (`PRIVACY_TEXT` in `Modals.tsx`).
- The "Online lyrics are off" empty state in `Lyrics.tsx`: it names both services.
- README feature line: "Synced lyrics: word by word where [Unison](https://unison.betterlyrics.org) has them, line by
  line from [LRCLIB](https://lrclib.net) otherwise…". Also the website's feature line.
- The onboarding tip "Lines light up as they're sung": "Lyrics light up as they're sung."

### Tests

- `tests/ttml.test.ts` (`// @vitest-environment jsdom`), with a TTML fixture we write ourselves, with made-up words:
  - Word and syllable timing, `joinNext`, background vocals, two agents (sides).
  - Line-timed TTML (`itunes:timing="Line"`, no spans).
  - The three time formats.
  - Malformed XML → `null`.
  - Text that looks like HTML (`<img onerror>` as escaped text) comes out as plain text.
- **Main lookup tests** (mock `net.fetch`, like `updater.test.ts` mocks Electron):
  - The ranking, all six steps, including LRCLIB failing while Unison has something.
  - Old v2 files read as the `lrclib` slot.
  - That switching Unison off and on doesn't lose either slot.
  - That Unison is never called unless allowed.
  - That only `v` is sent.
  - 404, 304 and 5xx handling.
  - That a 404 on revalidation removes the saved copy.
  - That `exclude: 'unison'` works.
  - That a mismatched `data.videoId` is rejected.
- **Pure tests:**
  - The line and word search helpers.
  - Settings defaults for the two new fields.
  - The consent rules: first-launch screen on vs off, the empty-state "Turn on", and when the card appears.
- **IPC check:** `openLyricsCredit` rejects bad ids and never opens a URL the page supplied.

## Left to the builder

- How exactly the background re-check reports back (push message or next open).
- Component and file split inside the overlay, and the exact easing and durations, within the ranges above.
- Whether `RichLyrics` is also used for LRC lines internally (one renderer) or kept beside `LyricLine`.
- The request timeout value and how many tries, following LRCLIB's code.

## Calls made in this document (not discussed with the user)

- A second "Word-by-word lyrics (Unison)" switch in Settings, so "Not now" can be undone.
- "Online lyrics" is the master switch, and only text that names Unison turns Unison on. The Settings row for Online
  lyrics keeps its LRCLIB-only hint.
- The six-step ranking: Unison word timing, then LRCLIB synced lines, then Unison line timing (above LRCLIB's
  unsynced text), and so on. Word timing is decided by the content, not the `richsync` label.
- A two-slot saved file (`lyrics-cache-v3`), reading old v2 files as the LRCLIB slot.
- Re-checking Unison weekly (ETag-based), in the background.
- Credit links go through a validated IPC instead of `openExternal` with a page-supplied URL.
- `jsdom` as a devDependency for parser tests.
