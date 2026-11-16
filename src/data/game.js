// ALIBI.EXE: a two-round party game. The big screen is at /game/join, phones play at /game/play.
// Copy, timings and limits. The game's live state is in the Realtime Database (src/lib/gameLink.js).
export const game = {
  name: 'ALIBI.EXE',
  address: 'latestavenue.com/game/play',
  minPlayers: 2,
  maxPlayers: 40,
  maxLength: 40, // characters in an answer
  finalists: 10, // how many answers go through to round 2
  leaders: 10, // how many answers the big screen's live leaderboard shows (phones can scroll all of them)
  // Seconds for each step. Writing and voting end early once everyone who can act has.
  seconds: { write1: 30, vote1: 30, cut: 6, write2: 30, vote2: 20 },
  prompts: {
    1: "You're a murder suspect. What's your best horrible alibi?",
    2: "You're pulled over for a DUI. What's the worst possible thing you could say?",
  },
  rounds: { 1: 'Round 1', 2: 'Final round' },

  // Show mode (/game/join?then=experience): when the game ends, a police report types itself out
  // and reveals the winner's name, then the big screen becomes the /experience (as if the game had
  // been running on the Desk 1 monitor all along) and the winner's phone becomes its controller.
  show: {
    lobby: 'Show mode',
    verdictSeconds: 2.5, // how long the verdict box stays up before the report
    typing: 30, // characters a second
    holdSeconds: 10, // how long it waits on the name if the admin doesn't press Advance
    nameLength: 20,
    title: 'Incident Report',
    unnamed: 'Unknown',
    charge: 'Homicide (suspected)',
    fields: { caseNo: 'Case no.', charge: 'Charge', statement: 'Statement', remarks: 'Remarks at the scene', witnesses: 'Witnesses', finding: 'Finding', suspect: 'Suspect name' },
    finding: 'GUILTY',
    // On the phones.
    askName: 'Your name, for the record',
    nameOk: 'OK',
    stay: 'Stay where you are.',
    watch: 'Watch the screen.',
    suspect: 'Suspect',
  },

  // The big screen.
  screen: {
    scan: 'Scan to join',
    orGo: 'or go to',
    code: 'Code',
    suspects: (n) => `${n} suspect${n === 1 ? '' : 's'} connected`,
    needMore: (n) => `Need at least ${n} to start`,
    start: 'Start',
    filed: (n, of) => `${n} / ${of} filed`,
    votesIn: (n, of) => `${n} / ${of} votes in`,
    objects: (n) => `${n} object(s)`,
    alibis: 'Alibis',
    finalists: 'Finalists',
    through: 'These go through to the final',
    final: 'Final round',
    writing: 'The finalists are writing…',
    votes: (n) => `${n} vote${n === 1 ? '' : 's'}`,
    voteWord: (n) => (n === 1 ? 'vote' : 'votes'), // under each count
    verdict: 'Guilty',
    noAnswers: 'No alibis filed.',
    again: 'OK',
    opening: 'Opening a room…',
    failed: "Couldn't open a room. Check the connection and reload.",
    fullscreen: 'Full screen (F)',
  },

  // The phones.
  play: {
    enterCode: 'Enter the code on the screen',
    join: 'Join',
    joining: 'Joining…',
    unknown: 'No game with that code.',
    full: 'This game is full.',
    over: 'Game over.',
    lost: "Couldn't connect. Check your signal and try again.",
    tryCode: 'Enter a different code',
    inLobby: "You're in. Watch the screen.",
    send: 'OK',
    left: (n) => `${n} left`,
    filed: 'Filed. Watch the screen.',
    missed: "Time's up.",
    pick: 'Tap the funniest',
    voted: 'Vote cast. Standings so far:',
    yours: 'your vote',
    nothingToVote: 'Nothing to vote on this time.',
    inFinal: "You're in the final.",
    onJury: "You're on the jury.",
    juryWaits: 'The finalists are writing. Watch the screen.',
    lateJoin: "Game in progress. You're on the jury.",
    guilty: 'GUILTY',
    free: 'Free to go',
    winner: 'The winning answer:',
  },
}
