// A three-reel slot machine standing in the corner of the parlor: oxblood cabinet, brass trim,
// a marquee of blinking bulbs, a pay table on its face, and a lever you can hear.
import * as THREE from 'three';
import { STRIP, SYMBOLS, PAYTABLE } from './slots.js';

const REEL_R = 0.17;
const REEL_W = 0.16;
const N = STRIP.length;
const CELL = 128; // pixels per symbol on the reel strip

function tex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function drawSymbol(ctx, key, size, logo) {
  const s = SYMBOLS[key];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (key === 'JACK' && logo) {
    const h = size * 0.86;
    const w = h * (logo.width / logo.height);
    ctx.drawImage(logo, -w / 2, -h / 2, w, h);
    return;
  }
  if (key === 'SEVEN') {
    ctx.font = `bold ${size * 0.82}px Georgia, serif`;
    ctx.fillStyle = '#8e1b1b';
    ctx.strokeStyle = '#2a0808';
    ctx.lineWidth = 4;
    ctx.strokeText('7', 0, size * 0.04);
    ctx.fillText('7', 0, size * 0.04);
    return;
  }
  if (key === 'BAR') {
    ctx.fillStyle = '#141414';
    ctx.fillRect(-size * 0.42, -size * 0.17, size * 0.84, size * 0.34);
    ctx.fillStyle = '#efe6d0';
    ctx.font = `bold ${size * 0.26}px Georgia, serif`;
    ctx.fillText('BAR', 0, size * 0.015);
    return;
  }
  ctx.font = `${size * 0.78}px Georgia, serif`;
  ctx.fillStyle = s.color === 'red' ? '#8e1b1b' : '#141414';
  ctx.fillText(s.label, 0, size * 0.05);
}

export function buildSlotMachine({ logo, logoDark } = {}) {
  const machine = new THREE.Group();
  const add = (geo, mat, x, y, z, parent = machine) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const oxblood = new THREE.MeshStandardMaterial({ color: 0x4a0f12, roughness: 0.35, metalness: 0.2 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x1c0f09, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb38b40, roughness: 0.3, metalness: 0.85 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 0.4 });

  // cabinet
  add(new THREE.BoxGeometry(0.82, 0.9, 0.62), darkWood, 0, 0.45, 0);
  add(new THREE.BoxGeometry(0.8, 0.86, 0.56), oxblood, 0, 1.33, -0.02);
  const hood = add(new THREE.CylinderGeometry(0.4, 0.4, 0.56, 32, 1, false, -Math.PI / 2, Math.PI), oxblood, 0, 1.76, -0.02);
  hood.rotation.z = Math.PI / 2;
  hood.rotation.y = Math.PI / 2;
  hood.scale.set(1, 1, 0.55);
  // brass trim strips
  for (const x of [-0.41, 0.41]) add(new THREE.BoxGeometry(0.025, 1.72, 0.03), brass, x, 0.92, 0.3);
  add(new THREE.BoxGeometry(0.84, 0.03, 0.64), brass, 0, 0.91, 0);

  // reels behind a window
  const reelTex = tex(N * CELL, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d9d2c0');
    g.addColorStop(0.5, '#f4efe3');
    g.addColorStop(1, '#d9d2c0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    STRIP.forEach((key, i) => {
      ctx.save();
      ctx.translate((i + 0.5) * CELL, h / 2);
      ctx.rotate(Math.PI / 2); // canvas +x runs up the reel face
      drawSymbol(ctx, key, CELL * 0.95, logoDark || logo);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(i * CELL, 0, 2, h);
    });
  });
  const reelMat = new THREE.MeshStandardMaterial({ map: reelTex, roughness: 0.5 });
  const reelSide = new THREE.MeshStandardMaterial({ color: 0x2a2421, roughness: 0.5, metalness: 0.4 });
  const reels = [-0.205, 0, 0.205].map((x) => {
    const reel = add(new THREE.CylinderGeometry(REEL_R, REEL_R, REEL_W, 64, 1), [reelMat, reelSide, reelSide], x, 1.32, 0.1);
    reel.rotation.z = Math.PI / 2;
    // rotation.x after the z turn spins the reel; set through a wrapper so order is right
    const pivot = new THREE.Group();
    pivot.position.copy(reel.position);
    machine.remove(reel);
    reel.position.set(0, 0, 0);
    pivot.add(reel);
    machine.add(pivot);
    return { pivot, angle: 0, from: 0, to: 0, t: 0, dur: 1, spinning: false, resolve: null };
  });
  // front panel with a window cut out (four boxes around it), dark glass, payline
  const WIN_W = 0.64;
  const WIN_H = 0.3;
  const panelZ = 0.27;
  add(new THREE.BoxGeometry(0.8, 1.32 - WIN_H / 2 - 0.92, 0.03), oxblood, 0, (0.92 + 1.32 - WIN_H / 2) / 2, panelZ);
  add(new THREE.BoxGeometry(0.8, 1.74 - (1.32 + WIN_H / 2), 0.03), oxblood, 0, (1.74 + 1.32 + WIN_H / 2) / 2, panelZ);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry((0.8 - WIN_W) / 2, WIN_H, 0.03), oxblood, s * (WIN_W / 2 + (0.8 - WIN_W) / 4), 1.32, panelZ);
  // brass window frame
  for (const [w, h, x, y] of [[WIN_W + 0.04, 0.02, 0, 1.32 + WIN_H / 2], [WIN_W + 0.04, 0.02, 0, 1.32 - WIN_H / 2], [0.02, WIN_H, -WIN_W / 2, 1.32], [0.02, WIN_H, WIN_W / 2, 1.32]]) {
    add(new THREE.BoxGeometry(w, h, 0.02), brass, x, y, panelZ + 0.02);
  }
  const glass = add(
    new THREE.PlaneGeometry(WIN_W, WIN_H),
    new THREE.MeshStandardMaterial({ color: 0x88aa99, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.2 }),
    0,
    1.32,
    panelZ + 0.005,
  );
  glass.castShadow = false;
  const paylineMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2a1a, emissiveIntensity: 1.2 });
  add(new THREE.BoxGeometry(WIN_W, 0.006, 0.004), paylineMat, 0, 1.32, panelZ + 0.012);

  // marquee
  const marqueeTex = tex(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#120807';
    ctx.fillRect(0, 0, w, h);
    if (logo) {
      const lh = 150;
      const lw = lh * (logo.width / logo.height);
      ctx.drawImage(logo, 24, (h - lh) / 2, lw, lh);
      ctx.drawImage(logo, w - 24 - lw, (h - lh) / 2, lw, lh);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e9d39a';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('PITCH BLACK', w / 2, 62);
    ctx.fillStyle = '#ff4a2a';
    ctx.font = 'bold 60px Georgia, serif';
    ctx.fillText('JACKPOT', w / 2, 130);
  });
  const marqueeMat = new THREE.MeshStandardMaterial({ map: marqueeTex, emissive: 0xffffff, emissiveMap: marqueeTex, emissiveIntensity: 0.9 });
  add(new THREE.PlaneGeometry(0.66, 0.25), marqueeMat, 0, 1.6, panelZ + 0.017);
  // bulbs
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.014, 10, 8);
  for (let i = 0; i < 18; i++) {
    const a = Math.PI * (i / 17);
    const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 1 });
    const b = add(bulbGeo, mat, Math.cos(a) * -0.36, 1.76 + Math.sin(a) * 0.2, panelZ + 0.015);
    b.castShadow = false;
    bulbs.push(b);
  }
  for (let i = 0; i < 6; i++) {
    for (const s of [-1, 1]) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 1 });
      const b = add(bulbGeo, mat, s * 0.36, 1.45 + i * 0.05, panelZ + 0.015);
      b.castShadow = false;
      bulbs.push(b);
    }
  }

  // pay table panel
  const payTex = tex(512, 300, (ctx, w, h) => {
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b38b40';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#e9d39a';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAYS', w / 2, 40);
    ctx.font = '22px Georgia, serif';
    PAYTABLE.forEach((line, i) => {
      const y = 74 + i * 28;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#efe6d0';
      ctx.fillText(line.name, 30, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffcf6a';
      ctx.fillText(`${line.pays}×`, w - 30, y);
    });
  });
  add(new THREE.PlaneGeometry(0.58, 0.34), new THREE.MeshStandardMaterial({ map: payTex, emissive: 0xffffff, emissiveMap: payTex, emissiveIntensity: 0.35 }), 0, 0.72, 0.312);

  // coin tray
  add(new THREE.BoxGeometry(0.5, 0.05, 0.16), brass, 0, 0.3, 0.38);
  add(new THREE.BoxGeometry(0.46, 0.04, 0.13), black, 0, 0.315, 0.38);
  const coins = [];
  const coinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.005, 18);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.9, roughness: 0.25 });

  // lever on the right side
  const lever = new THREE.Group();
  lever.position.set(0.44, 1.2, 0.05);
  machine.add(lever);
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 20), brass, 0, 0, 0, lever).rotation.z = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 12), brass, 0.035, 0.21, 0, lever);
  add(new THREE.SphereGeometry(0.045, 20, 14), new THREE.MeshStandardMaterial({ color: 0x9b1414, roughness: 0.25, metalness: 0.1 }), 0.035, 0.44, 0, lever);
  let leverT = -1;

  // a warm light so it glows in the dark corner
  const glow = new THREE.PointLight(0xffb070, 1.4, 3, 1.6);
  glow.position.set(0, 1.7, 0.9);
  machine.add(glow);

  let celebrate = 0;
  let celebrateLevel = 0;

  function update(dt, t) {
    for (const r of reels) {
      if (!r.spinning) continue;
      r.t += dt;
      const p = Math.min(1, r.t / r.dur);
      // fast start, long ease-out, tiny overshoot-and-settle at the end like a real reel
      const e = 1 - Math.pow(1 - p, 3);
      const settle = p > 0.92 ? Math.sin(((p - 0.92) / 0.08) * Math.PI) * 0.02 : 0;
      r.angle = r.from + (r.to - r.from) * e + settle;
      r.pivot.rotation.x = r.angle;
      if (p >= 1) {
        r.spinning = false;
        r.angle = r.to;
        r.pivot.rotation.x = r.to;
        r.resolve?.();
      }
    }
    if (leverT >= 0) {
      leverT += dt;
      const p = Math.min(1, leverT / 0.7);
      lever.rotation.x = Math.sin(Math.min(1, p * 2) * Math.PI) * 0.9;
      if (p >= 1) {
        leverT = -1;
        lever.rotation.x = 0;
      }
    }
    // bulbs chase slowly; during a win they flash hard
    celebrate = Math.max(0, celebrate - dt);
    bulbs.forEach((b, i) => {
      const chase = 0.6 + 0.6 * Math.max(0, Math.sin(t * 3 - i * 0.6));
      const party = celebrate > 0 ? (Math.floor(t * 10 + i) % 2 ? 4 : 0.3) : chase;
      b.material.emissiveIntensity = party;
    });
    marqueeMat.emissiveIntensity = celebrate > 0 ? 1.1 + Math.sin(t * 20) * 0.4 * celebrateLevel : 0.9;
    paylineMat.emissiveIntensity = celebrate > 0 ? 2 + Math.sin(t * 15) : 1.2;
    // coins fall into the tray
    for (const c of coins) {
      if (c.userData.v === null) continue;
      c.userData.v -= 9.8 * dt;
      c.position.y += c.userData.v * dt;
      c.rotation.x += c.userData.spin * dt;
      if (c.position.y <= 0.34 + c.userData.stack) {
        c.position.y = 0.34 + c.userData.stack;
        c.rotation.set(0, Math.random() * 3, 0);
        c.userData.v = null;
      }
    }
  }

  return {
    group: machine,
    update,
    /** Spin to the given strip indices; resolves as each reel lands (staggered). */
    spin(stops, onReelStop) {
      leverT = 0;
      return Promise.all(
        reels.map((r, i) => {
          const target = ((stops[i] + 0.5) / N) * Math.PI * 2;
          const base = r.angle - (r.angle % (Math.PI * 2));
          r.from = r.angle;
          r.to = base + Math.PI * 2 * (3 + i) + target;
          r.t = 0;
          r.dur = 1.3 + i * 0.45;
          r.spinning = true;
          return new Promise((res) => {
            r.resolve = () => {
              onReelStop?.(i);
              res();
            };
          });
        }),
      );
    },
    /** Lights and coins for a win. level 0..1 scales how big the show is. */
    celebrate(level, coinCount) {
      celebrate = 1.5 + level * 3;
      celebrateLevel = level;
      for (const c of coins) machine.remove(c);
      coins.length = 0;
      const n = Math.min(60, coinCount);
      for (let i = 0; i < n; i++) {
        const c = add(coinGeo, coinMat, (Math.random() - 0.5) * 0.36, 0.42 + i * 0.012, 0.37 + (Math.random() - 0.5) * 0.06);
        c.userData = { v: -Math.random() * 0.5, spin: 10 + Math.random() * 10, stack: Math.floor(i / 12) * 0.005 };
        coins.push(c);
      }
    },
    clearCoins() {
      for (const c of coins) machine.remove(c);
      coins.length = 0;
    },
  };
}
