// Roulette. European wheel (single 0) or American (0 and 00). Bets are placed on a layout and
// all settle on one spin. 00 is stored as the number 37 and shown as "00".
import { fairRandom } from './blackjack.js';

export const EUROPEAN = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const AMERICAN = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const label = (n) => (n === 37 ? '00' : String(n));
export const colorOf = (n) => (n === 0 || n === 37 ? 'green' : REDS.has(n) ? 'red' : 'black');

/** What each kind of bet pays to 1. */
export const PAYS = { n: 35, red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1, dozen: 2, column: 2 };

/** Does a bet (kind + target) win on number n? */
export function wins(kind, target, n) {
  if (kind === 'n') return n === target;
  if (n === 0 || n === 37) return false; // the green pockets beat every outside bet
  switch (kind) {
    case 'red':
      return REDS.has(n);
    case 'black':
      return !REDS.has(n);
    case 'odd':
      return n % 2 === 1;
    case 'even':
      return n % 2 === 0;
    case 'low':
      return n <= 18;
    case 'high':
      return n >= 19;
    case 'dozen':
      return Math.ceil(n / 12) === target; // 1, 2, 3
    case 'column':
      return ((n - 1) % 3) + 1 === target; // 1 = 1,4,7…; 2 = 2,5,8…; 3 = 3,6,9…
  }
  return false;
}

export const betKey = (kind, target) => (target === undefined || target === null ? kind : `${kind}:${target}`);

export const ROULETTE_DEFAULTS = { wheel: 'european', maxTotal: 1000, minBet: 1, maxBet: 1000 };

export class RouletteGame {
  constructor({ bankroll = 1000, rules = {}, rng = fairRandom } = {}) {
    this.rules = { ...ROULETTE_DEFAULTS, ...rules };
    this.wheel = this.rules.wheel === 'american' ? AMERICAN : EUROPEAN;
    this.rng = rng;
    this.bankroll = bankroll;
    this.bets = new Map(); // key -> { kind, target, amount }
    this.phase = 'betting';
    this.last = null;
    this.history = [];
  }

  get bet() {
    let t = 0;
    for (const b of this.bets.values()) t += b.amount;
    return t;
  }
  get canBet() {
    return this.phase !== 'spinning';
  }
  get broke() {
    return this.canBet && this.bets.size === 0 && this.bankroll < this.rules.minBet;
  }
  canDeal() {
    return this.canBet && this.bets.size > 0 && this.bet <= this.bankroll;
  }
  /** Chips go straight onto the layout; the money leaves your stack when the wheel spins. */
  place(kind, target, amount) {
    if (!this.canBet || amount <= 0) return false;
    const room = Math.min(this.rules.maxTotal, this.bankroll) - this.bet;
    const add = Math.min(amount, room);
    if (add <= 0) return false;
    const k = betKey(kind, target);
    const b = this.bets.get(k) || { kind, target, amount: 0 };
    b.amount += add;
    this.bets.set(k, b);
    return true;
  }
  clear() {
    if (!this.canBet) return false;
    this.bets.clear();
    return true;
  }
  /** Not used for roulette: chip size is chosen per click. Kept so shared controls work. */
  setBet() {
    return false;
  }

  spin() {
    if (!this.canDeal()) return null;
    const stake = this.bet;
    this.bankroll -= stake;
    const index = Math.floor(this.rng() * this.wheel.length);
    const n = this.wheel[index];
    let payout = 0;
    const lines = [];
    for (const b of this.bets.values()) {
      const won = wins(b.kind, b.target, n);
      const p = won ? b.amount * (PAYS[b.kind] + 1) : 0;
      payout += p;
      lines.push({ ...b, won, payout: p });
    }
    this.bankroll += payout;
    this.last = { n, index, stake, payout, net: payout - stake, lines, color: colorOf(n) };
    this.history.unshift(n);
    this.history.length = Math.min(this.history.length, 12);
    // keep the same bets on the layout for the next spin if you can still afford them
    if (this.bet > this.bankroll) this.bets.clear();
    return this.last;
  }
}

/** Long-run return of a single bet type, by checking every pocket. */
export function returnFor(kind, target, wheel = EUROPEAN) {
  let total = 0;
  for (const n of wheel) total += wins(kind, target, n) ? PAYS[kind] + 1 : 0;
  return total / wheel.length;
}
