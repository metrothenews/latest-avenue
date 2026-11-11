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
11. [Meta command-line tool](#meta-command-line-tool)
12. [Hosting](#hosting)
13. [Conventions](#conventions)
14. [Open TODOs](#open-todos)
15. [Verifying changes](#verifying-changes)

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
firebase.json               Firebase Hosting (serves dist/, all routes → index.html, long cache on /assets) + Firestore rules path
.firebaserc                 default Firebase project: latest-avenue-app
firestore.rules             owner-only Firestore rules (deploy: `firebase deploy --only firestore:rules`)
public/
  favicon.svg               "la" favicon
  apple-touch-icon.png      180×180 home-screen icon
  og-image.png              1200×630 social share image
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
      AdminLayout.jsx       header (logo, "admin", Dashboard/Drive/Campaigns nav, email, sign out) + content for /admin pages
      Header.jsx            sticky glass header, nav (Home, Contact), "login" button, mobile menu
      Footer.jsx            footer links + copyright
      Logo.jsx              text logo (site.name), links home
      ScrollToHash.jsx      scrolls to #anchor on navigation (e.g. /#metro-the-news), else to top
      PageMeta.jsx          sets tab title + meta description per route (from data/seo.js)
    ui/
      Button.jsx            Link / <a> / <button> with variants (primary, secondary, ghost)
      Section.jsx           standard section wrapper: padding, max width, optional title/subtitle
      Eyebrow.jsx           small uppercase label above headings
      Modal.jsx             dialog: Esc / backdrop / X to close, locks page scroll; `width` prop (used by Drive preview)
      TextField.jsx         input or textarea (as="textarea") with label + error message (unused; kept for admin tools)
      fieldStyles.js        fieldClass(error): shared input/select/textarea styling
      Notice.jsx            inline status message box
      Placeholder.jsx       dashed "content goes here" box (currently unused, kept for mockups)
    drive/
      FileResults.jsx       Drive files as a list or thumbnail grid
      FileIcon.jsx          Drive type icon or thumbnail
      FilePreview.jsx       modal with Google's embedded preview + "Open in Drive"
    meta/
      MetaConnect.jsx       "Continue with Facebook" + paste-a-token fallback for the Meta Marketing API
      FolderPicker.jsx      search box over Drive folders
      RunPanel.jsx          one saved run: upload / create-campaign buttons, per-video status, archive / delete
      RunActions.jsx        archive / unarchive and delete (with confirm) for a run; Saved runs list and run page
      RunLinkField.jsx      the run's one ads link (Saved runs list and run page); read-only once ads exist
      RunResults.jsx        read-only results of a run's campaign: totals, ad sets, sortable ads table
      RunLog.jsx            step-by-step progress of a run
    global/
      Round.jsx             one round of the /global game: outline, guess box, distance + direction hints
    auth/
      AuthProvider.jsx      layout route: Firebase auth state; useAuth() → { configured, user, loading, isOwner, signIn, signOut }
      RequireOwner.jsx      layout route: renders children only for the owner, else redirects to /login

  sections/home/            one file per homepage section, rendered in order by pages/Home.jsx

  pages/
    Home.jsx                lists homepage sections in order
    Contact.jsx             contact page
    Legal.jsx               template for privacy + terms (driven by data/legal.js)
    Login.jsx               owner sign-in with Google
    admin/Dashboard.jsx     /admin landing page: cards linking to each owner-only tool
    admin/Drive.jsx         /admin/drive: searchable Google Drive browser (see Drive browser)
    admin/Campaigns.jsx     /admin/campaigns: Drive folder → copied Meta campaign (see Meta campaign builder)
    Global.jsx              /global: hidden outline guessing game, then a gift link (see The /global game)
    NotFound.jsx            404

  data/                     ALL site copy and content (see below)
  lib/
    spotify.js              spotifyEmbedUrl(url): open.spotify.com link → embed URL (null if not Spotify)
    drive.js                Drive API v3: listFiles(), folderPath(), views/types/sorts, typeLabel(), fileSize(), shortDate()
    driveAuth.js            connectDrive() (Google popup, drive.readonly), getDriveToken(), clearDriveToken()
    meta.js                 Meta Graph API (v24.0): accounts, campaigns, copies, chunked video upload, creative swap
    metaAuth.js             startMetaLogin() / readMetaLoginRedirect() (direct Facebook login), get/set/clear the Meta token
    campaignCopy.js         uploadVideos() and finishRun(): the two stages of the Drive → Meta pipeline; runProgress()
    campaignRuns.js         Firestore: saved runs (campaignRuns) and the upload ledger (metaUploads)
    firebase.js             initializes Firebase from data/firebase.js; exports auth (null if unconfigured)
    format.js               compact(), num(), slugify(); null-safe (null shows as "[X]")
    validation.js           isEmail()
    geo.js                  distanceKm(), direction(), normalizeName() for the /global game
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
| `/global` | Global (outline guessing game) | SiteLayout | **no** (hidden; reached by typing the URL) |
| `/login` | Login (Google sign-in) | AuthLayout | header "login" button |
| `/admin` | Dashboard (owner only) | AdminLayout | **no** |
| `/admin/drive` | Drive browser (owner only) | AdminLayout | admin header |
| `/admin/campaigns` | Meta campaign builder (owner only) | AdminLayout | admin header, Drive folder button |
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
| `meta.js` | `facebookAppId`, `metaPermissions`, `facebookConfigId` | Meta app ID; Graph API permissions (used only without a configuration); Login for Business configuration ID |
| `firebase.js` | `firebaseConfig`, `ownerUid` | Firebase web config and the owner's user ID (see Owner login) |
| `seo.js` | `seo`, `notFoundTitle` | per-route `{ title, description }` for the browser tab and meta tags; unknown routes get the 404 title |
| `navigation.js` | `mainNav`, `footerNav` | header and footer links (`{ label, to }`) |
| `roster.js` | `flagship`, `artists` | artists (see shape below); `flagship.spotifyUrl` powers the homepage player; all artists' quotes show on the /login side panel |
| `global.js` | `globalGame` | copy and settings for the /global game: rounds, guesses per round, messages and the **gift link** (`gift.url`, `gift.label`) |
| `countries.js` | `countries`, `outlineSize` | **generated** (`npm run build:countries`): country names, centre points and SVG outlines. Do not edit by hand |
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

## The /global game

`/global` is a hidden page: nothing links to it, visitors reach it by typing `latestavenue.com/global`. It is an original country-outline guessing game in the site's own look (not a copy of any existing game's name or design).

- Each game picks 2 random countries (`rounds` in `data/global.js`). The player sees an outline and has `maxGuesses` (6) tries. Each wrong guess shows the distance and compass direction from the guess to the answer.
- After the last round, win or lose, the page congratulates the player and shows the **gift**: a button to `gift.url` labelled `gift.label`. **To change the offer, edit those two values in `src/data/global.js`.** While `gift.url` is empty a `[bracketed]` placeholder shows instead.
- Nothing is saved: no backend, no cookies, no storage. Reloading starts a new game.
- Country data comes from Natural Earth (public domain) via the `world-atlas` dev dependency. `scripts/build-countries.mjs` turns it into `src/data/countries.js`; rerun it with `npm run build:countries` only to change which countries are included. 196 countries can be guessed; the 151 larger than 20,000 km² can be the answer. Far-off territories (e.g. French Guiana) are left out of outlines.
- The page loads lazily, so the outline file (~480 KB) is only downloaded on `/global`.

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

## Drive browser

`/admin/drive` is a read-only, searchable view of **metrothenews@gmail.com's Google Drive**.

- **Connect:** the first visit shows "Connect Drive". Google's popup asks for read-only Drive access (`drive.readonly`) for the signed-in account, via Firebase's `reauthenticateWithPopup`, so picking a different Google account is rejected. The access token lasts ~1 hour and is kept in `sessionStorage` for that tab only; after it expires the page shows "Reconnect". Signing out clears it.
- **Privacy:** requests go straight from the browser to `googleapis.com`. Nothing is stored in Firebase, and there's no server.
- **Search:** typing searches the **whole Drive** by name and file contents (Drive's `fullText`), sorted by relevance (Drive can't sort full-text results). `/` focuses the box; Esc clears it.
- **Views:** My Drive (folder browsing with breadcrumbs), Recent, Starred, Shared with me. **Type chips:** Folders, Docs, Sheets, Slides, PDFs, Images, Video, Audio. **Sort:** last modified or name. **Layout:** list or grid (remembered in `localStorage`).
- **URL state:** `?view=&folder=&q=&type=&sort=` so back/forward, reloads and bookmarks keep your place.
- **Preview:** clicking a file opens Google's embedded preview (`…/preview`) with an "Open in Drive" button. The preview uses the browser's own Google session, so it only renders if this browser is signed in to that Google account.
- **Google Cloud setup:** the Google Drive API must be enabled on `latest-avenue-app` (https://console.cloud.google.com/apis/library/drive.googleapis.com?project=latest-avenue-app). `drive.readonly` is a "restricted" scope and the app isn't verified by Google, so the consent popup shows "Google hasn't verified this app": click **Advanced → Go to latest-avenue-app** (fine for a personal tool; verification is only needed for public apps).

---

## Meta campaign builder

`/admin/campaigns` takes an existing Meta ads campaign and a Google Drive folder of videos, and creates a **new, paused** campaign with identical settings and one ad per video. Also reachable from the Drive page via **New Meta campaign from this folder**.

### What it does

1. **Connect Meta**: **Continue with Facebook** (the page goes to Facebook and comes back with a token), or paste a token as a fallback. Pick the ad account (remembered).
2. **Template campaign**: pick a campaign; it lists the ad sets to copy and the ads. Pick the **template ad** whose text, headline, link, CTA, page/Instagram identity, URL tags and tracking will be reused.
3. **Videos**: pick a Drive folder; every video directly inside it is listed and selected (untick to skip).
4. **Review and start**: name the campaign (default "<template> — <folder>"), enter the **link for every ad** (pre-filled with the template ad's link when it has one; required, `http(s)://`), optionally pick the **conversion event** (see below), and **Save run and continue**. This saves a **run** to Firestore and opens it. Runs are listed under **Saved runs** and can be continued on any device.

Each run has two stages. Progress is saved after every step, so either stage can be stopped ("Stop after current step", a closed tab, an expired login) and continued later where it left off:

1. **Upload**: each video goes Drive → browser → the ad account's video library, two at a time (chunked, retries flaky chunks). A video **already in that ad account is reused** instead of uploaded again:
   - only by the upload ledger (`metaUploads`, keyed by ad account + the Drive file's MD5), so a renamed or moved copy of the same file still matches; the video is checked to still exist on Meta;
   - never by title: different folders often have different videos with the same file name, so a name match would put the wrong video in the ads.
   Once every video is uploaded, **the device can be shut down**: Meta processes the videos on its own.
2. **Create campaign and ads**: checks which videos Meta has finished processing (every 10 s while the page is open). For each ready video it makes a creative from the template creative with only the video, thumbnail and destination link changed (the call-to-action's link, or every `link_urls` entry of a flexible creative). Only after the first creative works does it copy the campaign (`/{id}/copies`, shallow, `PAUSED`, renamed) and **every** ad set (shallow, `PAUSED`, so targeting, budget, schedule, optimization and placements are identical); a template Meta rejects leaves nothing behind. Then it creates one ad per video **in each ad set**, named after the file, `PAUSED`. Ads appear as each video becomes ready. A video Meta can't process (or that was deleted from the library) goes back to "to upload".

**Conversion event**: when the template's ad sets optimize for a website conversion (their `promoted_object` has a pixel), a dropdown offers *Same as template* (default) and the 8 events Feature.fm sends to a Meta pixel (`knownPixelEvents` in `src/data/meta.js`, from https://help.feature.fm/articles/360042872852). Each shows how often the template's pixel fired it in 30 days (`listPixelEvents`: the pixel's `/stats?aggregation=event`, saved in Firestore at `pixelEvents/{pixelId}` and fetched from Meta again only when over 30 days old or on **Refresh now**; `loadPixelEvents` in `campaignRuns.js`). Picking one sets `custom_event_type: OTHER` + `custom_event_str` on the template's pixel. It needs every ad set to use the same pixel. If one is picked, each copied ad set is switched to it (`POST /{adset}` with `promoted_object`, keeping the template's pixel) before it gets ads; an ad set Meta refuses gets no ads and is retried next time. Ad sets that don't optimize for a website conversion are left as they are. Stored on the run as `conversion` (`{ key, type, label, id? }`), with each ad set's template `promotedObject`; runs saved before this have no dropdown.

The run's link and conversion event can be changed on the run page and in Saved runs until the first creative is made; runs saved before the link field existed ask for it there before ads can be created. **Results**: once a run's campaign exists, its page shows the campaign's status and totals (spent, results, cost per result, impressions, reach, link clicks), each ad set with its budget, and every ad in a sortable table, for today / 7 days / 30 days / lifetime (`getCampaignResults` in `lib/meta.js`, Insights API). "Results" are what each ad set optimizes for (`resultActionTypes`: the pixel event, custom conversion or goal). Totals come from Meta per level, since reach can't be summed. It only reads; turning ads on or off is done in Ads Manager.

A failed video, ad set or ad is shown on the run without stopping the rest, and is retried next time you continue. Each run (in the Saved runs list and on the run page) can be **archived**, which hides it from the list (**Show archived** brings it back, and **Unarchive** restores it; stored as `archived: true` on the run), or **deleted** after a confirm, which removes the record for good. Neither touches anything on Meta, and the upload ledger is kept, so the videos are still reused by later runs.

### Supported template ads

- Single **video** ads: video swapped.
- Single **image** ads: turned into video ads with the same text, headline, description, link and CTA.
- **Flexible / dynamic creative** (`asset_feed_spec`): same text options, one video.
- Not supported (flagged in the picker): **carousels**, and ads that promote an **existing post** (their media can't be swapped).

### One-time Meta setup

**Meta app** (https://developers.facebook.com/apps, logged in with the Facebook account that manages the ad account):

The app is `1761272091762214` (`facebookAppId`), a **Business**-type app with **Facebook Login for Business**.

1. **App settings → Basic → App Domains**: `latestavenue.com`, `latest-avenue-app.web.app`.
2. **Facebook Login for Business → Configurations**: configuration `1821308708887958` (`facebookConfigId`), a **User access token** with `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`. Change permissions there, not in code.
3. **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**: the campaign page on every domain the site runs on: `https://latestavenue.com/admin/campaigns`, `https://www.latestavenue.com/admin/campaigns`, `https://latest-avenue-app.web.app/admin/campaigns`. Localhost (`http://localhost:5173/admin/campaigns`) works while the app is in Development mode. The app can stay in **Development mode**: app admins can use every permission on their own ad accounts without Meta's App Review.

**How the login works:** **Continue with Facebook** sends the whole page to Facebook's login with the configuration ID; Facebook returns to `/admin/campaigns` with a token in the URL, which the page stores (this tab only) and removes from the address bar. A random `state` value checks the return came from this tab. It doesn't go through Firebase: Firebase's Facebook sign-in always requests the `email` permission, which Business-type apps reject ("Invalid Scopes: email"). The Firebase Facebook provider is no longer used and can be disabled. Facebook's token lasts 1–2 hours; reconnecting is one click. A longer-lived token would need a server to exchange it with the app secret (e.g. a Firebase Function, which requires the paid Blaze plan).

**Firestore** (saved runs and the upload ledger): created 2026-10-31 in `nam5`, rules published. After editing `firestore.rules`, run `firebase deploy --only firestore:rules`. If Firestore can't be reached, the campaign page says saved runs aren't available and new runs can't start.

**Fallback: paste a token.** "Or paste an access token instead": generate one in the Graph API Explorer (https://developers.facebook.com/tools/explorer/) with the same permissions. Optionally **Extend** it in the Access Token Debugger (https://developers.facebook.com/tools/debug/accesstoken/) to ~60 days and tick "Remember on this browser" (kept in `localStorage`; treat it like a password).

### Notes and limits

- Everything runs in the browser: videos stream Drive → browser memory → Meta, so very large videos need RAM and a steady connection. Keep the tab open until the upload stage finishes; after that only Meta's processing is left.
- Stage 2 also runs in the browser: ads are only created while a run's page is open. Fully hands-off creation would need a server holding the Meta token (not built).
- Uploading needs at least 20 minutes left on the Drive connection; otherwise it asks you to reconnect Drive first. The Meta token lasts 1–2 hours; if it expires mid-run, reconnect and continue.
- If an ad set's end date is in the past, Meta refuses to copy it; edit it in Ads Manager first (the picker warns about this).
- Uploaded videos stay in the ad account's video library even if a later step fails. Partial campaigns are paused; delete them in Ads Manager if needed.
- `GRAPH_VERSION` in `src/lib/meta.js` is the Graph API version; bump it when Meta deprecates it (roughly every two years).

---

## Meta command-line tool

`scripts/meta.mjs` (`npm run meta -- help`) runs the site's own Meta code from the terminal, for testing and debugging the campaign builder (including by Claude Code).

- **Login:** on `/admin/campaigns`, connect Meta and click **Copy token for the command-line tool**, then run `npm run meta -- login` in a terminal in this folder and paste it (hidden). It's saved to `.secrets/meta-token` (git-ignored, mode 600) and lasts 1–2 hours.
- **Reads:** `whoami`, `accounts`, `runs` (Firestore, via the owner's `gcloud` login), `template`, `params`, `results`, and `get <path>` for any Graph API read.
- **Checks without creating:** `creative` and `ad` ask Meta to validate (`execution_options: validate_only`) the creative / a paused ad the site would make; `--drop a.b.c` removes a field first, to find what Meta rejects.
- **Safety:** the only write it can make is an ad creative, and only with `creative --create`. It has no code for creating campaigns, ad sets or ads or changing any status, so it can't spend money.

## Hosting

The site is on **Firebase Hosting** in the `latest-avenue-app` project (owned by metrothenews@gmail.com; samuelrooker27@gmail.com is also an Owner), at https://latestavenue.com, with `www` redirecting to it. Also reachable at https://latest-avenue-app.web.app.

**Deploy** (manual; needs the Firebase CLI signed in to an account with access):

```
npm run build && firebase deploy --only hosting
```

**Domain**: registered at Squarespace (Domains → latestavenue.com → DNS). The Custom Records Firebase needs:

| Type | Host | Data |
|------|------|------|
| A | `@` | `199.36.158.100` |
| TXT | `@` | `hosting-site=latest-avenue-app` |
| CNAME | `www` | `latest-avenue-app.web.app` |

Keep the **Email Security** records (`v=spf1 -all` and `_dmarc`: the domain sends no email) and **Squarespace Domain Connect**; the **Squarespace Defaults** group is deleted. Firebase issues the HTTPS certificate itself once the records resolve. `latestavenue.com` and `www.latestavenue.com` are in Firebase Auth's authorized domains; the Meta app's App Domains should list `latestavenue.com` and `latest-avenue-app.firebaseapp.com` (App settings → Basic).

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
- [ ] **Facebook login for Meta**: now a direct login with configuration `1821308708887958` (Firebase's version failed with "Invalid Scopes: email" once the app became a Business app). Needs the redirect URIs above added in the Meta app, then a test. The paste-a-token fallback works meanwhile.
- [ ] Later, optional: a long-lived (~60-day) Meta token needs a server-side exchange with the app secret (Firebase Function, paid Blaze plan)
- [ ] **Campaign builder, next session:**
  - Re-test with the ads link field. Template ads with no link of their own failed with "The link field is required" (first on "assignment 14", again 2026-11-01 on NewStyleScript1Number1.mp4); every run now sets one link for all ads. Untested against Meta.
  - Delete the empty paused campaign "…— assignment 14" in Ads Manager, and optionally the 20 unused videos from that run in the ad account's media library.
  - Test saved runs end to end: upload half a folder, stop, continue; finish on another device. Firestore is live; the code is untested against real Firestore and Meta (stage logic checked against fakes only).
  - The 20 videos from the "assignment 14" run were uploaded before the ledger existed, so a re-run of that folder uploads them again (title matching was removed because it reused same-named videos from other folders).
- [x] Favicon, touch icon and social share image (`public/`)
- [x] SEO: meta description and per-page titles (`data/seo.js`)
- [x] `og:image` in `index.html` is an absolute URL (https://latestavenue.com/og-image.png)
- [ ] Optional: static version of the original site's topographic-line hero background
- [ ] Rename the project folder (`package.json` is already `latest-avenue`)
- [x] Set up git
- [x] Hosted on Firebase Hosting (see Hosting)
- [ ] Optional: deploy automatically on push to `main` (`firebase init hosting:github`); for now deploys are manual
- [ ] After latestavenue.com is confirmed working, optionally remove samuelrooker27@gmail.com from the Firebase project (metrothenews@gmail.com is Owner since 2026-10-31)

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
- `/global`: an outline shows; a made-up name is rejected; a wrong guess shows distance and direction; after two rounds the congratulations card shows the gift button (or the placeholder while `gift.url` is empty); "Play again" restarts. No header or footer link points to it
- `/admin/drive` (signed in as owner): Connect Drive works; search, view tabs, type chips, sort, list/grid, folder breadcrumbs, Load more and the preview modal all work
- `/admin/campaigns`: connect Meta, pick account → campaign → template ad → Drive folder, create; check the new paused campaign in Ads Manager
- `/admin` redirects to `/login` when signed out; `/signup` and `/reset-password` redirect to `/login`
- Tab title changes per page (e.g. "Contact | latest avenue"); an unknown URL shows "Page not found | latest avenue"
- Mobile width (~375px): ☰ menu opens and closes, no horizontal scroll
