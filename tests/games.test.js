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

import { ThinIceGame, multiplierAfter } from '../src/thinice.js';

test('thin ice: multipliers grow with every safe hop', () => {
  assert.equal(multiplierAfter(0, 1 / 6, 0.04), 1);
  assert.equal(multiplierAfter(1, 1 / 6, 0.04), 1.15); // 0.96 / (5/6)
  assert.ok(multiplierAfter(10, 1 / 6, 0.04) > 5);
});

test('thin ice: hop, hop, cash out', () => {
  const g = new ThinIceGame({ bankroll: 1000, bet: 100, rng: () => 0.9 });
  g.deal();
  assert.equal(g.bankroll, 900);
  g.step();
  g.step();
  assert.equal(g.steps, 2);
  assert.ok(g.cashOut());
  assert.equal(g.bankroll, 900 + 100 * multiplierAfter(2, 1 / 6, 0.04));
});

test('thin ice: the ice breaks and the stake is lost', () => {
  const rolls = [0.9, 0.01];
  const g = new ThinIceGame({ bankroll: 1000, bet: 100, rng: () => rolls.shift() });
  g.deal();
  g.step();
  g.step();
  assert.equal(g.phase, 'settled');
  assert.equal(g.lastResult.how, 'fell');
  assert.equal(g.bankroll, 900);
});

test('thin ice: you cannot cash out before the first hop', () => {
  const g = new ThinIceGame({ bankroll: 1000, bet: 100 });
  g.deal();
  assert.equal(g.cashOut(), false);
});

test('thin ice: crossing every tile pays automatically', () => {
  const g = new ThinIceGame({ bankroll: 1000, bet: 10, rules: { tiles: 3 }, rng: () => 0.99 });
  g.deal();
  g.step();
  g.step();
  g.step();
  assert.equal(g.lastResult.how, 'across');
  assert.equal(g.phase, 'settled');
});

test('thin ice: whenever you cash out, the house keeps a small edge', () => {
  for (const target of [1, 3, 6]) {
    const g = new ThinIceGame({ bankroll: 1e9, bet: 10, rules: { breakChance: 1 / 6 } });
    const rounds = 40000;
    for (let i = 0; i < rounds; i++) {
      g.deal();
      while (g.phase === 'walking' && g.steps < target) g.step();
      if (g.phase === 'walking') g.cashOut();
      g.flush();
    }
    const r = (g.bankroll - 1e9) / rounds / 10;
    assert.ok(r < 0.02 && r > -0.15, `cash out at ${target}: ${(r * 100).toFixed(1)}% per round`);
  }
});

import { GlacierGame } from '../src/glacier.js';

const slide = (g, brakeWhen) => {
  let state = 'sliding';
  while (state === 'sliding') state = g.tick(1 / 60, brakeWhen(g));
  return g.lastResult;
};

test('glacier: payout grows the closer he stops to the edge', () => {
  const g = new GlacierGame();
  assert.equal(g.zoneFor(0.03).pays, 8);
  assert.equal(g.zoneFor(0.1).pays, 4);
  assert.equal(g.zoneFor(0.3).pays, 2);
  assert.equal(g.zoneFor(0.6).pays, 1.2);
  assert.equal(g.zoneFor(1.0).pays, 0.5);
  assert.equal(g.zoneFor(2.0), null);
});

test('glacier: never braking sends him into the water', () => {
  const g = new GlacierGame({ bankroll: 1000, bet: 100 });
  g.deal();
  const r = slide(g, () => false);
  assert.equal(r.fell, true);
  assert.equal(g.bankroll, 900);
});

test('glacier: braking the whole way stops him far too early', () => {
  const g = new GlacierGame({ bankroll: 1000, bet: 100 });
  g.deal();
  const r = slide(g, () => true);
  assert.equal(r.fell, false);
  assert.equal(r.zone, null);
  assert.equal(g.bankroll, 900);
});

test('glacier: a well-timed brake lands near the edge and pays', () => {
  // brake only when he'd otherwise overshoot: stopping distance v²/2a vs distance left
  const g = new GlacierGame({ bankroll: 1000, bet: 100 });
  let wins = 0;
  for (let i = 0; i < 50; i++) {
    g.deal();
    const r = slide(g, (gm) => {
      const run = gm.run;
      const coast = (run.v * run.v) / (2 * gm.drag(run.x));
      return coast > gm.distanceToEdge - 0.08;
    });
    if (r.payout > r.bet) wins++;
  }
  assert.ok(wins > 30, `only ${wins}/50 good slides`);
});

test('glacier: every run rolls a different push and different ice', () => {
  const g = new GlacierGame({ bankroll: 1e6 });
  const speeds = new Set();
  for (let i = 0; i < 20; i++) {
    speeds.add(g.deal().v.toFixed(4));
    slide(g, () => true);
  }
  assert.equal(speeds.size, 20);
});
