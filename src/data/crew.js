import { site } from './site.js'

// Copy for the crew: the sign-in page (/team/crew), the welcome that follows it
// (/team/note/welcome) and the Crew section of /admin/team.
// The crew list itself is stored in Firestore and edited in that admin section.
export const crew = {
  loginTitle: 'Crew Login',
  loginText: `Sign in with the Google account ${site.name} has on file for you.`,
  loginButton: 'Continue with Google',
  checking: 'Checking sign-in…',
  checkFailed: "Couldn't check the crew list. Check your connection and try again.",
  tryAgain: 'Try again',
  // Shown when the Google account that signed in isn't on the crew list.
  contactEmail: 'sjr9969@nyu.edu',
  sorry: (email) => `Sorry, looks like we don't have your account yet. Please reach out to Sam at ${email} or try to log in with a different email.`,
  differentEmail: 'Log in with a different email',
  // The welcome: one line at a time, `secondsPerLine` each to fade in, then on to the note boards.
  secondsPerLine: 2,
  welcome: ({ firstName, role, project }) => [
    { text: 'Hello' },
    { text: firstName, big: true },
    { text: 'your role is' },
    { text: role, big: true },
    { text: `on ${project}.` },
    { text: 'Welcome.' },
  ],
  skip: 'Skip',
  admin: {
    title: 'Crew',
    text: 'People on a project. Anyone listed here can sign in at /team/crew with their Google account: they get a welcome with their name, role and project, then the note boards to look at (they can’t change them).',
    empty: 'Nobody has been added yet.',
    add: 'Add to crew',
    added: (m) => `${m.firstName} ${m.lastName} can now sign in at /team/crew.`,
    removed: (email) => `${email} can no longer sign in as crew.`,
    required: 'Needed for their welcome.',
    emailError: 'Enter a full email address.',
  },
}
