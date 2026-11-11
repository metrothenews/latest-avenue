import { site } from './site.js'

// Copy for the team portal (/team) and its admin page (/admin/team).
// The team list and the welcome message themselves are stored in Firestore and edited at /admin/team.
export const team = {
  badge: 'team',
  signInTitle: 'Team sign-in',
  signInText: `For people who work at ${site.name}. Sign in with the Google account the label has on file for you.`,
  signInButton: 'Continue with Google',
  notOnTeam: "but this account isn't on the team list. Ask the label to add this email address, or sign in with a different account.",
  checkFailed: "Couldn't check the team list. Check your connection and try again.",
  // Shown until a welcome message is saved at /admin/team.
  defaultHeading: 'Welcome',
  defaultMessage: '[Welcome message goes here. Edit it in Admin → Team.]',
}
