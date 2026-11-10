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

  // Games on the start screen, each with its own types. `rules` overrides that game's defaults
  // (src/blackjack.js, src/hilo.js, src/slots.js). Number keys pick types in the order listed.
  games: [
    {
      id: 'blackjack',
      name: 'Blackjack',
      blurb: 'Beat Jack to 21 without going over.',
      modes: [
        {
          id: 'classic',
          name: 'Classic',
          blurb: 'Vegas Strip rules: hit, stand, double, split, insurance and surrender.',
          rules: {},
        },
        {
          id: 'simple',
          name: 'Hit & Stand',
          blurb: 'Just the basics. No doubling, splitting, insurance or surrender.',
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
    },
    {
      id: 'roulette',
      name: 'Roulette',
      blurb: 'Jack spins the wheel. Put chips on numbers, colours, dozens or columns.',
      modes: [
        { id: 'roulette-eu', name: 'European', blurb: 'One green zero. The better odds.', rules: { wheel: 'european' } },
        { id: 'roulette-us', name: 'American', blurb: 'Zero and double zero. The house likes this one.', rules: { wheel: 'american' } },
      ],
    },
    {
      id: 'hilo',
      name: 'Higher or Lower',
      blurb: 'Call the next card. Each right call grows the pot. Collect before you guess wrong.',
      modes: [
        {
          id: 'hilo-classic',
          name: 'Classic',
          blurb: 'Aces are high. Long-shot calls pay more.',
          rules: { aceHigh: true },
        },
        {
          id: 'hilo-acelow',
          name: 'Aces Low',
          blurb: 'Aces count as one, so they sit at the bottom.',
          rules: { aceHigh: false },
        },
      ],
    },
    {
      id: 'race',
      name: 'Penguin Race',
      blurb: 'Wind-up penguins waddle across the felt. Back one and hope it holds its nerve.',
      modes: [
        { id: 'race-4', name: 'Four Penguins', blurb: '1 in 4 chance. Pays 3.6× your bet.', rules: { racers: 4, pays: 3.6 } },
        { id: 'race-6', name: 'Six Penguins', blurb: '1 in 6 chance. Pays 5.4× your bet.', rules: { racers: 6, pays: 5.4 } },
      ],
    },
    {
      id: 'thinice',
      name: 'Thin Ice',
      blurb: 'A wind-up penguin hops across the ice. Every hop pays more. Cash out before a tile cracks.',
      modes: [
        { id: 'ice-easy', name: 'Easy', blurb: '1 in 12 tiles cracks. Slow, steady climb.', rules: { breakChance: 1 / 12 } },
        { id: 'ice-medium', name: 'Medium', blurb: '1 in 6 tiles cracks. Pays 1.15× on the first hop.', rules: { breakChance: 1 / 6 } },
        { id: 'ice-hard', name: 'Hard', blurb: '1 in 3 tiles cracks. Huge payouts if you dare.', rules: { breakChance: 1 / 3 } },
      ],
    },
    {
      id: 'glacier',
      name: 'Glacier Edge',
      blurb: 'Shove the penguin toward the water. Hold Space to brake. The closer to the edge he stops, the more it pays.',
      modes: [
        { id: 'glacier-classic', name: 'Classic', blurb: 'Steady ice. Read the slide and brake late.', rules: {} },
        {
          id: 'glacier-black',
          name: 'Black Ice',
          blurb: 'Faster pushes and wild slick patches. Harder to judge.',
          rules: { speed: [3.1, 3.9], friction: 0.42, patchiness: 0.95, brake: 3.6 },
        },
      ],
    },
    {
      id: 'plinko',
      name: 'Plinko',
      blurb: 'Drop a chip down the peg board in the corner. The edges pay big; the middle rarely does.',
      modes: [
        { id: 'plinko-low', name: 'Low Risk', blurb: 'Small, steady wins. Up to 8×.', rules: { risk: 'low' } },
        { id: 'plinko-medium', name: 'Medium Risk', blurb: 'Up to 30× at the edges.', rules: { risk: 'medium' } },
        { id: 'plinko-high', name: 'High Risk', blurb: 'Mostly losses. 90× if you hit an edge.', rules: { risk: 'high' } },
      ],
    },
    {
      id: 'slots',
      name: 'Slots',
      blurb: "Pull the lever on the machine in the corner. Three Jacks pays 200 to 1.",
      modes: [
        {
          id: 'slots-classic',
          name: 'Three Reels',
          blurb: 'Classic three-reel machine. Bet $1 to $100 a spin.',
          rules: {},
        },
      ],
    },
  ],

  // The room's background crowd: a recording of a real bar, looped. Set to '' to use the
  // synthesized murmur instead.
  crowd: 'assets/audio/crowd.mp3',

  // Paste your Spotify track link here (e.g. 'https://open.spotify.com/track/...')
  // and an "Open on Spotify" button appears in the game. Leave empty to hide it.
  spotifyUrl: 'https://open.spotify.com/album/6wyomFtYLRTky1U38RurLU',
};
