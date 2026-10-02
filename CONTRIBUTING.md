# Contributing to YouputDesk

Thanks for helping! Bug reports, ideas, themes and pull requests are all welcome.

- **Bugs and feature requests:** [open an issue](https://github.com/roderio/youputdesk/issues/new/choose).
- **Questions, ideas, shared themes:** [Discussions](https://github.com/roderio/youputdesk/discussions).
- **Security issues:** report them privately, see [SECURITY.md](SECURITY.md).
- New here? Look for issues labelled [`good first issue`](https://github.com/roderio/youputdesk/labels/good%20first%20issue).

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development

You need Windows and Node.js 24.

```sh
npm install
npm run dev        # run with hot reload
npm test           # unit tests
npm run typecheck
npm run dist       # typecheck + test + build the installer and portable exes into dist/
npm run icons      # regenerate icons in resources/ and build/icon.ico
```

`YOUPUTDESK_PROFILE=test npm run dev` runs a separate profile (its own login, settings and
single-instance lock), so you can test without touching your everyday setup.

## Where things are

| Area | Code |
| --- | --- |
| Google sign-in, browser identity | `src/main/auth.ts`, `src/main/ua.ts` |
| Tray, mini player, taskbar, global shortcuts, toasts, Discord, lyrics | `src/main/*.ts` |
| Audio engine (Web Audio chain) | `src/preload/audio.ts` |
| Overlay UI (toolbar, panels, modals) | `src/preload/overlay/` |
| YouTube Music DOM selectors | `src/shared/selectors.ts` |

**When YouTube Music changes its page** and something stops working (the toolbar disappears, song info is
wrong, buttons don't respond), `src/shared/selectors.ts` is the first place to look: it holds every selector
YouputDesk uses to find things on music.youtube.com. Such issues are labelled `selectors`.

Debugging the overlay: open DevTools (`Alt` → App → Toggle Developer Tools), pick the
**Electron Isolated Context**, and use `__youputdesk.getState()`.

## Pull requests

- Keep each PR to one change, and describe what it fixes and how you tested it.
- `npm run typecheck` and `npm test` must pass (CI runs both).
- Match the style of the surrounding code; add a test when you change logic in `src/shared/`.
- For UI changes, include a screenshot.

## Themes

Made a theme you like? Export it from the theme editor and share the file in the
[Show and tell](https://github.com/roderio/youputdesk/discussions/categories/show-and-tell) discussions.

## Releasing (maintainers)

1. `npm version patch` (or `minor`/`major`): bumps `package.json` and creates the `vX.Y.Z` tag.
2. `git push --follow-tags`: GitHub Actions (`.github/workflows/release.yml`) tests, builds and uploads the
   installer, the portable exes and `latest.yml` (the auto-update feed) to a **draft** release.
3. Check the draft on GitHub, generate or write release notes, and click **Publish**. Installed copies pick it
   up at their next launch, or download it in the background within six hours and install it at the launch
   after that.

Releases are only ever built by CI. Keep 2FA on the GitHub account and protect the `main` branch and `v*` tags,
because anyone who can publish a release can ship an update.

Each published release is also submitted to WinGet automatically (`.github/workflows/winget.yml`, which needs
a `WINGET_TOKEN` secret: a classic token with the `public_repo` scope). The Scoop bucket
([roderio/scoop-bucket](https://github.com/roderio/scoop-bucket)) picks up new releases on its own.
