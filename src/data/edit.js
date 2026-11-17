// The /edit page: the latest avenue video editor, running in the cloud and streamed here.
// The editor's compute only runs while someone is connected, and its gateway checks the
// signed-in account on the server (see README → "The /edit page").

// Address of the editor's gateway: wherever the editor runs. Either the Cloud Run service
// (printed by `cloud/deploy.sh` in the latest-avenue-edit repo) or your own PC acting as the
// server (printed by `cloud/pc/install.ps1` there). It must start with https://.
// It isn't secret: nothing there answers without the owner's sign-in.
// Empty until one of them has been set up; the page says so.
export const editServiceUrl = ''

export const edit = {
  tag: 'edit',
  back: 'Admin',
  fullScreen: 'Full screen',
  exitFullScreen: 'Exit full screen',
  keys: 'Keys',
  reconnect: 'Reconnect',
  status: {
    notDeployed: 'The cloud editor hasn’t been set up yet.',
    notDeployedHelp: 'Set it up from the latest-avenue-edit repo (cloud/deploy.sh for Google Cloud, cloud/pc/install.ps1 for your own PC), then put the address it prints in editServiceUrl in src/data/edit.js.',
    starting: 'Starting the editor…',
    startingHelp: 'It is switched off when nobody is using it, so the first connection takes up to a minute.',
    connecting: 'Connecting…',
    connected: 'Connected',
    disconnected: 'Disconnected',
    disconnectedHelp: 'Your work was saved when the connection closed.',
    denied: 'This account can’t use the editor.',
    failed: 'Couldn’t reach the editor.',
  },
  // On-screen keys for the game view, for phones and tablets (no keyboard). `key` is the
  // X11 key symbol sent to the editor, `code` the matching keyboard code.
  pad: [
    { label: '1', key: 0x31, code: 'Digit1' },
    { label: '2', key: 0x32, code: 'Digit2' },
    { label: '3', key: 0x33, code: 'Digit3' },
    { label: '4', key: 0x34, code: 'Digit4' },
    { label: '7', key: 0x37, code: 'Digit7' },
    { label: '8', key: 0x38, code: 'Digit8' },
    { label: '9', key: 0x39, code: 'Digit9' },
    { label: '0', key: 0x30, code: 'Digit0' },
    { label: 'no LUT', key: 0xff08, code: 'Backspace', wide: true },
    { label: 'pass', key: 0xff09, code: 'Tab', wide: true },
    { label: '←', key: 0xff51, code: 'ArrowLeft' },
    { label: '→', key: 0xff53, code: 'ArrowRight' },
    { label: 'apply', key: 0x20, code: 'Space', wide: true, primary: true },
  ],
}
