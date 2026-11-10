// Penguin Race on the felt: chalk lanes, a start line and a chequered finish, and a row of
// wind-up tin penguins in coloured scarves.
import * as THREE from 'three';
import { buildPenguin } from './thinice3d.js';
import { RACERS, sampleRace } from './race.js';

const START = -1.12;
const FINISH = 1.12;

export function createRace({ tableY }) {
  const group = new THREE.Group();
  group.visible = false;
  const top = tableY + 0.003;

  const chalk = new THREE.MeshBasicMaterial({ color: 0xd8cfb8, transparent: true, opacity: 0.45 });
  const finishTex = (() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 256;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#eee';
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  let lanes = [];
  let racers = [];
  const decor = new THREE.Group();
  group.add(decor);
  const pickRing = new THREE.Mesh(
    new THREE.RingGeometry(0.075, 0.095, 32),
    new THREE.MeshBasicMaterial({ color: 0xc9a35c, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  pickRing.rotation.x = -Math.PI / 2;
  group.add(pickRing);

  function laneZ(i, n) {
    const span = n <= 4 ? 0.7 : 0.8;
    return 0.86 + (n === 1 ? 0 : (i / (n - 1)) * span);
  }

  function setup(n) {
    decor.clear();
    for (const r of racers) group.remove(r.holder);
    racers = [];
    lanes = Array.from({ length: n }, (_, i) => laneZ(i, n));
    const half = n > 1 ? (lanes[1] - lanes[0]) / 2 : 0.15;
    // lane chalk lines
    for (let i = 0; i <= n; i++) {
      const z = (i === 0 ? lanes[0] - half : i === n ? lanes[n - 1] + half : (lanes[i - 1] + lanes[i]) / 2);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(FINISH - START + 0.3, 0.006), chalk);
      line.rotation.x = -Math.PI / 2;
      line.position.set((START + FINISH) / 2, top, z);
      decor.add(line);
    }
    const depth = lanes[n - 1] - lanes[0] + half * 2;
    const startLine = new THREE.Mesh(new THREE.PlaneGeometry(0.01, depth), chalk);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(START + 0.07, top, (lanes[0] + lanes[n - 1]) / 2);
    decor.add(startLine);
    const finish = new THREE.Mesh(new THREE.PlaneGeometry(0.06, depth), new THREE.MeshBasicMaterial({ map: finishTex }));
    finish.rotation.x = -Math.PI / 2;
    finish.position.set(FINISH + 0.03, top + 0.001, (lanes[0] + lanes[n - 1]) / 2);
    decor.add(finish);
    // racers
    for (let i = 0; i < n; i++) {
      const p = buildPenguin();
      const scarfMat = new THREE.MeshStandardMaterial({ color: RACERS[i].color, roughness: 0.7 });
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.012, 8, 24), scarfMat);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(0, 0.112, 0.003);
      p.group.add(scarf);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.008), scarfMat);
      tail.position.set(0.02, 0.085, -0.045);
      tail.rotation.z = 0.3;
      p.group.add(tail);
      const holder = new THREE.Group();
      holder.add(p.group);
      holder.rotation.y = Math.PI / 2; // facing the finish
      group.add(holder);
      racers.push({ holder, p, x: 0, finished: false });
    }
    reset();
  }

  function reset() {
    racers.forEach((r, i) => {
      r.x = 0;
      r.finished = false;
      r.holder.position.set(START, tableY, lanes[i]);
      r.holder.rotation.z = 0;
      r.p.group.position.y = 0;
    });
    race = null;
    cheer = -1;
  }

  let race = null; // { plan, t, resolve, winner }
  let cheer = -1;
  let pick = 0;

  function update(dt, t) {
    if (!group.visible) return;
    pickRing.position.set(racers[pick] ? racers[pick].holder.position.x : START, top + 0.001, lanes[pick] ?? 0);
    pickRing.material.opacity = 0.6 + Math.sin(t * 4) * 0.3;
    racers.forEach((r, i) => {
      r.p.key.rotation.z += dt * (race ? 9 : 1.5);
      if (race) {
        const x = sampleRace(race.plan[i], race.t);
        const speed = (x - r.x) / Math.max(dt, 1e-4);
        r.x = x;
        r.holder.position.x = START + (FINISH - START) * x;
        // waddle and hop in proportion to speed
        const s = Math.min(1, speed * 4);
        r.holder.rotation.x = Math.sin(t * 18 + i) * 0.16 * s;
        r.p.group.position.y = Math.abs(Math.sin(t * 18 + i)) * 0.02 * s;
        r.p.flippers.forEach((f, k) => (f.rotation.z = (k ? 1 : -1) * (0.25 + s * Math.abs(Math.sin(t * 18 + i)) * 0.7)));
      } else {
        r.holder.rotation.x = Math.sin(t * 2 + i) * 0.03;
      }
      if (cheer >= 0 && i === (race ? race.winner : lastWinner)) {
        r.p.group.position.y = Math.abs(Math.sin(t * 9)) * 0.06;
        r.p.flippers.forEach((f, k) => (f.rotation.z = (k ? 1 : -1) * (0.4 + Math.abs(Math.sin(t * 12)) * 1.1)));
      }
    });
    if (cheer >= 0) cheer -= dt;
    if (race) {
      race.t += dt;
      const done = race.plan.every((keys) => race.t >= keys[keys.length - 1].t);
      if (race.t >= race.winnerTime && !race.crossed) {
        race.crossed = true;
        race.onCross?.();
      }
      if (done && race.t > race.winnerTime + 0.6) {
        lastWinner = race.winner;
        cheer = 2.2;
        const r = race.resolve;
        race = null;
        r();
      }
    }
  }
  let lastWinner = 0;

  return {
    group,
    update,
    setup,
    reset,
    show() {
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    setPick(i) {
      pick = i;
    },
    laneLabelPos: (i) => new THREE.Vector3(START - 0.3, tableY, lanes[i]),
    racerPos: (i) => racers[i].holder.position.clone(),
    /** Run a planned race. Resolves after everyone has crossed. */
    run(plan, winner, onCross) {
      const winnerTime = plan[winner][plan[winner].length - 1].t;
      return new Promise((resolve) => {
        race = { plan, t: 0, resolve, winner, winnerTime, onCross, crossed: false };
      });
    },
  };
}
