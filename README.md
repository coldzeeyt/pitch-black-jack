# Pitch Black Jack

A smoky, eerie 3D blackjack parlor. One green table under one flickering lamp, patrons
murmuring somewhere in the dark, and a dealer in a low-brimmed hat whose face you never see.

His name is Jack.

## Play

**In your browser:** https://coldzeeyt.github.io/pitch-black-jack/ (once GitHub Pages is on).

**On your own computer:**

```bash
npm start
```

Then open http://localhost:8080. You need Node 18+. There's nothing to install: three.js
is vendored in `vendor/`. Any static file server works too, as long as you serve the folder
over http rather than opening `index.html` directly.

You walk in with **$1,000**. Cash out whenever you like (or when the money runs out) to get
your account statement, with the money visibly leaving or entering your account.

### Keys

| Key | Action |
|-----|--------|
| `H` / `L` / `C` | Higher or Lower: call higher, call lower, collect |
| `H` | Hit |
| `S` | Stand |
| `D` | Double down |
| `P` | Split |
| `R` | Surrender |
| `I` / `N` | Take / decline insurance |
| `1`–`5` | Add a $1 / $5 / $25 / $100 / $500 chip to your bet |
| `↑` / `↓` | Bet ±$5 (hold Shift for ±$25) |
| `Backspace` | Clear bet |
| `Space` / `Enter` | Deal |
| `E` | Cash out and end the game |
| `J` | Play / stop **DEALER** (or click the radio on the table) |
| `M` | Mute |
| `?` | Rules and keys |

## Games

Pick one on the start screen. Number keys 1–9 and 0 pick the first ten types; click the rest.

| Game | Types | How it plays |
|------|-------|--------------|
| **Blackjack** | Classic · Hit & Stand · Baby · Single Deck | Real casino rules (below). *Baby* renames the buttons *get anofer cawd* / *dont get anofer cawd*. |
| **Roulette** | European · American | Pick a chip with `1`–`5`, click the layout to place bets, `Space` spins. Numbers pay 35:1, dozens and columns 2:1, red/black, odd/even and 1–18/19–36 even money. House edge 2.7% (European) or 5.26% (American). |
| **Higher or Lower** | Classic · Aces Low | Call the next card with `H` / `L`. Each right call multiplies the pot by its odds; collect with `C`. |
| **Penguin Race** | Four Penguins · Six Penguins | `←` `→` pick a penguin, `Space` starts. Every penguin has the same chance; pays 3.6× or 5.4×. |
| **Thin Ice** | Easy · Medium · Hard | A wind-up penguin hops across ice tiles. Each hop raises the multiplier; any tile can crack. `Space` hops, `C` cashes out. |
| **Glacier Edge** | Classic · Black Ice | Shove the penguin toward the water and hold `Space` to brake. ×8 on the lip down to ×0.5; slide off and you lose. |
| **Plinko** | Low · Medium · High Risk | `Space` drops a chip down 12 rows of pegs into one of 13 slots. Edges pay up to 8×, 30× or 90×. |
| **Slots** | Three Reels | `Space` pulls the lever. Three Jacks pays 200×; returns about 93% over the long run. |

Every game's odds are checked by the tests (`npm test`). Games and their types live in
`src/config.js`; add your own by overriding any rule.

## House rules

Real casino blackjack, as dealt on the Las Vegas Strip:

- Six-deck shoe, reshuffled when the cut card comes out (~75% penetration)
- Blackjack pays **3 to 2**
- Dealer **stands on all 17s** and **peeks** for blackjack with an Ace or ten up
- **Insurance** offered on a dealer Ace, pays 2 to 1
- **Double** on any first two cards, including after a split
- **Split** pairs (any two ten-value cards count) up to four hands; split Aces get one card
  each, can't be resplit, and 21 on them isn't a blackjack
- **Late surrender** returns half your bet
- Bets from $5 to $1,000

The rules engine (`src/blackjack.js`) has no rendering code and is covered by tests:

```bash
npm test
```

## Music

**DEALER** plays from the radio on the table: click it, press `J`, or use the ♫ button. It
also plays when the account statement rolls at the end. Listen on
[Spotify](https://open.spotify.com/album/6wyomFtYLRTky1U38RurLU).

The song file, the starting money, and the Spotify link are set in `src/config.js`.

The room's crowd is a looped recording of a real bar (`assets/audio/crowd.mp3`, 12 minutes,
crossfaded so the loop has no seam). If it's missing, the game falls back to synthesized murmuring.

## Your art

The cards use the hand-drawn master sheet in `assets/cards/master.png`. The game slices it,
trims each card to its outline, and stamps the suit (♠ ♥ ♦ ♣) on in red or black. See
[`assets/README.md`](assets/README.md) to swap in new art, change the card back, or use
separate files per card.

## Layout

```
index.html          page, HUD, intro and statement screens
src/blackjack.js    blackjack rules engine (pure logic, emits events)
src/hilo.js         Higher or Lower engine
src/slots.js        slot reels, pay table and return-to-player math
src/slotmachine.js  the 3D slot machine
src/thinice.js      Thin Ice engine · src/thinice3d.js the ice row and the tin penguin
src/glacier.js      Glacier Edge engine and sliding physics · src/glacier3d.js the glacier
src/roulette.js     roulette rules · src/roulette3d.js the wheel
src/race.js         Penguin Race odds and race plans · src/race3d.js the track
src/plinko.js       Plinko odds · src/plinko3d.js the peg board
src/extras.js       controllers for Roulette, Penguin Race and Plinko
mockup/toon.html    a bright toon-style art mockup (not used by the game)
src/main.js         plays events back as 3D animation; input, HUD, statement
src/scene.js        the room, the table, the lamp, smoke, the radio
src/jack.js         Jack: suit, fedora, legs, and arms that reach with two-bone IK
src/cards.js        3D cards built from your art
src/audio.js        synthesized ambience (chatter, hum, drone) + foley + the song
src/config.js       starting money, song, Spotify link
assets/             cards, logo, music
tests/              rules tests (node --test)
preview/jack.html   Jack on his own, with camera angles (npm start, then /preview/jack.html)
```
