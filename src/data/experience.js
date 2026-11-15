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
  // Looking up and down is switched off for now; turning it on needs no other change.
  lookUpDown: false,
  maxPitch: 60, // degrees, when lookUpDown is on
  // The handheld feel. Turning with the arrow keys has momentum: it picks up speed, coasts to a
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
      pan: 0.45, // degrees, left / right, at most
      tilt: 0.3, // degrees, up / down, at most
      roll: 0.42, // degrees, at most
      every: [2.3, 5.3], // seconds between new offsets, picked at random in this range
      ease: 1.75, // seconds: how slowly it moves to each new offset
      settle: 1.6, // seconds for the drift to return after moving stops
      whileMoving: 0.25, // how much of the drift stays while turning (0 to 1)
    },
  },
  keySpeed: 45, // degrees per second while an arrow key is held (reduced motion, and looking up / down)
  hint: 'Drag, or use the arrow keys, to look around',
  hintTouch: 'Drag to look around',
  enterFullscreen: 'Full screen',
  exitFullscreen: 'Leave full screen',
  label: 'A 360° view you can turn left and right in. Drag, or use the left and right arrow keys.',
  unsupported: "This browser can't show the view (it needs WebGL).",
  failed: "Couldn't load the view. Check your connection and reload.",
}
