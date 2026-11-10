// Penguin Race: wind-up penguins waddle across the felt. Pick one and bet on it.
// Every penguin has the same chance; the winner is drawn fairly before the race starts and the
// race is then run out with random bursts and stumbles so it looks (and feels) like a race.
import { fairRandom } from './blackjack.js';

export const RACERS = [
  { name: 'Pip', color: 0xc0262d, css: '#e0454b' },
  { name: 'Bishop', color: 0x2a5bd7, css: '#5a86ee' },
  { name: 'Mabel', color: 0x2f9a4c, css: '#55c472' },
  { name: 'Duke', color: 0xd4a32a, css: '#ebc04f' },
  { name: 'Clementine', color: 0x7a3fc0, css: '#a274e0' },
  { name: 'Ghost', color: 0xdcdcdc, css: '#f0f0f0' },
];

export const RACE_DEFAULTS = { racers: 4, pays: 3.6, minBet: 5, maxBet: 1000 };

export class RaceGame {
  constructor({ bankroll = 1000, bet = 25, rules = {}, rng = fairRandom } = {}) {
    this.rules = { ...RACE_DEFAULTS, ...rules };
    this.rng = rng;
    this.bankroll = bankroll;
    this.bet = bet;
    this.pick = 0;
    this.phase = 'betting';
    this.last = null;
  }
  get racers() {
    return RACERS.slice(0, this.rules.racers);
  }
  get canBet() {
    return this.phase !== 'racing';
  }
  get broke() {
    return this.canBet && this.bankroll < this.rules.minBet;
  }
  setBet(amount) {
    if (!this.canBet) return false;
    const max = Math.min(this.rules.maxBet, Math.floor(this.bankroll));
    this.bet = Math.max(this.rules.minBet, Math.min(max, Math.round(amount)));
    return true;
  }
  canDeal() {
    return this.canBet && this.bet >= this.rules.minBet && this.bet <= this.bankroll;
  }
  choose(i) {
    if (!this.canBet) return false;
    const n = this.rules.racers;
    this.pick = ((i % n) + n) % n;
    return true;
  }
  /** Takes the bet and decides the race. The 3D side then plays it out. */
  start() {
    if (!this.canDeal()) return null;
    this.bankroll -= this.bet;
    const winner = Math.floor(this.rng() * this.rules.racers);
    const won = winner === this.pick;
    const payout = won ? Math.round(this.bet * this.rules.pays * 100) / 100 : 0;
    this.phase = 'racing';
    this.last = { winner, pick: this.pick, won, payout, net: Math.round((payout - this.bet) * 100) / 100, bet: this.bet };
    return this.last;
  }
  /** Called when the animation reaches the line. */
  finish() {
    if (this.phase !== 'racing') return null;
    this.bankroll = Math.round((this.bankroll + this.last.payout) * 100) / 100;
    this.phase = 'settled';
    if (this.bet > this.bankroll) this.bet = Math.max(this.rules.minBet, Math.floor(this.bankroll));
    return this.last;
  }
}

/**
 * Speed plans for every racer so the chosen winner crosses first. Each racer gets a sequence of
 * segments (burst, cruise, stumble) and a finish time; the winner's is the earliest.
 * Returns per-racer arrays of { t, x } keyframes from x = 0 to x = 1.
 */
export function planRace(count, winner, rng = Math.random) {
  const base = 6.5; // seconds for an average finish
  const times = Array.from({ length: count }, () => base + (rng() - 0.5) * 1.6);
  const best = Math.min(...times) - 0.25 - rng() * 0.4;
  times[winner] = best;
  // make sure everyone else is behind the winner by a visible margin
  for (let i = 0; i < count; i++) if (i !== winner && times[i] < best + 0.18) times[i] = best + 0.18 + rng() * 0.3;
  return times.map((total) => {
    const keys = [{ t: 0, x: 0 }];
    const n = 7;
    // uneven progress: random weights per segment, normalised to the finish time
    const weights = Array.from({ length: n }, () => 0.35 + rng() * 1.3);
    const sum = weights.reduce((a, b) => a + b, 0);
    let x = 0;
    for (let k = 0; k < n; k++) {
      x += weights[k] / sum;
      keys.push({ t: (total * (k + 1)) / n, x: Math.min(1, x) });
    }
    keys[keys.length - 1].x = 1;
    return keys;
  });
}

/** Position (0..1) along the track at time t from a keyframe list (smooth between keys). */
export function sampleRace(keys, t) {
  if (t <= 0) return 0;
  const last = keys[keys.length - 1];
  if (t >= last.t) return 1;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const u = (t - a.t) / (b.t - a.t);
      const e = u * u * (3 - 2 * u);
      return a.x + (b.x - a.x) * e;
    }
  }
  return 1;
}
