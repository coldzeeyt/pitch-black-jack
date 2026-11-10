// Thin Ice, on the table: a row of ice tiles laid across the felt, a snowy start pad, a little
// flag at the far side, and a wind-up tin penguin with a brass key turning in its back.
import * as THREE from 'three';

const TILE = 0.25;
const GAP = 0.05;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crackLines(ctx, w, h, n, alpha) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  for (let k = 0; k < n; k++) {
    let x = w / 2 + (Math.random() - 0.5) * w * 0.2;
    let y = h / 2 + (Math.random() - 0.5) * h * 0.2;
    const a0 = Math.random() * Math.PI * 2;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      const a = a0 + (Math.random() - 0.5) * 0.9;
      x += Math.cos(a) * w * 0.09;
      y += Math.sin(a) * h * 0.09;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

export function buildPenguin() {
  const p = new THREE.Group();
  const tin = (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32 });
  const black = tin(0x15171c);
  const white = tin(0xeeeae0);
  const orange = tin(0xe0791c);
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.9, roughness: 0.25 });
  const add = (geo, mat, x, y, z, parent = p) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  // egg-shaped tin body
  const body = add(
    new THREE.LatheGeometry(
      [[0, 0], [0.045, 0.004], [0.06, 0.03], [0.062, 0.06], [0.055, 0.09], [0.04, 0.115], [0, 0.125]].map(([r, y]) => new THREE.Vector2(r, y)),
      32,
    ),
    black,
    0,
    0.012,
    0,
  );
  const belly = add(new THREE.SphereGeometry(0.05, 24, 16), white, 0, 0.06, 0.022);
  belly.scale.set(0.95, 1.15, 0.7);
  // a painted seam where the two tin halves were pressed together
  const seam = add(new THREE.TorusGeometry(0.061, 0.002, 6, 32), brass, 0, 0.062, 0);
  seam.rotation.x = Math.PI / 2;
  // head
  const head = new THREE.Group();
  head.position.set(0, 0.145, 0.004);
  p.add(head);
  add(new THREE.SphereGeometry(0.04, 24, 16), black, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    const patch = add(new THREE.SphereGeometry(0.014, 12, 10), white, s * 0.017, 0.006, 0.031, head);
    patch.scale.set(1, 1.2, 0.5);
    add(new THREE.SphereGeometry(0.006, 10, 8), black, s * 0.017, 0.007, 0.037, head);
  }
  const beak = add(new THREE.ConeGeometry(0.012, 0.032, 12), orange, 0, -0.008, 0.045, head);
  beak.rotation.x = Math.PI / 2;
  // flippers
  const flippers = [-1, 1].map((s) => {
    const f = add(new THREE.SphereGeometry(0.03, 16, 10), black, s * 0.058, 0.075, -0.002);
    f.scale.set(0.25, 1, 0.55);
    f.rotation.z = s * 0.25;
    return f;
  });
  // feet
  for (const s of [-1, 1]) {
    const foot = add(new THREE.SphereGeometry(0.018, 14, 8), orange, s * 0.022, 0.006, 0.02);
    foot.scale.set(1, 0.35, 1.5);
  }
  // wind-up key in the back
  const key = new THREE.Group();
  key.position.set(0, 0.07, -0.062);
  p.add(key);
  const shaft = add(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 10), brass, 0, 0, -0.012, key);
  shaft.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const wing = add(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 18), brass, s * 0.014, 0, -0.028, key);
    wing.rotation.x = Math.PI / 2;
  }
  p.scale.setScalar(1.25);
  return { group: p, head, flippers, key };
}

export function createThinIce({ tableY, z = 1.12, count = 10 }) {
  const group = new THREE.Group();
  group.visible = false;
  const startX = -((count - 1) / 2) * (TILE + GAP);
  const tileX = (i) => startX + i * (TILE + GAP);
  const padX = tileX(0) - (TILE + GAP) * 1.15;
  const flagX = tileX(count - 1) + (TILE + GAP) * 0.9;

  const iceTex = canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#d8f1fb');
    g.addColorStop(0.6, '#8fc6dd');
    g.addColorStop(1, '#5d9fbd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    crackLines(ctx, w, h, 2, 0.35);
  });
  const crackTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    crackLines(ctx, w, h, 9, 0.95);
  });

  const tiles = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshStandardMaterial({ map: iceTex, color: 0xcfeaf5, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.78, emissive: 0x1d4b5e, emissiveIntensity: 0.2 });
    const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.03, TILE), mat);
    tile.position.set(tileX(i), tableY + 0.015, z);
    tile.receiveShadow = true;
    tile.castShadow = true;
    group.add(tile);
    const crack = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.98, TILE * 0.98),
      new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0, depthWrite: false }),
    );
    crack.rotation.x = -Math.PI / 2;
    crack.rotation.z = Math.random() * Math.PI;
    crack.position.set(tileX(i), tableY + 0.032, z);
    group.add(crack);
    tiles.push({ tile, crack });
  }
  // dark water showing through a broken tile
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(TILE * 0.48, 32),
    new THREE.MeshStandardMaterial({ color: 0x06141c, roughness: 0.1, metalness: 0.3, emissive: 0x0a2836, emissiveIntensity: 0.4 }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.visible = false;
  group.add(hole);
  // snowy start pad and a little flag at the far side
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.03, 28), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.95 }));
  pad.position.set(padX, tableY + 0.015, z);
  pad.receiveShadow = true;
  group.add(pad);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.8, roughness: 0.3 }));
  pole.position.set(flagX, tableY + 0.11, z - 0.05);
  group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.055), new THREE.MeshStandardMaterial({ color: 0x9b1414, side: THREE.DoubleSide }));
  flag.position.set(flagX + 0.046, tableY + 0.19, z - 0.05);
  group.add(flag);

  // shards for when a tile gives way
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xcfeefa, roughness: 0.1, transparent: true, opacity: 0.9 });
  const shards = Array.from({ length: 14 }, () => {
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.035 + Math.random() * 0.03), shardMat.clone());
    m.visible = false;
    group.add(m);
    return { m, v: new THREE.Vector3(), spin: new THREE.Vector3() };
  });

  const peng = buildPenguin();
  group.add(peng.group);

  // animation state
  let hop = null; // { from, to, t, dur, resolve }
  let fall = null; // { t, resolve }
  let shardT = -1;
  let cheer = 0;
  let windSpeed = 2;
  const restY = tableY + 0.03;

  function placeAtPad() {
    peng.group.position.set(padX, tableY + 0.03, z);
    peng.group.rotation.set(0, Math.PI / 2, 0); // facing along the row
    peng.group.scale.setScalar(1.25);
    peng.group.visible = true;
  }

  function reset() {
    tiles.forEach(({ tile, crack }) => {
      tile.visible = true;
      tile.material.emissiveIntensity = 0.2;
      crack.material.opacity = 0;
    });
    hole.visible = false;
    shards.forEach((s) => (s.m.visible = false));
    hop = null;
    fall = null;
    cheer = 0;
    placeAtPad();
  }

  function update(dt, t) {
    if (!group.visible) return;
    // the key keeps turning; faster while walking
    peng.key.rotation.z += dt * windSpeed * 3;
    peng.head.rotation.y = Math.sin(t * 1.3) * 0.25;
    if (hop) {
      hop.t += dt;
      const p = Math.min(1, hop.t / hop.dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      peng.group.position.x = hop.from + (hop.to - hop.from) * e;
      peng.group.position.y = restY + Math.sin(p * Math.PI) * 0.09;
      peng.group.rotation.z = Math.sin(p * Math.PI * 2) * 0.18; // waddle
      peng.flippers.forEach((f, i) => (f.rotation.z = (i ? 1 : -1) * (0.25 + Math.sin(p * Math.PI) * 0.8)));
      if (p >= 1) {
        peng.group.position.y = restY;
        peng.group.rotation.z = 0;
        const r = hop.resolve;
        hop = null;
        r();
      }
    } else if (!fall) {
      // idle sway on the ice
      peng.group.rotation.z = Math.sin(t * 4) * 0.04;
    }
    if (cheer > 0) {
      cheer -= dt;
      peng.group.position.y = restY + Math.abs(Math.sin(cheer * 10)) * 0.05;
      peng.flippers.forEach((f, i) => (f.rotation.z = (i ? 1 : -1) * (0.3 + Math.abs(Math.sin(cheer * 12)) * 1.2)));
    }
    if (fall) {
      fall.t += dt;
      const p = Math.min(1, fall.t / 0.9);
      peng.group.position.y = restY - p * p * 0.5;
      peng.group.rotation.x = p * 1.2;
      peng.group.rotation.z += dt * 6;
      if (p >= 1) {
        peng.group.visible = false;
        const r = fall.resolve;
        fall = null;
        r();
      }
    }
    if (shardT >= 0) {
      shardT += dt;
      for (const s of shards) {
        if (!s.m.visible) continue;
        s.v.y -= 6 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.rotation.x += s.spin.x * dt;
        s.m.rotation.y += s.spin.y * dt;
        s.m.material.opacity = Math.max(0, 0.9 - shardT * 0.7);
        if (s.m.position.y < tableY - 0.4) s.m.visible = false;
      }
      if (shardT > 1.5) shardT = -1;
    }
  }

  return {
    group,
    update,
    tileWorld: (i) => new THREE.Vector3(tileX(i), tableY, z),
    show() {
      group.visible = true;
      reset();
    },
    hide() {
      group.visible = false;
    },
    reset,
    /** Hop from wherever it is onto tile i. */
    hopTo(i) {
      windSpeed = 6;
      return new Promise((resolve) => {
        hop = { from: peng.group.position.x, to: tileX(i), t: 0, dur: 0.42, resolve };
      }).then(() => {
        windSpeed = 2;
        const { tile } = tiles[i];
        tile.material.emissiveIntensity = 0.5; // the tiles he's crossed glow a little
      });
    },
    /** Hop onto tile i, which cracks, shatters, and swallows the penguin. */
    async breakAt(i) {
      windSpeed = 6;
      await new Promise((resolve) => {
        hop = { from: peng.group.position.x, to: tileX(i), t: 0, dur: 0.42, resolve };
      });
      const { tile, crack } = tiles[i];
      crack.material.opacity = 1;
      await new Promise((r) => setTimeout(r, 380));
      tile.visible = false;
      crack.material.opacity = 0;
      hole.position.set(tileX(i), tableY + 0.003, z);
      hole.visible = true;
      shardT = 0;
      for (const s of shards) {
        s.m.visible = true;
        s.m.position.set(tileX(i) + (Math.random() - 0.5) * TILE, tableY + 0.03, z + (Math.random() - 0.5) * TILE);
        s.v.set((Math.random() - 0.5) * 1.2, Math.random() * 1.2 + 0.4, (Math.random() - 0.5) * 1.2);
        s.spin.set(Math.random() * 10, Math.random() * 10, 0);
        s.m.material.opacity = 0.9;
      }
      windSpeed = 0.5;
      await new Promise((resolve) => (fall = { t: 0, resolve }));
    },
    celebrate() {
      cheer = 1.6;
    },
  };
}
