// Things you can change without touching the game code.
export const CONFIG = {
  // Money you walk in with at the start of every game.
  startingMoney: 1000,

  // Your song. Plays from the radio on the table (click it, or press J) and at the end of the game.
  song: {
    title: 'DEALER',
    file: 'assets/audio/dealer.mp3',
    playOnEnd: true,
  },

  // Game modes, picked on the start screen. `rules` overrides the defaults in src/blackjack.js.
  modes: [
    {
      id: 'classic',
      name: 'Classic',
      blurb: 'Vegas Strip rules. Hit, stand, double, split, insurance and surrender.',
      rules: {},
    },
    {
      id: 'simple',
      name: 'Hit & Stand',
      blurb: 'Just the basics. Hit or stand: no doubling, splitting, insurance or surrender.',
      rules: { allowDouble: false, allowSplit: false, lateSurrender: false, insurance: false },
    },
    {
      id: 'baby',
      name: 'Baby',
      blurb: 'Hit & Stand, but Jack speaks your language. Get anofer cawd?',
      rules: { allowDouble: false, allowSplit: false, lateSurrender: false, insurance: false },
      labels: { hit: 'get anofer cawd', stand: 'dont get anofer cawd' },
    },
    {
      id: 'single',
      name: 'Single Deck',
      blurb: 'One deck, shuffled often. No surrender. Count the cards if you dare.',
      rules: { decks: 1, penetration: 0.6, lateSurrender: false },
    },
  ],

  // Paste your Spotify track link here (e.g. 'https://open.spotify.com/track/...')
  // and an "Open on Spotify" button appears in the game. Leave empty to hide it.
  spotifyUrl: 'https://open.spotify.com/album/6wyomFtYLRTky1U38RurLU',
};
