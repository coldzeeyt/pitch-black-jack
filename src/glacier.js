// Glacier Edge: the penguin is shoved down a glacier toward open water. Hold the brake to slow
// him down. Where he stops decides the payout: the nearer the edge, the more it pays. Slide off
// and the stake is gone; stop too far back and it's gone too.
// Every run is different: his starting speed and the slick and sticky patches on the ice are
// rolled fresh, so you have to read each slide as it happens.
import { fairRandom } from './blackjack.js';

export const GLACIER_DEFAULTS = {
  length: 3.0, // metres from the start line to the edge
  speed: [2.8, 3.4], // starting speed range, m/s
  friction: 0.55, // ice drag, m/s² on average
  patchiness: 0.6, // how much the drag varies along the ice (0 = smooth)
  brake: 3.0, // extra slowing while braking, m/s²
  // payout by how far from the edge he stops (metres)
  zones: [
    { within: 0.06, pays: 8, name: 'On the lip' },
    { within: 0.18, pays: 4, name: 'Toes over' },
    { within: 0.4, pays: 2, name: 'Close' },
    { within: 0.75, pays: 1.2, name: 'Safe' },
    { within: 1.0, pays: 0.5, name: 'Timid' },
  ],
  minBet: 5,
  maxBet: 1000,
};

export class GlacierGame {
  constructor({ bankroll = 1000, bet = 25, rules = {}, rng = fairRandom } = {}) {
    this.rules = { ...GLACIER_DEFAULTS, ...rules };
    this.rng = rng;
    this.bankroll = bankroll;
    this.bet = bet;
    this.phase = 'betting'; // betting | sliding | settled
    this.run = null;
    this.lastResult = null;
  }

  get canBet() {
    return this.phase !== 'sliding';
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

  /** Takes the bet and rolls this run's ice and push. Returns the run. */
  deal() {
    if (!this.canDeal()) return null;
    this.bankroll -= this.bet;
    const r = this.rules;
    const [lo, hi] = r.speed;
    const patches = Array.from({ length: 6 }, () => ({
      at: this.rng() * r.length,
      width: 0.15 + this.rng() * 0.35,
      amount: (this.rng() * 2 - 1) * r.patchiness, // negative = slicker, positive = stickier
    }));
    this.run = { x: 0, v: lo + this.rng() * (hi - lo), patches, braking: false, time: 0 };
    this.phase = 'sliding';
    this.lastResult = null;
    return this.run;
  }

  /** Ice drag at a spot on the glacier (m/s²). */
  drag(x) {
    let k = 1;
    for (const p of this.run.patches) k += p.amount * Math.exp(-((x - p.at) ** 2) / (2 * p.width ** 2));
    return this.rules.friction * Math.max(0.15, k);
  }

  /**
   * Advance the slide by dt seconds. Returns 'sliding', 'stopped' or 'fell'.
   * The game settles itself on stop or fall.
   */
  tick(dt, braking) {
    if (this.phase !== 'sliding') return this.phase;
    const run = this.run;
    run.braking = braking;
    const steps = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = this.drag(run.x) + (braking ? this.rules.brake : 0);
      run.v -= a * h;
      if (run.v <= 0) {
        run.v = 0;
        this.settle(false);
        return 'stopped';
      }
      run.x += run.v * h;
      run.time += h;
      if (run.x > this.rules.length) {
        this.settle(true);
        return 'fell';
      }
    }
    return 'sliding';
  }

  get distanceToEdge() {
    return this.run ? Math.max(0, this.rules.length - this.run.x) : this.rules.length;
  }

  zoneFor(distance) {
    return this.rules.zones.find((z) => distance <= z.within) || null;
  }

  settle(fell) {
    const d = this.distanceToEdge;
    const zone = fell ? null : this.zoneFor(d);
    const payout = zone ? Math.round(this.bet * zone.pays * 100) / 100 : 0;
    this.bankroll = Math.round((this.bankroll + payout) * 100) / 100;
    const net = Math.round((payout - this.bet) * 100) / 100;
    this.lastResult = { fell, distance: fell ? 0 : d, zone, payout, net, bet: this.bet };
    this.phase = 'settled';
    if (this.bet > this.bankroll) this.bet = Math.max(this.rules.minBet, Math.floor(this.bankroll));
    return this.lastResult;
  }
}
