import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlackjackGame, Shoe, handValue, isNatural } from '../src/blackjack.js';

// Draw order on the opening deal: player, dealer up, player, dealer hole.
function game(stack, opts = {}) {
  return new BlackjackGame({ bankroll: 1000, bet: 100, shoe: new Shoe({ stack }), ...opts });
}

test('hand values handle soft and hard aces', () => {
  assert.deepEqual(handValue(['A', '6']), { total: 17, soft: true });
  assert.deepEqual(handValue(['A', '6', '10']), { total: 17, soft: false });
  assert.deepEqual(handValue(['A', 'A', '9']), { total: 21, soft: true });
  assert.deepEqual(handValue(['K', 'Q', '5']), { total: 25, soft: false });
  assert.ok(isNatural(['A', 'K']));
  assert.ok(!isNatural(['7', '7', '7']));
});

test('six-deck shoe has 312 cards and a cut card around 75%', () => {
  const s = new Shoe({ decks: 6 });
  assert.equal(s.remaining, 312);
  assert.ok(s.cutIndex >= 224 && s.cutIndex <= 244, `cut card at ${s.cutIndex}`);
  for (let i = 0; i < s.cutIndex - 1; i++) s.draw();
  assert.ok(!s.needsShuffle);
  s.draw();
  assert.ok(s.needsShuffle);
});

test('every shuffle is different', () => {
  const order = () => new Shoe({ decks: 1 }).cards.map((c) => c.rank + c.suit).join(',');
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(order());
  assert.equal(seen.size, 200);
});

test('shuffle is unbiased: each card is equally likely to come out first', () => {
  // 52,000 single-deck shuffles: each card should be first about 1,000 times.
  const counts = new Map();
  const N = 52000;
  for (let i = 0; i < N; i++) {
    const c = new Shoe({ decks: 1 }).draw();
    const k = c.rank + c.suit;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  assert.equal(counts.size, 52);
  // chi-squared with 51 degrees of freedom; 99.9th percentile is about 87.
  const expected = N / 52;
  let chi = 0;
  for (const n of counts.values()) chi += (n - expected) ** 2 / expected;
  assert.ok(chi < 87, `chi-squared ${chi.toFixed(1)} too high: shuffle looks biased`);
});

test('the house edge is real: random play over many hands loses a little, not a lot', () => {
  // Basic "hit below 17, else stand" play over many random hands. Blackjack's house edge
  // is small, so the result should be a modest loss per hand, never a big win or a wipeout.
  const g = new BlackjackGame({ bankroll: 1e9, bet: 10, rules: { insurance: false } });
  const hands = 20000;
  for (let i = 0; i < hands; i++) {
    g.deal();
    while (g.phase === 'player') {
      if (handValue(g.currentHand.cards).total < 17) g.hit();
      else g.stand();
    }
    g.flush();
  }
  const perHand = (g.bankroll - 1e9) / hands / 10; // as a fraction of the bet
  assert.ok(perHand < 0.02 && perHand > -0.12, `average result ${(perHand * 100).toFixed(1)}% per hand`);
});

test('player blackjack pays 3:2', () => {
  const g = game(['A', '9', 'K', '7']);
  g.deal();
  assert.equal(g.phase, 'settled');
  assert.equal(g.lastResults.hands[0].outcome, 'blackjack');
  assert.equal(g.bankroll, 1150);
});

test('dealer peeks with a ten up and wins with blackjack', () => {
  const g = game(['10', 'K', '9', 'A']);
  g.deal();
  assert.equal(g.phase, 'settled');
  assert.equal(g.lastResults.hands[0].outcome, 'lose');
  assert.equal(g.bankroll, 900);
});

test('both blackjack is a push', () => {
  const g = game(['A', 'K', 'Q', 'A']);
  g.deal();
  assert.equal(g.lastResults.hands[0].outcome, 'push');
  assert.equal(g.bankroll, 1000);
});

test('insurance pays 2:1 when dealer has blackjack', () => {
  const g = game(['10', 'A', '9', 'K']);
  g.deal();
  assert.equal(g.phase, 'insurance');
  g.insure(true);
  assert.equal(g.phase, 'settled');
  // lose 100 main bet, win 100 on 50 insurance => even
  assert.equal(g.bankroll, 1000);
});

test('insurance is lost when dealer has no blackjack, play continues', () => {
  const g = game(['10', 'A', '9', '5', '10']);
  g.deal();
  g.insure(true);
  assert.equal(g.phase, 'player');
  assert.equal(g.bankroll, 850);
  g.stand(); // dealer A5 = soft 16, hits 10 -> 16, hits again...
  assert.equal(g.phase, 'settled');
  assert.equal(g.lastResults.insuranceNet, -50);
});

test('hit to bust loses and dealer does not draw', () => {
  const g = game(['10', '7', '6', '9', 'K', '5']);
  g.deal();
  g.hit();
  assert.equal(g.phase, 'settled');
  assert.equal(g.lastResults.hands[0].outcome, 'bust');
  assert.equal(g.dealer.length, 2);
  assert.equal(g.bankroll, 900);
});

test('dealer stands on soft 17 by default', () => {
  const g = game(['10', 'A', '8', '6']);
  g.deal();
  g.insure(false);
  g.stand();
  assert.equal(g.dealer.length, 2);
  assert.equal(g.lastResults.dealerTotal, 17);
  assert.equal(g.lastResults.hands[0].outcome, 'win');
});

test('dealer hits soft 17 when the rule is on', () => {
  const g = game(['10', 'A', '8', '6', '3'], { rules: { dealerHitsSoft17: true } });
  g.deal();
  g.insure(false);
  g.stand();
  assert.equal(g.lastResults.dealerTotal, 20);
  assert.equal(g.lastResults.hands[0].outcome, 'lose');
});

test('double down doubles the bet and takes exactly one card', () => {
  const g = game(['6', '10', '5', '7', '10']);
  g.deal();
  assert.ok(g.availableActions().double);
  g.double();
  assert.equal(g.hands[0].cards.length, 3);
  assert.equal(g.lastResults.hands[0].outcome, 'win');
  assert.equal(g.bankroll, 1200);
});

test('split creates two hands, each played in turn', () => {
  // P 8, D 6, P 8, D 10(hole) -> split: hand1 gets 3 (11), double -> 10 (21)
  // hand2 gets 2 (10), stand. Dealer 16 hits K -> bust.
  const g = game(['8', '6', '8', '10', '3', '10', '2', 'K']);
  g.deal();
  assert.ok(g.availableActions().split);
  g.split();
  assert.equal(g.hands.length, 2);
  g.double();
  assert.equal(g.active, 1);
  assert.equal(g.hands[1].cards.length, 2);
  g.stand();
  assert.equal(g.phase, 'settled');
  assert.deepEqual(
    g.lastResults.hands.map((h) => h.outcome),
    ['win', 'win'],
  );
  assert.equal(g.bankroll, 1000 + 200 + 100);
});

test('split aces get one card each and 21 is not blackjack', () => {
  const g = game(['A', '9', 'A', '8', 'K', '5']);
  g.deal();
  g.split();
  assert.equal(g.phase, 'settled');
  const [h1, h2] = g.lastResults.hands;
  assert.equal(h1.outcome, 'win');
  assert.equal(h1.payout, 200); // even money, not 3:2
  assert.equal(h2.total, 16);
  assert.equal(h2.outcome, 'lose');
});

test('late surrender returns half the bet', () => {
  const g = game(['10', '9', '6', '8']);
  g.deal();
  g.surrender();
  assert.equal(g.lastResults.hands[0].outcome, 'surrender');
  assert.equal(g.bankroll, 950);
});

test('cannot surrender after hitting', () => {
  const g = game(['2', '9', '3', '8', '2']);
  g.deal();
  g.hit();
  assert.equal(g.availableActions().surrender, false);
  assert.equal(g.availableActions().double, false);
});

test('hit & stand mode offers only hit and stand', () => {
  const g = game(['8', '6', '8', '10'], {
    rules: { allowDouble: false, allowSplit: false, lateSurrender: false, insurance: false },
  });
  g.deal();
  assert.deepEqual(g.availableActions(), { hit: true, stand: true, double: false, split: false, surrender: false });
  assert.equal(g.double(), false);
  assert.equal(g.split(), false);
});

test('no insurance offer when insurance is off', () => {
  const g = game(['10', 'A', '9', '5'], { rules: { insurance: false } });
  g.deal();
  assert.equal(g.phase, 'player');
});

test('single deck shoe has 52 cards', () => {
  assert.equal(new Shoe({ decks: 1 }).remaining, 52);
});
