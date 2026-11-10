// Pitch Black Jack — blackjack rules engine.
// Pure logic, no rendering. Every state change emits an event so the 3D layer
// can animate it in order.
//
// House rules (standard Las Vegas-style shoe game):
//   - 6-deck shoe, reshuffled at ~75% penetration (cut card)
//   - Blackjack pays 3:2
//   - Dealer stands on all 17s (configurable: dealerHitsSoft17)
//   - Dealer peeks for blackjack when showing an Ace or a 10-value card
//   - Insurance offered when the dealer shows an Ace, pays 2:1
//   - Double down on any first two cards, double after split allowed
//   - Split pairs (any two 10-value cards count as a pair) up to 4 hands
//   - Split aces receive one card each, cannot be resplit; 21 on them is not a blackjack
//   - Late surrender on the first two cards (returns half the bet)
// Every rule is configurable; see the game modes in src/config.js.

export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const DEFAULT_RULES = {
  decks: 6,
  penetration: 0.75,
  dealerHitsSoft17: false,
  blackjackPays: 1.5,
  maxHands: 4,
  doubleAfterSplit: true,
  resplitAces: false,
  hitSplitAces: false,
  lateSurrender: true,
  insurance: true,
  allowDouble: true,
  allowSplit: true,
  minBet: 5,
  maxBet: 500,
};

export function rankValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
  return Number(rank);
}

/** Best total for a hand, and whether an ace is still being counted as 11. */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = typeof c === 'string' ? c : c.rank;
    total += rankValue(r);
    if (r === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isNatural(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}

let nextCardId = 1;
function makeCard(rank, suit) {
  return { id: nextCardId++, rank, suit };
}

export class Shoe {
  /**
   * @param {object} opts
   * @param {number} [opts.decks]
   * @param {number} [opts.penetration] fraction of the shoe dealt before the cut card
   * @param {() => number} [opts.rng]
   * @param {Array<string|{rank:string,suit:string}>} [opts.stack] fixed draw order (for tests);
   *        used once, after which the shoe behaves normally.
   */
  constructor({ decks = 6, penetration = 0.75, rng = Math.random, stack = null } = {}) {
    this.decks = decks;
    this.penetration = penetration;
    this.rng = rng;
    this.stack = stack;
    this.reset();
  }

  reset() {
    if (this.stack) {
      this.cards = this.stack
        .map((c) => (typeof c === 'string' ? makeCard(c, 'S') : makeCard(c.rank, c.suit)))
        .reverse();
      this.stack = null;
      this.cutIndex = Infinity;
    } else {
      this.cards = [];
      for (let d = 0; d < this.decks; d++) {
        for (const s of SUITS) for (const r of RANKS) this.cards.push(makeCard(r, s));
      }
      for (let i = this.cards.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
      }
      this.cutIndex = Math.floor(this.cards.length * this.penetration);
    }
    this.dealt = 0;
  }

  draw() {
    if (this.cards.length === 0) this.reset();
    this.dealt++;
    return this.cards.pop();
  }

  get remaining() {
    return this.cards.length;
  }

  get needsShuffle() {
    return this.dealt >= this.cutIndex;
  }
}

function newHand(bet) {
  return {
    cards: [],
    bet,
    done: false,
    busted: false,
    doubled: false,
    surrendered: false,
    fromSplit: false,
  };
}

export class BlackjackGame {
  constructor({ bankroll = 1000, bet = 25, rules = {}, rng, shoe } = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.shoe =
      shoe || new Shoe({ decks: this.rules.decks, penetration: this.rules.penetration, rng });
    this.bankroll = bankroll;
    this.bet = bet;
    this.phase = 'betting'; // betting | insurance | player | dealer | settled
    this.dealer = [];
    this.hands = [];
    this.active = -1;
    this.insurance = 0;
    this.holeRevealed = false;
    this.lastResults = null;
    this.events = [];
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  /** Returns and clears pending events. */
  flush() {
    const e = this.events;
    this.events = [];
    return e;
  }

  get canBet() {
    return this.phase === 'betting' || this.phase === 'settled';
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

  dealTo(target, handIndex = 0, faceDown = false) {
    const card = this.shoe.draw();
    if (target === 'dealer') this.dealer.push(card);
    else this.hands[handIndex].cards.push(card);
    this.emit('card', { target, hand: handIndex, card, faceDown });
    return card;
  }

  deal() {
    if (!this.canDeal()) return false;
    if (this.dealer.length) this.emit('clear');
    if (this.shoe.needsShuffle) {
      this.shoe.reset();
      this.emit('shuffle');
    }
    this.bankroll -= this.bet;
    this.hands = [newHand(this.bet)];
    this.dealer = [];
    this.insurance = 0;
    this.holeRevealed = false;
    this.lastResults = null;
    this.emit('bet', { hand: 0, amount: this.bet });

    this.dealTo('player', 0);
    this.dealTo('dealer');
    this.dealTo('player', 0);
    this.dealTo('dealer', 0, true); // hole card

    if (this.rules.insurance && this.dealer[0].rank === 'A') {
      this.phase = 'insurance';
      this.emit('insuranceOffer', { cost: this.insuranceCost });
      return true;
    }
    this.resolveOpening();
    return true;
  }

  get insuranceCost() {
    return this.hands.length ? this.hands[0].bet / 2 : 0;
  }

  canInsure() {
    return this.phase === 'insurance' && this.bankroll >= this.insuranceCost;
  }

  insure(take) {
    if (this.phase !== 'insurance') return false;
    if (take && this.canInsure()) {
      this.insurance = this.insuranceCost;
      this.bankroll -= this.insurance;
      this.emit('insurance', { amount: this.insurance });
    } else {
      this.emit('insuranceDeclined');
    }
    this.resolveOpening();
    return true;
  }

  resolveOpening() {
    const up = this.dealer[0];
    const dealerBJ = isNatural(this.dealer);
    const peeks = rankValue(up.rank) >= 10;
    const playerBJ = isNatural(this.hands[0].cards);

    if (peeks) this.emit('peek', { blackjack: dealerBJ });
    if ((peeks && dealerBJ) || playerBJ) {
      this.reveal();
      this.settle();
      return;
    }
    this.phase = 'player';
    this.active = 0;
    this.emit('turn', { hand: 0 });
  }

  get currentHand() {
    return this.phase === 'player' ? this.hands[this.active] : null;
  }

  availableActions() {
    const none = { hit: false, stand: false, double: false, split: false, surrender: false };
    const h = this.currentHand;
    if (!h) return none;
    const two = h.cards.length === 2;
    const [a, b] = h.cards;
    return {
      hit: true,
      stand: true,
      double:
        this.rules.allowDouble &&
        two && this.bankroll >= h.bet && (!h.fromSplit || this.rules.doubleAfterSplit),
      split:
        this.rules.allowSplit &&
        two &&
        rankValue(a.rank) === rankValue(b.rank) &&
        this.hands.length < this.rules.maxHands &&
        this.bankroll >= h.bet &&
        !(a.rank === 'A' && h.fromSplit && !this.rules.resplitAces),
      surrender:
        this.rules.lateSurrender && two && this.hands.length === 1 && !h.fromSplit,
    };
  }

  hit() {
    if (!this.availableActions().hit) return false;
    const h = this.currentHand;
    this.dealTo('player', this.active);
    const v = handValue(h.cards).total;
    if (v > 21) {
      h.busted = true;
      h.done = true;
      this.emit('bust', { hand: this.active });
      this.advance();
    } else if (v === 21) {
      h.done = true;
      this.advance();
    }
    return true;
  }

  stand() {
    if (!this.availableActions().stand) return false;
    this.currentHand.done = true;
    this.emit('stand', { hand: this.active });
    this.advance();
    return true;
  }

  double() {
    if (!this.availableActions().double) return false;
    const h = this.currentHand;
    this.bankroll -= h.bet;
    h.bet *= 2;
    h.doubled = true;
    this.emit('double', { hand: this.active, amount: h.bet });
    this.dealTo('player', this.active);
    if (handValue(h.cards).total > 21) {
      h.busted = true;
      this.emit('bust', { hand: this.active });
    }
    h.done = true;
    this.advance();
    return true;
  }

  split() {
    if (!this.availableActions().split) return false;
    const h = this.currentHand;
    this.bankroll -= h.bet;
    const nh = newHand(h.bet);
    nh.fromSplit = true;
    h.fromSplit = true;
    nh.cards = [h.cards.pop()];
    this.hands.splice(this.active + 1, 0, nh);
    this.emit('split', { hand: this.active, amount: nh.bet });
    this.dealTo('player', this.active);
    this.checkSplitHand();
    return true;
  }

  surrender() {
    if (!this.availableActions().surrender) return false;
    const h = this.currentHand;
    h.surrendered = true;
    h.done = true;
    this.bankroll += h.bet / 2;
    this.emit('surrender', { hand: this.active, refund: h.bet / 2 });
    this.advance();
    return true;
  }

  /** After a split hand receives its second card: split aces stop, 21 stands automatically. */
  checkSplitHand() {
    const h = this.hands[this.active];
    const splitAces = h.cards[0].rank === 'A';
    const canResplit = splitAces && this.rules.resplitAces && h.cards[1].rank === 'A';
    if ((splitAces && !this.rules.hitSplitAces && !canResplit) || handValue(h.cards).total === 21) {
      h.done = true;
      this.advance();
    }
  }

  advance() {
    const next = this.hands.findIndex((h, i) => i > this.active && !h.done);
    if (next === -1) {
      this.active = -1;
      this.dealerPlay();
      return;
    }
    this.active = next;
    this.emit('turn', { hand: next });
    if (this.hands[next].cards.length === 1) {
      this.dealTo('player', next);
      this.checkSplitHand();
    }
  }

  reveal() {
    if (this.holeRevealed) return;
    this.holeRevealed = true;
    this.emit('reveal', { card: this.dealer[1] });
  }

  dealerPlay() {
    this.phase = 'dealer';
    this.reveal();
    const live = this.hands.some((h) => !h.busted && !h.surrendered);
    if (live) {
      for (;;) {
        const v = handValue(this.dealer);
        const hitSoft = v.total === 17 && v.soft && this.rules.dealerHitsSoft17;
        if (v.total < 17 || hitSoft) this.dealTo('dealer');
        else break;
      }
    }
    this.settle();
  }

  settle() {
    const dv = handValue(this.dealer).total;
    const dealerBJ = isNatural(this.dealer);
    const dealerBust = dv > 21;
    const single = this.hands.length === 1;

    const hands = this.hands.map((h) => {
      const v = handValue(h.cards).total;
      const natural = single && !h.fromSplit && isNatural(h.cards);
      let outcome;
      let payout = 0;
      if (h.surrendered) outcome = 'surrender';
      else if (h.busted) outcome = 'bust';
      else if (natural && dealerBJ) (outcome = 'push'), (payout = h.bet);
      else if (natural) (outcome = 'blackjack'), (payout = h.bet + h.bet * this.rules.blackjackPays);
      else if (dealerBJ) outcome = 'lose';
      else if (dealerBust || v > dv) (outcome = 'win'), (payout = h.bet * 2);
      else if (v < dv) outcome = 'lose';
      else (outcome = 'push'), (payout = h.bet);
      this.bankroll += payout;
      const net = outcome === 'surrender' ? -h.bet / 2 : payout - h.bet;
      return { outcome, total: v, bet: h.bet, payout, net };
    });

    let insuranceNet = 0;
    if (this.insurance > 0) {
      if (dealerBJ) {
        this.bankroll += this.insurance * 3;
        insuranceNet = this.insurance * 2;
      } else insuranceNet = -this.insurance;
    }

    const net = hands.reduce((s, r) => s + r.net, 0) + insuranceNet;
    this.phase = 'settled';
    this.active = -1;
    this.lastResults = { hands, dealerTotal: dv, dealerBJ, dealerBust, insuranceNet, net };
    if (this.bet > this.bankroll) this.bet = Math.max(this.rules.minBet, Math.floor(this.bankroll));
    this.emit('settle', this.lastResults);
  }
}
