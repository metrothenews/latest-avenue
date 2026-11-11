# Notes for Claude Code

Read `README.md` first. It documents the project's history, structure, data files, design system, conventions and open TODOs.

**Hard rule: never break or remove existing functionality.** Every change must be additive. Do not delete, disable or rewire any feature the site has now. If a request seems to require changing or replacing an existing feature, stop and ask Sam first. After every change, confirm with `npm run build` that existing features still work.

Key rules:
- The brand name is always lowercase: "latest avenue" (use `site.name`).
- Site copy lives in `src/data/`, not in JSX.
- Keep the dark frosted-glass look (`.glass`, `.glass-bar` in `src/index.css`). Keep blue accents subtle.
- No animations and no backend unless Sam asks.
- Never invent stats, quotes or testimonials; use `[bracketed]` placeholders.
- Verify with `npm run build` before finishing a change.
