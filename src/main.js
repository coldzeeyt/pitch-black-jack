import * as THREE from 'three';
import { BlackjackGame, handValue } from './blackjack.js';
import { HiLoGame } from './hilo.js';
import { SlotsGame } from './slots.js';
import { buildScene, makeChipStack, TABLE_Y, SHOE_POS, DISCARD_POS } from './scene.js';
import { loadCardArt, createCardMesh, disposeCardMesh } from './cards.js';
import { Sound } from './audio.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const money = (n) => '$' + (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2));

// ------------------------------------------------------------------------------------------
// renderer + scene
// ------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
$('stage').appendChild(renderer.domElement);

const loadImg = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
const [logo, logoDark] = await Promise.all([loadImg('assets/logo-cream.png'), loadImg('assets/logo-black.png')]);
await loadCardArt(renderer);
const world = buildScene(renderer, { logo, logoDark });
const { scene, camera } = world;
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  world.resize();
});

// ------------------------------------------------------------------------------------------
// tweens
// ------------------------------------------------------------------------------------------
const tweens = [];
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
function tween(duration, onUpdate, ease = easeInOut) {
  return new Promise((resolve) => tweens.push({ t: 0, duration, onUpdate, ease, resolve }));
}
function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const p = Math.min(1, tw.t / tw.duration);
    tw.onUpdate(tw.ease(p));
    if (p >= 1) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
}

/** Glide an object to a position/rotation, optionally arcing upward. */
function glide(obj, to, { duration = 0.4, rotZ, rotY, arc = 0 } = {}) {
  const from = obj.position.clone();
  const fz = obj.rotation.z;
  const fy = obj.rotation.y;
  return tween(duration, (p) => {
    obj.position.lerpVectors(from, to, p);
    obj.position.y += Math.sin(p * Math.PI) * arc;
    if (rotZ !== undefined) obj.rotation.z = fz + (rotZ - fz) * p;
    if (rotY !== undefined) obj.rotation.y = fy + (rotY - fy) * p;
  });
}

// ------------------------------------------------------------------------------------------
// table model (what's physically on the felt, mirrored from game events)
// ------------------------------------------------------------------------------------------
const table = {
  dealer: [], // { mesh, card, faceDown }
  hands: [], // { cards: [{mesh, card}], chips: Group|null, bet }
  insuranceChips: null,
  active: -1,
};

const DEALER_Z = 0.66;
const HAND_Z = 1.42;
const BET_Z = 1.97;
const SPREAD = 0.35; // card width + a small gap: cards sit side by side, nothing hidden

function handX(i, n) {
  return (i - (n - 1) / 2) * 0.98;
}
/** Jack's cards: side by side, re-centred as he draws. */
function dealerSlot(j, count) {
  return new THREE.Vector3((j - (count - 1) / 2) * SPREAD, TABLE_Y + 0.004, DEALER_Z);
}
/**
 * Your cards. One hand: side by side, re-centred as you draw.
 * Several hands after a split: each hand cascades toward you so every card's rank stays visible.
 */
function playerSlot(i, j, n, count) {
  if (n === 1) return new THREE.Vector3((j - (count - 1) / 2) * SPREAD, TABLE_Y + 0.004, HAND_Z);
  return new THREE.Vector3(handX(i, n) + j * 0.03, TABLE_Y + 0.004 + j * 0.0065, HAND_Z - 0.12 + j * 0.085);
}
function betSpot(i, n) {
  return new THREE.Vector3(handX(i, n), TABLE_Y, BET_Z);
}

async function dealCardTo(target, handIndex, card, faceDown) {
  const mesh = createCardMesh(card);
  mesh.position.copy(SHOE_POS);
  mesh.rotation.set(0, -0.35, Math.PI);
  scene.add(mesh);

  let dest;
  const shifts = [];
  if (target === 'dealer') {
    const count = table.dealer.length + 1;
    dest = dealerSlot(count - 1, count);
    table.dealer.forEach((d, j) => shifts.push(glide(d.mesh, dealerSlot(j, count), { duration: 0.3 })));
    table.dealer.push({ mesh, card, faceDown });
  } else {
    const h = table.hands[handIndex];
    const n = table.hands.length;
    const count = h.cards.length + 1;
    dest = playerSlot(handIndex, count - 1, n, count);
    h.cards.forEach((c, j) => shifts.push(glide(c.mesh, playerSlot(handIndex, j, n, count), { duration: 0.3 })));
    h.cards.push({ mesh, card });
  }
  world.jack.reach(SHOE_POS);
  world.jack.look(dest);
  sound.cardDeal();
  await sleep(90);
  world.jack.reach(dest.clone().lerp(SHOE_POS, 0.45));
  await Promise.all([glide(mesh, dest, { duration: 0.42, rotZ: faceDown ? Math.PI : 0, rotY: rand(-0.03, 0.03), arc: 0.18 }), ...shifts]);
  world.jack.reach(null);
  updateLabels();
}

async function relayout() {
  const n = table.hands.length;
  const jobs = [];
  table.hands.forEach((h, i) => {
    h.cards.forEach((c, j) => jobs.push(glide(c.mesh, playerSlot(i, j, n, h.cards.length), { duration: 0.35 })));
    if (h.chips) jobs.push(glide(h.chips, betSpot(i, n), { duration: 0.35 }));
  });
  await Promise.all(jobs);
}

function setHandChips(i, amount) {
  const h = table.hands[i];
  if (h.chips) scene.remove(h.chips);
  h.chips = makeChipStack(amount);
  h.chips.position.copy(betSpot(i, table.hands.length));
  scene.add(h.chips);
  h.bet = amount;
}

async function sweepTable() {
  const all = [...table.dealer.map((d) => d.mesh), ...table.hands.flatMap((h) => h.cards.map((c) => c.mesh))];
  world.jack.reach(DISCARD_POS, -1);
  const pile = world.discardPile;
  await Promise.all(
    all.map((m, k) =>
      sleep(k * 35).then(() => glide(m, DISCARD_POS.clone().setY(TABLE_Y + 0.05), { duration: 0.35, rotZ: Math.PI, arc: 0.1 })),
    ),
  );
  for (const m of all) {
    scene.remove(m);
    disposeCardMesh(m);
  }
  pile.visible = true;
  pile.scale.y = Math.min(0.25, pile.scale.y + all.length * 0.0028);
  pile.position.y = TABLE_Y + 0.02 + pile.scale.y / 2;
  for (const h of table.hands) if (h.chips) scene.remove(h.chips);
  if (table.insuranceChips) scene.remove(table.insuranceChips);
  table.dealer = [];
  table.hands = [];
  table.insuranceChips = null;
  world.jack.reach(null, -1);
  updateLabels();
}

// ------------------------------------------------------------------------------------------
// HUD: totals floating over the hands, bankroll, actions, subtitles
// ------------------------------------------------------------------------------------------
const labelLayer = $('labels');
const labelEls = new Map();
function labelEl(key) {
  if (!labelEls.has(key)) {
    const el = document.createElement('div');
    el.className = 'total';
    labelLayer.appendChild(el);
    labelEls.set(key, el);
  }
  return labelEls.get(key);
}

function totalText(cards) {
  const v = handValue(cards);
  if (v.soft && v.total < 21) return `${v.total - 10} / ${v.total}`;
  return String(v.total);
}

const results = new Map(); // hand index -> { text, cls }

function updateLabels() {
  const seen = new Set();
  const n = table.hands.length;
  table.hands.forEach((h, i) => {
    if (!h.cards.length) return;
    const key = 'p' + i;
    seen.add(key);
    const el = labelEl(key);
    const r = results.get(i);
    const v = handValue(h.cards.map((c) => c.card)).total;
    el.innerHTML = r
      ? `<b>${totalText(h.cards.map((c) => c.card))}</b><span class="${r.cls}">${r.text}</span>`
      : `<b>${totalText(h.cards.map((c) => c.card))}</b>${v > 21 ? '<span class="bad">BUST</span>' : ''}`;
    el.classList.toggle('active', i === table.active && n > 0);
    el.dataset.x = n === 1 ? 0 : handX(i, n) + 0.05;
    el.dataset.z = n === 1 ? HAND_Z + 0.33 : HAND_Z + 0.2 + h.cards.length * 0.085;
  });
  const visible = table.dealer.filter((d) => !d.faceDown).map((d) => d.card);
  if (visible.length) {
    seen.add('d');
    const el = labelEl('d');
    el.innerHTML = `<b>${totalText(visible)}</b>`;
    el.dataset.x = 0;
    el.dataset.z = DEALER_Z - 0.33;
  }
  for (const [k, el] of labelEls) {
    if (k.startsWith('x:')) continue; // labels owned by Higher or Lower / Slots
    if (!seen.has(k)) {
      el.remove();
      labelEls.delete(k);
    }
  }
}

const projV = new THREE.Vector3();
function positionLabels() {
  for (const el of labelEls.values()) {
    projV.set(Number(el.dataset.x), el.dataset.y ? Number(el.dataset.y) : TABLE_Y, Number(el.dataset.z)).project(camera);
    if (projV.z > 1) {
      el.style.visibility = 'hidden';
      continue;
    }
    el.style.visibility = '';
    el.style.transform = `translate(-50%, -50%) translate(${((projV.x + 1) / 2) * window.innerWidth}px, ${((1 - projV.y) / 2) * window.innerHeight}px)`;
  }
}

const ACTIONS = [
  { key: 'H', id: 'hit', label: 'Hit' },
  { key: 'S', id: 'stand', label: 'Stand' },
  { key: 'D', id: 'double', label: 'Double' },
  { key: 'P', id: 'split', label: 'Split' },
  { key: 'R', id: 'surrender', label: 'Surrender' },
];

function renderActions() {
  const bar = $('actions');
  const phase = game.phase;
  let items = [];
  const betItems = (dealLabel) => [
    { key: '1–5', id: 'chipHint', label: 'Add chips', on: game.bet < Math.min(game.rules.maxBet, game.bankroll) },
    { key: '↓', id: 'betDown', label: '', on: game.bet > game.rules.minBet },
    { key: '↑', id: 'betUp', label: '', on: game.bet < Math.min(game.rules.maxBet, game.bankroll) },
    { key: '⌫', id: 'betClear', label: 'Clear', on: game.bet > game.rules.minBet },
    { key: 'Space', id: 'deal', label: dealLabel, on: game.canDeal() },
    { key: 'E', id: 'end', label: 'Cash out', on: true },
  ];
  if (busy || statementOpen) items = [];
  else if (mode.game === 'hilo') {
    if (phase === 'guessing') {
      const mh = game.multiplier('higher');
      const ml = game.multiplier('lower');
      items = [
        { key: 'H', id: 'higher', label: mh ? `Higher ×${mh.toFixed(2)}` : 'Higher', on: game.canCall('higher') },
        { key: 'L', id: 'lower', label: ml ? `Lower ×${ml.toFixed(2)}` : 'Lower', on: game.canCall('lower') },
        { key: 'C', id: 'collect', label: `Collect ${money(game.pot)}`, on: game.canCollect },
      ];
    } else items = betItems('Turn a card');
  } else if (mode.game === 'slots') items = betItems('Spin');
  else if (phase === 'betting' || phase === 'settled')
    items = [
      { key: '1–5', id: 'chipHint', label: 'Add chips', on: game.bet < Math.min(game.rules.maxBet, game.bankroll) },
      { key: '↓', id: 'betDown', label: '', on: game.bet > game.rules.minBet },
      { key: '↑', id: 'betUp', label: '', on: game.bet < Math.min(game.rules.maxBet, game.bankroll) },
      { key: '⌫', id: 'betClear', label: 'Clear', on: game.bet > game.rules.minBet },
      { key: 'Space', id: 'deal', label: 'Deal', on: game.canDeal() },
      { key: 'E', id: 'end', label: 'Cash out', on: true },
    ];
  else if (phase === 'insurance')
    items = [
      { key: 'I', id: 'insure', label: `Insurance (${money(game.insuranceCost)})`, on: game.canInsure() },
      { key: 'N', id: 'noInsure', label: 'No insurance', on: true },
    ];
  else if (phase === 'player') {
    const a = game.availableActions();
    const r = game.rules;
    const inMode = { hit: true, stand: true, double: r.allowDouble, split: r.allowSplit, surrender: r.lateSurrender };
    items = ACTIONS.filter((x) => inMode[x.id]).map((x) => ({
      ...x,
      label: mode.labels?.[x.id] ?? x.label,
      on: a[x.id],
    }));
  }
  bar.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'act' + (it.on ? '' : ' off');
    b.disabled = !it.on;
    b.innerHTML = `<kbd>${it.key}</kbd>${it.label ? `<span>${it.label}</span>` : ''}`;
    b.addEventListener('click', () => {
      sound.start();
      command(it.id);
    });
    bar.appendChild(b);
  }
  $('modeName').textContent = `${mode.gameName} · ${mode.name}`;
  $('bankroll').textContent = money(game.bankroll);
  $('bet').textContent = money(game.bet);
  $('shoeBox').hidden = !game.shoe;
  if (game.shoe) {
    const pct = game.shoe.remaining / (game.rules.decks * 52);
    $('shoe').style.setProperty('--fill', (pct * 100).toFixed(1) + '%');
  }
}

// ------------------------------------------------------------------------------------------
// game + event playback
// ------------------------------------------------------------------------------------------
const sound = new Sound();
sound.setSong(CONFIG.song.file);
if (CONFIG.crowd) sound.setCrowd(CONFIG.crowd);
sound.onSongChange = (on) => {
  world.radio.setPlaying(on);
  $('songBtn').classList.toggle('on', on);
  $('songBtn').querySelector('span').textContent = on ? '❚❚ ' + CONFIG.song.title : '♫ ' + CONFIG.song.title;
};
function toggleSong() {
  sound.toggleSong();
}

// click the radio on the table
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function overRadio(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(world.radio.object, true).length > 0;
}
renderer.domElement.addEventListener('pointermove', (e) => {
  const hit = started && overRadio(e);
  world.radio.setHover(hit);
  renderer.domElement.style.cursor = hit ? 'pointer' : '';
});
renderer.domElement.addEventListener('click', (e) => {
  if (started && overRadio(e)) toggleSong();
});
$('songBtn').addEventListener('click', toggleSong);
$('songBtn').querySelector('span').textContent = '♫ ' + CONFIG.song.title;
if (CONFIG.spotifyUrl) {
  const a = $('spotify');
  a.href = CONFIG.spotifyUrl;
  a.hidden = false;
}
const STARTING_MONEY = CONFIG.startingMoney;
// every type of every game, in menu order; number keys pick them
const MODES = CONFIG.games.flatMap((g) => g.modes.map((m) => ({ ...m, game: g.id, gameName: g.name })));
let mode = MODES[0];
let game = newGame();
let stats = { hands: 0, won: 0 };
let ledger = [{ label: 'Opening balance', detail: 'Chips bought at the cage', amount: STARTING_MONEY, opening: true }];
function newGame(bankroll = STARTING_MONEY) {
  if (mode.game === 'hilo') return new HiLoGame({ bankroll, bet: 25, rules: mode.rules });
  if (mode.game === 'slots') return new SlotsGame({ bankroll, bet: 5, rules: mode.rules });
  return new BlackjackGame({ bankroll, bet: 25, rules: { maxBet: 1000, ...mode.rules } });
}
function describe(r) {
  return r.hands
    .map((h) => ({ blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Loss', bust: 'Bust', surrender: 'Surrender' })[h.outcome])
    .join(' · ');
}
let busy = false;


function persist() {}

async function play(events) {
  busy = true;
  renderActions();
  for (const e of events) await handle(e);
  busy = false;
  renderActions();
  persist();
}

async function handle(e) {
  switch (e.type) {
    case 'clear':
      results.clear();
      await sweepTable();
      break;
    case 'shuffle':
      sound.shuffle();
      world.jack.reach(DISCARD_POS, -1);
      await sleep(900);
      world.discardPile.scale.y = 0.0001;
      world.discardPile.visible = false;
      world.jack.reach(null, -1);
      await sleep(900);
      break;
    case 'bet':
      table.hands = [{ cards: [], chips: null, bet: e.amount }];
      setHandChips(0, e.amount);
      sound.chips(5);
      await sleep(250);
      break;
    case 'card':
      await dealCardTo(e.target, e.hand, e.card, e.faceDown);
      break;
    case 'insuranceOffer':
      world.jack.lookAtPlayer();
      break;
    case 'insurance': {
      const c = makeChipStack(e.amount);
      c.position.set(0.35, TABLE_Y, 1.12);
      scene.add(c);
      table.insuranceChips = c;
      sound.chips(3);
      await sleep(300);
      break;
    }
    case 'insuranceDeclined':
      break;
    case 'peek': {
      const hole = table.dealer[1];
      world.jack.look(hole.mesh.position);
      world.jack.reach(hole.mesh.position);
      const base = hole.mesh.position.clone();
      await tween(0.35, (p) => {
        hole.mesh.position.y = base.y + Math.sin(p * Math.PI) * 0.03;
        hole.mesh.rotation.x = -Math.sin(p * Math.PI) * 0.35;
      });
      world.jack.reach(null);
      await sleep(400);
      world.jack.lookAtPlayer();
      break;
    }
    case 'reveal': {
      const hole = table.dealer[1];
      hole.faceDown = false;
      world.jack.reach(hole.mesh.position);
      sound.cardFlip();
      const base = hole.mesh.position.clone();
      await tween(0.4, (p) => {
        hole.mesh.rotation.z = Math.PI * (1 - p);
        hole.mesh.position.y = base.y + Math.sin(p * Math.PI) * 0.12;
      });
      world.jack.reach(null);
      updateLabels();
      await sleep(250);
      break;
    }
    case 'turn':
      table.active = e.hand;
      world.jack.lookAtPlayer();
      updateLabels();
      break;
    case 'split': {
      const h = table.hands[e.hand];
      const moved = h.cards.pop();
      table.hands.splice(e.hand + 1, 0, { cards: [moved], chips: null, bet: e.amount });
      setHandChips(e.hand + 1, e.amount);
      sound.chips(4);
      await relayout();
      updateLabels();
      break;
    }
    case 'double':
      setHandChips(e.hand, e.amount);
      sound.chips(4);
      await sleep(250);
      break;
    case 'bust':
      sound.hush(3);
      sound.swell();
      world.flicker(1.2);
      world.jack.stare();
      await sleep(700);
      break;
    case 'stand':
      await sleep(150);
      break;
    case 'surrender':
      setHandChips(e.hand, table.hands[e.hand].bet / 2);
      await sleep(500);
      break;
    case 'settle':
      await settle(e);
      break;
  }
}

async function settle(r) {
  table.active = -1;
  stats.hands += 1;
  r.hands.forEach((h, i) => {
    const map = {
      blackjack: ['BLACKJACK', 'good'],
      win: ['WIN', 'good'],
      push: ['PUSH', 'meh'],
      lose: ['LOSE', 'bad'],
      bust: ['BUST', 'bad'],
      surrender: ['SURRENDER', 'meh'],
    };
    const [text, cls] = map[h.outcome];
    const net = h.net > 0 ? ` +${money(h.net)}` : h.net < 0 ? ` −${money(-h.net)}` : '';
    results.set(i, { text: text + net, cls });
  });
  updateLabels();

  const n = table.hands.length;
  // pay winners: Jack adds chips beside the bet; losers' chips slide to his tray
  const jobs = [];
  r.hands.forEach((h, i) => {
    const th = table.hands[i];
    if (!th || !th.chips) return;
    if (h.payout > h.bet) {
      const win = makeChipStack(h.payout - h.bet);
      const spot = betSpot(i, n);
      win.position.set(spot.x, TABLE_Y + 0.4, spot.z - 0.5);
      scene.add(win);
      jobs.push(
        glide(win, spot.clone().add(new THREE.Vector3(0.17, 0, 0)), { duration: 0.45 }).then(async () => {
          await sleep(650);
          await Promise.all([
            glide(win, new THREE.Vector3(spot.x, TABLE_Y, 3.0), { duration: 0.5 }),
            glide(th.chips, new THREE.Vector3(spot.x, TABLE_Y, 3.0), { duration: 0.5 }),
          ]);
          scene.remove(win);
          scene.remove(th.chips);
          th.chips = null;
        }),
      );
    } else if (h.payout === 0 && h.outcome !== 'surrender') {
      jobs.push(
        sleep(500).then(async () => {
          await glide(th.chips, new THREE.Vector3(0, TABLE_Y + 0.05, 0.25), { duration: 0.5, arc: 0.1 });
          scene.remove(th.chips);
          th.chips = null;
        }),
      );
    } else {
      jobs.push(
        sleep(900).then(async () => {
          await glide(th.chips, new THREE.Vector3(th.chips.position.x, TABLE_Y, 3.0), { duration: 0.5 });
          scene.remove(th.chips);
          th.chips = null;
        }),
      );
    }
  });
  if (table.insuranceChips) {
    const ic = table.insuranceChips;
    const to = r.insuranceNet > 0 ? new THREE.Vector3(0.35, TABLE_Y, 3.0) : new THREE.Vector3(0, TABLE_Y + 0.05, 0.25);
    jobs.push(sleep(400).then(() => glide(ic, to, { duration: 0.5 })).then(() => scene.remove(ic)));
    table.insuranceChips = null;
  }
  sound.chips(6);

  if (r.dealerBJ) {
    sound.hush(2.5);
    world.flicker(1);
  }
  if (r.net > 0) stats.won += 1;

  await Promise.all(jobs);
  freshBet = true;
  ledger.push({ label: `Hand ${stats.hands}`, detail: describe(r), amount: r.net });
  if (game.broke) {
    await sleep(900);
    sound.hush(4, 0.0);
    world.flicker(2);
    await sleep(900);
    showStatement();
  }
}

// ------------------------------------------------------------------------------------------
// input
// ------------------------------------------------------------------------------------------
let freshBet = true;
function command(id) {
  if (statementOpen) {
    if (id === 'deal' && statementDone) restartGame();
    return;
  }
  if (busy || !started) return;
  const step = shiftHeld ? 25 : 5;
  let ok = false;
  switch (id) {
    case 'betUp':
      ok = game.setBet(game.bet + step);
      if (ok) sound.chips(1);
      renderActions();
      persist();
      return;
    case 'betDown':
      ok = game.setBet(game.bet - step);
      if (ok) sound.chips(1);
      renderActions();
      persist();
      return;
    case 'chip1':
    case 'chip5':
    case 'chip25':
    case 'chip100':
    case 'chip500': {
      const v = Number(id.slice(4));
      // the first chip pressed for a hand starts a fresh bet; later chips add to it
      const base = freshBet ? 0 : game.bet;
      ok = game.setBet(base + v);
      freshBet = false;
      if (ok) sound.chips(1);
      renderActions();
      return;
    }
    case 'betClear':
      game.setBet(game.rules.minBet);
      freshBet = true;
      sound.chips(2);
      renderActions();
      return;
    case 'chipHint':
      return;
    case 'end':
      if (!game.canBet) return;
      showStatement();
      return;
    case 'deal':
      if (game.broke) return showStatement();
      if (mode.game === 'slots') return spinSlots();
      ok = game.deal();
      freshBet = false;
      if (ok && mode.game === 'hilo') return playHilo(game.flush());
      break;
    case 'higher':
    case 'lower':
      if (mode.game === 'hilo' && game.call(id)) return playHilo(game.flush());
      return;
    case 'collect':
      if (mode.game === 'hilo' && game.collect()) return playHilo(game.flush());
      return;
    case 'insure':
      if (mode.game !== 'blackjack') return;
      ok = game.insure(true);
      break;
    case 'noInsure':
      if (mode.game !== 'blackjack') return;
      ok = game.insure(false);
      break;
    case 'hit':
      if (mode.game !== 'blackjack') return;
      ok = game.hit();
      break;
    case 'stand':
      if (mode.game !== 'blackjack') return;
      ok = game.stand();
      break;
    case 'double':
      if (mode.game !== 'blackjack') return;
      ok = game.double();
      break;
    case 'split':
      if (mode.game !== 'blackjack') return;
      ok = game.split();
      break;
    case 'surrender':
      if (mode.game !== 'blackjack') return;
      ok = game.surrender();
      break;
  }
  if (ok) play(game.flush());
}

let shiftHeld = false;
let started = false;
const KEYMAP = {
  h: 'hit',
  s: 'stand',
  d: 'double',
  p: 'split',
  r: 'surrender',
  i: 'insure',
  y: 'insure',
  n: 'noInsure',
  ' ': 'deal',
  enter: 'deal',
  arrowup: 'betUp',
  '+': 'betUp',
  '=': 'betUp',
  arrowdown: 'betDown',
  '-': 'betDown',
  1: 'chip1',
  2: 'chip5',
  3: 'chip25',
  4: 'chip100',
  5: 'chip500',
  backspace: 'betClear',
  delete: 'betClear',
  e: 'end',
};

const HILO_KEYS = { h: 'higher', l: 'lower', c: 'collect' };

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') shiftHeld = false;
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') shiftHeld = true;
  if (!started) {
    const n = Number(e.key);
    if (n >= 1 && n <= MODES.length) begin(MODES[n - 1]);
    else if (e.key === 'Enter' || e.key === ' ') begin(mode);
    e.preventDefault();
    return;
  }
  if (statementOpen && statementDone && e.key.toLowerCase() === 'c') {
    backToModes();
    return;
  }
  const k = e.key.toLowerCase();
  if (k === 'j') {
    toggleSong();
    return;
  }
  if (k === 'm') {
    $('mute').classList.toggle('on', sound.toggleMute());
    return;
  }
  if (k === '?' || k === '/' || k === 'f1') {
    $('help').classList.toggle('show');
    e.preventDefault();
    return;
  }
  if (k === 'escape') {
    $('help').classList.remove('show');
    return;
  }
  const id = (mode.game === 'hilo' ? HILO_KEYS[k] : undefined) ?? KEYMAP[k];
  if (id) {
    e.preventDefault();
    if (e.repeat && id !== 'betUp' && id !== 'betDown') return;
    command(id);
  }
});
const modeList = $('modes');
let modeNumber = 0;
for (const g of CONFIG.games) {
  const box = document.createElement('section');
  box.className = 'game';
  box.innerHTML = `<h2>${g.name}</h2><p>${g.blurb}</p><div class="types"></div>`;
  const types = box.querySelector('.types');
  for (const m of g.modes) {
    const entry = MODES[modeNumber++];
    const b = document.createElement('button');
    b.className = 'mode';
    b.innerHTML = `<kbd>${modeNumber}</kbd><span><strong>${m.name}</strong><small>${m.blurb}</small></span>`;
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      begin(entry);
    });
    types.appendChild(b);
  }
  modeList.appendChild(box);
}
$('mute').addEventListener('click', () => {
  sound.start();
  $('mute').classList.toggle('on', sound.toggleMute());
});
$('helpBtn').addEventListener('click', () => $('help').classList.toggle('show'));
$('help').addEventListener('click', () => $('help').classList.remove('show'));

function begin(chosen) {
  if (started) return;
  started = true;
  sound.start();
  if (chosen && chosen !== mode) {
    mode = chosen;
    game = newGame();
  } else if (!game) game = newGame();
  freshBet = true;
  world.focus(mode.game === 'slots' ? 'slots' : 'table');
  $('intro').classList.add('gone');
  $('hud').classList.add('show');
  renderActions();
  setTimeout(() => world.jack.lookAtPlayer(), 1200);
}

// Jack glances around the room now and then
setInterval(() => {
  if (!busy && started && mode.game !== 'slots' && Math.random() < 0.5) {
    world.jack.look(new THREE.Vector3(rand(-6, 6), rand(1, 2), rand(-8, -2)));
    setTimeout(() => world.jack.lookAtPlayer(), rand(1500, 3500));
  }
}, 9000);

// ------------------------------------------------------------------------------------------
// Higher or Lower: Jack turns cards into a row across the middle of the table
// ------------------------------------------------------------------------------------------
const HILO_Z = 1.0;
const hilo = { row: [], chips: null, round: 0 };

function hiloSlot(j, count) {
  return new THREE.Vector3((j - (count - 1) / 2) * 0.36, TABLE_Y + 0.004, HILO_Z);
}

function setHiloLabel(html, cls = '') {
  const el = labelEl('x:hilo');
  el.innerHTML = html;
  el.className = 'total ' + cls;
  el.dataset.x = 0;
  el.dataset.z = HILO_Z + 0.42;
  delete el.dataset.y;
}

function setPotChips(amount) {
  if (hilo.chips) scene.remove(hilo.chips);
  hilo.chips = amount > 0 ? makeChipStack(amount) : null;
  if (hilo.chips) {
    hilo.chips.position.copy(betSpot(0, 1));
    scene.add(hilo.chips);
  }
}

async function clearHilo() {
  const meshes = hilo.row;
  if (meshes.length) {
    world.jack.reach(DISCARD_POS, -1);
    await Promise.all(meshes.map((m, k) => sleep(k * 35).then(() => glide(m, DISCARD_POS.clone().setY(TABLE_Y + 0.05), { duration: 0.35, rotZ: Math.PI, arc: 0.1 }))));
    for (const m of meshes) {
      scene.remove(m);
      disposeCardMesh(m);
    }
    world.jack.reach(null, -1);
  }
  hilo.row = [];
  setPotChips(0);
  const el = labelEls.get('x:hilo');
  if (el) {
    el.remove();
    labelEls.delete('x:hilo');
  }
}

async function playHilo(events) {
  busy = true;
  renderActions();
  for (const e of events) {
    switch (e.type) {
      case 'clear':
        await clearHilo();
        break;
      case 'shuffle':
        sound.shuffle();
        await sleep(1200);
        break;
      case 'bet':
        hilo.round += 1;
        setPotChips(e.amount);
        sound.chips(5);
        await sleep(250);
        break;
      case 'card': {
        const mesh = createCardMesh(e.card);
        mesh.position.copy(SHOE_POS);
        mesh.rotation.set(0, -0.35, Math.PI);
        scene.add(mesh);
        const count = hilo.row.length + 1;
        const shifts = hilo.row.map((m, j) => glide(m, hiloSlot(j, count), { duration: 0.3 }));
        hilo.row.push(mesh);
        const dest = hiloSlot(count - 1, count);
        world.jack.reach(SHOE_POS);
        world.jack.look(dest);
        sound.cardDeal();
        await sleep(90);
        world.jack.reach(dest.clone().lerp(SHOE_POS, 0.45));
        await Promise.all([glide(mesh, dest, { duration: 0.45, rotZ: 0, rotY: rand(-0.03, 0.03), arc: 0.22 }), ...shifts]);
        world.jack.reach(null);
        world.jack.lookAtPlayer();
        break;
      }
      case 'pot':
        setHiloLabel(`<span class="meh">POT</span><b>${money(e.pot)}</b>`);
        break;
      case 'right':
        setPotChips(e.pot);
        sound.chips(4);
        setHiloLabel(`<span class="good">RIGHT ×${e.mult.toFixed(2)}</span><b>${money(e.pot)}</b>`, 'active');
        await sleep(350);
        break;
      case 'tie':
        setHiloLabel(`<span class="meh">SAME RANK · PUSH</span><b>${money(e.pot)}</b>`);
        await sleep(300);
        break;
      case 'wrong':
        sound.hush(3);
        sound.swell();
        world.flicker(1.2);
        setHiloLabel(`<span class="bad">WRONG</span><b>${money(e.pot)}</b>`);
        if (hilo.chips) {
          const c = hilo.chips;
          hilo.chips = null;
          await sleep(400);
          await glide(c, new THREE.Vector3(0, TABLE_Y + 0.05, 0.25), { duration: 0.5, arc: 0.1 });
          scene.remove(c);
        }
        break;
      case 'settle': {
        const r = e;
        const won = r.payout > 0;
        if (won && hilo.chips) {
          const c = hilo.chips;
          hilo.chips = null;
          sound.chips(6);
          setHiloLabel(`<span class="good">COLLECTED${r.net > 0 ? ' +' + money(r.net) : ''}</span><b>${money(r.payout)}</b>`);
          await sleep(500);
          await glide(c, new THREE.Vector3(0, TABLE_Y, 3.0), { duration: 0.5 });
          scene.remove(c);
        }
        const detail =
          r.how === 'lose'
            ? r.calls > 1
              ? `Wrong call after ${r.calls - 1} right`
              : 'Wrong first call'
            : `${r.how === 'full' ? 'Full row' : 'Collected'} after ${r.calls} calls`;
        ledger.push({ label: `Round ${hilo.round}`, detail, amount: r.net });
        freshBet = true;
        break;
      }
    }
  }
  busy = false;
  renderActions();
  if (game.broke) {
    await sleep(900);
    showStatement();
  }
}

// ------------------------------------------------------------------------------------------
// Slots: the machine in the corner
// ------------------------------------------------------------------------------------------
let spinCount = 0;
function setSlotLabel(html, cls = '') {
  const el = labelEl('x:slots');
  el.innerHTML = html;
  el.className = 'total ' + cls;
  // just under the reel window, in world space
  el.dataset.x = -4.1;
  el.dataset.y = 1.1;
  el.dataset.z = 2.95;
}

async function spinSlots() {
  const r = game.spin();
  if (!r) return;
  busy = true;
  freshBet = true;
  spinCount += 1;
  renderActions();
  world.slots.clearCoins();
  setSlotLabel('<span class="meh">SPINNING…</span>');
  sound.lever();
  const whirr = sound.reelWhirr(2.4);
  await world.slots.spin(r.stops, () => sound.reelStop());
  whirr?.();
  if (r.win > 0) {
    const level = Math.min(1, r.pays / 50);
    world.slots.celebrate(level, Math.round(8 + r.pays * 2));
    sound.jingle(level);
    setSlotLabel(`<span class="good">${r.name.toUpperCase()} · ${r.pays}×</span><b>+${money(r.win)}</b>`, 'active');
    if (r.pays >= 50) world.flicker(0.6);
  } else {
    setSlotLabel('<span class="meh">NO WIN</span>');
  }
  ledger.push({ label: `Spin ${spinCount}`, detail: r.name ? `${r.name} · ${r.symbols.map((x) => (x === 'SEVEN' ? '7' : x === 'JACK' ? 'J♠' : x === 'BAR' ? 'BAR' : { S: '♠', H: '♥', D: '♦', C: '♣' }[x])).join(' ')}` : 'No win', amount: r.net });
  await sleep(r.win > 0 ? 900 : 250);
  busy = false;
  renderActions();
  if (game.broke) {
    await sleep(900);
    showStatement();
  }
}

// ------------------------------------------------------------------------------------------
// pointing at things: a small name tag says what they are
// ------------------------------------------------------------------------------------------
const tip = $('tip');
function propAt(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(world.props.map((p) => p.object), true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o) {
    const p = world.props.find((x) => x.object === o);
    if (p) return p;
    o = o.parent;
  }
  return null;
}
renderer.domElement.addEventListener('pointermove', (e) => {
  const p = started && !statementOpen ? propAt(e) : null;
  if (!p) {
    tip.hidden = true;
    return;
  }
  tip.innerHTML = `<strong>${p.name}</strong><span>${p.info}</span>`;
  tip.hidden = false;
  const x = Math.min(e.clientX + 16, window.innerWidth - tip.offsetWidth - 8);
  const y = Math.min(e.clientY + 18, window.innerHeight - tip.offsetHeight - 8);
  tip.style.transform = `translate(${x}px, ${y}px)`;
});
renderer.domElement.addEventListener('pointerleave', () => (tip.hidden = true));

// ------------------------------------------------------------------------------------------
// end of game: the account statement, with the money visibly leaving (or entering) your account
// ------------------------------------------------------------------------------------------
let statementOpen = false;
let statementDone = false;

async function showStatement() {
  if (statementOpen) return;
  statementOpen = true;
  statementDone = false;
  renderActions();
  const el = $('statement');
  const rows = $('ledger');
  const final = game.bankroll;
  const net = final - STARTING_MONEY;
  rows.innerHTML = '';
  $('acct-balance').textContent = money(STARTING_MONEY);
  $('acct-balance').className = '';
  $('stamp').className = 'stamp';
  $('transfer-bar').style.setProperty('--p', '0%');
  $('transfer-label').textContent = 'Settling with the house…';
  $('again').classList.remove('show');
  el.classList.add('show');
  if (CONFIG.song.playOnEnd && !sound.songPlaying) sound.playSong();
  await sleep(700);

  // 1) the ledger prints line by line
  let running = 0;
  const shown = ledger.length > 14 ? [ledger[0], { skip: ledger.length - 13 }, ...ledger.slice(-12)] : ledger;
  for (const entry of shown) {
    const tr = document.createElement('div');
    tr.className = 'row';
    if (entry.skip) {
      for (const e of ledger.slice(1, 1 + entry.skip)) running += e.amount;
      tr.innerHTML = `<span class="desc">… ${entry.skip} earlier rounds</span><span></span><span class="bal">${money(running)}</span>`;
    } else {
      running += entry.amount;
      const cls = entry.opening ? '' : entry.amount > 0 ? 'in' : entry.amount < 0 ? 'out' : 'even';
      const amt = entry.opening ? money(entry.amount) : entry.amount === 0 ? '—' : (entry.amount > 0 ? '+' : '−') + money(Math.abs(entry.amount));
      tr.innerHTML = `<span class="desc">${entry.label}<small>${entry.detail}</small></span><span class="amt ${cls}">${amt}</span><span class="bal">${money(running)}</span>`;
    }
    rows.appendChild(tr);
    rows.scrollTop = rows.scrollHeight;
    sound.chips(1);
    await sleep(140);
  }
  await sleep(500);

  // 2) the transfer: balance ticks toward the final amount while bills fly out of (or into) the account
  $('transfer-label').textContent =
    net < 0 ? `Withdrawing ${money(-net)} from your account…` : net > 0 ? `Depositing ${money(net)} into your account…` : 'Nothing changes hands…';
  const bal = $('acct-balance');
  bal.className = net < 0 ? 'draining' : net > 0 ? 'filling' : '';
  const duration = 2600;
  const t0 = performance.now();
  let lastBill = 0;
  await new Promise((resolve) => {
    const frame = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      bal.textContent = money(Math.round(STARTING_MONEY + net * e));
      $('transfer-bar').style.setProperty('--p', (p * 100).toFixed(1) + '%');
      if (net !== 0 && now - lastBill > 70 && p < 0.92) {
        lastBill = now;
        flyBill(net < 0);
        if (Math.random() < 0.4) sound.chips(1);
      }
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
  bal.textContent = money(final);

  // 3) stamped
  const stamp = $('stamp');
  stamp.textContent = net < 0 ? 'Paid to the house' : net > 0 ? 'Paid out' : 'Broke even';
  stamp.className = 'stamp show ' + (net < 0 ? 'out' : net > 0 ? 'in' : 'even');
  $('transfer-label').textContent =
    net < 0 ? `${money(-net)} left your account` : net > 0 ? `${money(net)} added to your account` : 'You walk out with what you brought';
  sound.burst({ dur: 0.25, freq: 180, q: 0.8, gain: 0.6, type: 'lowpass' });
  await sleep(600);
  $('again').classList.add('show');
  statementDone = true;
}

function flyBill(leaving) {
  const acct = $('acct').getBoundingClientRect();
  const bill = document.createElement('div');
  bill.className = 'bill ' + (leaving ? 'out' : 'in');
  bill.textContent = '$';
  document.body.appendChild(bill);
  const cx = acct.left + acct.width / 2;
  const cy = acct.top + acct.height / 2;
  const far = { x: cx + (leaving ? 1 : -1) * (window.innerWidth * 0.35 + rand(0, 200)), y: cy + rand(-260, 160) };
  const [from, to] = leaving ? [{ x: cx, y: cy }, far] : [far, { x: cx, y: cy }];
  const rot = rand(-260, 260);
  bill.animate(
    [
      { transform: `translate(${from.x}px, ${from.y}px) rotate(0deg) scale(0.6)`, opacity: leaving ? 1 : 0 },
      { opacity: 1, offset: 0.2 },
      { transform: `translate(${to.x}px, ${to.y}px) rotate(${rot}deg) scale(1)`, opacity: leaving ? 0 : 1 },
    ],
    { duration: rand(900, 1400), easing: 'cubic-bezier(.3,.6,.4,1)' },
  ).onfinish = () => bill.remove();
}

async function restartGame() {
  $('statement').classList.remove('show');
  statementOpen = false;
  statementDone = false;
  busy = true;
  results.clear();
  if (table.dealer.length || table.hands.length) await sweepTable();
  world.discardPile.visible = false;
  world.discardPile.scale.y = 0.0001;
  await clearHilo();
  world.slots.clearCoins();
  for (const [k, el] of labelEls) {
    if (k.startsWith('x:')) {
      el.remove();
      labelEls.delete(k);
    }
  }
  hilo.round = 0;
  spinCount = 0;
  game = newGame();
  stats = { hands: 0, won: 0 };
  ledger = [{ label: 'Opening balance', detail: 'Chips bought at the cage', amount: STARTING_MONEY, opening: true }];
  freshBet = true;
  busy = false;
  sound.chips(8);
  renderActions();
}
$('again').addEventListener('click', () => statementDone && restartGame());
$('change').addEventListener('click', () => statementDone && backToModes());

async function backToModes() {
  await restartGame();
  started = false;
  world.focus('table');
  $('hud').classList.remove('show');
  $('intro').classList.remove('gone');
}

// ------------------------------------------------------------------------------------------
// loop
// ------------------------------------------------------------------------------------------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  stepTweens(dt);
  world.update(dt, t);
  renderer.render(scene, camera);
  positionLabels();
});
$('loading').classList.add('gone');
renderActions();

// handy for debugging from the console
window.pbj = { get game() { return game; }, world, showStatement };
