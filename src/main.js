import * as THREE from 'three';
import { BlackjackGame, handValue } from './blackjack.js';
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

const logo = await new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = 'assets/logo-cream.png';
});
await loadCardArt(renderer);
const world = buildScene(renderer, { logo });
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

const DEALER_Z = 0.5;
const HAND_Z = 1.42;
const BET_Z = 1.97;

function handX(i, n) {
  return (i - (n - 1) / 2) * 0.98;
}
function dealerSlot(j) {
  return new THREE.Vector3(-0.38 + j * 0.25, TABLE_Y + 0.004 + j * 0.0065, DEALER_Z);
}
function playerSlot(i, j, n) {
  return new THREE.Vector3(handX(i, n) - 0.1 + j * 0.095, TABLE_Y + 0.004 + j * 0.0065, HAND_Z - j * 0.06);
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
  if (target === 'dealer') {
    dest = dealerSlot(table.dealer.length);
    table.dealer.push({ mesh, card, faceDown });
  } else {
    const h = table.hands[handIndex];
    dest = playerSlot(handIndex, h.cards.length, table.hands.length);
    h.cards.push({ mesh, card });
  }
  world.jack.reach(SHOE_POS);
  world.jack.look(dest);
  sound.cardDeal();
  await sleep(90);
  world.jack.reach(dest.clone().lerp(SHOE_POS, 0.45));
  await glide(mesh, dest, { duration: 0.42, rotZ: faceDown ? Math.PI : 0, rotY: rand(-0.05, 0.05), arc: 0.18 });
  world.jack.reach(null);
  updateLabels();
}

async function relayout() {
  const n = table.hands.length;
  const jobs = [];
  table.hands.forEach((h, i) => {
    h.cards.forEach((c, j) => jobs.push(glide(c.mesh, playerSlot(i, j, n), { duration: 0.35 })));
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
  world.jack.reach(DISCARD_POS);
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
  world.jack.reach(null);
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
    el.dataset.x = handX(i, n) + 0.05;
    el.dataset.z = HAND_Z + 0.4;
  });
  const visible = table.dealer.filter((d) => !d.faceDown).map((d) => d.card);
  if (visible.length) {
    seen.add('d');
    const el = labelEl('d');
    el.innerHTML = `<b>${totalText(visible)}</b>`;
    el.dataset.x = 0.1;
    el.dataset.z = DEALER_Z - 0.38;
  }
  for (const [k, el] of labelEls) {
    if (!seen.has(k)) {
      el.remove();
      labelEls.delete(k);
    }
  }
}

const projV = new THREE.Vector3();
function positionLabels() {
  for (const el of labelEls.values()) {
    projV.set(Number(el.dataset.x), TABLE_Y, Number(el.dataset.z)).project(camera);
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
  if (busy || statementOpen) items = [];
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
  $('modeName').textContent = mode.name;
  $('bankroll').textContent = money(game.bankroll);
  $('bet').textContent = money(game.bet);
  const pct = game.shoe.remaining / (game.rules.decks * 52);
  $('shoe').style.setProperty('--fill', (pct * 100).toFixed(1) + '%');
}

// ------------------------------------------------------------------------------------------
// game + event playback
// ------------------------------------------------------------------------------------------
const sound = new Sound();
sound.setSong(CONFIG.song.file);
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
let mode = CONFIG.modes[0];
let game = newGame();
let stats = { hands: 0, won: 0 };
let ledger = [{ label: 'Opening balance', detail: 'Chips bought at the cage', amount: STARTING_MONEY, opening: true }];
function newGame() {
  return new BlackjackGame({ bankroll: STARTING_MONEY, bet: 25, rules: { maxBet: 1000, ...mode.rules } });
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
      world.jack.reach(DISCARD_POS);
      await sleep(900);
      world.discardPile.scale.y = 0.0001;
      world.discardPile.visible = false;
      world.jack.reach(null);
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
          await glide(th.chips, new THREE.Vector3(0, TABLE_Y + 0.05, 0.15), { duration: 0.5, arc: 0.1 });
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
    const to = r.insuranceNet > 0 ? new THREE.Vector3(0.35, TABLE_Y, 3.0) : new THREE.Vector3(0, TABLE_Y + 0.05, 0.15);
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
      ok = game.deal();
      freshBet = false;
      break;
    case 'insure':
      ok = game.insure(true);
      break;
    case 'noInsure':
      ok = game.insure(false);
      break;
    case 'hit':
      ok = game.hit();
      break;
    case 'stand':
      ok = game.stand();
      break;
    case 'double':
      ok = game.double();
      break;
    case 'split':
      ok = game.split();
      break;
    case 'surrender':
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

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') shiftHeld = false;
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') shiftHeld = true;
  if (!started) {
    const n = Number(e.key);
    if (n >= 1 && n <= CONFIG.modes.length) begin(CONFIG.modes[n - 1]);
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
  const id = KEYMAP[k];
  if (id) {
    e.preventDefault();
    if (e.repeat && id !== 'betUp' && id !== 'betDown') return;
    command(id);
  }
});
const modeList = $('modes');
CONFIG.modes.forEach((m, i) => {
  const b = document.createElement('button');
  b.className = 'mode';
  b.innerHTML = `<kbd>${i + 1}</kbd><strong>${m.name}</strong><small>${m.blurb}</small>`;
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    begin(m);
  });
  modeList.appendChild(b);
});
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
  $('intro').classList.add('gone');
  $('hud').classList.add('show');
  renderActions();
  setTimeout(() => world.jack.lookAtPlayer(), 1200);
}

// Jack glances around the room now and then
setInterval(() => {
  if (!busy && started && Math.random() < 0.5) {
    world.jack.look(new THREE.Vector3(rand(-6, 6), rand(1, 2), rand(-8, -2)));
    setTimeout(() => world.jack.lookAtPlayer(), rand(1500, 3500));
  }
}, 9000);

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
      tr.innerHTML = `<span class="desc">… ${entry.skip} earlier hands</span><span></span><span class="bal">${money(running)}</span>`;
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
