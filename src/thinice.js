// Thin Ice: a wind-up penguin waddles across a row of ice tiles laid on the felt.
// Every hop multiplies your stake, and every tile might crack. It's pure chance: each tile
// has the same odds of breaking, and nothing that happened before changes the next one.
// Cash out whenever you like; if the ice gives way first, the stake goes into the water.
import { fairRandom } from './blackjack.js';

export const THINICE_DEFAULTS = {
  breakChance: 1 / 6, // chance any single tile cracks
  tiles: 10, // reach the far side and you're paid automatically
  houseEdge: 0.04,
  minBet: 5,
  maxBet: 1000,
};

/** What the stake is multiplied by after `steps` safe hops (fair odds minus the house edge). */
export function multiplierAfter(steps, breakChance, houseEdge) {
  if (steps <= 0) return 1;
  const fair = 1 / Math.pow(1 - breakChance, steps);
  return Math.floor(fair * (1 - houseEdge) * 100) / 100;
}

export class ThinIceGame {
  constructor({ bankroll = 1000, bet = 25, rules = {}, rng = fairRandom } = {}) {
    this.rules = { ...THINICE_DEFAULTS, ...rules };
    this.rng = rng;
    this.bankroll = bankroll;
    this.bet = bet;
    this.steps = 0;
    this.phase = 'betting'; // betting | walking | settled
    this.events = [];
    this.lastResult = null;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  flush() {
    const e = this.events;
    this.events = [];
    return e;
  }

  get canBet() {
    return this.phase !== 'walking';
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

  multiplier(steps = this.steps) {
    return multiplierAfter(steps, this.rules.breakChance, this.rules.houseEdge);
  }
  get pot() {
    return Math.round(this.bet * this.multiplier() * 100) / 100;
  }
  /** The ladder of multipliers for every tile, for labels over the ice. */
  ladder() {
    return Array.from({ length: this.rules.tiles }, (_, i) => this.multiplier(i + 1));
  }

  get canStep() {
    return this.phase === 'walking' && this.steps < this.rules.tiles;
  }
  get canCashOut() {
    return this.phase === 'walking' && this.steps > 0;
  }

  /** Put the stake down and set the penguin at the edge of the ice. */
  deal() {
    if (!this.canDeal()) return false;
    this.bankroll -= this.bet;
    this.steps = 0;
    this.lastResult = null;
    this.phase = 'walking';
    this.emit('start', { bet: this.bet, ladder: this.ladder() });
    return true;
  }

  /** One hop onto the next tile. */
  step() {
    if (!this.canStep) return false;
    const tile = this.steps; // index of the tile being stepped on
    if (this.rng() < this.rules.breakChance) {
      this.emit('crack', { tile });
      this.finish(0, 'fell');
      return true;
    }
    this.steps += 1;
    this.emit('hop', { tile, steps: this.steps, mult: this.multiplier(), pot: this.pot });
    if (this.steps >= this.rules.tiles) this.finish(this.pot, 'across');
    return true;
  }

  cashOut() {
    if (!this.canCashOut) return false;
    this.finish(this.pot, 'cashout');
    return true;
  }

  finish(payout, how) {
    this.bankroll = Math.round((this.bankroll + payout) * 100) / 100;
    const net = Math.round((payout - this.bet) * 100) / 100;
    this.lastResult = { how, payout, net, steps: this.steps, bet: this.bet, mult: payout ? this.multiplier() : 0 };
    this.phase = 'settled';
    if (this.bet > this.bankroll) this.bet = Math.max(this.rules.minBet, Math.floor(this.bankroll));
    this.emit('settle', this.lastResult);
  }
}
