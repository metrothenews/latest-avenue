# Notes for Claude Code

Read `README.md` first. It documents the project's history, structure, data files, design system, conventions and open TODOs.

**Hard rule: never break or remove functionality that existed before 2026-11-10.** That baseline is the site as of commit `82cc0ff` ("Add conversion event picker, run results, archive/delete and Meta CLI"). Do not delete, disable or rewire any feature from that baseline. If a request seems to require changing or replacing one, stop and ask Sam first. Features added on or after 2026-11-10 may be changed or removed when Sam asks. After every change, confirm with `npm run build` that existing features still work.

Key rules:
- The brand name is always lowercase: "latest avenue" (use `site.name`).
- Site copy lives in `src/data/`, not in JSX.
- Keep the dark frosted-glass look (`.glass`, `.glass-bar` in `src/index.css`). Keep blue accents subtle.
- All database reads and writes go in `src/lib/` as named functions, never in pages or components (keeps the site ready for an MCP server later; see "Data layer" in `README.md`).
- No animations and no backend unless Sam asks.
- Never invent stats, quotes or testimonials; use `[bracketed]` placeholders.
- **Every page must work on a phone.** There is one site for all screens (no separate mobile site): build each page so it adapts. Before finishing, check it at phone size (about 390px wide) with touch: no sideways scrolling, every control on screen and big enough to tap, and nothing that needs hover, double-click or right-click as the only way to do it.
- Verify with `npm run build` before finishing a change.
