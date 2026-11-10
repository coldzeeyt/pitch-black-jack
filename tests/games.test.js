import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Shoe } from '../src/blackjack.js';
import { HiLoGame, callOdds } from '../src/hilo.js';
import { SlotsGame, STRIP, SYMBOLS, evaluate, returnToPlayer } from '../src/slots.js';

const hilo = (stack, rules = {}) => new HiLoGame({ bankroll: 1000, bet: 100, rules, shoe: new Shoe({ stack }) });

test('higher or lower: odds from a 7', () => {
  const o = callOdds('7');
  assert.equal(o.higher, 7 / 13); // 8 9 10 J Q K A
  assert.equal(o.lower, 5 / 13); // 2 3 4 5 6
});

test('higher or lower: you cannot call higher on an ace when aces are high', () => {
  const g = hilo(['A', '5']);
  g.deal();
  assert.equal(g.canCall('higher'), false);
  assert.equal(g.canCall('lower'), true);
});

test('higher or lower: a right call grows the pot by the odds, then you collect', () => {
  const g = hilo(['7', '9']);
  g.deal();
  assert.equal(g.bankroll, 900);
  const m = g.multiplier('higher'); // 0.95 / (7/12) = 1.62
  assert.equal(m, 1.62);
  g.call('higher');
  assert.equal(g.pot, 162);
  assert.ok(g.collect());
  assert.equal(g.bankroll, 1062);
  assert.equal(g.lastResult.net, 62);
});

test('higher or lower: a wrong call loses the pot', () => {
  const g = hilo(['7', '3']);
  g.deal();
  g.call('higher');
  assert.equal(g.phase, 'settled');
  assert.equal(g.bankroll, 900);
  assert.equal(g.lastResult.net, -100);
});

test('higher or lower: equal ranks push and play continues', () => {
  const g = hilo(['7', '7', '2']);
  g.deal();
  g.call('higher');
  assert.equal(g.phase, 'guessing');
  assert.equal(g.pot, 100);
  assert.equal(g.canCollect, true);
});

test('higher or lower: ace low variant', () => {
  const g = hilo(['A', '5'], { aceHigh: false });
  g.deal();
  assert.equal(g.canCall('lower'), false);
  assert.equal(g.multiplier('higher'), 1); // from an ace-low, higher is a sure thing
  g.call('higher');
  assert.equal(g.pot, 100);
  assert.equal(g.phase, 'guessing');
  assert.ok(g.multiplier('higher') > 1); // from the 5, both calls are live again
});

test('higher or lower: always calling the likelier side still has a small house edge', () => {
  const g = new HiLoGame({ bankroll: 1e9, bet: 10 });
  const rounds = 30000;
  for (let i = 0; i < rounds; i++) {
    g.deal();
    // keep making the likelier call until there's something to collect (or it's lost)
    const safer = () => {
      const h = g.multiplier('higher');
      const l = g.multiplier('lower');
      if (!h) return 'lower';
      if (!l) return 'higher';
      return h <= l ? 'higher' : 'lower';
    };
    do g.call(safer());
    while (g.phase === 'guessing' && !g.canCollect);
    if (g.phase === 'guessing') g.collect();
    g.flush();
  }
  const perRound = (g.bankroll - 1e9) / rounds / 10;
  assert.ok(perRound < 0 && perRound > -0.12, `return ${(perRound * 100).toFixed(1)}%`);
});

test('slots: strip has the right symbol weights', () => {
  for (const [k, s] of Object.entries(SYMBOLS)) assert.equal(STRIP.filter((x) => x === k).length, s.weight, k);
});

test('slots: pay table', () => {
  assert.equal(evaluate(['JACK', 'JACK', 'JACK']).pays, 200);
  assert.equal(evaluate(['SEVEN', 'BAR', 'SEVEN']).pays, 10);
  assert.equal(evaluate(['H', 'H', 'H']).pays, 11);
  assert.equal(evaluate(['H', 'D', 'H']).pays, 4);
  assert.equal(evaluate(['S', 'H', 'C']).pays, 0);
  assert.equal(evaluate(['JACK', 'S', 'H']).pays, 1);
});

test('slots: the machine returns about 93% in the long run', () => {
  const rtp = returnToPlayer();
  assert.ok(rtp > 0.9 && rtp < 0.96, `RTP ${(rtp * 100).toFixed(2)}%`);
});

test('slots: a spin takes the bet and pays the win', () => {
  let i = 0;
  const seq = [0, 0, 0]; // all JACK
  const g = new SlotsGame({ bankroll: 100, bet: 2, rng: () => seq[i++] / STRIP.length });
  const r = g.spin();
  assert.deepEqual(r.symbols, ['JACK', 'JACK', 'JACK']);
  assert.equal(r.win, 400);
  assert.equal(g.bankroll, 498);
});
