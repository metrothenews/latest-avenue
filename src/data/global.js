import { site } from './site.js'

// Copy and settings for the hidden /global outline game (not linked from the menu).
export const globalGame = {
  title: 'global',
  intro: 'Name the country from its outline. Each wrong guess tells you how far away the answer is, and in which direction.',
  rounds: 2,
  maxGuesses: 6,
  inputLabel: 'Your guess',
  inputPlaceholder: 'Type a country',
  unknownCountry: 'Pick a country from the list.',
  alreadyGuessed: 'You already guessed that one.',
  won: 'Correct. It is',
  lost: 'Out of guesses. It was',
  nextRound: 'Next round',
  finish: 'Finish',
  playAgain: 'Play again',

  // Shown after the last round. Set `url` and `label` to whatever exclusive is on offer right now.
  // While `url` is empty the page shows the bracketed placeholder instead of a button.
  gift: {
    heading: 'Congratulations',
    body: `You made it around the world. Here is a gift from ${site.name}.`,
    label: '[Name of the current exclusive]',
    url: '',
    placeholder: '[Gift link goes here: set gift.url in src/data/global.js]',
  },
}
