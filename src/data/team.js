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
  nav: [
    { label: 'Home', to: '/team' },
    { label: 'Messages', to: '/team/chat' },
    { label: 'Assignments', to: '/team/assignments' },
  ],
  // Shown only to the owner, in the portal header, to get back to the admin area.
  adminLink: { label: 'Admin', to: '/admin' },
  assignments: {
    title: 'Assignments',
    none: 'No assignments have been posted yet.',
    updated: 'Updated',
    emptyDoc: 'This doc is empty.',
    back: 'Assignments',
    noAccess: "Can't see it? It needs your Google account to have access to this file: ask {founder} to share it with you.",
    openInGoogle: 'Open in Google instead',
    missingDoc: "This doc isn't available here. It may have been removed from the assignments.",
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
