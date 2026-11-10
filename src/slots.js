// Slots: a three-reel machine in the corner of the parlor.
// Each reel is a strip of 22 stops; rarer symbols appear on fewer stops.
// The pay table is tuned for about a 93% return, like a real casino machine.
import { fairRandom } from './blackjack.js';

export const SYMBOLS = {
  JACK: { label: 'JACK', weight: 1 }, // the spade-J logo: the jackpot
  SEVEN: { label: '7', weight: 2 },
  BAR: { label: 'BAR', weight: 3 },
  S: { label: '♠', weight: 4, suit: true, color: 'black' },
  H: { label: '♥', weight: 4, suit: true, color: 'red' },
  D: { label: '♦', weight: 4, suit: true, color: 'red' },
  C: { label: '♣', weight: 4, suit: true, color: 'black' },
};

/** The physical strip, spread out so the same symbol rarely sits next to itself. */
export const STRIP = ['JACK', 'S', 'BAR', 'H', 'SEVEN', 'D', 'C', 'BAR', 'S', 'H', 'D', 'C', 'SEVEN', 'S', 'H', 'BAR', 'D', 'C', 'S', 'H', 'D', 'C'];

export const PAYTABLE = [
  { name: 'Three Jacks', pays: 200, test: (s) => s.every((x) => x === 'JACK') },
  { name: 'Three 7s', pays: 50, test: (s) => s.every((x) => x === 'SEVEN') },
  { name: 'Three BARs', pays: 20, test: (s) => s.every((x) => x === 'BAR') },
  { name: 'Three of a suit', pays: 11, test: (s) => SYMBOLS[s[0]].suit && s.every((x) => x === s[0]) },
  { name: 'Two Jacks', pays: 10, test: (s) => s.filter((x) => x === 'JACK').length === 2 },
  { name: 'Any 7s and BARs', pays: 10, test: (s) => s.every((x) => x === 'SEVEN' || x === 'BAR') },
  { name: 'Three red or three black', pays: 4, test: (s) => s.every((x) => SYMBOLS[x].suit) && new Set(s.map((x) => SYMBOLS[x].color)).size === 1 },
  { name: 'One Jack', pays: 1, test: (s) => s.filter((x) => x === 'JACK').length === 1 },
];

export function evaluate(symbols) {
  for (const line of PAYTABLE) if (line.test(symbols)) return { name: line.name, pays: line.pays };
  return { name: null, pays: 0 };
}

/** Exact long-run return per $1 bet, by checking every possible spin. */
export function returnToPlayer() {
  let total = 0;
  const n = STRIP.length;
  for (const a of STRIP) for (const b of STRIP) for (const c of STRIP) total += evaluate([a, b, c]).pays;
  return total / n ** 3;
}

export const SLOTS_DEFAULTS = { minBet: 1, maxBet: 100 };

export class SlotsGame {
  constructor({ bankroll = 1000, bet = 5, rules = {}, rng = fairRandom } = {}) {
    this.rules = { ...SLOTS_DEFAULTS, ...rules };
    this.rng = rng;
    this.bankroll = bankroll;
    this.bet = bet;
    this.phase = 'betting';
    this.last = null;
  }
  get canBet() {
    return this.phase !== 'spinning';
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
  /** Spin all three reels. Returns where each reel stops and what it paid. */
  spin() {
    if (!this.canDeal()) return null;
    this.bankroll -= this.bet;
    const stops = [0, 1, 2].map(() => Math.floor(this.rng() * STRIP.length));
    const symbols = stops.map((i) => STRIP[i]);
    const { name, pays } = evaluate(symbols);
    const win = this.bet * pays;
    this.bankroll += win;
    this.last = { stops, symbols, name, pays, win, net: win - this.bet, bet: this.bet };
    if (this.bet > this.bankroll) this.bet = Math.max(this.rules.minBet, Math.floor(this.bankroll));
    return this.last;
  }
}
