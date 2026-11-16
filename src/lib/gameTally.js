// Counting for ALIBI.EXE: votes, the cut to the finalists, and the winner. No database here, so
// it can be tested on its own.
//
// Answers on a ballot are keyed 'n1', 'n2', ...; `authors` maps a key to the seat that wrote it;
// `votes` maps a seat to the key it picked.

// How many votes each answer has. A vote for your own answer, or for something that isn't on
// the ballot, doesn't count.
export function countVotes(ballot, authors, votes) {
  const counts = Object.fromEntries(Object.keys(ballot ?? {}).map((key) => [key, 0]))
  for (const [seat, key] of Object.entries(votes ?? {})) {
    if (key in counts && authors?.[key] !== seat) counts[key] += 1
  }
  return counts
}

// Answer keys from most votes to fewest; equal counts keep ballot order (which is shuffled).
export const ranked = (counts) => Object.keys(counts).sort((a, b) => counts[b] - counts[a] || Number(a.slice(1)) - Number(b.slice(1)))

function pickSome(list, howMany, random) {
  const pool = [...list]
  const picked = []
  while (picked.length < howMany && pool.length) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  return picked
}

// The `size` answers that go through. If answers are tied across the cut line, the ones that go
// through are picked at random from the tied ones and each quietly gets one extra vote.
// Returns { through: [keys, best first], counts: the counts to show }.
export function cut(counts, size, random = Math.random) {
  const order = ranked(counts)
  if (order.length <= size) return { through: order, counts: { ...counts } }
  const line = counts[order[size - 1]]
  if (counts[order[size]] !== line) return { through: order.slice(0, size), counts: { ...counts } }
  const clear = order.filter((key) => counts[key] > line)
  const tied = order.filter((key) => counts[key] === line)
  const lucky = pickSome(tied, size - clear.length, random)
  const shown = { ...counts }
  for (const key of lucky) shown[key] += 1
  return { through: ranked(shown).slice(0, size), counts: shown }
}

// The winner. A tie for first is settled by quietly giving one of the tied answers, picked at
// random, one extra vote. Returns { key, counts } (key is null when there are no answers).
export function winner(counts, random = Math.random) {
  const order = ranked(counts)
  if (!order.length) return { key: null, counts: {} }
  const tied = order.filter((key) => counts[key] === counts[order[0]])
  if (tied.length === 1) return { key: order[0], counts: { ...counts } }
  const [lucky] = pickSome(tied, 1, random)
  return { key: lucky, counts: { ...counts, [lucky]: counts[lucky] + 1 } }
}

// A shuffled copy.
export function shuffle(list, random = Math.random) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
