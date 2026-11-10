// Plinko: drop a chip into a board of pegs. At every peg it bounces left or right with even odds,
// so it usually lands near the middle and only rarely in the big-paying slots at the sides.
import { fairRandom } from './blackjack.js';

export const ROWS = 12;

// Payout for each of the 13 slots (left to right), by risk level. Tuned for about a 93-95% return.
export const PLINKO_TABLES = {
  low: [8, 3, 1.4, 1.3, 1.1, 0.9, 0.5, 0.9, 1.1, 1.3, 1.4, 3, 8],
  medium: [30, 9, 3.3, 1.7, 1.1, 0.6, 0.4, 0.6, 1.1, 1.7, 3.3, 9, 30],
  high: [90, 20, 6, 2.4, 0.7, 0.3, 0.2, 0.3, 0.7, 2.4, 6, 20, 90],
};

export const PLINKO_DEFAULTS = { risk: 'medium', minBet: 1, maxBet: 100 };

function choose(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Exact long-run return for a risk table. */
export function plinkoReturn(table) {
  let ev = 0;
  for (let k = 0; k <= ROWS; k++) ev += (choose(ROWS, k) / 2 ** ROWS) * table[k];
  return ev;
}

export class PlinkoGame {
  constructor({ bankroll = 1000, bet = 5, rules = {}, rng = fairRandom } = {}) {
    this.rules = { ...PLINKO_DEFAULTS, ...rules };
    this.table = PLINKO_TABLES[this.rules.risk];
    this.rng = rng;
    this.bankroll = bankroll;
    this.bet = bet;
    this.phase = 'betting';
    this.last = null;
  }
  get canBet() {
    return this.phase !== 'dropping';
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
  /** Drop one chip: returns the bounce path (0 = left, 1 = right per row) and the slot. */
  drop() {
    if (!this.canDeal()) return null;
    this.bankroll -= this.bet;
    const path = Array.from({ length: ROWS }, () => (this.rng() < 0.5 ? 0 : 1));
    const slot = path.reduce((a, b) => a + b, 0);
    const mult = this.table[slot];
    const payout = Math.round(this.bet * mult * 100) / 100;
    this.bankroll = Math.round((this.bankroll + payout) * 100) / 100;
    this.last = { path, slot, mult, payout, net: Math.round((payout - this.bet) * 100) / 100, bet: this.bet };
    if (this.bet > this.bankroll) this.bet = Math.max(this.rules.minBet, Math.floor(this.bankroll));
    return this.last;
  }
}
