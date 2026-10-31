# latest avenue — website

Website for **latest avenue**, an independent hip-hop record label founded by **Sam Rooker**. The flagship artist is **Metro The News**.

React 18 + Vite 5 + Tailwind CSS 3 + React Router 6, plain JavaScript (no TypeScript). There is **no server of our own**. The public site is a minimal homepage (headline, login link, Metro The News' Spotify player) plus contact and legal pages, and an **owner-only admin area** (`/login` → `/admin`) uses Firebase Google sign-in, restricted to Sam's account (see [Owner login](#owner-login)).

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
10. [Owner login](#owner-login)
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
6. **Owner login added** (Firebase Google sign-in, `/login` → `/admin`) so Sam can build private tools.
7. **Stripped back to a minimal homepage.** All sales sections (problem, approach, services, deals, founder, lessons, comparison, demo form, FAQ, platforms, CTA), the roster page and the Formspree demo-form wiring were removed. They're recoverable from git (commit `3fd744a` and earlier).

The folder is still named `Intellijend Clone`, a leftover from step 1 that is safe to rename. (`package.json` was renamed to `latest-avenue`.)

---

## Tech stack

| Tool | Version (installed) | Notes |
|---|---|---|
| React / React DOM | 18.3 | Function components and hooks only |
| React Router DOM | 6.30 | `BrowserRouter`, nested layout routes |
| Vite | 5.4 | `@vitejs/plugin-react` |
| Tailwind CSS | 3.4 | With PostCSS + Autoprefixer; config in `tailwind.config.js` |
| Firebase | 12 | Auth only (Google sign-in) for `/login` + `/admin`; lazy-loaded, not in the public bundle |
| Font | Inter | Loaded from Google Fonts in `index.html` |

There is no test runner, linter, formatter, state library or UI kit. Styling is Tailwind utility classes plus two custom classes in `src/index.css`.

---

## Project structure

```
index.html                  HTML shell: default title + meta/Open Graph tags, favicon links, Inter font
vercel.json                 SPA rewrite for Vercel (all routes → index.html)
firestore.rules             owner-only Firestore rules to paste into the Firebase console
public/
  favicon.svg               "la" favicon
  apple-touch-icon.png      180×180 home-screen icon
  og-image.png              1200×630 social share image
  _redirects                SPA rewrite for Netlify
  robots.txt                keeps /login and /admin out of search engines
start.command               macOS double-click launcher (install + dev server + open Chrome)
tailwind.config.js          theme: colors `ink` (#0a0a0a) and `brand` (#e5e7eb), Inter font
src/
  main.jsx                  entry: BrowserRouter + App + index.css
  App.jsx                   all routes (see Routes)
  index.css                 Tailwind layers, page background, .glass and .glass-bar classes

  components/
    layout/
      SiteLayout.jsx        Header + <Outlet/> + Footer (used by most pages)
      AuthLayout.jsx        split screen: form left, artist quote slides right (/login)
      AdminLayout.jsx       header (logo, "admin", email, sign out) + content for /admin pages
      Header.jsx            sticky glass header, nav (Home, Contact), "login" button, mobile menu
      Footer.jsx            footer links + copyright
      Logo.jsx              text logo (site.name), links home
      ScrollToHash.jsx      scrolls to #anchor on navigation (e.g. /#metro-the-news), else to top
      PageMeta.jsx          sets tab title + meta description per route (from data/seo.js)
    ui/
      Button.jsx            Link / <a> / <button> with variants (primary, secondary, ghost)
      Section.jsx           standard section wrapper: padding, max width, optional title/subtitle
      Eyebrow.jsx           small uppercase label above headings
      Modal.jsx             dialog: Esc / backdrop / X to close, locks page scroll (unused; kept for admin tools)
      TextField.jsx         input or textarea (as="textarea") with label + error message (unused; kept for admin tools)
      fieldStyles.js        fieldClass(error): shared input/select/textarea styling
      Notice.jsx            inline status message box
      Placeholder.jsx       dashed "content goes here" box (currently unused, kept for mockups)
    auth/
      AuthProvider.jsx      layout route: Firebase auth state; useAuth() → { configured, user, loading, isOwner, signIn, signOut }
      RequireOwner.jsx      layout route: renders children only for the owner, else redirects to /login

  sections/home/            one file per homepage section, rendered in order by pages/Home.jsx

  pages/
    Home.jsx                lists homepage sections in order
    Contact.jsx             contact page
    Legal.jsx               template for privacy + terms (driven by data/legal.js)
    Login.jsx               owner sign-in with Google
    admin/Dashboard.jsx     /admin landing page for owner-only tools
    NotFound.jsx            404

  data/                     ALL site copy and content (see below)
  lib/
    spotify.js              spotifyEmbedUrl(url): open.spotify.com link → embed URL (null if not Spotify)
    firebase.js             initializes Firebase from data/firebase.js; exports auth (null if unconfigured)
    format.js               compact(), num(), slugify(); null-safe (null shows as "[X]")
    validation.js           isEmail()
```

---

## Routes

Defined in `src/App.jsx`.

| Path | Page | Layout | Linked from site? |
|---|---|---|---|
| `/` | Home | SiteLayout | yes |
| `/roster`, `/case-studies` | redirect to `/` | — | no (removed / legacy URLs) |
| `/contact` | Contact | SiteLayout | yes |
| `/privacy` | Legal (`doc="privacy"`) | SiteLayout | footer |
| `/terms` | Legal (`doc="terms"`) | SiteLayout | footer |
| `/login` | Login (Google sign-in) | AuthLayout | header "login" button |
| `/admin` | Dashboard (owner only) | AdminLayout | **no** |
| `/signup`, `/reset-password` | redirect to `/login` | — | no (removed) |
| `*` | NotFound | SiteLayout | — |

Links like `/#metro-the-news` work from any page: `ScrollToHash` scrolls to the element with that id after navigation.

---

## Homepage sections

Order is set in `src/pages/Home.jsx`. Reorder or remove sections there. The `id` is the anchor you can link to (`/#id`).

| # | File | id | Content | Data source |
|---|---|---|---|---|
| 1 | Hero.jsx | `hero` | headline "the label of the future is here" + "login" button | inline |
| 2 | Listen.jsx | `metro-the-news` | glass card: "Flagship artist", name, "Open in Spotify", Spotify's embedded player (top tracks). Shows a `[bracketed]` placeholder until `spotifyUrl` is set | roster.js `flagship` |

The player is Spotify's official iframe embed (`open.spotify.com/embed/artist/<id>`), so it needs no API key and always shows Spotify's current data. Spotify may set its own cookies inside the iframe; mention it in the privacy policy.

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
| `site.js` | `site` | `name` ('latest avenue'), `founder`, `supportEmail` (**placeholder: you@example.com**) |
| `firebase.js` | `firebaseConfig`, `ownerUid` | Firebase web config and the owner's user ID (see Owner login) |
| `seo.js` | `seo`, `notFoundTitle` | per-route `{ title, description }` for the browser tab and meta tags; unknown routes get the 404 title |
| `navigation.js` | `mainNav`, `footerNav` | header and footer links (`{ label, to }`) |
| `roster.js` | `flagship`, `artists` | artists (see shape below); `flagship.spotifyUrl` powers the homepage player; all artists' quotes show on the /login side panel |
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
  spotifyUrl: '',            // public open.spotify.com/artist/... link; flagship's powers the homepage player
  // flagship only:
  streams: '[X]M+',          // display string
  latestRelease: '[Title]',
}
```

To add an artist, append an object to `artists`. They appear in the /login side-panel quotes. The bio/stat fields are currently unused (the roster page and stats card were removed).

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
- Content width: `max-w-6xl` centered (the homepage card is `max-w-3xl`), `px-4` side padding. Sections are `py-16 md:py-24`; use `<Section>`.
- Mobile-first: grids collapse to one column; the header switches to a ☰ menu below `md`.
- **No animations** (no marquees, carousels with auto-play, scroll effects or animated canvases) unless Sam asks for them. This was an explicit early decision.

---

## Components

```jsx
<Button to="/contact">…</Button>                      // internal link (React Router)
<Button href="https://…" target="_blank" rel="noreferrer">…</Button>   // external link
<Button onClick={fn} variant="secondary">…</Button>    // button; type="submit" also works

<Section id="x" title="…" subtitle="…">…</Section>

<TextField id="x" name="x" label="Label" showLabel value={v} onChange={fn} error={err} />
<TextField id="msg" as="textarea" rows={4} … />      // textarea
<select className={fieldClass(error)}>…</select>      // match field styling

<Modal open={bool} onClose={fn} title="…">…</Modal>
```

---

## Owner login

`/login` signs in with Google through Firebase Auth. Only the account whose user ID matches `ownerUid` in `src/data/firebase.js` can open `/admin`; anyone else who signs in sees "this account doesn't have access". The header's and homepage's "login" buttons link to `/login`; `robots.txt` keeps `/login` and `/admin` out of search engines.

**How secure is it?** The route guard (`RequireOwner`) only hides pages in the browser; the JavaScript for `/admin` still ships to anyone who looks for it. That's fine for UI, but **any private data must live in Firestore (or another Firebase service) behind `firestore.rules`**, which Google enforces on its servers. Never put secrets (API keys for paid services, private info) in front-end code.

### Current setup

- Firebase project: **`latest-avenue-app`** (display name "latest avenue"), created with the Firebase CLI under samuelrooker27@gmail.com. Console: https://console.firebase.google.com/project/latest-avenue-app
- Web app "latest avenue site"; its config is in `src/data/firebase.js`.
- Google sign-in enabled. Owner account: **metrothenews@gmail.com** (its UID is `ownerUid` and is in `firestore.rules`).
- To change the owner: have the new account sign in once at `/login`, run `firebase auth:export users.json --project latest-avenue-app` to find its `localId`, put that in `ownerUid` and `firestore.rules`, then delete `users.json`.

### One-time setup (for reference / a new project)

1. Go to console.firebase.google.com → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, pick a support email, Save.
3. **Project settings (gear) → General → Your apps → Web (`</>`)**, register an app (no Hosting needed). Copy `apiKey`, `authDomain`, `projectId`, `appId` into `firebaseConfig` in `src/data/firebase.js`.
4. `npm run dev`, open http://localhost:5173/login, **Continue with Google**. The page shows your user ID.
5. Paste that ID into `ownerUid` in `src/data/firebase.js`. Reload: `/login` now takes you to `/admin`.
6. When you add Firestore (**Build → Firestore Database → Create database**, production mode), paste `firestore.rules` into its **Rules** tab with `OWNER_UID` replaced, and Publish.
7. After deploying, add your domain under **Authentication → Settings → Authorized domains** (localhost is there by default).

### Adding an owner-only feature

Create a page in `src/pages/admin/`, lazy-import it in `App.jsx`, and add a `<Route path="/admin/your-tool">` next to the Dashboard route (inside `RequireOwner` → `AdminLayout`). Use `useAuth()` for the user. Add a title in `data/seo.js`.

---

## Conventions

- **Brand name is lowercase: "latest avenue".** Use `site.name` in JSX instead of hard-coding it.
- **Copy goes in `src/data/`.** Components render data; avoid hard-coding paragraphs in JSX.
- **Tailwind only.** Add shared styles to `@layer components` in `index.css` only when used in many places (like `.glass`).
- **Function components + hooks.** One component per file, default export, `.jsx` extension. Utilities are named exports in `.js` files.
- **Imports use explicit extensions** (`'./Button.jsx'`).
- **Accessibility:** real `<button>`s for actions and `<a>`/`<Link>` for navigation, labels on all inputs, `aria-expanded` / `aria-pressed` / `aria-current` where relevant, Esc closes modals.
- **No fabricated content.** Stats, quotes and testimonials must come from Sam or the artists. Use `[bracketed]` placeholders until then.
- **No animations or backend** unless asked. (Sam asked for Firebase auth for the owner-only area.)

---

## Open TODOs

Content (Sam to supply):
- [x] Metro The News' Spotify artist link (`flagship.spotifyUrl` in `data/roster.js`)
- [ ] Metro The News' quote, other artists' names/quotes (shown on /login)
- [ ] Real contact email (`data/site.js`)
- [ ] Privacy policy and terms text, plus "last updated" dates (`data/legal.js`); mention Firebase sign-in and the Spotify embed; remove "Demo Submissions"; have a lawyer review

Features and technical:
- [x] Owner-only Google login (`/login` → `/admin`); signup and reset-password pages removed
- [x] Firebase setup: project `latest-avenue-app`, Google sign-in enabled, owner = metrothenews@gmail.com
- [ ] When the first feature stores data: create Firestore and run `firebase deploy --only firestore:rules --project latest-avenue-app` (rules already have the owner UID)
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

- `/`: headline, "login" button and the Metro The News card render; with `spotifyUrl` set the player loads, without it the placeholder shows; both "login" buttons go to `/login`
- `/contact`, `/privacy`, `/terms`: render; table of contents links jump to sections
- `/roster` and `/case-studies` redirect to `/`
- `/admin` redirects to `/login` when signed out; `/signup` and `/reset-password` redirect to `/login`
- Tab title changes per page (e.g. "Contact | latest avenue"); an unknown URL shows "Page not found | latest avenue"
- Mobile width (~375px): ☰ menu opens and closes, no horizontal scroll
