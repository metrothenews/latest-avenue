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
  saving: 'Saving…',
  saved: 'Saved',
  dragMe: 'Drag me',
  notePlaceholder: 'Start typing…',
  todoPlaceholder: 'Add a task…',
  todoTitle: 'New to-do list',
  headingPlaceholder: 'Heading',
  newBoard: 'New board',
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
  { type: 'board', label: 'Board' },
]

export const CARD_WIDTH = 300
export const MIN_WIDTH = 160
export const MAX_WIDTH = 900

// Card and board colours: `key` is stored; classes are the look on the dark canvas.
// Kept muted, to sit with the site's glass style.
export const colors = [
  { key: 'default', label: 'Default', swatch: 'bg-neutral-800', card: 'bg-neutral-900/80 border-white/15', board: 'bg-neutral-600' },
  { key: 'grey', label: 'Grey', swatch: 'bg-neutral-500', card: 'bg-neutral-700/80 border-white/20', board: 'bg-neutral-500' },
  { key: 'blue', label: 'Blue', swatch: 'bg-blue-500', card: 'bg-blue-950/80 border-blue-400/40', board: 'bg-blue-500' },
  { key: 'violet', label: 'Violet', swatch: 'bg-violet-500', card: 'bg-violet-950/80 border-violet-400/40', board: 'bg-violet-500' },
  { key: 'pink', label: 'Pink', swatch: 'bg-pink-500', card: 'bg-pink-950/80 border-pink-400/40', board: 'bg-pink-500' },
  { key: 'red', label: 'Red', swatch: 'bg-red-500', card: 'bg-red-950/80 border-red-400/40', board: 'bg-red-500' },
  { key: 'orange', label: 'Orange', swatch: 'bg-orange-500', card: 'bg-orange-950/80 border-orange-400/40', board: 'bg-orange-500' },
  { key: 'yellow', label: 'Yellow', swatch: 'bg-yellow-500', card: 'bg-yellow-950/80 border-yellow-400/40', board: 'bg-yellow-500' },
  { key: 'green', label: 'Green', swatch: 'bg-green-500', card: 'bg-green-950/80 border-green-400/40', board: 'bg-green-500' },
  { key: 'teal', label: 'Teal', swatch: 'bg-teal-500', card: 'bg-teal-950/80 border-teal-400/40', board: 'bg-teal-500' },
]
export const colorOf = (key) => colors.find((c) => c.key === key) ?? colors[0]
