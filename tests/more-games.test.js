import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RouletteGame, EUROPEAN, AMERICAN, wins, returnFor, colorOf } from '../src/roulette.js';
import { RaceGame, planRace, sampleRace } from '../src/race.js';
import { PlinkoGame, PLINKO_TABLES, plinkoReturn, ROWS } from '../src/plinko.js';

test('roulette: wheels have the right pockets', () => {
  assert.equal(EUROPEAN.length, 37);
  assert.equal(new Set(EUROPEAN).size, 37);
  assert.equal(AMERICAN.length, 38);
  assert.equal(new Set(AMERICAN).size, 38);
  assert.equal(colorOf(0), 'green');
  assert.equal(colorOf(37), 'green');
  assert.equal(colorOf(1), 'red');
  assert.equal(colorOf(2), 'black');
});

test('roulette: bet rules', () => {
  assert.ok(wins('n', 17, 17));
  assert.ok(wins('red', null, 32));
  assert.ok(!wins('red', null, 0));
  assert.ok(!wins('even', null, 0));
  assert.ok(wins('dozen', 2, 13) && wins('dozen', 3, 36) && !wins('dozen', 1, 13));
  assert.ok(wins('column', 1, 34) && wins('column', 3, 36) && !wins('column', 2, 36));
  assert.ok(wins('low', null, 18) && wins('high', null, 19));
});

test('roulette: house edge is 2.7% on the European wheel and 5.26% on the American', () => {
  for (const [kind, target] of [['n', 7], ['red'], ['odd'], ['dozen', 2], ['column', 3]]) {
    assert.ok(Math.abs(returnFor(kind, target, EUROPEAN) - 36 / 37) < 1e-9, kind);
    assert.ok(Math.abs(returnFor(kind, target, AMERICAN) - 36 / 38) < 1e-9, kind);
  }
});

test('roulette: a spin pays every winning bet and takes the losers', () => {
  // land on 32 (red, even, high, 3rd dozen, 2nd column)
  const g = new RouletteGame({ bankroll: 1000, rng: () => (EUROPEAN.indexOf(32) + 0.5) / 37 });
  g.place('n', 32, 10); // 35:1 -> 360 back
  g.place('red', null, 50); // 1:1 -> 100 back
  g.place('odd', null, 20); // loses
  g.place('dozen', 1, 20); // loses
  const r = g.spin();
  assert.equal(r.n, 32);
  assert.equal(r.stake, 100);
  assert.equal(r.payout, 460);
  assert.equal(g.bankroll, 1360);
});

test('roulette: you cannot stake more than you have', () => {
  const g = new RouletteGame({ bankroll: 30 });
  g.place('red', null, 25);
  g.place('black', null, 25);
  assert.equal(g.bet, 30);
});

test('race: picking the winner pays, otherwise the stake is lost', () => {
  const g = new RaceGame({ bankroll: 1000, bet: 100, rng: () => 0.1 }); // winner 0
  g.choose(0);
  g.start();
  g.finish();
  assert.equal(g.bankroll, 1260);
  const h = new RaceGame({ bankroll: 1000, bet: 100, rng: () => 0.9 }); // winner 3
  h.choose(1);
  h.start();
  h.finish();
  assert.equal(h.bankroll, 900);
});

test('race: every penguin wins about equally often', () => {
  const g = new RaceGame({ bankroll: 1e9, bet: 10, rules: { racers: 4 } });
  const wins = [0, 0, 0, 0];
  for (let i = 0; i < 40000; i++) {
    wins[g.start().winner]++;
    g.finish();
  }
  for (const w of wins) assert.ok(Math.abs(w - 10000) < 500, String(wins));
});

test('race: the planned race really is won by the drawn winner', () => {
  for (let trial = 0; trial < 200; trial++) {
    const winner = trial % 6;
    const plan = planRace(6, winner);
    const finish = plan.map((keys) => keys[keys.length - 1].t);
    const first = finish.indexOf(Math.min(...finish));
    assert.equal(first, winner);
    // positions only move forward
    for (const keys of plan) for (let t = 0.1; t < 10; t += 0.1) assert.ok(sampleRace(keys, t) >= sampleRace(keys, t - 0.1) - 1e-9);
  }
});

test('plinko: every risk level returns between 92% and 96%', () => {
  for (const [name, table] of Object.entries(PLINKO_TABLES)) {
    assert.equal(table.length, ROWS + 1, name);
    const r = plinkoReturn(table);
    assert.ok(r > 0.92 && r < 0.96, `${name}: ${(r * 100).toFixed(1)}%`);
  }
});

test('plinko: a drop bounces once per row and lands where the bounces say', () => {
  const g = new PlinkoGame({ bankroll: 100, bet: 10, rules: { risk: 'high' }, rng: () => 0.1 }); // always left
  const r = g.drop();
  assert.equal(r.path.length, ROWS);
  assert.equal(r.slot, 0);
  assert.equal(r.payout, 900);
  assert.equal(g.bankroll, 990);
});
