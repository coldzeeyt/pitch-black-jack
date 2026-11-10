// Controllers for Roulette, Penguin Race and Plinko. Each one plugs into main.js through the
// same small interface: create a game, show its props, list its buttons, handle its commands.
import * as THREE from 'three';
import { RouletteGame, label as rLabel, colorOf, wins } from './roulette.js';
import { RaceGame, RACERS, planRace } from './race.js';
import { PlinkoGame } from './plinko.js';
import { createRouletteWheel } from './roulette3d.js';
import { createRace } from './race3d.js';
import { createPlinko } from './plinko3d.js';

const CHIPS = { chip1: 1, chip5: 5, chip25: 25, chip100: 100, chip500: 500 };

export function createExtras(ctx) {
  const { scene, world, sleep, glide, labelEl, dropLabel, money, makeChipStack, betSpot, TABLE_Y } = ctx;
  const sfx = () => ctx.sound; // the sound engine is created after this module

  // ------------------------------------------------------------------------------------------
  // Roulette
  // ------------------------------------------------------------------------------------------
  const wheel = createRouletteWheel({ tableY: TABLE_Y, position: new THREE.Vector3(0, 0, 0.95) });
  scene.add(wheel.group);
  world.props.push({ object: wheel.group, name: 'Roulette wheel', info: 'Bets go on the layout below. Space spins it.' });

  const board = document.createElement('div');
  board.id = 'rouletteBoard';
  board.hidden = true;
  document.body.appendChild(board);
  let chip = 5;
  let spinNo = 0;
  let lastWin = null;

  function cell(kind, target, text, cls, style) {
    const b = document.createElement('button');
    b.className = 'rc ' + cls;
    b.dataset.kind = kind;
    if (target !== null && target !== undefined) b.dataset.target = target;
    b.style.cssText = style;
    b.innerHTML = `<span>${text}</span><i></i>`;
    b.addEventListener('click', () => placeOn(kind, target));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  }

  function buildBoard(g) {
    board.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'rgrid';
    const american = g.rules.wheel === 'american';
    // zero column
    if (american) {
      grid.appendChild(cell('n', 0, '0', 'green', 'grid-column:1;grid-row:1 / span 2'));
      grid.appendChild(cell('n', 37, '00', 'green', 'grid-column:1;grid-row:2 / span 2;margin-top:50%'));
    } else grid.appendChild(cell('n', 0, '0', 'green', 'grid-column:1;grid-row:1 / span 3'));
    for (let c = 0; c < 12; c++) {
      for (let r = 0; r < 3; r++) {
        const n = c * 3 + (3 - r);
        grid.appendChild(cell('n', n, String(n), colorOf(n), `grid-column:${c + 2};grid-row:${r + 1}`));
      }
    }
    for (let r = 0; r < 3; r++) grid.appendChild(cell('column', 3 - r, '2:1', 'out', `grid-column:14;grid-row:${r + 1}`));
    ['1st 12', '2nd 12', '3rd 12'].forEach((t, i) => grid.appendChild(cell('dozen', i + 1, t, 'out', `grid-column:${2 + i * 4} / span 4;grid-row:4`)));
    [['low', '1–18'], ['even', 'EVEN'], ['red', '<b class="dia red"></b>'], ['black', '<b class="dia black"></b>'], ['odd', 'ODD'], ['high', '19–36']].forEach(([k, t], i) =>
      grid.appendChild(cell(k, null, t, 'out', `grid-column:${2 + i * 2} / span 2;grid-row:5`)),
    );
    board.appendChild(grid);
    const hist = document.createElement('div');
    hist.className = 'rhist';
    board.appendChild(hist);
  }

  function paintBoard(g) {
    for (const el of board.querySelectorAll('.rc')) {
      const kind = el.dataset.kind;
      const target = el.dataset.target !== undefined ? Number(el.dataset.target) : null;
      const key = target === null ? kind : `${kind}:${target}`;
      const b = g.bets.get(key);
      const i = el.querySelector('i');
      i.textContent = b ? (b.amount >= 1000 ? (b.amount / 1000).toFixed(1) + 'k' : b.amount) : '';
      i.className = b ? 'on' : '';
      el.classList.toggle('win', lastWin !== null && wins(kind, target, lastWin));
      el.disabled = !g.canBet;
    }
    const hist = board.querySelector('.rhist');
    hist.innerHTML = g.history.map((n) => `<span class="${colorOf(n)}">${rLabel(n)}</span>`).join('');
  }

  function placeOn(kind, target) {
    const g = ctx.game();
    if (ctx.isBusy() || !(g instanceof RouletteGame)) return;
    if (lastWin !== null) {
      lastWin = null;
      dropLabel('x:rres');
    }
    if (g.place(kind, target, chip)) sfx().chips(1);
    paintBoard(g);
    ctx.render();
  }

  async function spinWheel() {
    const g = ctx.game();
    if (!g.canDeal()) return;
    ctx.setBusy(true);
    lastWin = null;
    dropLabel('x:rres');
    paintBoard(g);
    const r = g.spin();
    if (!r) {
      ctx.setBusy(false);
      return;
    }
    g.phase = 'spinning'; // no new chips while the ball is running
    spinNo += 1;
    ctx.render();
    world.jack.reach(wheel.worldPos().add(new THREE.Vector3(0.25, 0.1, -0.2)));
    world.jack.look(wheel.worldPos());
    sfx().burst({ dur: 0.3, freq: 1800, q: 1, gain: 0.25 });
    setTimeout(() => world.jack.reach(null), 700);
    await wheel.spin(r.index, { onClick: () => sfx().ballClick(), onLand: () => sfx().ballClick(true) });
    g.phase = 'betting';
    lastWin = r.n;
    const el = labelEl('x:rres');
    const p = wheel.worldPos();
    el.dataset.x = p.x;
    el.dataset.y = TABLE_Y + 0.25;
    el.dataset.z = p.z - 0.15;
    el.className = 'total big ' + (r.net > 0 ? 'active' : '');
    el.innerHTML = `<b class="rnum ${r.color}">${rLabel(r.n)}</b><span class="${r.net > 0 ? 'good' : r.net < 0 ? 'bad' : 'meh'}">${r.net > 0 ? '+' + money(r.net) : r.net < 0 ? '−' + money(-r.net) : 'EVEN'}</span>`;
    if (r.net > 0) sfx().jingle(Math.min(1, r.payout / r.stake / 20));
    else if (r.net < 0) sfx().hush(1.5, 0.4);
    const winners = r.lines.filter((l) => l.won).length;
    ctx.record(`Spin ${spinNo}`, `${rLabel(r.n)} ${r.color} · ${winners}/${r.lines.length} bets won`, r.net);
    world.jack.lookAtPlayer();
    paintBoard(g);
    ctx.setBusy(false);
    ctx.render();
    ctx.afterRound();
  }

  const roulette = {
    view: 'roulette',
    create: (bankroll, rules) => new RouletteGame({ bankroll, rules }),
    enter(g) {
      wheel.setWheel(g.wheel);
      wheel.show();
      buildBoard(g);
      paintBoard(g);
      board.hidden = false;
      lastWin = null;
    },
    leave() {
      wheel.hide();
      board.hidden = true;
      dropLabel('x:rres');
    },
    reset() {
      spinNo = 0;
    },
    keys: {},
    actions(g) {
      return [
        { key: '1–5', id: 'chipHint', label: `Chip ${money(chip)}`, on: true },
        { key: '⌫', id: 'betClear', label: 'Clear bets', on: g.bets.size > 0 },
        { key: 'Space', id: 'deal', label: 'Spin', on: g.canDeal() },
        { key: 'E', id: 'end', label: 'Cash out', on: true },
      ];
    },
    command(id) {
      const g = ctx.game();
      if (CHIPS[id]) {
        chip = CHIPS[id];
        sfx().chips(1);
        ctx.render();
        return true;
      }
      if (id === 'betClear') {
        g.clear();
        lastWin = null;
        dropLabel('x:rres');
        paintBoard(g);
        sfx().chips(2);
        ctx.render();
        return true;
      }
      if (id === 'betUp' || id === 'betDown') return true;
      if (id === 'deal') {
        if (g.broke) return false;
        spinWheel();
        return true;
      }
      return false;
    },
    update: (dt) => wheel.update(dt),
  };

  // ------------------------------------------------------------------------------------------
  // Penguin Race
  // ------------------------------------------------------------------------------------------
  const track = createRace({ tableY: TABLE_Y });
  scene.add(track.group);
  let raceNo = 0;
  let raceChips = null;

  function laneLabels(g, winner = -1) {
    g.racers.forEach((rc, i) => {
      const el = labelEl('x:lane:' + i);
      const p = track.laneLabelPos(i);
      el.dataset.x = p.x;
      el.dataset.y = TABLE_Y + 0.01;
      el.dataset.z = p.z;
      el.className = 'total lane' + (i === g.pick ? ' active' : '') + (i === winner ? ' winner' : '');
      el.innerHTML = `<i style="background:${rc.css}"></i><b>${rc.name}</b>${i === winner ? '<span class="good">1ST</span>' : ''}`;
    });
  }
  function setRaceChips(amount) {
    if (raceChips) scene.remove(raceChips);
    raceChips = amount > 0 ? makeChipStack(amount) : null;
    if (raceChips) {
      raceChips.position.copy(betSpot(0, 1));
      scene.add(raceChips);
    }
  }

  async function runRace() {
    const g = ctx.game();
    const r = g.start();
    if (!r) return;
    ctx.setBusy(true);
    raceNo += 1;
    ctx.render();
    track.reset();
    laneLabels(g);
    setRaceChips(r.bet);
    sfx().chips(4);
    sfx().windUp();
    await sleep(700);
    sfx().whistle();
    const plan = planRace(g.rules.racers, r.winner);
    let lead = -1;
    const look = setInterval(() => {
      // Jack's head follows the leader
      let best = 0;
      for (let i = 1; i < g.rules.racers; i++) if (track.racerPos(i).x > track.racerPos(best).x) best = i;
      if (best !== lead) {
        lead = best;
        world.jack.look(track.racerPos(best));
      }
    }, 250);
    await track.run(plan, r.winner, () => {
      if (r.won) sfx().jingle(0.6);
      else sfx().hush(1.5, 0.4);
    });
    clearInterval(look);
    g.finish();
    laneLabels(g, r.winner);
    if (raceChips) {
      const c = raceChips;
      raceChips = null;
      if (r.won) {
        setRaceChips(r.payout);
        const w = raceChips;
        raceChips = null;
        scene.remove(c);
        sfx().chips(6);
        await sleep(400);
        await glide(w, new THREE.Vector3(0, TABLE_Y, 3.0), { duration: 0.5 });
        scene.remove(w);
      } else {
        await glide(c, new THREE.Vector3(0, TABLE_Y + 0.05, 0.25), { duration: 0.5, arc: 0.1 });
        scene.remove(c);
      }
    }
    ctx.record(`Race ${raceNo}`, `${RACERS[r.winner].name} won · you backed ${RACERS[r.pick].name}`, r.net);
    world.jack.lookAtPlayer();
    ctx.setBusy(false);
    ctx.render();
    ctx.afterRound();
  }

  const race = {
    view: 'table',
    create: (bankroll, rules) => new RaceGame({ bankroll, bet: 25, rules }),
    enter(g) {
      track.setup(g.rules.racers);
      track.setPick(g.pick);
      track.show();
      laneLabels(g);
    },
    leave() {
      track.hide();
      if (raceChips) scene.remove(raceChips);
      raceChips = null;
      for (let i = 0; i < 6; i++) dropLabel('x:lane:' + i);
    },
    reset() {
      raceNo = 0;
    },
    keys: { arrowleft: 'pickPrev', arrowright: 'pickNext', a: 'pickPrev', d: 'pickNext' },
    actions(g, betItems) {
      const items = betItems(`Race (pays ×${g.rules.pays})`);
      items.splice(0, 0, { key: '←', id: 'pickPrev', label: '', on: true }, { key: '→', id: 'pickNext', label: `Back ${g.racers[g.pick].name}`, on: true });
      return items;
    },
    command(id) {
      const g = ctx.game();
      if (id === 'pickPrev' || id === 'pickNext') {
        g.choose(g.pick + (id === 'pickNext' ? 1 : -1));
        track.setPick(g.pick);
        track.reset();
        laneLabels(g);
        sfx().chips(1);
        ctx.render();
        return true;
      }
      if (id === 'deal') {
        if (g.broke) return false;
        runRace();
        return true;
      }
      return false;
    },
    update: (dt, t) => track.update(dt, t),
  };

  // ------------------------------------------------------------------------------------------
  // Plinko
  // ------------------------------------------------------------------------------------------
  const plinkoBoard = createPlinko();
  scene.add(plinkoBoard.group);
  world.props.push({ object: plinkoBoard.group, name: 'Plinko board', info: 'Pick Plinko on the start screen to drop chips.' });
  let dropNo = 0;

  async function dropChip() {
    const g = ctx.game();
    const r = g.drop();
    if (!r) return;
    ctx.setBusy(true);
    dropNo += 1;
    ctx.render();
    dropLabel('x:plinko');
    sfx().chips(1);
    await plinkoBoard.drop(r.path, (i) => sfx().pegTick(i));
    const el = labelEl('x:plinko');
    const p = plinkoBoard.labelPos();
    el.dataset.x = p.x;
    el.dataset.y = p.y;
    el.dataset.z = p.z;
    el.className = 'total ' + (r.mult >= 2 ? 'active' : '');
    el.innerHTML = `<span class="${r.mult >= 1 ? 'good' : 'bad'}">×${r.mult}</span><b>${r.net >= 0 ? '+' : '−'}${money(Math.abs(r.net))}</b>`;
    if (r.mult >= 5) {
      sfx().jingle(Math.min(1, r.mult / 50));
      if (r.mult >= 20) world.flicker(0.6);
    } else if (r.mult >= 1) sfx().chips(3);
    ctx.record(`Drop ${dropNo}`, `Slot ${r.slot + 1} of 13 · ×${r.mult}`, r.net);
    ctx.setBusy(false);
    ctx.render();
    ctx.afterRound();
  }

  const plinko = {
    view: 'plinko',
    create: (bankroll, rules) => new PlinkoGame({ bankroll, bet: 5, rules }),
    enter(g) {
      plinkoBoard.setTable(g.table);
    },
    leave() {
      plinkoBoard.hideChip();
      dropLabel('x:plinko');
    },
    reset() {
      dropNo = 0;
    },
    keys: {},
    actions: (g, betItems) => betItems('Drop'),
    command(id) {
      const g = ctx.game();
      if (id === 'deal') {
        if (g.broke) return false;
        dropChip();
        return true;
      }
      return false;
    },
    update: (dt, t) => plinkoBoard.update(dt, t),
  };

  return { roulette, race, plinko };
}
