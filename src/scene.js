// The parlor: a smoke-filled back room, one green table under one flickering lamp,
// patrons murmuring in the dark, and Jack.
import * as THREE from 'three';

export const TABLE_Y = 0.92; // felt height
const RX = 3.2; // table half-width
const RZ = 2.3; // table depth (dealer's straight edge at z = 0, curve toward the player)
const PX_PER_UNIT = 320;

export const SHOE_POS = new THREE.Vector3(1.25, TABLE_Y + 0.16, 0.28);
export const DISCARD_POS = new THREE.Vector3(-1.25, TABLE_Y, 0.3);
const LAMP_POS = new THREE.Vector3(0, 3.25, 0.95);

const rand = (a, b) => a + Math.random() * (b - a);

function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 8;
  return t;
}

function speckle(ctx, w, h, n, color, maxA, maxR = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${color},${Math.random() * maxA})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * maxR + 0.5, Math.random() * maxR + 0.5);
  }
}

function textOnArc(ctx, text, cx, cy, r, font, color, spacing = 1) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const widths = [...text].map((ch) => ctx.measureText(ch).width * spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = Math.PI / 2 + total / r / 2;
  [...text].forEach((ch, i) => {
    const step = widths[i] / r;
    a -= step / 2;
    ctx.save();
    ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.rotate(a - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a -= step / 2;
  });
  ctx.restore();
}

function feltTexture(logo) {
  const W = Math.round(RX * 2 * PX_PER_UNIT);
  const H = Math.round(RZ * PX_PER_UNIT);
  return canvasTex(W, H, (ctx) => {
    const g = ctx.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, W * 0.6);
    g.addColorStop(0, '#1f5a3a');
    g.addColorStop(1, '#0b2a1b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, W, H, 60000, '0,0,0', 0.25);
    speckle(ctx, W, H, 20000, '120,180,140', 0.06);
    // cigarette burns and stains
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(20,12,5,${rand(0.08, 0.25)})`;
      ctx.beginPath();
      ctx.arc(rand(0, W), rand(0, H), rand(3, 30), 0, Math.PI * 2);
      ctx.fill();
    }
    const cx = W / 2;
    const ink = 'rgba(214,196,150,0.82)';
    textOnArc(ctx, 'BLACKJACK PAYS 3 TO 2', cx, 0, 0.8 * PX_PER_UNIT, 'bold 46px Georgia, serif', ink, 1.15);
    textOnArc(ctx, 'DEALER MUST STAND ON ALL 17s  ·  INSURANCE PAYS 2 TO 1', cx, 0, 0.98 * PX_PER_UNIT, '26px Georgia, serif', ink, 1.08);
    // insurance band
    ctx.strokeStyle = 'rgba(214,196,150,0.5)';
    ctx.lineWidth = 3;
    for (const r of [1.08, 1.16]) {
      ctx.beginPath();
      ctx.arc(cx, 0, r * PX_PER_UNIT, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
    // the player's betting circle, with the logo inside
    const bx = cx;
    const by = 1.97 * PX_PER_UNIT;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bx, by, 0.2 * PX_PER_UNIT, 0, Math.PI * 2);
    ctx.stroke();
    if (logo) {
      const h = 0.3 * PX_PER_UNIT;
      const w = h * (logo.width / logo.height);
      ctx.globalAlpha = 0.25;
      ctx.drawImage(logo, bx - w / 2, by - h / 2, w, h);
      ctx.globalAlpha = 1;
    }
    textOnArc(ctx, 'PITCH BLACK JACK', cx, 0, 1.45 * PX_PER_UNIT, 'italic 30px Georgia, serif', 'rgba(214,196,150,0.35)', 1.3);
  });
}

function woodTexture(base = [48, 28, 16], planks = true) {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = `rgb(${base})`;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * h;
      ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
      ctx.lineWidth = Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + rand(-6, 6), w * 0.6, y + rand(-6, 6), w, y + rand(-4, 4));
      ctx.stroke();
    }
    if (planks) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      for (let y = 0; y < h; y += 64) ctx.fillRect(0, y, w, 3);
      for (let y = 0; y < h; y += 64) ctx.fillRect(((y * 7) % 5) * 100 + 50, y, 3, 64);
    }
  }, { repeat: planks ? [8, 8] : [1, 1] });
}

function wallpaperTexture() {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2a1012';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, 18, h);
    ctx.fillRect(w / 2, 0, 6, h);
    ctx.strokeStyle = 'rgba(160,110,60,0.18)';
    ctx.lineWidth = 3;
    // damask-ish motif
    for (let y = 40; y < h; y += 128) {
      for (const x of [w * 0.25 + 9, w * 0.75 + 3]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 26, 44, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - 60);
        ctx.quadraticCurveTo(x + 30, y, x, y + 60);
        ctx.quadraticCurveTo(x - 30, y, x, y - 60);
        ctx.stroke();
      }
    }
    speckle(ctx, w, h, 6000, '0,0,0', 0.3);
    // water damage
    const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,5,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: [14, 1] });
}

function smokeTexture() {
  return canvasTex(128, 128, (ctx, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + rand(-22, 22);
      const y = h / 2 + rand(-22, 22);
      const r = rand(14, 40);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

function tableShape(rx, rz) {
  const s = new THREE.Shape();
  s.moveTo(rx, 0);
  s.absellipse(0, 0, rx, rz, 0, Math.PI, true);
  s.lineTo(rx, 0);
  return s;
}

function chipMaterialSet(color, stripe) {
  const side = canvasTex(128, 16, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stripe;
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 16 + 4, 0, 6, h);
  });
  const top = canvasTex(64, 64, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 6;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.arc(32, 32, 27, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(32, 32, 17, 0, Math.PI * 2);
    ctx.stroke();
  });
  const m = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.5 });
  return [m(side), m(top), m(top)];
}

export const CHIP_DENOMS = [
  { value: 500, color: '#4a2463', stripe: '#e8d9a8' },
  { value: 100, color: '#151515', stripe: '#e9e2cf' },
  { value: 25, color: '#1d5e34', stripe: '#e9e2cf' },
  { value: 5, color: '#8e1b1b', stripe: '#e9e2cf' },
  { value: 1, color: '#d9d4c5', stripe: '#3b5d8f' },
];
const CHIP_R = 0.065;
const CHIP_H = 0.016;
let chipGeo = null;
const chipMats = new Map();

/** A group of chip stacks representing `amount`. */
export function makeChipStack(amount) {
  chipGeo ??= new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 28);
  const group = new THREE.Group();
  let left = Math.round(amount);
  const stacks = [];
  for (const d of CHIP_DENOMS) {
    let n = Math.floor(left / d.value);
    left -= n * d.value;
    while (n > 0) {
      const take = Math.min(n, 12);
      stacks.push({ d, n: take });
      n -= take;
    }
  }
  stacks.forEach((s, i) => {
    if (!chipMats.has(s.d.value)) chipMats.set(s.d.value, chipMaterialSet(s.d.color, s.d.stripe));
    const col = i % 3;
    const row = Math.floor(i / 3);
    for (let k = 0; k < s.n; k++) {
      const chip = new THREE.Mesh(chipGeo, chipMats.get(s.d.value));
      chip.position.set((col - 0) * CHIP_R * 2.1 + rand(-0.004, 0.004), CHIP_H / 2 + k * CHIP_H, row * CHIP_R * 2.1 + rand(-0.004, 0.004));
      chip.rotation.y = Math.random() * Math.PI;
      chip.castShadow = true;
      chip.receiveShadow = true;
      group.add(chip);
    }
  });
  // center the stacks around the origin
  const cols = Math.min(stacks.length, 3);
  group.children.forEach((c) => (c.position.x -= ((cols - 1) * CHIP_R * 2.1) / 2));
  return group;
}

// ---------------------------------------------------------------------------------------------
// Jack
// ---------------------------------------------------------------------------------------------

// Low-poly, hand-built: every piece is a few flat-shaded facets, with a slight
// deterministic "chisel" jitter so it reads as sculpted rather than generated.
function chisel(geo, amount, seed = 1) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // hash of the rounded position: shared vertices move together, so faces never crack
    const h = Math.sin(Math.round(v.x * 1e4) * 12.9898 + Math.round(v.y * 1e4) * 78.233 + Math.round(v.z * 1e4) * 37.719 + seed) * 43758.5453;
    const n = (h - Math.floor(h)) * 2 - 1;
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildJack() {
  const jack = new THREE.Group();
  jack.position.set(0, 0, -0.55);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
  const skin = mat(0xc29a7e); // hands only: the one part of him the lamp reaches
  const skinShade = mat(0xa47e66);
  const shadowFace = mat(0x0b0909, { roughness: 1 }); // under the hat there is no face, just dark
  const shirt = mat(0x6e675c);
  const vest = mat(0x1a1618);
  const vestDark = mat(0x1b1719);
  const hairM = mat(0x17110f, { roughness: 0.5 });
  const red = mat(0x7d1d1d);
  const brass = mat(0xb08a3e, { metalness: 0.6, roughness: 0.4 });
  const visorMat = mat(0x2f7a45, { transparent: true, opacity: 0.78, side: THREE.DoubleSide, emissive: 0x0e3a1c, emissiveIntensity: 0.5 });

  const part = (geo, m, parent, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // ---- torso ------------------------------------------------------------------------------
  const body = new THREE.Group();
  jack.add(body);
  // shirt core: 7-sided barrel, wider at the chest
  const chestPts = [
    [0.0, 0.0], [0.2, 0.0], [0.215, 0.18], [0.25, 0.42], [0.26, 0.56], [0.2, 0.66], [0.07, 0.7], [0.0, 0.7],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const chest = part(chisel(new THREE.LatheGeometry(chestPts, 7), 0.02, 3), shirt, body, 0, 1.0, 0);
  chest.scale.set(1.05, 1, 0.72);
  // vest: same lathe slightly larger, open at the front
  const vestPts = chestPts.map((p) => new THREE.Vector2(p.x + 0.014, p.y)).slice(0, 6);
  const vestMesh = part(
    chisel(new THREE.LatheGeometry(vestPts, 9, 0.5, Math.PI * 2 - 1.0), 0.015, 5),
    vest,
    body,
    0,
    0.995,
    0,
  );
  vestMesh.scale.set(1.05, 1, 0.74);
  // lapels: two slanted plates forming a V
  for (const s of [-1, 1]) {
    const lapel = part(new THREE.BoxGeometry(0.06, 0.34, 0.012), vestDark, body, s * 0.07, 1.47, 0.175);
    lapel.rotation.z = s * 0.32;
    lapel.rotation.y = s * -0.35;
  }
  // brass buttons + watch chain
  for (let i = 0; i < 3; i++) part(new THREE.OctahedronGeometry(0.013, 0), brass, body, 0.035, 1.3 - i * 0.075, 0.185);
  const chain = part(new THREE.TorusGeometry(0.07, 0.004, 3, 8, Math.PI), brass, body, 0.1, 1.24, 0.17);
  chain.rotation.z = Math.PI;
  chain.rotation.y = -0.4;
  // bow tie
  for (const s of [-1, 1]) {
    const wing = part(new THREE.ConeGeometry(0.035, 0.07, 4), red, body, s * 0.035, 1.665, 0.11);
    wing.rotation.z = (-s * Math.PI) / 2;
  }
  part(new THREE.BoxGeometry(0.022, 0.026, 0.02), red, body, 0, 1.665, 0.115);
  // shoulders
  for (const s of [-1, 1]) {
    const sh = part(chisel(new THREE.IcosahedronGeometry(0.11, 0), 0.05, s + 9), vest, body, s * 0.25, 1.6, 0);
    sh.scale.set(1.1, 0.75, 1);
  }
  // neck + collar
  part(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 6), skinShade, jack, 0, 1.73, 0);
  const collar = part(new THREE.CylinderGeometry(0.075, 0.09, 0.06, 7, 1, true), shirt, body, 0, 1.69, 0);
  collar.material = shirt;

  // ---- head: a silhouette under the hat ----------------------------------------------------
  const head = new THREE.Group();
  head.position.set(0, 1.9, 0.0);
  jack.add(head);
  const cranium = part(chisel(new THREE.IcosahedronGeometry(0.13, 1), 0.04, 21), shadowFace, head, 0, 0.02, -0.01);
  cranium.scale.set(0.88, 1.05, 1.0);
  const jaw = part(chisel(new THREE.IcosahedronGeometry(0.095, 0), 0.06, 22), shadowFace, head, 0, -0.07, 0.03);
  jaw.scale.set(0.95, 1.05, 1.0);
  const nose = part(new THREE.ConeGeometry(0.02, 0.07, 4), shadowFace, head, 0, -0.01, 0.13);
  nose.rotation.x = Math.PI / 2 + 0.45;
  for (const s of [-1, 1]) {
    const ear = part(new THREE.OctahedronGeometry(0.03, 0), shadowFace, head, s * 0.115, 0.0, -0.005);
    ear.scale.set(0.4, 1.2, 0.8);
  }
  // the fedora: low, wide brim tipped forward over where his eyes would be
  const felt = mat(0x141113, { roughness: 0.95 });
  const hat = new THREE.Group();
  hat.position.set(0, 0.085, 0.0);
  hat.rotation.x = 0.16;
  head.add(hat);
  const brim = part(chisel(new THREE.CylinderGeometry(0.27, 0.28, 0.014, 12), 0.02, 51), felt, hat, 0, 0, 0.01);
  brim.scale.set(1, 1, 1.08);
  // front and back of the brim snap down a touch
  const bpos = brim.geometry.attributes.position;
  for (let i = 0; i < bpos.count; i++) {
    const x = bpos.getX(i), z = bpos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.18) bpos.setY(i, bpos.getY(i) - Math.abs(z / r) * (r - 0.18) * 0.45);
  }
  brim.geometry.computeVertexNormals();
  const crown = part(chisel(new THREE.CylinderGeometry(0.105, 0.135, 0.15, 8), 0.03, 52), felt, hat, 0, 0.08, -0.005);
  crown.scale.set(1, 1, 1.12);
  // pinched crease on top
  const crease = part(new THREE.BoxGeometry(0.03, 0.03, 0.2), mat(0x0a0809), hat, 0, 0.15, -0.005);
  crease.rotation.z = Math.PI / 4;
  part(new THREE.CylinderGeometry(0.137, 0.137, 0.03, 8), mat(0x3b1214), hat, 0, 0.022, -0.005); // hat band
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const eyes = [];

  // ---- arms: shoulder -> elbow -> hand, solved every frame ----------------------------------
  const upperGeo = new THREE.CylinderGeometry(0.052, 0.046, 1, 6);
  const lowerGeo = new THREE.CylinderGeometry(0.046, 0.036, 1, 6);
  const arms = [-1, 1].map((side) => {
    const upper = part(upperGeo, shirt, jack);
    upper.userData.trim = 0.0;
    const garter = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.035, 6), red);
    garter.position.y = 0.1; // in the upper arm's stretched local space it is re-scaled below
    const lower = part(lowerGeo, shirt, jack);
    lower.userData.trim = 0.0;
    const armband = part(new THREE.CylinderGeometry(0.057, 0.057, 0.03, 6), red, jack);
    const cuff = part(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 6), shirt, jack);
    const hand = new THREE.Group();
    jack.add(hand);
    const palm = part(chisel(new THREE.BoxGeometry(0.075, 0.035, 0.09, 1, 1, 1), 0.05, side + 40), skin, hand, 0, 0, 0.03);
    palm.rotation.x = 0.1;
    const fingers = part(new THREE.BoxGeometry(0.07, 0.025, 0.05), skinShade, hand, 0, -0.008, 0.095);
    fingers.rotation.x = 0.35;
    const thumb = part(new THREE.BoxGeometry(0.022, 0.022, 0.05), skin, hand, -side * 0.045, 0.0, 0.04);
    thumb.rotation.y = side * 0.5;
    const rest = new THREE.Vector3(side * 0.4, TABLE_Y + 0.03, 0.18);
    return {
      side,
      upper,
      lower,
      armband,
      cuff,
      hand,
      shoulder: new THREE.Vector3(side * 0.27, 1.6, 0),
      rest,
      target: rest.clone(),
      pos: rest.clone(),
    };
  });

  return { group: jack, head, body, eyes, arms, eyeMat };
}

const UP = new THREE.Vector3(0, 1, 0);
function placeLimb(mesh, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.scale.set(1, Math.max(0.05, len - (mesh.userData.trim ?? 0.08)), 1);
}

// ---------------------------------------------------------------------------------------------

export function buildScene(renderer, { logo } = {}) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0x120e0c);
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.085);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 60);
  const camBase = new THREE.Vector3(0, 2.05, 3.35);
  const camLook = new THREE.Vector3(0, 1.08, 0.5);
  camera.position.copy(camBase);
  camera.lookAt(camLook);

  scene.add(new THREE.HemisphereLight(0x3a2c22, 0x050403, 0.35));

  // --- room --------------------------------------------------------------------------------
  const floorTex = woodTexture([38, 22, 13]);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(24, 5.2, 24),
    [
      ...Array(2).fill(new THREE.MeshStandardMaterial({ map: wallpaperTexture(), side: THREE.BackSide, roughness: 0.95 })),
      new THREE.MeshStandardMaterial({ color: 0x0c0907, side: THREE.BackSide }),
      new THREE.MeshStandardMaterial({ color: 0x0c0907, side: THREE.BackSide }),
      ...Array(2).fill(new THREE.MeshStandardMaterial({ map: wallpaperTexture(), side: THREE.BackSide, roughness: 0.95 })),
    ],
  );
  walls.position.set(0, 2.6, -3);
  walls.receiveShadow = true;
  scene.add(walls);

  // --- the table ---------------------------------------------------------------------------
  const felt = new THREE.MeshStandardMaterial({ map: feltTexture(logo), roughness: 0.95 });
  felt.map.repeat.set(1 / (RX * 2), 1 / RZ);
  felt.map.offset.set(0.5, 1);
  const leather = new THREE.MeshStandardMaterial({ color: 0x0d0a09, roughness: 0.45 });
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture([60, 30, 16], false), roughness: 0.55 });

  const top = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tableShape(RX, RZ), { depth: 0.1, bevelEnabled: false, curveSegments: 64 }),
    [felt, wood],
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = TABLE_Y - 0.1;
  top.receiveShadow = true;
  scene.add(top);

  const skirt = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tableShape(RX - 0.15, RZ - 0.12), { depth: 0.18, bevelEnabled: false, curveSegments: 48 }),
    wood,
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = TABLE_Y - 0.28;
  skirt.castShadow = true;
  scene.add(skirt);

  for (const x of [-1.4, 1.4]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, TABLE_Y - 0.28, 12), wood);
    leg.position.set(x, (TABLE_Y - 0.28) / 2, 0.9);
    leg.castShadow = true;
    scene.add(leg);
  }

  // padded leather armrest along the curve
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * (RX + 0.04), TABLE_Y + 0.03, Math.sin(a) * (RZ + 0.04)));
  }
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.1, 14, false), leather);
  rail.castShadow = true;
  rail.receiveShadow = true;
  scene.add(rail);
  const dealerEdge = new THREE.Mesh(new THREE.BoxGeometry(RX * 2 + 0.2, 0.08, 0.1), wood);
  dealerEdge.position.set(0, TABLE_Y - 0.02, -0.03);
  scene.add(dealerEdge);

  // dealer's chip tray
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.6 }));
  tray.position.set(0, TABLE_Y + 0.02, 0.15);
  tray.receiveShadow = true;
  scene.add(tray);
  CHIP_DENOMS.forEach((d, i) => {
    for (const row of [0, 1]) {
      // upright stacks of a single colour, standing in the tray
      const stack = makeChipStack(d.value * Math.floor(rand(5, 12)));
      stack.scale.setScalar(0.9);
      stack.position.set(-0.5 + i * 0.25, TABLE_Y + 0.04, 0.09 + row * 0.12);
      scene.add(stack);
    }
  });

  // shoe
  const shoe = new THREE.Group();
  const shoeBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.55), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.3 }));
  shoeBody.castShadow = true;
  const shoeCards = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.16, 0.42), new THREE.MeshStandardMaterial({ color: 0x777777 }));
  shoeCards.position.set(0, 0.03, -0.04);
  shoe.add(shoeBody, shoeCards);
  shoe.position.set(SHOE_POS.x + 0.05, TABLE_Y + 0.1, SHOE_POS.z - 0.2);
  shoe.rotation.set(-0.15, -0.35, 0);
  scene.add(shoe);

  // discard holder
  const discard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.56), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4 }));
  discard.position.set(DISCARD_POS.x, TABLE_Y + 0.01, DISCARD_POS.z);
  scene.add(discard);
  const discardPile = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1, 0.5), new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 }));
  discardPile.position.set(DISCARD_POS.x, TABLE_Y + 0.02, DISCARD_POS.z);
  discardPile.scale.y = 0.0001;
  discardPile.visible = false;
  scene.add(discardPile);

  // ashtray + cigarette, and a forgotten glass
  const glass = new THREE.MeshStandardMaterial({ color: 0x9aa6a0, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1 });
  const ashtray = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.04, 20), glass);
  ashtray.position.set(-2.05, TABLE_Y + 0.02, 0.55);
  scene.add(ashtray);
  const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xe8e2d4 }));
  cig.rotation.z = Math.PI / 2 - 0.15;
  cig.rotation.y = 0.5;
  cig.position.set(-2.0, TABLE_Y + 0.055, 0.56);
  scene.add(cig);
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff5a1a, emissiveIntensity: 3 });
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), emberMat);
  const emberPos = new THREE.Vector3(-1.93, TABLE_Y + 0.066, 0.52);
  ember.position.copy(emberPos);
  scene.add(ember);

  const tumbler = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.13, 20), glass);
  tumbler.position.set(2.15, TABLE_Y + 0.065, 1.0);
  const whiskey = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.047, 0.05, 20),
    new THREE.MeshStandardMaterial({ color: 0x6b3510, transparent: true, opacity: 0.8, roughness: 0.1 }),
  );
  whiskey.position.set(2.15, TABLE_Y + 0.03, 1.0);
  scene.add(whiskey, tumbler);

  // --- the radio: plays the player's song --------------------------------------------------
  const radio = new THREE.Group();
  radio.position.set(2.3, TABLE_Y, 0.42);
  radio.rotation.y = -0.75;
  scene.add(radio);
  const radioWood = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.55, flatShading: true });
  const radioFront = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, 0, w, h);
    // speaker grille cloth with slats
    ctx.fillStyle = '#6b5a3e';
    ctx.fillRect(28, 20, w - 56, 140);
    ctx.fillStyle = '#3a2614';
    for (let x = 40; x < w - 36; x += 22) ctx.fillRect(x, 20, 9, 140);
    // brass plaque
    ctx.fillStyle = '#b08a3e';
    ctx.fillRect(48, 196, w - 96, 40);
    ctx.fillStyle = '#1b1612';
    ctx.font = 'bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♫ DEALER', w / 2, 217);
  });
  const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.15), [
    radioWood, radioWood, radioWood, radioWood,
    new THREE.MeshStandardMaterial({ map: radioFront, roughness: 0.7 }),
    radioWood,
  ]);
  radioBody.position.y = 0.13;
  radioBody.castShadow = true;
  radio.add(radioBody);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.15, 10, 1, false, -Math.PI / 2, Math.PI), radioWood);
  arch.rotation.x = Math.PI / 2;
  arch.rotation.y = Math.PI / 2;
  arch.position.y = 0.26;
  arch.castShadow = true;
  radio.add(arch);
  const dialMat = new THREE.MeshStandardMaterial({ color: 0x2a1e10, emissive: 0xffa040, emissiveIntensity: 0.15, flatShading: true });
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), dialMat);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0, 0.32, 0.075);
  radio.add(dial);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.04, 0.004), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  needle.position.set(0, 0.33, 0.083);
  radio.add(needle);
  for (const s of [-1, 1]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.6, roughness: 0.4, flatShading: true }));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(s * 0.12, 0.05, 0.085);
    radio.add(knob);
  }
  const radioGlow = new THREE.PointLight(0xffa040, 0, 1.2, 2);
  radioGlow.position.set(0, 0.32, 0.2);
  radio.add(radioGlow);
  let radioOn = false;
  let radioHover = false;

  // --- the lamp ----------------------------------------------------------------------------
  const lampGroup = new THREE.Group();
  lampGroup.position.copy(LAMP_POS);
  scene.add(lampGroup);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.5), new THREE.MeshStandardMaterial({ color: 0x050505 }));
  cord.position.y = 1.4;
  lampGroup.add(cord);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.62, 0.34, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x173826, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }),
  );
  lampGroup.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd9a0, emissiveIntensity: 4 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), bulbMat);
  bulb.position.y = -0.08;
  lampGroup.add(bulb);

  const spot = new THREE.SpotLight(0xffc98a, 60, 9, 0.78, 0.55, 1.6);
  spot.position.copy(LAMP_POS).add(new THREE.Vector3(0, -0.1, 0));
  spot.target.position.set(0, TABLE_Y, 0.85);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.5;
  spot.shadow.camera.far = 8;
  scene.add(spot, spot.target);

  // a weak fill so Jack's face isn't pure black
  const fill = new THREE.PointLight(0x7a5a3a, 0.6, 6, 1.5);
  fill.position.set(0, 1.6, 2.6);
  scene.add(fill);

  // volumetric light cone through the smoke
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uIntensity: { value: 1 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uIntensity; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        float edge = pow(abs(dot(vN, vView)), 2.0);
        float fade = smoothstep(0.0, 1.0, vUv.y) * 0.9 + 0.1;
        gl_FragColor = vec4(vec3(1.0,0.82,0.55), 0.07 * edge * fade * uIntensity);
      }`,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.75, LAMP_POS.y - TABLE_Y - 0.15, 40, 1, true), coneMat);
  cone.position.set(LAMP_POS.x, (LAMP_POS.y - 0.15 + TABLE_Y) / 2, LAMP_POS.z);
  scene.add(cone);

  // --- the rest of the room, lost in smoke ---------------------------------------------------
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x0b0908, roughness: 1 });
  const farFelt = new THREE.MeshStandardMaterial({ color: 0x0f2a1a, roughness: 1 });
  const patrons = [];
  const farLamps = [];
  const farTables = [
    [-6.5, -6, 0.3],
    [6, -7.5, -0.4],
    [8.5, -1.5, 0.9],
    [-8.5, -1, -0.6],
  ];
  farTables.forEach(([x, z, rot], ti) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.1, 32), farFelt);
    t.position.set(x, TABLE_Y, z);
    scene.add(t);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, TABLE_Y, 12), shadowMat);
    base.position.set(x, TABLE_Y / 2, z);
    scene.add(base);
    const lb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), bulbMat.clone());
    lb.position.set(x, 2.9, z);
    const ls = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.3, 24, 1, true), shade.material);
    ls.position.set(x, 3.0, z);
    scene.add(lb, ls);
    farLamps.push(lb);
    if (ti < 2) {
      const pl = new THREE.PointLight(0xffb070, 3.5, 7, 1.8);
      pl.position.set(x, 2.7, z);
      scene.add(pl);
      lb.userData.light = pl;
    }
    const seats = Math.floor(rand(3, 6));
    for (let i = 0; i < seats; i++) {
      const a = rot + (i / seats) * Math.PI * 2 + rand(-0.2, 0.2);
      const p = new THREE.Group();
      const standing = Math.random() < 0.3;
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, standing ? 0.75 : 0.45, 4, 10), shadowMat);
      torso.position.y = standing ? 1.15 : 1.0;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), shadowMat);
      head.position.y = standing ? 1.82 : 1.55;
      p.add(torso, head);
      if (Math.random() < 0.4) {
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 14), shadowMat);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.015, 18), shadowMat);
        hat.position.y = head.position.y + 0.14;
        brim.position.y = head.position.y + 0.08;
        p.add(hat, brim);
      }
      p.position.set(x + Math.cos(a) * 1.75, 0, z + Math.sin(a) * 1.75);
      p.lookAt(x, 1, z);
      p.userData = { phase: rand(0, 10), speed: rand(0.3, 0.8), head, baseRot: p.rotation.y };
      scene.add(p);
      patrons.push(p);
    }
  });

  // bar along the back wall
  const bar = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 0.8), shadowMat);
  bar.position.set(0, 0.55, -13.6);
  scene.add(bar);
  const shelfGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x8a4f1c, emissiveIntensity: 0.45 }),
  );
  shelfGlow.position.set(0, 2.2, -14.95);
  scene.add(shelfGlow);
  for (let i = 0; i < 34; i++) {
    const h = rand(0.25, 0.45);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 8), shadowMat);
    b.position.set(-3.8 + i * 0.23 + rand(-0.04, 0.04), 1.65 + h / 2 + (i % 2 ? 0.6 : 0), -14.85);
    scene.add(b);
  }
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.8, 4, 10), shadowMat);
    torso.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), shadowMat);
    head.position.y = 1.85;
    p.add(torso, head);
    p.position.set(-2.5 + i * 2.3 + rand(-0.4, 0.4), 0, -12.7);
    p.userData = { phase: rand(0, 10), speed: rand(0.3, 0.8), head, baseRot: Math.PI + rand(-0.3, 0.3) };
    p.rotation.y = p.userData.baseRot;
    scene.add(p);
    patrons.push(p);
  }

  // --- smoke -------------------------------------------------------------------------------
  const smokeTex = smokeTexture();
  const smoke = [];
  for (let i = 0; i < 70; i++) {
    const nearLamp = i < 14;
    const mat = new THREE.SpriteMaterial({
      map: smokeTex,
      color: nearLamp ? 0xffe2b8 : 0x8a8178,
      transparent: true,
      depthWrite: false,
      opacity: nearLamp ? rand(0.18, 0.32) : rand(0.12, 0.28),
      rotation: rand(0, Math.PI * 2),
    });
    const s = new THREE.Sprite(mat);
    const scale = nearLamp ? rand(1.2, 2.4) : rand(2.5, 6);
    s.scale.set(scale, scale, 1);
    if (nearLamp) s.position.set(rand(-1.4, 1.4), rand(1.6, 2.9), rand(-0.2, 1.8));
    else s.position.set(rand(-10, 10), rand(1.0, 4.2), rand(-14, 2.5));
    s.userData = { vx: rand(0.02, 0.07), vy: rand(-0.005, 0.01), spin: rand(-0.03, 0.03), nearLamp, base: mat.opacity };
    scene.add(s);
    smoke.push(s);
  }
  // curling cigarette smoke
  const wisps = [];
  const wispMat = new THREE.SpriteMaterial({ map: smokeTex, color: 0xcfc6ba, transparent: true, depthWrite: false, opacity: 0 });
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Sprite(wispMat.clone());
    s.visible = false;
    s.userData = { life: 0, max: 1 };
    scene.add(s);
    wisps.push(s);
  }
  let wispTimer = 0;
  let wispIdx = 0;

  // --- Jack --------------------------------------------------------------------------------
  const jack = buildJack();
  scene.add(jack.group);
  const lookTarget = new THREE.Vector3().copy(camBase);
  const lookSmoothed = lookTarget.clone();
  let blinkTimer = rand(2, 5);
  let tiltPhase = 0;
  let flickerBoost = 0;
  const mouse = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  });

  const tmp = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const shoulderW = new THREE.Vector3();
  const handLocal = new THREE.Vector3();

  function update(dt, t) {
    // lamp flicker: mostly steady hum, with sputters
    let f = 1 + Math.sin(t * 13.1) * 0.015 + Math.sin(t * 31.7) * 0.01;
    if (Math.random() < 0.004 + flickerBoost * 0.08) f *= rand(0.15, 0.6);
    flickerBoost = Math.max(0, flickerBoost - dt * 0.5);
    spot.intensity = THREE.MathUtils.lerp(spot.intensity, 60 * f, 0.5);
    bulbMat.emissiveIntensity = 4 * f;
    coneMat.uniforms.uIntensity.value = f;
    farLamps.forEach((l, i) => {
      const ff = 0.8 + Math.sin(t * (2 + i) + i) * 0.05 + (Math.random() < 0.01 ? -0.5 : 0);
      l.material.emissiveIntensity = 2.5 * ff;
      if (l.userData.light) l.userData.light.intensity = 3.5 * ff;
    });
    emberMat.emissiveIntensity = 2.5 + Math.sin(t * 2.3) * 0.8 + Math.random() * 0.4;
    // radio: dial glows and the needle sways while the song plays; it breathes softly when hovered
    const glowTarget = radioOn ? 2.2 + Math.sin(t * 6) * 0.25 : radioHover ? 0.9 + Math.sin(t * 5) * 0.3 : 0.15;
    dialMat.emissiveIntensity += (glowTarget - dialMat.emissiveIntensity) * Math.min(1, dt * 6);
    radioGlow.intensity = radioOn ? 0.6 + Math.sin(t * 6) * 0.1 : 0;
    needle.rotation.z = radioOn ? Math.sin(t * 1.7) * 0.6 : needle.rotation.z * 0.95;

    // smoke drift
    for (const s of smoke) {
      const u = s.userData;
      s.position.x += u.vx * dt;
      s.position.y += u.vy * dt;
      s.material.rotation += u.spin * dt;
      if (u.nearLamp) {
        if (s.position.x > 1.6) s.position.x = -1.6;
        s.material.opacity = u.base * (0.8 + 0.2 * Math.sin(t * 0.3 + s.id));
      } else if (s.position.x > 10) s.position.x = -10;
    }
    wispTimer -= dt;
    if (wispTimer <= 0) {
      wispTimer = 0.12;
      const w = wisps[wispIdx++ % wisps.length];
      w.visible = true;
      w.position.copy(emberPos);
      w.userData = { life: 0, max: rand(3.5, 5), phase: rand(0, 6) };
      w.material.rotation = rand(0, 6);
    }
    for (const w of wisps) {
      if (!w.visible) continue;
      const u = w.userData;
      u.life += dt;
      const k = u.life / u.max;
      if (k >= 1) {
        w.visible = false;
        continue;
      }
      w.position.y += dt * 0.22;
      w.position.x = emberPos.x + Math.sin(u.life * 1.7 + u.phase) * 0.06 * (1 + k * 3) + k * 0.25;
      w.position.z = emberPos.z + Math.cos(u.life * 1.3 + u.phase) * 0.04 * (1 + k * 3);
      const sc = 0.04 + k * 0.5;
      w.scale.set(sc, sc, 1);
      w.material.opacity = Math.sin(k * Math.PI) * 0.16 * (1 - k * 0.5);
      w.material.rotation += dt * 0.4;
    }

    // patrons sway and shift
    for (const p of patrons) {
      const u = p.userData;
      p.rotation.z = Math.sin(t * u.speed + u.phase) * 0.025;
      p.rotation.y = u.baseRot + Math.sin(t * u.speed * 0.3 + u.phase) * 0.15;
      u.head.position.x = Math.sin(t * u.speed * 1.3 + u.phase) * 0.03;
    }

    // Jack: breathing, head tracking, blinking, arms
    jack.body.scale.set(1 + Math.sin(t * 1.1) * 0.008, 1 + Math.sin(t * 1.1) * 0.012, 1);
    lookSmoothed.lerp(lookTarget, 1 - Math.pow(0.02, dt));
    tiltPhase += dt;
    const head = jack.head;
    tmp.copy(lookSmoothed);
    jack.group.worldToLocal(tmp);
    tmp.sub(head.position);
    const yaw = Math.atan2(tmp.x, tmp.z);
    const pitch = -Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)) * 0.8;
    head.rotation.y = THREE.MathUtils.clamp(yaw, -0.9, 0.9);
    head.rotation.x = THREE.MathUtils.clamp(pitch, -0.4, 0.7);
    head.rotation.z = Math.sin(tiltPhase * 0.23) * 0.09;
    blinkTimer -= dt;
    const blink = blinkTimer < 0.12 && blinkTimer > 0 ? 0.1 : 1;
    if (blinkTimer < 0) blinkTimer = rand(2.5, 7);
    for (const e of jack.eyes) e.scale.y = blink;

    for (const arm of jack.arms) {
      arm.pos.lerp(arm.target, 1 - Math.pow(0.0005, dt));
      handLocal.copy(arm.pos);
      jack.group.worldToLocal(handLocal);
      shoulderW.copy(arm.shoulder);
      elbow.addVectors(shoulderW, handLocal).multiplyScalar(0.5);
      elbow.x += arm.side * 0.12;
      elbow.y -= 0.1;
      elbow.z -= 0.08;
      placeLimb(arm.upper, shoulderW, elbow);
      placeLimb(arm.lower, elbow, handLocal);
      // red sleeve garter sits a third of the way down the upper arm, the cuff at the wrist
      arm.armband.position.lerpVectors(shoulderW, elbow, 0.38);
      arm.armband.quaternion.copy(arm.upper.quaternion);
      arm.cuff.position.lerpVectors(elbow, handLocal, 0.92);
      arm.cuff.quaternion.copy(arm.lower.quaternion);
      arm.hand.position.copy(handLocal);
      // hand lies flat, pointing along the forearm's heading
      tmp.subVectors(handLocal, elbow);
      arm.hand.rotation.set(0, Math.atan2(tmp.x, tmp.z), 0);
    }

    // camera: slow breathing sway + a little mouse parallax
    camera.position.set(
      camBase.x + Math.sin(t * 0.25) * 0.03 + mouse.x * 0.22,
      camBase.y + Math.sin(t * 0.4) * 0.015 - mouse.y * 0.08,
      camBase.z,
    );
    camera.lookAt(camLook.x + mouse.x * 0.15, camLook.y - mouse.y * 0.1, camLook.z);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    // pull back a little on narrow screens so the whole table fits
    camera.fov = camera.aspect < 1 ? 68 : 50;
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    scene,
    camera,
    update,
    resize,
    discardPile,
    jack: {
      /** Move Jack's right (dealing) hand toward a world point; null returns it to rest. */
      reach(point, side = 1) {
        const arm = jack.arms[side > 0 ? 1 : 0];
        if (point) arm.target.copy(point).add(new THREE.Vector3(0, 0.05, 0));
        else arm.target.copy(arm.rest);
      },
      look(point) {
        lookTarget.copy(point || camera.position);
      },
      lookAtPlayer() {
        lookTarget.copy(camBase);
      },
      stare() {
        // eyes burn a little brighter for a moment
        /* no face to see: he just holds still */
      },
    },
    radio: {
      object: radio,
      setPlaying(on) {
        radioOn = on;
      },
      setHover(on) {
        radioHover = on;
      },
    },
    flicker(amount = 1) {
      flickerBoost = amount;
    },
  };
}
