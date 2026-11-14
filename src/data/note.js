import { site } from './site.js'

// Copy and settings for latest avenue note (/team/note): visual boards of cards for the team,
// with read-only links for everyone else.
export const note = {
  name: `${site.name} note`,
  homeTitle: 'Home',
  tagline: 'Boards for notes, tasks and ideas, laid out however you think.',
  open: 'Open your boards',
  signInTitle: 'This board is private',
  signInText: `Sign in with the Google account ${site.name} has on file for you to open it.`,
  signIn: 'Continue with Google',
  notOnTeam: "This account isn't on the team list, and this board isn't shared.",
  missing: "This board doesn't exist, or it isn't shared.",
  viewOnly: 'View only',
  lockLabel: 'Lock this board (read-only)',
  lockHint: 'Lock: make this board read-only so nothing is changed by accident',
  unlockHint: 'Locked. Switch off to edit again',
  lockedStatus: 'Locked: read-only',
  saving: 'Saving…',
  saved: 'Saved',
  dragMe: 'Drag me',
  notePlaceholder: 'Start typing…',
  todoPlaceholder: 'Add a task…',
  todoTitle: 'New to-do list',
  headingPlaceholder: 'Heading',
  newBoard: 'New board',
  newColumn: 'New column',
  iconTitle: 'Board icon',
  iconSearch: 'Search icons',
  iconNone: 'No icon',
  iconNoMatch: 'No icons match that.',
  iconMore: 'Keep typing to narrow it down.',
  iconHint: 'Search for more.',
  iconFailed: "Couldn't load the icons. Check your connection and try again.",
  iconCredit: 'Icons: Lucide (open source).',
  cleanUp: 'Clean up',
  cleanUpHint: 'Clean up: move everything to the nearest dot on the grid (Undo puts it back)',
  theme: 'Theme',
  themeTitle: 'Board theme',
  upload: 'Upload',
  uploadPdf: 'Upload a PDF',
  onlyPdf: 'Only PDF files can be added for now.',
  tooBig: 'That PDF is over 15 MB, which is too large to keep on the site.',
  uploading: 'Uploading',
  download: 'Download',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  close: 'Close',
  loadingPdf: 'Opening…',
  fileGone: "Couldn't open this file. Check your connection and try again.",
  view: 'View',
  fit: 'Scale to fit',
  trash: 'Trash',
  trashEmpty: 'Nothing in the trash for this board.',
  emptyTrash: 'Empty trash',
  restore: 'Restore',
  share: 'Share',
  shareTitle: 'Share a read-only link',
  shareText: 'Anyone with this link can see this board and the boards inside it, without signing in. They can’t change anything.',
  shareToggle: 'Read-only link',
  copyLink: 'Copy link',
  copied: 'Copied',
}

// The left toolbar, top to bottom. `type` is the card type a tile creates when dragged out.
export const tools = [
  { type: 'note', label: 'Note' },
  { type: 'todo', label: 'To-do' },
  { type: 'heading', label: 'Heading' },
  { type: 'line', label: 'Line' },
  { type: 'board', label: 'Board' },
  { type: 'column', label: 'Column' },
]

export const CARD_WIDTH = 300
export const GRID = 22 // spacing of the dots on the board (also set in .note-canvas in index.css)
export const COLUMN_WIDTH = 320
export const ZOOM_MIN = 0.2
export const ZOOM_MAX = 2
export const MIN_WIDTH = 160
export const MAX_WIDTH = 900

// Board themes. A board has one theme (`key` is stored on the board; grey when none is set). It
// colours only the icons on the board tiles sitting on that board; cards, columns, lines and the
// tiles themselves stay grey. `swatch`: shown on the Theme button and in its menu · `icon`: the
// icons' colour (a text colour, used through currentColor).
export const colors = [
  // The default: the light grey the icons have always been.
  { key: 'grey', label: 'Light grey', swatch: 'bg-neutral-300', icon: 'text-white' },
  { key: 'blue', label: 'Blue', swatch: 'bg-blue-500', icon: 'text-blue-400' },
  { key: 'violet', label: 'Violet', swatch: 'bg-violet-500', icon: 'text-violet-400' },
  { key: 'pink', label: 'Pink', swatch: 'bg-pink-500', icon: 'text-pink-400' },
  { key: 'red', label: 'Red', swatch: 'bg-red-500', icon: 'text-red-400' },
  { key: 'orange', label: 'Orange', swatch: 'bg-orange-500', icon: 'text-orange-400' },
  { key: 'yellow', label: 'Yellow', swatch: 'bg-yellow-400', icon: 'text-yellow-300' },
  { key: 'green', label: 'Green', swatch: 'bg-green-500', icon: 'text-green-400' },
  { key: 'teal', label: 'Teal', swatch: 'bg-teal-500', icon: 'text-teal-300' },
]
export const colorOf = (key) => colors.find((c) => c.key === key) ?? colors[0]

// The icons the picker offers before anything is typed in its search box (by Lucide's names, in
// words). Searching looks through the whole library.
export const featuredIcons = [
  'music', 'mic', 'headphones', 'disc 3', 'guitar', 'piano', 'drum', 'radio', 'speaker', 'podcast',
  'play', 'video', 'film', 'clapperboard', 'camera', 'image', 'smartphone', 'monitor',
  'calendar', 'clock', 'list todo', 'check', 'flag', 'target', 'rocket', 'lightbulb', 'sparkles', 'flame',
  'star', 'heart', 'trophy', 'megaphone', 'dollar sign', 'chart column', 'shopping bag', 'shirt', 'package',
  'folder', 'file text', 'book open', 'pen', 'palette', 'briefcase',
  'users', 'mail', 'message circle', 'link', 'globe', 'map pin', 'house',
]
