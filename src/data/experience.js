// Settings and copy for /experience: one 360° panorama you look around in, as if standing in it.
// The panorama's files are made by `npm run pano` (scripts/pano.mjs) into public/pano/.
export const experience = {
  title: 'experience',
  // The lens, in mm on a 36 x 24mm frame (a bigger number is more zoomed in). The screen shows a
  // crop of that frame. `portraitFocalLength` is used when the screen is taller than it is wide.
  focalLength: 45,
  portraitFocalLength: 45,
  // Which way you face when the page opens, in degrees to the right of the panorama's centre.
  startYaw: 0,
  // Looking up and down, with the up and down arrow keys. 90 degrees would be straight up (or down).
  lookUpDown: true,
  maxUp: 45, // degrees: half way to straight up
  maxDown: 18, // degrees: a fifth of the way to straight down
  maxTiltSpeed: 40, // degrees per second: the fastest it looks up or down
  // The exposure adjustment: the whole picture gets brighter as you look up and darker as you
  // look down, evenly in between. Measured in photographic stops: 1 is one stop (twice, or half,
  // the light), 0.5 is half a stop, 0 switches it off.
  exposureUp: 1, // stops brighter when looking as far up as possible
  exposureDown: 1, // stops darker when looking as far down as possible
  // Film grain over the whole picture. `amount` 0 switches it off.
  grain: {
    amount: 0.05, // how strong: 0.03 is barely there, 0.15 is heavy
    size: 1.4, // how big each grain is, in screen px
    fps: 24, // how many times a second the pattern changes, like frames of film
  },
  // The handheld feel. Turning and looking up or down with the arrow keys has momentum: it picks up speed, coasts to a
  // stop, and the camera leans into the turn. Left alone, the camera drifts very slightly, as if
  // someone were holding it. All of it is switched off for people whose device asks for reduced motion.
  handheld: {
    minSpeed: 8, // degrees per second: the speed a turn starts at, so a tap responds at once
    maxSpeed: 62, // degrees per second: the fastest it turns
    speedUp: 0.4, // seconds to get most of the way to full speed
    slowDown: 0.32, // seconds to lose most of its speed after the key is let go
    maxRoll: 2.4, // degrees: how far the camera leans at full speed
    rollTime: 0.45, // seconds: how quickly the lean follows the turn (and straightens after)
    // Standing still: every few seconds the camera picks a new, tiny offset and eases towards it.
    idle: {
      pan: 0.81, // degrees, left / right, at most
      tilt: 0.54, // degrees, up / down, at most
      roll: 0.76, // degrees, at most
      every: [2.3, 5.3], // seconds between new offsets, picked at random in this range
      ease: 1.75, // seconds: how slowly it moves to each new offset
      settle: 1.6, // seconds for the drift to return after moving stops
      whileMoving: 0.25, // how much of the drift stays while turning (0 to 1)
    },
  },
  keySpeed: 45, // degrees per second while an arrow key is held (reduced motion only)
  // The computers. Look at one and it is outlined, with an "A" prompt; press it (the space bar,
  // or tap the prompt) and the view closes in on its screen and shows `slides`, a PDF, one page
  // at a time. Places are measured in pixels on the panorama at `panoWidth` wide: `body` is the
  // monitor (what gets outlined), `screen` is the glass the slide is shown on.
  slides: '/slides/chapel-hill-lookbook.pdf',
  panoWidth: 16384,
  computers: [
    { id: 'desk-1', body: { left: 7900, right: 8487, top: 3860, bottom: 4385 }, screen: { left: 7965, right: 8425, top: 3922, bottom: 4267 } },
    { id: 'desk-2', body: { left: 12022, right: 12548, top: 3890, bottom: 4375 }, screen: { left: 12083, right: 12492, top: 3940, bottom: 4247 } },
    { id: 'desk-3', body: { left: 16019, right: 16749, top: 3810, bottom: 4445 }, screen: { left: 16110, right: 16660, top: 3890, bottom: 4302 } },
    { id: 'desk-4', body: { left: 3840, right: 4352, top: 3862, bottom: 4300 }, screen: { left: 3910, right: 4268, top: 3959, bottom: 4227 } },
  ],
  lockMargin: 2, // degrees: how far past a monitor's edge you can look and still be locked on to it
  closeIn: 1.22, // how much of the monitor shows around the slide when closed in (1 = the slide fills the view)
  closeInTime: 0.7, // seconds for the view to close in or pull back
  slideFade: 0.22, // seconds for one slide to fade into the next
  action: 'Open',
  actionHint: 'Press the space bar, or tap, to open this screen',
  previous: 'Previous slide',
  next: 'Next slide',
  close: 'Back',
  closeHint: 'Back (X key)',
  slideOf: (n, count) => `${n} / ${count}`,
  // The phone controller (/experience/controller). The screen shows a code (and a QR code for
  // it); a phone that opens the controller with that code steers this screen.
  controller: {
    open: 'Connect a controller',
    title: 'Controller',
    steps: 'Scan this with your phone, or open the address below on it and enter the code.',
    address: 'latestavenue.com/experience/controller',
    waiting: 'Waiting for a controller',
    connected: 'Controller connected',
    failed: "Couldn't set up the link. Check your connection and try again.",
    done: 'Done',
    deadZone: 0.14, // how far the stick moves before it counts (0 to 1)
    flick: 0.6, // how far the stick is pushed sideways to change slide (0 to 1)
    // The controller page itself.
    pageTitle: 'controller',
    enterCode: 'Enter the code on the screen',
    connect: 'Connect',
    connecting: 'Connecting',
    linked: 'Connected',
    yourTurn: 'You have the controls',
    waitTurn: 'Connected. Waiting for your turn',
    presenterHas: 'Watch the screen',
    removed: 'You were removed by the host',
    unknown: 'No screen is showing that code',
    lost: "Couldn't connect. Check both devices are online and try again.",
    change: 'Change code',
    stick: 'Stick: look around',
    a: 'A button',
    x: 'X button',
  },
  // /admin/experience: the owner's page for running the experience in front of a room.
  admin: {
    title: 'Experience',
    intro: 'Run the experience for a room: see who has joined, decide who has the controls, take them over yourself, and guide it through a story.',
    connectTitle: 'Screen',
    connectText: 'On the screen showing the experience, press the controller button (top right). Type the code it shows here.',
    connect: 'Connect',
    disconnect: 'Disconnect',
    noScreen: 'No screen is showing that code. Check the code, and that the controller panel has been opened on the screen.',
    linked: (code) => `Connected to screen ${code}`,
    statusLooking: 'The player is looking around.',
    statusLocked: (name) => `Looking at ${name}.`,
    statusViewing: (name, page, count) => `${name} is open${count ? `: slide ${page} of ${count}` : ''}.`,
    playersTitle: 'Players',
    playersText: 'Everyone who has scanned the code. One of them has the controls at a time.',
    noPlayers: 'Nobody has joined yet.',
    player: (n) => `Player ${n}`,
    has: 'Has the controls',
    give: 'Give controls',
    remove: 'Remove',
    auto: 'First to join',
    takeTitle: 'Controls',
    take: 'Take the controls',
    release: 'Hand the controls back',
    youHave: 'You have the controls.',
    youPresent: "You have the controls while this chapter's slides are showing.",
    theyHave: (who) => `${who} has the controls.`,
    nobodyHas: 'Nobody has the controls yet.',
    padHelp: 'Hold an arrow to look. A opens the monitor being looked at; X goes back. On a keyboard: arrow keys, space and X (click the pad first).',
    prevSlide: 'Previous slide',
    nextSlide: 'Next slide',
    storyTitle: 'Story',
    storyText: 'A story is a list of chapters. Each chapter puts one PDF on one monitor. While a story is running, the player can look around but can only open the monitor for the current chapter; when they do, the controls pass to you for the slides, and go back to them when you end the chapter.',
    chapter: (n) => `Chapter ${n}`,
    chapterTitle: 'Title (for you)',
    monitor: 'Monitor',
    pdf: 'PDF',
    choosePdf: 'Choose a PDF…',
    addChapter: 'Add a chapter',
    save: 'Save story',
    saved: 'Story saved.',
    up: 'Move up',
    down: 'Move down',
    removeChapter: 'Remove chapter',
    incomplete: 'Every chapter needs a monitor and a PDF.',
    decksTitle: 'PDFs',
    upload: 'Upload a PDF',
    uploading: (pct) => `Uploading… ${pct}%`,
    noDecks: 'No PDFs uploaded yet.',
    deleteDeck: 'Delete',
    inUse: 'Used in the story',
    runTitle: 'Run the story',
    needScreen: 'Connect to a screen first.',
    start: 'Start the story',
    stop: 'End the story',
    running: (n, of, title) => `Chapter ${n} of ${of}${title ? `: ${title}` : ''}`,
    waitingFor: (name) => `Waiting for the player to open ${name}.`,
    presenting: 'On screen now. You have the slides.',
    finished: 'The story has finished.',
    endChapter: 'End chapter (hand back)',
    back: 'Previous chapter',
    skip: 'Skip chapter',
    monitors: { 'desk-1': 'Desk 1 (spreadsheet)', 'desk-2': 'Desk 2', 'desk-3': 'Desk 3 (TV)', 'desk-4': 'Desk 4' },
  },
  hint: 'Drag, or use the arrow keys, to look around',
  hintTouch: 'Drag to look around',
  enterFullscreen: 'Full screen',
  exitFullscreen: 'Leave full screen',
  label: 'A 360° view you can look around in. Drag to turn, or use the arrow keys to turn and to look up and down.',
  unsupported: "This browser can't show the view (it needs WebGL).",
  failed: "Couldn't load the view. Check your connection and reload.",
}
