# Your art goes here

The game runs fine with no art. It draws placeholder cards: a grey back with a thick
black rounded border, and a cream front. Drop your own images in and they show up on
the 3D cards automatically.

## Cards: `assets/cards/`

1. Put your PNG/JPG files in `assets/cards/`.
2. Name them in `assets/cards/cards.json`:

```json
{
  "back": "back.png",
  "face": "face.png",
  "ranks": {
    "A": "A.png",
    "2": "2.png",
    "3": "3.png"
  },
  "cards": {
    "AS": "ace-of-spades.png",
    "JC": "jack-of-clubs.png"
  }
}
```

| Key     | What it is | Required? |
|---------|------------|-----------|
| `back`  | Every face-down card uses this image. | no |
| `face`  | A **blank** card front. The game draws the rank and suit (A♠, 10♥, K♣…) on top, so one image covers all 52 cards. Keep the middle plain so the symbols are readable. | no |
| `ranks` | One front per rank, reused for all four suits. The game stamps a small ♠♥♦♣ in the top-left and bottom-right corners, so **don't draw suits** and leave those corners clear. Ranks are `A 2 3 4 5 6 7 8 9 10 J Q K`. There's **no 1**: the Ace counts as 1 or 11. Any rank you skip uses `face` (or the placeholder) instead. | no |
| `cards` | Optional full custom fronts for single cards. Codes are rank + suit: ranks `A 2 3 4 5 6 7 8 9 10 J Q K`, suits `S` spades, `H` hearts, `D` diamonds, `C` clubs. Examples: `AS`, `10H`, `QD`. These are drawn as-is, so include the rank and suit in the art. | no |

You **don't** need to draw suits or jokers. Blackjack uses no jokers.

**How many images?** Two (`back` + `face`) covers the whole deck. With `ranks` it's
up to 13 + a back. With `cards` it's up to 52 + a back. Mix freely: the most specific
image wins (`cards` > `ranks` > `face` > placeholder).

**Size:** portrait, about 5:7, e.g. **500 × 700 px**. The 3D card already has rounded
corners, so fill the whole rectangle and let the edges get trimmed. Draw a thick
border the way your sketch does if you want it.

## One master sheet instead of separate files

If all your cards are drawn on one big image in a grid, skip cutting them up:

```json
{
  "sheet": {
    "image": "master.png",
    "columns": 7,
    "rows": 2,
    "order": ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "back"]
  }
}
```

`order` names each grid cell, reading left to right, top to bottom. Use rank names
(`A`…`K`), `back`, `face`, or single-card codes like `AS`. Use `null` for an empty cell.
If there's spacing between the cards, add `"gap": <pixels>`.

## Logo: `assets/logo.png`

Optional. When present, it's shown on the title screen and printed on the table felt.
A transparent PNG works best.
