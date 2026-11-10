// Higher or Lower: Jack turns a card; you call whether the next is higher or lower.
// Each right call grows your pot by the odds of that call (minus a small house edge).
// Cash out any time. One wrong call and the pot is gone. Equal ranks are a push: the pot
// stands and you call again from the new card.
import { Shoe, fairRandom } from './blackjack.js';

export const HILO_DEFAULTS = {
  decks: 6,
  aceHigh: true,
  houseEdge: 0.05,
  maxCards: 8, // the row is full after 8 cards; the pot is paid out automatically
  minBet: 5,
  maxBet: 1000,
};

const ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function rankNumber(rank, aceHigh = true) {
  if (rank === 'A') return aceHigh ? 14 : 1;
  return ORDER.indexOf(rank) + 1; // 2..13
}

/** Chance the next card is higher / lower / equal, from 13 equally likely ranks. */
export function callOdds(rank, aceHigh = true) {
  const v = rankNumber(rank, aceHigh);
  const values = ORDER.map((r) => rankNumber(r, aceHigh));
  const higher = values.filter((x) => x > v).length / 13;
  const lower = values.filter((x) => x < v).length / 13;
  return { higher, lower, tie: 1 / 13 };
}

export class HiLoGame {
  constructor({ bankroll = 1000, bet = 25, rules = {}, shoe, rng = fairRandom } = {}) {
    this.rules = { ...HILO_DEFAULTS, ...rules };
    this.shoe = shoe || new Shoe({ decks: this.rules.decks, penetration: 0.75, rng });
    this.bankroll = bankroll;
    this.bet = bet;
    this.pot = 0;
    this.cards = [];
    this.phase = 'betting'; // betting | guessing | settled
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
    return this.phase !== 'guessing';
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

  get current() {
    return this.cards[this.cards.length - 1];
  }

  /** Payout multiplier for a call from the current card (ties push, so they're left out). */
  multiplier(dir) {
    if (!this.current) return 0;
    const o = callOdds(this.current.rank, this.rules.aceHigh);
    const p = o[dir] / (o.higher + o.lower);
    if (p <= 0) return 0;
    if (p >= 1) return 1; // a sure thing just moves you on; the pot stays the same
    return Math.floor(((1 - this.rules.houseEdge) / p) * 100) / 100;
  }

  canCall(dir) {
    return this.phase === 'guessing' && this.multiplier(dir) > 0;
  }

  /** Can you collect now? Only after at least one right call. */
  get canCollect() {
    return this.phase === 'guessing' && this.pot > this.bet - 1e-9 && this.cards.length > 1;
  }

  draw() {
    if (this.shoe.needsShuffle) {
      this.shoe.reset();
      this.emit('shuffle');
    }
    const card = this.shoe.draw();
    this.cards.push(card);
    this.emit('card', { card, index: this.cards.length - 1 });
    return card;
  }

  deal() {
    if (!this.canDeal()) return false;
    if (this.cards.length) this.emit('clear');
    this.cards = [];
    this.bankroll -= this.bet;
    this.pot = this.bet;
    this.lastResult = null;
    this.emit('bet', { amount: this.bet });
    this.draw();
    this.phase = 'guessing';
    this.emit('pot', { pot: this.pot });
    return true;
  }

  call(dir) {
    if (!this.canCall(dir)) return false;
    const from = this.current;
    const mult = this.multiplier(dir);
    const next = this.draw();
    const a = rankNumber(from.rank, this.rules.aceHigh);
    const b = rankNumber(next.rank, this.rules.aceHigh);
    if (a === b) {
      this.emit('tie', { pot: this.pot });
    } else if ((dir === 'higher' && b > a) || (dir === 'lower' && b < a)) {
      this.pot = Math.round(this.pot * mult * 100) / 100;
      this.emit('right', { pot: this.pot, mult });
    } else {
      this.emit('wrong', { pot: this.pot });
      this.finish(0, 'lose');
      return true;
    }
    if (this.cards.length >= this.rules.maxCards) this.finish(this.pot, 'full');
    return true;
  }

  collect() {
    if (!this.canCollect) return false;
    this.finish(this.pot, 'collect');
    return true;
  }

  finish(payout, how) {
    this.bankroll = Math.round((this.bankroll + payout) * 100) / 100;
    const net = Math.round((payout - this.bet) * 100) / 100;
    this.phase = 'settled';
    this.lastResult = { how, payout, net, calls: this.cards.length - 1, bet: this.bet };
    this.pot = 0;
    if (this.bet > this.bankroll) this.bet = Math.max(this.rules.minBet, Math.floor(this.bankroll));
    this.emit('settle', this.lastResult);
  }
}
