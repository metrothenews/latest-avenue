# latest avenue — website

Marketing website for **latest avenue**, an independent hip-hop record label founded by **Sam Rooker**. The flagship artist is **Metro The News**.

Front end only: React 18 + Vite 5 + Tailwind CSS 3 + React Router 6, plain JavaScript (no TypeScript). There is **no backend**. The demo form can POST to a form service (Formspree etc.) once `site.demoFormEndpoint` is set; the login/signup/reset forms only validate.

---

## Contents

1. [Quick start](#quick-start)
2. [Project history](#project-history)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Routes](#routes)
6. [Homepage sections](#homepage-sections)
7. [Content and data files](#content-and-data-files)
8. [Design system](#design-system)
9. [Components](#components)
10. [Forms](#forms)
11. [Conventions](#conventions)
12. [Open TODOs](#open-todos)
13. [Verifying changes](#verifying-changes)

---

## Quick start

Requires Node.js 18+ (LTS recommended).

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

On macOS you can also double-click `start.command`. It installs dependencies on first run, starts the dev server and opens Chrome.

---

## Project history

Useful context for anyone (or any AI assistant) continuing the work:

1. **Started as a structural clone of intellijend.com**, a music-marketing SaaS site Sam built earlier. The clone copied its pages and section layout (homepage, case studies, login/signup, contact, legal) as a React skeleton, deliberately **without animations or a backend**.
2. **Restyled** from a Spotify-green accent to a **dark frosted-glass look**, matched to the original site: near-black `#0a0a0a` background, faint blue-violet glow, grey translucent glass cards.
3. **Rebranded to latest avenue.** All intellijend copy was replaced with record-label copy (hip-hop only), "Case studies" became the **Roster** page, and the old SaaS-only sections (dashboard mockups, pricing, ad gallery, algorithm research, reviews) were removed.
4. **The brand name is always lowercase**: "latest avenue", even at the start of a sentence.
5. The hero headline is **"the label of the future is here"**.

The folder is still named `Intellijend Clone`, a leftover from step 1 that is safe to rename. (`package.json` was renamed to `latest-avenue`.)

---

## Tech stack

| Tool | Version (installed) | Notes |
|---|---|---|
| React / React DOM | 18.3 | Function components and hooks only |
| React Router DOM | 6.30 | `BrowserRouter`, nested layout routes |
| Vite | 5.4 | `@vitejs/plugin-react` |
| Tailwind CSS | 3.4 | With PostCSS + Autoprefixer; config in `tailwind.config.js` |
| Font | Inter | Loaded from Google Fonts in `index.html` |

There is no test runner, linter, formatter, state library or UI kit. Styling is Tailwind utility classes plus two custom classes in `src/index.css`.

---

## Project structure

```
index.html                  HTML shell: default title + meta/Open Graph tags, favicon links, Inter font
vercel.json                 SPA rewrite for Vercel (all routes → index.html)
public/
  favicon.svg               "la" favicon
  apple-touch-icon.png      180×180 home-screen icon
  og-image.png              1200×630 social share image
  _redirects                SPA rewrite for Netlify
start.command               macOS double-click launcher (install + dev server + open Chrome)
tailwind.config.js          theme: colors `ink` (#0a0a0a) and `brand` (#e5e7eb), Inter font
src/
  main.jsx                  entry: BrowserRouter + App + index.css
  App.jsx                   all routes (see Routes)
  index.css                 Tailwind layers, page background, .glass and .glass-bar classes

  components/
    layout/
      SiteLayout.jsx        Header + <Outlet/> + Footer (used by most pages)
      AuthLayout.jsx        split screen: form left, artist quote slides right (login/signup)
      CenteredLayout.jsx    logo + centered content (reset password)
      Header.jsx            sticky glass header, nav, "Submit a Demo" button, mobile menu
      Footer.jsx            footer links + copyright
      Logo.jsx              text logo (site.name), links home
      ScrollToHash.jsx      scrolls to #anchor on navigation (e.g. /#submit), else to top
      PageMeta.jsx          sets tab title + meta description per route (from data/seo.js)
    ui/
      Button.jsx            Link / <a> / <button> with variants (primary, secondary, ghost)
      Section.jsx           standard section wrapper: padding, max width, optional title/subtitle
      Eyebrow.jsx           small uppercase label above headings
      Accordion.jsx         one-open-at-a-time Q&A list (used by FAQ)
      Modal.jsx             dialog: Esc / backdrop / X to close, locks page scroll
      TextField.jsx         input or textarea (as="textarea") with label + error message
      fieldStyles.js        fieldClass(error): shared input/select/textarea styling
      Notice.jsx            inline status message box
      Placeholder.jsx       dashed "content goes here" box (currently unused, kept for mockups)
    artists/
      FlagshipArtist.jsx    big feature card for the flagship artist (home + roster)
      ArtistCard.jsx        roster card; clickable when given onClick
      ArtistModal.jsx       artist details popup
    auth/
      AuthForm.jsx          shared login/signup form (stubbed)

  sections/home/            one file per homepage section, rendered in order by pages/Home.jsx

  pages/
    Home.jsx                lists homepage sections in order
    Roster.jsx              roster page
    Contact.jsx             contact page
    Legal.jsx               template for privacy + terms (driven by data/legal.js)
    Login.jsx, Signup.jsx, ResetPassword.jsx   unlinked; kept for a possible artist portal
    NotFound.jsx            404

  data/                     ALL site copy and content (see below)
  lib/
    submitForm.js           submitForm(endpoint, data): JSON POST to a form service
    format.js               compact(), num(), slugify(); null-safe (null shows as "[X]")
    validation.js           isEmail()
```

---

## Routes

Defined in `src/App.jsx`.

| Path | Page | Layout | Linked from site? |
|---|---|---|---|
| `/` | Home | SiteLayout | yes |
| `/roster` | Roster | SiteLayout | yes |
| `/case-studies` | redirects to `/roster` | — | no (legacy URL) |
| `/contact` | Contact | SiteLayout | yes |
| `/privacy` | Legal (`doc="privacy"`) | SiteLayout | footer |
| `/terms` | Legal (`doc="terms"`) | SiteLayout | footer |
| `/login`, `/signup` | AuthForm | AuthLayout | **no** |
| `/reset-password` | ResetPassword | CenteredLayout | only from /login |
| `*` | NotFound | SiteLayout | — |

Links like `/#submit` or `/#services` work from any page: `ScrollToHash` scrolls to the element with that id after navigation.

---

## Homepage sections

Order is set in `src/pages/Home.jsx`. Reorder or remove sections there. The `id` is the anchor you can link to (`/#id`).

| # | File | id | Content | Data source |
|---|---|---|---|---|
| 1 | Hero.jsx | `hero` | founder pill, headline "the label of the future is here", buttons, "Home of Metro The News" | site.js, roster.js |
| 2 | Problem.jsx | `problem` | "The Independent Rapper's Trap": Control / Money / Time | label.js `traps` |
| 3 | Approach.jsx | `approach` | "Major-label moves. Independent terms." | inline |
| 4 | Services.jsx | `services` | 4 numbered services | label.js `services` |
| 5 | Deals.jsx | `deals` | Single Deal + Project Deal cards → link to `/?deal=<id>#submit` | deals.js |
| 6 | Founder.jsx | `founder` | Sam Rooker story, lessons, stats | label.js `founder` |
| 7 | Flagship.jsx | `metro-the-news` | FlagshipArtist card | roster.js `flagship` |
| 8 | RosterPreview.jsx | `roster` | non-flagship artists + "See the full roster" | roster.js `artists` |
| 9 | StreamingLessons.jsx | `lessons` | 4 lesson cards | label.js `lessons` |
| 10 | Comparison.jsx | `comparison` | "latest avenue vs. Going It Alone" table | comparison.js |
| 11 | SubmitDemo.jsx | `submit` | demo submission form | deals.js `dealOptions` |
| 12 | FAQ.jsx | `faq` | accordion + contact email | faq.js |
| 13 | Platforms.jsx | `platforms` | streaming platform chips | label.js `platforms` |
| 14 | FinalCTA.jsx | `get-started` | "Your Next Drop Starts Here" (also reused on /roster) | site.js |

---

## Content and data files

**Rule: copy and content live in `src/data/`, not in JSX.** To change text, edit the data file first. Short one-off headings are the exception and sit inline in their section component.

### Placeholder convention

- Text in **`[brackets]`** is a placeholder for real content, e.g. `'[Quote from Metro The News, in his own words.]'`.
- Numbers set to **`null`** render as `[X]` through `num()` / `compact()` in `lib/format.js`. Replace them with real numbers.
- Do not invent stats, quotes or testimonials. They must come from the label or the artists.

### Files

| File | Exports | What it holds |
|---|---|---|
| `site.js` | `site` | `name` ('latest avenue'), `founder`, `supportEmail` (**placeholder: you@example.com**), `replyDays`, `submitPath` ('/#submit'), `demoFormEndpoint` (form service URL; empty = not connected) |
| `seo.js` | `seo`, `notFoundTitle` | per-route `{ title, description }` for the browser tab and meta tags; unknown routes get the 404 title |
| `navigation.js` | `mainNav`, `footerNav` | header and footer links (`{ label, to }`) |
| `roster.js` | `flagship`, `artists`, `steps` | artists (see shape below); `artists[0]` is the flagship; `steps` = 3-step "how it works" on /roster |
| `label.js` | `traps`, `services`, `founder`, `lessons`, `platforms` | homepage copy blocks |
| `deals.js` | `deals`, `dealOptions` | deal cards; options for the demo form's deal dropdown |
| `comparison.js` | `columns`, `rows` | comparison table; a row is an array of cells, or `{ highlight: true, cells }` for latest avenue's row |
| `faq.js` | `faq` | `[{ id, question, answer }]` built from `[question, answer]` pairs |
| `legal.js` | `legal` | `{ privacy, terms }`, each `{ title, updated, intro[], sections[] }`; section = `{ heading, body[], subsections[] }` |

### Artist shape (`roster.js`)

```js
{
  id: 'metro-the-news',      // unique; also used as an anchor id
  name: 'Metro The News',
  bio: '...',
  before: null,              // monthly listeners before signing (number or null)
  after: null,               // monthly listeners now (number or null)
  months: null,              // months since signing (number or null)
  quote: '...',
  spotifyUrl: '#',
  // flagship only:
  streams: '[X]M+',          // display string
  latestRelease: '[Title]',
}
```

To add an artist, append an object to `artists`. They automatically appear in the homepage roster preview (all except the flagship), on `/roster`, and in the login/signup slides.

---

## Design system

### Look

Dark, minimal, **frosted grey glass** over a **near-black background with a faint blue-violet glow**, matched to the original intellijend.com. Keep the blue subtle: an earlier, stronger blue gradient was rejected as "too much blue".

### Colors and background (`src/index.css`, `tailwind.config.js`)

- Page base: `#0a0a0a` (`html` background and Tailwind color `ink`).
- `body::before` (fixed, behind everything):
  - `radial-gradient(70% 55% at 50% 0%, rgba(130,115,255,0.14), transparent 70%)`: blue-violet glow at the top
  - `radial-gradient(50% 50% at 100% 100%, rgba(60,170,255,0.06), transparent 70%)`: faint cyan bottom-right
- Accent color `brand` = `#e5e7eb` (light grey). There is no green or other saturated accent.
- Text: white, with `text-white/70` for body copy and `text-white/40`–`/60` for secondary text.

### Custom classes (`src/index.css`, `@layer components`)

- **`.glass`**: cards, panels, modals, table wrapper. `rounded-xl border border-gray-700/50 bg-gray-900/30 backdrop-blur-md` plus a subtle top inset highlight. Add a Tailwind rounding class (`rounded-2xl`, `rounded-full`) to override the radius, and `bg-white/10` / `border-white/30` to emphasize a card.
- **`.glass-bar`**: header, footer and sticky bars. `border-white/10 bg-black/30 backdrop-blur-md`. Combine with `border-b` / `border-t`.

### Buttons (`components/ui/Button.jsx`)

- `primary`: brighter frosted glass (`bg-white/20`, `border-white/25`)
- `secondary`: subtle glass (`bg-white/5`, `border-white/15`)
- `ghost`: text only
- All buttons are pill-shaped (`rounded-full`).

### Typography and layout

- Inter font. Headings use `font-bold`/`font-extrabold` and `tracking-tight`. h1 is `text-4xl md:text-6xl`, section h2 is `text-3xl md:text-4xl`.
- Content width: `max-w-6xl` centered, `px-4` side padding. Sections are `py-16 md:py-24`; use `<Section>`.
- Mobile-first: grids collapse to one column; the header switches to a ☰ menu below `md`.
- **No animations** (no marquees, carousels with auto-play, scroll effects or animated canvases) unless Sam asks for them. This was an explicit early decision.

---

## Components

```jsx
<Button to="/roster">…</Button>                       // internal link (React Router)
<Button href="https://…" target="_blank" rel="noreferrer">…</Button>   // external link
<Button onClick={fn} variant="secondary">…</Button>    // button; type="submit" also works

<Section id="faq" title="…" subtitle="…">…</Section>

<TextField id="x" name="x" label="Label" showLabel value={v} onChange={fn} error={err} />
<TextField id="msg" as="textarea" rows={4} … />      // textarea
<select className={fieldClass(error)}>…</select>      // match field styling

<Modal open={bool} onClose={fn} title="…">…</Modal>
<Accordion items={[{ id, question, answer }]} />
<ArtistCard artist={a} onClick={setSelected} />        // omit onClick for a static card
<ArtistModal artist={selectedOrNull} onClose={fn} />
<FlagshipArtist artist={flagship} />
```

---

## Forms

Only the demo form can send data, and only once `site.demoFormEndpoint` is set. The auth forms have a `// TODO` where the backend call goes.

| Form | File | Validation | On submit |
|---|---|---|---|
| Demo submission | `sections/home/SubmitDemo.jsx` | name, artist name, valid email, link must start with http(s):// | with an endpoint: POSTs `values` + `_subject` as JSON, shows "Sending…", then thank-you or an error notice. Without one: thank-you state that says nothing was sent |
| Login / signup | `components/auth/AuthForm.jsx` | valid email; password required (login) or 6+ chars (signup) | shows "isn't connected to a backend yet" |
| Reset password | `pages/ResetPassword.jsx` | valid email | shows "link on its way" (states nothing was sent) |

The demo form reads `?deal=single|project` from the URL to preselect the deal dropdown. The deal cards link to `/?deal=<id>#submit`.

**Connecting the demo form (Formspree):** create a free account at formspree.io, make a new form, copy its endpoint (`https://formspree.io/f/xxxxxxx`) into `demoFormEndpoint` in `src/data/site.js`, then submit a test demo and confirm the email. Formspree uses the `email` field as the reply-to address. Any service that accepts a JSON POST and returns 2xx works the same way. Update the privacy policy (section 1.1 Demo Submissions) to name the service.

---

## Conventions

- **Brand name is lowercase: "latest avenue".** Use `site.name` in JSX instead of hard-coding it.
- **Copy goes in `src/data/`.** Components render data; avoid hard-coding paragraphs in JSX.
- **Tailwind only.** Add shared styles to `@layer components` in `index.css` only when used in many places (like `.glass`).
- **Function components + hooks.** One component per file, default export, `.jsx` extension. Utilities are named exports in `.js` files.
- **Imports use explicit extensions** (`'./Button.jsx'`).
- **Accessibility:** real `<button>`s for actions and `<a>`/`<Link>` for navigation, labels on all inputs, `aria-expanded` / `aria-pressed` / `aria-current` where relevant, Esc closes modals.
- **No fabricated content.** Stats, quotes and testimonials must come from Sam or the artists. Use `[bracketed]` placeholders until then.
- **No animations or backend** unless asked.

---

## Open TODOs

Content (Sam to supply):
- [ ] Metro The News: bio, quote, monthly listeners before/after, months, streams, latest release, Spotify URL (`data/roster.js`)
- [ ] Other roster artists (currently `[Artist 2]`–`[Artist 4]` placeholders)
- [ ] Sam's founder story and label stats (`data/label.js` → `founder`)
- [ ] Deal terms: royalty splits, number of releases (`data/deals.js`)
- [ ] FAQ answers in brackets: masters/publishing, splits, deal length, creative support (`data/faq.js`)
- [ ] Real contact email and reply time (`data/site.js`)
- [ ] Privacy policy and terms text, plus "last updated" dates (`data/legal.js`); have a lawyer review
- [ ] "[Your terms]" cell in the comparison table (`data/comparison.js`)

Features and technical:
- [ ] Create a Formspree form and paste its endpoint into `site.demoFormEndpoint` (code is ready)
- [ ] Decide what to do with `/login`, `/signup`, `/reset-password` (artist portal, or delete)
- [ ] Artist photos / cover art (none yet)
- [x] Favicon, touch icon and social share image (`public/`)
- [x] SEO: meta description and per-page titles (`data/seo.js`)
- [ ] Make `og:image` in `index.html` an absolute URL once the domain is known
- [ ] Optional: static version of the original site's topographic-line hero background
- [ ] Rename the project folder (`package.json` is already `latest-avenue`)
- [x] Set up git
- [ ] Push to GitHub and deploy. Vercel or Netlify both work with Vite out of the box (build `npm run build`, output `dist`); the SPA rewrites are already in `vercel.json` and `public/_redirects`

---

## Verifying changes

There are no automated tests. Before calling a change done:

```bash
npm run build     # must succeed with no errors
npm run dev       # then check in the browser:
```

- `/`: all 14 sections render; header links and `/#submit`, `/#services` scroll correctly
- Demo form: empty submit shows errors; valid submit shows the thank-you state; `/?deal=project#submit` preselects "Project deal"
- `/roster`: clicking an artist opens the modal; Esc closes it
- `/contact`, `/privacy`, `/terms`: render; table of contents links jump to sections
- `/case-studies` redirects to `/roster`
- Tab title changes per page (e.g. "Roster | latest avenue"); an unknown URL shows "Page not found | latest avenue"
- Mobile width (~375px): ☰ menu opens and closes, no horizontal scroll (the comparison table scrolls inside its own box)
