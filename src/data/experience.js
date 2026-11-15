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
  keySpeed: 45, // degrees per second while an arrow key is held
  hint: 'Drag, or use the arrow keys, to look around',
  hintTouch: 'Drag to look around',
  enterFullscreen: 'Full screen',
  exitFullscreen: 'Leave full screen',
  label: 'A 360° view you can turn left and right in. Drag, or use the left and right arrow keys.',
  unsupported: "This browser can't show the view (it needs WebGL).",
  failed: "Couldn't load the view. Check your connection and reload.",
}
