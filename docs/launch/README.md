# Launch kit

Drafts for announcing YouputDesk. Not linked from the website. Post them from your own accounts.

**Before posting:** screenshots and the demo GIF are in `docs/screenshots/`, the website is live, and
`winget install roderio.YouputDesk` works (PR #445420 merged). Then post to one or two places a day, and stay
around for a few hours afterwards to answer comments and fix the bugs people find.

| File | Where | Notes |
| --- | --- | --- |
| [reddit.md](reddit.md) | r/YoutubeMusic, r/windows, r/software, r/electronjs | Read each sub's self-promotion rules first |
| [show-hn.md](show-hn.md) | news.ycombinator.com/submit | Weekday morning US time works best |
| [product-hunt.md](product-hunt.md) | producthunt.com/posts/new | Needs a gallery: social card + screenshots |
| [social.md](social.md) | X, Mastodon, Bluesky | Attach the demo GIF/MP4 |
| [directories.md](directories.md) | AlternativeTo, awesome lists, download sites | Ready-to-paste text |

Track what works: stars, release download counts
(`gh api repos/roderio/youputdesk/releases --jq '.[]|[.tag_name,([.assets[].download_count]|add)]'`)
and GitHub's Insights → Traffic page (referrers show which post sent people).
