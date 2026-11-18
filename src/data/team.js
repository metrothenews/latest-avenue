import { site } from './site.js'

// Copy for the team portal (/team) and its admin page (/admin/team).
// The team list and the welcome message themselves are stored in Firestore and edited at /admin/team.
export const team = {
  badge: 'team',
  signInTitle: 'Team sign-in',
  signInText: `For people who work at ${site.name}. Sign in with the Google account the label has on file for you.`,
  signInButton: 'Continue with Google',
  // /team/join: anyone can sign themselves up; the owner can remove them later.
  join: {
    title: 'Join the team',
    intro: `Sign in with Google to join the ${site.name} team portal.`,
    detailsTitle: 'A couple of details',
    detailsText: 'This is how you will appear to the rest of the team.',
    name: 'Your name',
    role: 'What you do (optional)',
    submit: 'Join',
    joining: 'Joining…',
    nameError: 'Enter your name.',
    signedInAs: 'Signed in as',
    blocked: "This account can't join the team. If you think that's a mistake, get in touch with the label.",
    failed: "Couldn't sign you up. Check your connection and try again.",
    doneTitle: "You're in",
    doneText: 'Welcome to the team.',
    open: 'Open the team portal',
    already: "You're already on the team.",
    other: 'Use a different account',
    offer: 'Not on the list yet?',
    offerLink: 'Join the team',
  },
  notOnTeam: "but this account isn't on the team list. Ask the label to add this email address, or sign in with a different account.",
  checkFailed: "Couldn't check the team list. Check your connection and try again.",
  // Shown until a welcome message is saved at /admin/team.
  defaultHeading: 'Welcome',
  nav: [
    { label: 'Home', to: '/team' },
    { label: 'Messages', to: '/team/chat' },
    { label: 'Assignments', to: '/team/assignments' },
    { label: 'Note', to: '/team/note/home' },
  ],
  // Shown only to the owner, in the portal header, to get back to the admin area.
  adminLink: { label: 'Admin', to: '/admin' },
  assignments: {
    title: 'Assignments',
    none: 'No assignments have been posted yet.',
    updated: 'Updated',
    emptyDoc: 'The assignments doc is empty.',
    loadFailed: "Couldn't load assignments. Check your connection and reload.",
  },
  messages: {
    title: 'Messages',
    teamChat: 'Team chat',
    teamChatNote: 'Everyone on the team',
    direct: 'Direct messages',
    nobodyElse: 'Nobody else is on the team yet.',
    empty: 'No messages yet.',
    placeholder: 'Write a message',
    send: 'Send',
    back: 'All conversations',
    loadFailed: "Couldn't load messages. Check your connection and reload.",
    sendFailed: "Couldn't send. Check your connection and try again.",
    formerMember: 'former member',
  },
  defaultMessage: '[Welcome message goes here. Edit it at /admin/team.]',
}
