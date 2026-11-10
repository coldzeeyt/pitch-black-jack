# Pitch Black Jack

A smoky, eerie 3D blackjack parlor. One green table under one flickering lamp, patrons
murmuring somewhere in the dark, and a dealer in a low-brimmed hat whose face you never see.

His name is Jack.

## Play

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

## Game modes

Pick one on the start screen (`1`–`4`):

- **Classic**: full Vegas rules, below
- **Hit & Stand**: only hit and stand
- **Baby**: Hit & Stand, but the buttons say *get anofer cawd* and *dont get anofer cawd*
- **Single Deck**: one deck, shuffled often, no surrender

Modes live in `src/config.js`. Add your own by overriding any rule.

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

## Your art

The cards use the hand-drawn master sheet in `assets/cards/master.png`. The game slices it,
trims each card to its outline, and stamps the suit (♠ ♥ ♦ ♣) on in red or black. See
[`assets/README.md`](assets/README.md) to swap in new art, change the card back, or use
separate files per card.

## Layout

```
index.html          page, HUD, intro and statement screens
src/blackjack.js    rules engine (pure logic, emits events)
src/main.js         plays events back as 3D animation; input, HUD, statement
src/scene.js        the room, the table, Jack, the lamp, smoke, the radio
src/cards.js        3D cards built from your art
src/audio.js        synthesized ambience (chatter, hum, drone) + foley + the song
src/config.js       starting money, song, Spotify link
assets/             cards, logo, music
tests/              rules tests (node --test)
```
