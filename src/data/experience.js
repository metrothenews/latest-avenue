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
  // The picture brightens as you look up and darkens as you look down, evenly in between.
  brighterUp: 0.4, // 40% brighter when looking as far up as possible
  darkerDown: 0.3, // 30% darker when looking as far down as possible
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
    unknown: 'No screen is showing that code',
    lost: "Couldn't connect. Check both devices are online and try again.",
    change: 'Change code',
    stick: 'Stick: look around',
    a: 'A button',
    x: 'X button',
  },
  hint: 'Drag, or use the arrow keys, to look around',
  hintTouch: 'Drag to look around',
  enterFullscreen: 'Full screen',
  exitFullscreen: 'Leave full screen',
  label: 'A 360° view you can look around in. Drag to turn, or use the arrow keys to turn and to look up and down.',
  unsupported: "This browser can't show the view (it needs WebGL).",
  failed: "Couldn't load the view. Check your connection and reload.",
}
