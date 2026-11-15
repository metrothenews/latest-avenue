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
13. [Data layer](#data-layer-ready-for-an-mcp-later)
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
      TeamLayout.jsx        header (logo, "team", Home/Messages nav, email, sign out) + content for the team portal
      Header.jsx            sticky glass header, nav (Home, Contact), "login" button, mobile menu
      Footer.jsx            footer links + copyright
      Logo.jsx              text logo (site.name), links home
      ScrollToHash.jsx      scrolls to #anchor on navigation (e.g. /#metro-the-news), else to top
      PageMeta.jsx          sets tab title + meta description per route (from data/seo.js)
      ErrorBoundary.jsx     shows "Something went wrong" + Reload instead of a blank page if a page crashes
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
    note/
      NoteHeader.jsx        breadcrumbs, undo / redo, save status, board title, Share
      NoteToolbar.jsx       left toolbar: card types to drag out; options for the selection; text formatting while editing
      CardBody.jsx          the inside of a card by type (note, to-do list, heading, board icon, column header), shown and edited
      LineEdit.jsx          one-line text field for headings, board / column names and line labels
      Lines.jsx             the lines and arrows layer (SVG) with end and bend handles and labels
      ContextMenu.jsx       right-click menu
      PdfViewer.jsx         full-screen PDF viewer: draws every page itself (pdf.js), with zoom and download
      BoardIcon.jsx         a board's tile and icon (also draws an icon from its saved shapes)
      IconMenu.jsx          small menu beside a board's tile: choose its icon (search, 50 shown at a time)
      NoteEditor.jsx        rich text editor for note cards (TipTap)
      TrashPanel.jsx        a board's trashed cards: restore, empty
      ShareDialog.jsx       read-only link on / off, copy link
    team/
      DocContent.jsx        shows the assignments doc's saved HTML, sanitized (DOMPurify), styled by .doc-content in index.css
      TeamAccess.jsx        layout route: sign-in and team-list check for /team pages; useTeamMember() → { email, name, role }
      Conversation.jsx      one chat: live message list + the box to write in
    admin/
      AssignmentsAdmin.jsx  Assignments section of /admin/team: one doc link and a Refresh button
    analytics/
      AreaChart.jsx         one metric per day as a smooth SVG area chart; hover, touch or arrow keys read a day
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
    Analytics.jsx           /analytics: Meta Ads numbers at a glance (owner only; see Analytics)
    admin/Team.jsx          /admin/team: who can open the team portal, and its welcome message (see Team portal)
    Team.jsx                /team: team portal home: the welcome page
    TeamAssignments.jsx     /team/assignments: the assignments doc, whole, as one page (see Team assignments)
    note/NoteBoard.jsx      /team/note (home board + welcome pop-up) and /team/note/:boardId: one board: canvas, dragging, selection, undo, keyboard (see latest avenue note)
    TeamMessages.jsx        /team/chat: team chat + private one-to-one chats (see Team messaging)
    Global.jsx              /global: hidden outline guessing game, then a gift link (see The /global game)
    NotFound.jsx            404

  data/                     ALL site copy and content (see below)
  lib/
    freshness.js            reloads a tab that is running an out-of-date copy of the site (see Hosting → Staying up to date)
    spotify.js              spotifyEmbedUrl(url): open.spotify.com link → embed URL (null if not Spotify)
    drive.js                Drive API v3: listFiles(), folderPath(), views/types/sorts, typeLabel(), fileSize(), shortDate()
    driveAuth.js            connectDrive() (Google popup, drive.readonly), getDriveToken(), clearDriveToken()
    meta.js                 Meta Graph API (v24.0): accounts, campaigns, copies, chunked video upload, creative swap
    metaAuth.js             startMetaLogin() / readMetaLoginRedirect() (direct Facebook login), get/set/clear the Meta token
    campaignCopy.js         uploadVideos() and finishRun(): the two stages of the Drive → Meta pipeline; runProgress()
    campaignRuns.js         Firestore: saved runs (campaignRuns) and the upload ledger (metaUploads)
    metaAnalytics.js        Meta Insights (read-only) for /analytics: getOverview(), getCampaignRows(), getCampaign()
    analyticsFormat.js      formatValue() (money / count / percent), shortDay(), longDay()
    team.js                 Firestore: team list (teamMembers) and the portal's welcome message (portal/welcome)
    assignments.js          the assignments doc: read from Drive as HTML (Google export, or Word via mammoth), cleaned, stored in Firestore
    note.js                 Firestore: note boards and their cards, live; sharing; moving cards between boards
    noteGeometry.js         where a line runs between cards: edge points, curve, arrowheads
    pdf.js                  loads pdf.js (the PDF drawing library) on demand
    pdfThumb.js             draws a PDF's first page as a picture for its card
    teamChat.js             Firestore: team messaging (chats and their messages), live updates
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
| `/experience` | Experience: a 360° view you turn left and right in | none (full screen) | **no** (hidden; reached by typing the URL) |
| `/experience/controller` | A phone game controller that steers `/experience` on another screen | none (full screen) | QR code / address shown on `/experience` |
| `/login` | Login (Google sign-in) | AuthLayout | header "login" button |
| `/admin` | Dashboard (owner only) | AdminLayout | **no** |
| `/admin/drive` | Drive browser (owner only) | AdminLayout | admin header |
| `/admin/campaigns` | Meta campaign builder (owner only) | AdminLayout | admin header, Drive folder button |
| `/analytics` | Analytics: Meta Ads at a glance (owner only) | AdminLayout | admin header, dashboard |
| `/admin/team` | Admin: team list and welcome message (owner only) | AdminLayout | admin header and dashboard ("Admin") |
| `/team` | Team portal (people on the team list) | TeamLayout | **no** (share the address with the team) |
| `/team/assignments` | Team assignments: one doc shown whole (people on the team list) | TeamLayout | team portal header |
| `/team/note` | The note home board with a welcome pop-up over it | none (full screen) | **no** (unlisted) |
| `/team/note/home`, `/team/note/:boardId` | A note board. Team members edit; anyone with the link can view a board that has been shared | none (full screen) | team portal header ("Note") |
| `/team/crew` | Crew Login: Google sign-in for people on the crew list | none (full screen) | **no** (share the address with the crew) |
| `/team/note/welcome` | The crew welcome (fades in line by line), then on to the boards | none (full screen) | reached from `/team/crew` |
| `/team/chat` | Team messaging (people on the team list) | TeamLayout | team portal header |
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
| `analytics.js` | `analytics`, `ranges`, `metrics` | copy for /analytics, its date ranges and the metrics it can chart (label, format, which direction is better) |
| `note.js` | `note`, `tools`, `colors`, `featuredIcons` | copy for latest avenue note, the toolbar's card types, the board themes and the icons offered first |
| `team.js` | `team` | copy for the team portal: sign-in, nav, messaging labels and fallback welcome text (the team list, welcome message and messages themselves are in Firestore) |
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

## The /experience view

`/experience` puts you in one spot of a 3D scene (Sam's Unreal Engine office) and lets you turn left and right, all the way round, as if it were being drawn live. It is really one still panorama.

- **How it works (`src/lib/pano.js`, no library):** the panorama is wrapped around the inside of a sphere and looked at from the centre through a 45mm lens, in one WebGL canvas. The graphics chip does the perspective, which is what makes it feel like turning your head instead of sliding a picture. A frame is drawn only when the view changes, so it costs nothing while you hold still.
- **Controls (`src/pages/Experience.jsx`):** drag or swipe (the spot you grab stays under your finger, with a short coast after letting go, unless the device asks for reduced motion), **left and right arrow keys**, a sideways trackpad scroll or Shift + wheel turn. **F** or the corner button is full screen (iPhone Safari has no full screen for pages; there the button is hidden and the page simply fills the screen). There is no zoom and no moving.
- **Handheld feel (`handheld` in `src/data/experience.js`):** the arrow keys turn with momentum: a turn starts at `minSpeed`, eases up to `maxSpeed`, and coasts to a stop when the key is let go. The camera leans (rolls) into the turn in proportion to its speed, up to `maxRoll`, and straightens as it stops. When nothing is being moved the camera drifts like one held in the hand: every few seconds it picks new, tiny random pan, tilt and roll offsets and eases towards them very slowly. The drift fades down while turning and comes back after. Every number (speeds, lean, drift size and pace) is in that one setting. Because of the drift the page redraws continuously while it is open (the browser pauses it in a background tab). **People whose device asks for reduced motion get none of this:** a steady turn while the key is down, no lean, no drift, and no redrawing while still.
- **The computers and the slideshow:** look at any of the four monitors and a thin outline fades in around it, followed by an "A" prompt. The **space bar** (standing in for an A button; a click or tap on the prompt does the same) closes the view in on that monitor's screen, and a PDF is shown on the glass one page at a time. **Left and right arrow keys** change slide (so do a sideways swipe and the buttons at the bottom); the **X key** (or Esc, or the on-screen X button) goes back out. The on-screen prompts are drawn like a game's: an A button above the monitor, arrow keys at the sides of the view, and an X button with the slide number at the bottom. It remembers which slide you were on. The PDF is `slides` in `src/data/experience.js` (the file is in `public/slides/`; replace it or point to another); pdf.js is only loaded once a monitor is first looked at. The monitors are listed in `computers` there, each with a `body` (what is outlined) and a `screen` (where the slide goes), measured in pixels on the panorama: re-measure them if the render changes. `closeIn`, `closeInTime`, `slideFade` and `lockMargin` tune the move. The slide is drawn by the same renderer (`stage.slide` in `src/lib/pano.js`); `src/lib/panoSpots.js` turns the pixel rectangles into angles and `src/lib/slides.js` draws the PDF pages.
- **Film grain (`grain` in `src/data/experience.js`):** fine grey specks over the whole picture that change 24 times a second, strongest in the mid-tones; `amount`, `size` and `fps` tune it, and `amount: 0` switches it off. Drawn by the same shader, so it costs almost nothing. It holds still for reduced motion.
- **Phone controller (`/experience/controller`, `src/pages/Controller.jsx`):** white lines on black: a stick on the left, and A and X buttons on the right (X up and to the left of A). On `/experience`, the controller button (top right) shows a 5-character code and a QR code; scanning it, or opening the address on a phone and typing the code, pairs that phone with that screen. The stick turns and looks up and down (a gentle push moves slowly), A is the space bar, X is the X key, and with slides showing a push left or right changes slide. The keyboard and mouse keep working alongside it. The phone is kept awake while the page is open. Copy and the stick's dead zone are under `controller` in `src/data/experience.js`.
- **How the two pages talk (`src/lib/padLink.js`):** through Firebase's **Realtime Database**, the way a shared spreadsheet stays live: the phone writes what its stick and buttons are doing to `pads/{code}`, and the screen, listening to the same spot, gets each change as it happens (the stick is sent at most 30 times a second). `pads/{code}` holds `host` (set by the screen), `pad` (true while a controller is connected) and `input` `{ x, y, a, b }` (the stick, and how many times A and X have been pressed). Everything under a code is removed when the screen's page closes; the stick is set back to the middle if the phone drops. Nobody signs in on these pages, so `database.rules.json` lets anyone read or write under a 5-character code, but only those fields, only numbers in range, and nothing can be listed. Sam asked for this live database (the site's rule is no backend unless asked).
- **One-time setup for the controller:** in the Firebase console open **Realtime Database → Create database** (United States, locked mode). If the address it shows isn't `https://latest-avenue-app-default-rtdb.firebaseio.com`, put the one it shows in `databaseURL` in `src/data/firebase.js`. Then `firebase deploy --only database` (the rules) and deploy the site.
- **Looking up and down (up and down arrow keys):** up to `maxUp` (45°, half way to straight up) and down to `maxDown` (18°, a fifth of the way to straight down), with the same momentum as turning, easing to a stop at each limit. An exposure adjustment follows where you look: up to `exposureUp` stops brighter at the top limit and `exposureDown` stops darker at the bottom limit (1 stop is twice, or half, the light), in proportion in between. It is applied to everything drawn, like an adjustment layer (`uGrade` in `src/lib/pano.js`): darker is a plain cut in exposure; brighter lifts the shadows and mid-tones towards white rather than scaling everything, so parts that are already bright (the ceiling lights) don't cap the effect. Dragging and swiping only turn, so on a phone the view stays level. `lookUpDown: false` switches it all off. Settings are in `src/data/experience.js`.
- **Settings (`src/data/experience.js`):** `focalLength` and `portraitFocalLength` (mm on a 36 × 24 frame; the screen shows a crop of that frame), `startYaw`, `keySpeed`, and the page's copy.
- **The image:** one full 360° × 180° equirectangular render (2:1), camera level, centre column facing the way the page should open. For a sharp 45mm view it must be **at least 16384 × 8192**. Render with auto exposure, vignette, lens flares, motion blur, film grain and depth of field off.
- **Preparing it:** `npm run pano -- path/to/panorama.png` (`scripts/pano.mjs`, uses the dev-only `sharp` package) writes `public/pano/`: a small `preview.webp` of the whole thing, the panorama at full, half and quarter size cut into 2048px tiles (`<width>/<row>_<col>.webp`), and `manifest.json`. The page shows the preview at once, then downloads only the tiles being faced, at the size the screen needs. Commit `public/pano/` and deploy. The source render is not copied into the site.
- **Currently** `public/pano/` holds the full-size office render (16384 × 8192, about 11 MB of tiles in all).
- **Data use:** a full turn at the largest size downloads several MB. Firebase's free plan allows about 360 MB of downloads a day.

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
- **One site for every screen.** There is no separate mobile site (no `m.` address): each page adapts to the screen. Every new page is checked at phone size (about 390px wide) with touch before it's done: no sideways scrolling, every control on screen and big enough to tap, nothing that works only by hover, double-click or right-click.
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

## Analytics

`/analytics` (owner only, "Analytics" in the admin header) shows the Meta Ads account's numbers at a glance. The layout follows Sam's earlier intellijend "Console" demo: filters, a big area chart with a metric dropdown, and a "Top" list that opens a detail view with a back button.

- **Filters** (one row at the top): ad account (shared with `/admin/campaigns` via `localStorage` `meta-account`; only shown with more than one account) and date range (past 7 / 14 / 28 / 90 days, Meta's `date_preset`s: whole days in the ad account's time zone, today excluded; remembered in `localStorage`).
- **Totals:** amount spent, impressions, reach, link clicks, CTR (link clicks ÷ impressions), CPC (spend ÷ link clicks) and CPM. Clicking a total charts it. Totals come from Meta for the whole period, because reach can't be added up across days.
- **Chart:** one metric per day (`?metric=` in the URL). Days with no delivery show as 0. Hover, tap or focus it and use the arrow keys to read a day; "Show as a table" lists every day. No chart library and no animation: `components/analytics/AreaChart.jsx` draws SVG (monotone curve, so it never dips below 0 or overshoots a real value).
- **Top campaigns:** every campaign that delivered in the period, sorted by the charted metric (costs: lowest first; campaigns without a value last). Clicking one opens `?campaign=<id>`: the same totals and chart for that campaign, and a link to it in Ads Manager.
- **Meta connection:** a "Connect Meta" card at the top, the same as step 1 of `/admin/campaigns`: "Continue with Facebook" or a pasted token when not connected, "Connected as …" and **Disconnect** when connected. It is the same token as `/admin/campaigns` (this tab, or remembered), so connecting on one page connects the other. Facebook returns to `/admin/campaigns` (the only registered redirect URI), which forwards straight back to `/analytics`, with the error if the login failed or was cancelled (`startMetaLogin(returnTo)` and `takeMetaLoginError()` in `lib/metaAuth.js`). An expired token shows the connect options again.
- Read-only: it never changes anything on Meta. Money is in the ad account's currency.

---

## Team portal

`/team` is a portal for people who work at the label. Nothing on the public site links to it; give the address to the team. `robots.txt` keeps it out of search engines.

- **Signing in:** "Continue with Google" (the same Firebase sign-in as `/login`). People on the team list see the portal; anyone else sees "this account isn't on the team list" and a sign-out button. The owner always has access.
- **Naming:** "Team" always means the portal itself (`/team`); "Admin" means the page that manages it (`/admin/team`). The admin header and the dashboard each have both, and the page's heading is "Admin".
- **Managing it (`/admin/team`, owner only):** add a person by their **Google account email** (name and role optional), remove them with a confirm, and edit the **welcome message** (heading + text) everyone sees. Changes apply straight away, with no redeploy.
- **What it shows now:** a welcome page (the heading with the person's first name, their role, and the message) and **Messages** (see Team messaging). Until a message is saved it shows the `[bracketed]` placeholder from `data/team.js`. To add a page, add a route inside `TeamAccess` in `App.jsx` and a link in `team.nav` (`data/team.js`).
- **Storage (Firestore):** `teamMembers/{email}` (document ID = lowercase email; fields `email`, `name`, `role`, `addedAt`; the owner gets an entry automatically on first visit, marked `owner: true`, so the team can message them; it can't be removed at `/admin/team`) and `portal/welcome` (`heading`, `message`, `updatedAt`).
- **Security (`firestore.rules`):** the owner can read and write everything, as before. A team member can read the team list and the `portal` documents, and use messaging (below); they can't change the team list or the portal content. Membership needs a Google-verified email matching a `teamMembers` document. Everyone else is denied. **The rules must be deployed for team members to get in:** `firebase deploy --only firestore:rules`. Until then only the owner can open the portal.
- Team members can't open `/admin`: `RequireOwner` sends them to `/login`, and the rules deny them the admin data.
- Private portal content must be stored in Firestore under `portal/` (protected by the rules), never written into the front-end code, which anyone can download.
- `lib/team.js` and `lib/campaignRuns.js` both call `initializeFirestore` with the same settings on purpose; keep them identical or Firebase throws.

---

## Crew

People working on a project (separate from the team). Sam adds them in the **Crew** section of `/admin/team`: first name, last name, project, role, phone number (optional) and Google account email. Adding the same email again replaces that person's entry; **Remove** takes their access away.

- **`/team/crew` ("Crew Login")**: Google sign-in. If the email is on the crew list the person goes on to their welcome. If it isn't, they see: "Sorry, looks like we don't have your account yet. Please reach out to Sam at sjr9969@nyu.edu or try to log in with a different email." with a button to sign in with another account. Sam and team members who aren't on the crew list go straight to the boards.
- **`/team/note/welcome`**: an empty page (just the background), then the welcome fades in one line at a time, two seconds a line: Hello / first name / your role is / role / on project. / Welcome. Then the page fades out and `/team/note/home` opens. A faint **Skip** sits in the corner. Opening this address without a crew sign-in goes back to `/team/crew`. (Sam asked for this animation; the timing is `secondsPerLine` in `src/data/crew.js`.)
- **What the crew can do:** look at every note board, card and PDF, read-only ("View only" in the header). They can't change anything and can't open the team portal, messages, assignments or admin.
- **Link preview:** crawlers don't run JavaScript, so the build writes `dist/team/crew.html`, a copy of `index.html` titled "Crew Login" (`linkPreviews` in `vite.config.js`; any page in `src/data/seo.js` with `preview: true` gets one). Firebase Hosting serves it at `/team/crew`.
- **Stored** in `crew/{email}` = `{ email, firstName, lastName, project, role, phone, addedAt }` (`src/lib/crew.js`). One entry per email, so one project and role per person for now.
- **Security (`firestore.rules`):** only Sam can list, add or remove crew; each person can read only their own entry (it holds their phone number). **Deploy the rules** (`firebase deploy --only firestore:rules`) or crew sign-ins will all land on the "Sorry" page.
- Copy is in `src/data/crew.js`; pages are `src/pages/CrewLogin.jsx` and `CrewWelcome.jsx`; the admin section is `src/components/admin/CrewAdmin.jsx`.

---

## Team messaging

`/team/chat` (in the team portal's header) has one **team chat** everyone on the team sees, and **private one-to-one chats** between any two people on the team list. Text only for now: **attachments are not built yet** (Sam chose "messages first, files later"; storing them in Sam's Google Drive needs a server, or each sender's own Drive).

- **Live:** new messages appear without reloading (Firestore listeners). Each chat shows its newest 200 messages (`SHOWN` in `lib/teamChat.js`). Messages are up to 4,000 characters; Enter sends, Shift+Enter makes a new line.
- **Unread dot:** a white dot marks a chat with a message newer than the last time this browser had it open (kept in `localStorage`, per device). There are **no push or email notifications**: people see new messages when they open the portal. Notifications would need a server.
- **Layout:** side by side on a wide screen; on a phone the list and the open chat are separate screens. `?chat=team` or `?chat=<email>` picks the chat, so the back button works.
- **Storage (Firestore):** `chats/team` and `chats/{emailA}|{emailB}` (emails in alphabetical order) hold `{ members (private chats only), lastAt, lastFrom }`; messages are `chats/{id}/messages/{id}` = `{ from, text, at }`.
- **Security (`firestore.rules`):** only people on the team list can read or send; a private chat can be read only by its two people; nobody can send as someone else, or edit or delete a message. Someone removed from the team loses all access at once; their old messages stay, labelled "former member", and private chats with them are no longer listed.
- **The owner can read everything in the database** (the owner rule covers all of Firestore), including other people's private chats, through the Firebase console. The portal itself only shows the owner their own chats. Tell the team if that matters.
- Messages can only be deleted in the Firebase console (Firestore → `chats`).
- Cost: Firestore's free tier (50,000 reads and 20,000 writes a day) is far more than a small team's chat uses.

---

## latest avenue note

`/team/note` is a visual notes tool for the team: **boards** you lay cards out on, with boards inside boards. Its workflow is modelled on Milanote (Sam's choice), in latest avenue's own dark style; nothing of Milanote's name, wording or artwork is used. Sam's reference (a written walkthrough and 81 screenshots of Milanote) is in his Google Drive folder "milanote-reference", not in this repo.

**Who can do what:** team members (the team list at `/admin/team`, plus Sam) **edit** everything. Everyone else can only **view** a board whose read-only link has been switched on (**Share** on the board). The link is the board's address (`/team/note/<id>`, a long random ID); turning it on shares that board and every board inside it, and new boards made inside inherit it. The home board (`/team/note/home`) is private unless shared. Nothing on the public site links to any of it.

### What's built (phases 1 and 2)

- **`/team/note`** opens the home board with a short welcome pop-up over it; closing it (or "Open your boards") leaves you on `/team/note/home`.
- **Home is a board.** `/team/note/home` holds your top-level boards as icons; every board works the same way. Double-click a board icon to open it (Enter also works); breadcrumbs at the top lead back up. Each icon shows how many cards are inside.
- **Left toolbar:** drag **Note**, **To-do**, **Heading**, **Line**, **Board** or **Column** onto the canvas (clicking one just says "Drag me"). Double-clicking empty canvas adds a note. With cards selected the toolbar becomes their options (to-do title, edit / rename, line style, delete); while editing a note it becomes text formatting.
- **Notes:** rich text (TipTap): headings, bold, italic, strikethrough, bullet and numbered lists, quotes. Typing `# `, `## `, `* `, `1. ` or `> ` at the start of a line works too.
- **To-do lists:** Enter adds the next task, Backspace on an empty one removes it; tick boxes work without entering edit mode; optional title.
- **On a phone:** everything works by touch. Drag tools out of the toolbar, drag cards, swipe empty board to move around. Tap a card to select it and tap it again to edit it; the same second tap opens a board or a PDF (double-tapping isn't dependable on phones). The header keeps the board name, View and Share on one row.
- **Cards:** click to select, Shift-click or drag a box to select several, drag to move, drag the corner to change width, click a selected card (or double-click) to edit, Esc to stop. Drag cards (or a whole column) onto a board icon to move them inside it; lines stay behind.
- **Columns:** a titled stack of cards. Drag cards in (they take the column's width and drop into the stack where you let go), drag them up and down to reorder, drag them out to put them back on the board. Moving a column moves its cards; the `–` in its corner collapses it. Columns don't nest. Deleting a column hides its cards with it (undo or Trash → Restore brings both back; Empty trash removes both).
- **Lines and arrows:** drag **Line** out, then select it and drag an end onto a card to attach it; attached ends follow the card. Drag the middle handle to curve it (drag it back to straighten). The toolbar sets an arrowhead at the start and / or end, dashed, weight (3 thicknesses) and a label (double-clicking the line also edits the label). Lines aren't counted as cards.
- **Editing a board (name and icon):** select a board and press **Edit** (or right-click → Edit name and icon). Its name is selected, ready to type over, and a small icon menu opens beside its tile (under or over it on a phone, clear of the keyboard). The menu has a search box at the top and 50 icons at a time: a featured set to begin with (`featuredIcons` in `data/note.js`), or the best 50 matches as you type, searched across the whole library. Picking an icon applies at once and leaves the cursor in the name. Esc, or clicking the board, saves the name and closes the menu. "None" goes back to the plain four-squares tile. The icons are **Lucide** (open source, ISC licence; the `lucide` package, loaded only when the menu first opens). The chosen icon's drawing is saved on the board itself, so showing it needs no icon library. (Columns keep a plain **Rename**.)
- **Theme:** one colour per board, chosen with **Theme** in the toolbar (its button shows the current colour). It colours **only the icons on the board tiles sitting on that board**; the tiles themselves, cards, columns, lines and the background are always grey. The default, "Light grey", is the light colour the icons have always had. There are no per-card colours any more (an earlier version had a Color button on every card; colours saved then are ignored). `colors` in `data/note.js` lists the themes.
- **Lock:** the padlock switch beside the board's name (team members only) puts *you* in read-only: nothing can be dragged, edited, renamed or undone, and the status reads "Locked: read-only". It applies to every board and stays on (or off) from board to board and visit to visit until you switch it again; it is remembered in the browser (`src/lib/noteLock.js`), so it doesn't affect teammates and isn't stored in the database. While locked the left panel stays in place but empty, and the name and switch don't move. Opening boards and PDFs, zooming and moving around still work.
- **Clean up** (toolbar): moves every card on the board, and every loose line end, to the nearest dot of the background grid (`GRID` in `src/data/note.js`, 22px). Cards in columns stay in their stack. It's one action, so one Undo puts everything back; it is not a snapping mode, cards can still be dragged anywhere afterwards.
- **PDFs:** add one with **Upload** in the toolbar, right-click → Upload a PDF, or by dragging files from the computer onto the board (several at once is fine). A PDF card shows a picture of the first page, the file name, page count and size; double-click it (Enter, a second tap on a phone, or one click for viewers) to open it in the **viewer**: full-screen, every page drawn by the site itself (pdf.js) so it works the same on phones and computers, with the pages in one scrolling column, zoom (100 / 150 / 200 / 300%, keeping your place) and a download button. **A board fetches its PDFs in the background as soon as it opens**, in one request each, and keeps them in memory while the site is open, so opening one is quick; the person who uploaded a file never downloads it back. (Preloading is skipped when the browser's data-saver is on.) It moves, resizes, goes into columns and boards, and trashes like any card. **Limit: 15 MB per PDF** (`MAX_FILE_BYTES` in `lib/note.js`), because on the free plan the file is stored as text in Firestore, not in real file storage; only PDFs are accepted for now. PDF cards can't be copied or duplicated (a file belongs to one card). Emptying the trash deletes the stored file for good.
- **Right-click:** on a card: Cut, Copy, Duplicate, Bring to front, Send to back, Move to trash (a board also gets Open, Open in new tab, Copy link, Rename). On the canvas: Undo, Redo, Paste, Select all, and New note / to-do / heading / line / board / column at that spot.
- **Copy and paste:** ⌘/Ctrl+C, X, V. Pasting puts the cards under the pointer, and works across boards while the site stays open (it's the app's own clipboard, not the computer's). Boards and columns can't be copied or duplicated.
- **Zoom:** the **View** menu (it shows the percentage when not 100%), ⌘/Ctrl + and −, ⌘/Ctrl+0 for 100%, **Z** to scale to fit, or hold ⌘/Ctrl and scroll (a trackpad pinch works too). Viewers can zoom as well.
- **Keyboard:** Delete, arrows to nudge (Shift for 1px), ⌘/Ctrl+Z undo, Shift+⌘/Ctrl+Z redo, ⌘/Ctrl+A select all, ⌘/Ctrl+D duplicate, Enter to edit or open.
- **Undo / redo** (also in the header) covers adding, moving, resizing, editing, colours and deleting, for this visit to the board. **Trash** (bottom of the toolbar) lists the board's deleted cards to restore, or empties it for good.
- **Live:** several people can have a board open; changes appear for everyone, including read-only viewers. Two people editing the *same card* at once: the last save wins.
- "Saving… / Saved" shows at the top left.

### How it's stored (Firestore)

- `noteBoards/{id}` = `{ title, parent, theme, icon, public, cardCount, createdBy, createdAt }`; `home` is the top board. `icon` is `{ name, shapes: [{ tag, …attributes }] }`: only plain SVG shapes are ever drawn from it.
- `noteBoards/{id}/cards/{cardId}` = `{ type, x, y, w, z, color, trashed, … }` with `html` (note), `title` + `items` (to-do), `text` (heading), `boardId` (a board's icon), `title` + `collapsed` (column; cards inside it carry `column` and `order`), `from` / `to` / `startArrow` / `endArrow` / `dashed` / `weight` / `label` / `bend` (line; an end is `{ card }` when attached, else `{ x, y }`), or `fileId` / `name` / `size` / `pages` / `thumb` (a PDF).
- `noteFiles/{fileId}` = `{ board, name, type, size, parts, createdBy, createdAt }`, with the file as base64 text in `noteFiles/{fileId}/parts/{n}` (about 180 KB of file per part). `board` is the board the card is on; it follows the card when it's moved into another board.
- **Security (`firestore.rules`):** team members read and write boards, cards and files; the crew (see [Crew](#crew)) read all of them and write nothing; anyone can read a board with `public: true`, its cards, and the files whose `board` is that board; nobody else can write. **Deploy the rules** (`firebase deploy --only firestore:rules`) or nobody but Sam can use it.

### Still to build

3. Links, images and other file types, video and audio embeds (YouTube, Vimeo, Spotify, SoundCloud), colour swatches, comments. On the free plan images are limited to a few MB each and ordinary web links get no thumbnail preview (Sam chose to stay on the free plan for now).
4. Live cursors, an editor link (so far only read-only links exist).
5. Tables, long documents, sketching, export, search, templates, and the public homepage for `/team/note` (currently a welcome pop-up over the home board).

---

## Team assignments

**One doc, shown whole.** Sam pastes one doc link in the **Assignments** section of `/admin/team` and presses **Refresh**; the doc as it is at that moment appears, complete, as one scrolling page under **Assignments** in the team portal (`/team/assignments`). Everyone on the team sees the same page. Deliberately simple for now: no splitting into separate assignments and no per-person assigning (an earlier version did both and was replaced on 2026-11-12).

- **One link at a time:** pasting a different link and pressing Refresh replaces what's shown. The link is remembered.
- **Updating:** the page changes only when Sam presses **Refresh** (after editing the doc). There's no automatic sync (it would need a server). A failed refresh leaves the page as it was.
- **Reading the doc:** needs a Drive connection (the same read-only one as `/admin/drive`; "Connect Google Drive" appears when there isn't one). A **Google Doc** is read through Google's HTML export; a **Word file (.docx) stored in Drive** (links ending `rtpof=true` are usually these) is converted in the browser by mammoth. Other file types are refused.
- **What carries over:** paragraphs and blank lines, **bold**, *italic*, underline, strikethrough, headings, bulleted and numbered lists (with nesting), links, tables, centred/right alignment and images. **Not** fonts, text sizes or colours: the page uses the site's own dark style so it stays readable. `cleanHtml()` in `lib/assignments.js` does this (Google's export keeps formatting in CSS classes, which it resolves into real tags; it also unwraps Google's redirect links).
- **Safety:** only plain formatting tags are kept when importing, and the HTML is sanitized again with DOMPurify when shown (`components/team/DocContent.jsx`), so a doc can't inject scripts.
- **Storage (Firestore):** `adminSettings/assignments` = `{ url, docId }` (owner only); `portal/assignments` = `{ title, updatedAt, version, parts }` and the HTML in `portal/assignments-<version>-<n>` (split into parts because a Firestore document holds at most 1 MiB; a very large doc loses its images, and the refresh message says so). The existing `portal/{doc}` rule lets team members read these, so **this needed no rules change**.
- Left over from the earlier version and unused: the `assignments` collection and its rule in `firestore.rules`. Harmless; delete the collection in the Firebase console if you like.
- `mammoth` loads only when refreshing from a Word file; `dompurify` only on the assignments page.

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

### Staying up to date after a deploy

Every deploy renames the script files in `/assets`. A tab opened before the deploy (phones keep tabs for days) still asks for the old names when it needs another page, such as `/login`. Three things stop that from ending in a blank page:

- `firebase.json` only falls back to `index.html` for pages, **not for `/assets/**`**, so a missing script is a plain 404 instead of the homepage's HTML served as a script and cached for a year.
- `lib/freshness.js` listens for a script that fails to load and reloads the page once (at most once a minute), which picks up the current version.
- `components/layout/ErrorBoundary.jsx` wraps all pages: any crash shows "Something went wrong" with a Reload button, never a blank screen.

## Data layer (ready for an MCP later)

Sam wants to be able to build an MCP server for the site later (so an AI assistant can read and change the site's data). Nothing is built yet; the site is kept in a shape that makes it straightforward:

- **Everything is plain documents in Firestore**, and each kind of data has **one lib file** that holds every read and write as a small named function. No page or component touches the database directly. An MCP tool is then roughly one of these functions with a description.

| Data | Firestore | Lib file | Functions an MCP tool would mirror |
| --- | --- | --- | --- |
| Team list, welcome message | `teamMembers/{email}`, `portal/welcome` | `src/lib/team.js` | `listMembers`, `addMember`, `removeMember`, `getWelcome`, `saveWelcome` |
| Team messages | `chats/{chatId}/messages` | `src/lib/teamChat.js` | `watchChats`, `watchMessages`, `sendMessage` |
| Assignments doc | `portal/*` | `src/lib/assignments.js` | `getAssignmentsDoc`, `getDocInfo`, `publishDoc` |
| Crew list | `crew/{email}` | `src/lib/crew.js` | `listCrew`, `addCrewMember`, `removeCrewMember`, `getCrewMember` |
| Controller link (Realtime Database, not Firestore) | `pads/{code}` | `src/lib/padLink.js` | `hostPad`, `joinPad` |
| Note boards, cards, files | `noteBoards`, `…/cards`, `noteFiles`, `…/parts` | `src/lib/note.js` | `createBoard`, `updateBoard`, `setCard`, `patchCards`, `removeCard`, `moveCards`, `setPublic`, `uploadFile`, `loadFile` |
| Campaign runs | `campaignRuns`, `metaUploads`, `pixelEvents` | `src/lib/campaignRuns.js` | `listRuns`, `saveRun`, `setRunArchived`, `deleteRun` |
| Meta Ads (not in Firestore) | Meta Graph API | `src/lib/meta.js`, `metaAnalytics.js` | also usable from the terminal: see [Meta command-line tool](#meta-command-line-tool) |

- **Document shapes are written down** in each feature's section of this file ("How it's stored"). Keep them current: they are the MCP's schema.
- **When the MCP is built** it will be a small separate server (the first real backend, so only when Sam asks). It would talk to the same Firestore with the Firebase Admin SDK and a service-account key, which skips `firestore.rules`, so it must do its own permission checks. It can run on Sam's Mac for free, or hosted (Cloud Functions / Cloud Run need the paid Blaze plan).
- **Keep it this way:** new features put their reads and writes in a lib file as named functions, keep any rule that data depends on (counts, ordering, file parts) inside that function rather than in a component, and document the document shape here.

---

## Conventions

- **Brand name is lowercase: "latest avenue".** Use `site.name` in JSX instead of hard-coding it.
- **Copy goes in `src/data/`.** Components render data; avoid hard-coding paragraphs in JSX.
- **Tailwind only.** Add shared styles to `@layer components` in `index.css` only when used in many places (like `.glass`).
- **Function components + hooks.** One component per file, default export, `.jsx` extension. Utilities are named exports in `.js` files.
- **Imports use explicit extensions** (`'./Button.jsx'`).
- **Accessibility:** real `<button>`s for actions and `<a>`/`<Link>` for navigation, labels on all inputs, `aria-expanded` / `aria-pressed` / `aria-current` where relevant, Esc closes modals.
- **No fabricated content.** Stats, quotes and testimonials must come from Sam or the artists. Use `[bracketed]` placeholders until then.
- **All database access lives in `src/lib/`.** Pages and components never call Firestore themselves; they call a named function in a lib file (see [Data layer](#data-layer-ready-for-an-mcp-later)).
- **No animations or backend** unless asked. (Sam asked for Firebase auth for the owner-only area, and for the fade-in on the crew welcome.)

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
- `/team` signed out: the sign-in card shows. Signed in as the owner: the welcome page shows. As a Google account not on the list: "isn't on the team list" and Sign out
- `/admin/team`: add a member (a bad email is rejected), remove one, save the welcome message; reload and both are still there. That member can then open `/team` and is sent to `/login` from `/admin`
- `/team/chat` (needs two accounts on the team list, in two browsers): a message in Team chat appears in the other browser without reloading; a private message shows a dot for the other person, opens only for those two people, and a reply appears live. At phone width the list and the chat are separate screens with a back arrow
- `/analytics` (owner): connect Meta; totals, chart and Top campaigns load; clicking a total or the dropdown changes the chart; changing the date range reloads everything; a campaign opens its own view and ‹ goes back; "Continue with Facebook" comes back to `/analytics`. At phone width the admin tabs sit on a second row that scrolls sideways
- `/admin/team` → Assignments (owner, Drive connected): paste a doc link, Refresh; "Showing … last refreshed …" appears. In `/team` → Assignments the whole doc shows as one page with its bold text, blank lines, links and lists. Edit the doc, Refresh, reload the team page: the change is there
- `/team/note/home` (team member): drag a Board out, name it, double-click it; drag out a Note, a To-do and a Heading and type in each; move, resize, duplicate, delete and undo them; restore from Trash; drag a card onto a board icon. Drag a Column out and drop notes into it, reorder them, pull one out, collapse it. Drag a Line out, attach its ends to two cards, move a card (the line follows), curve it, label it. Right-click a card and the canvas. Zoom from View and with ⌘/Ctrl + scroll; press Z. Select a board → Edit: the name is selected and the icon menu opens beside the tile; pick an icon, type a new name, press Esc: both are saved and survive a reload. Theme → pick a colour: the tiles' icons on this board change colour and nothing else does. Upload a PDF (toolbar, right-click, and by dragging a file in): its first page shows on the card; double-click opens it; a shared board's viewer can open it too. Share → turn the link on → open it in a private window: the board shows with "View only", no toolbar, and nothing can be changed; turn it off and the private window says the board is private
- `/admin` redirects to `/login` when signed out; `/signup` and `/reset-password` redirect to `/login`
- Tab title changes per page (e.g. "Contact | latest avenue"); an unknown URL shows "Page not found | latest avenue"
- Mobile width (~375px): ☰ menu opens and closes, no horizontal scroll
