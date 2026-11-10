// A Plinko board standing in the right-hand corner of the parlor: dark lacquered backboard,
// brass pegs, payout slots painted by risk, and a chip that rattles its way down.
import * as THREE from 'three';
import { ROWS } from './plinko.js';

const S = 0.075; // peg spacing
const TOP_Y = 2.02; // top peg row
const BIN_Y = TOP_Y - ROWS * S - 0.02;

function colorFor(mult) {
  if (mult >= 20) return '#c0262d';
  if (mult >= 5) return '#d4732a';
  if (mult >= 2) return '#d4a32a';
  if (mult >= 1) return '#6f8f62';
  return '#3a3533';
}

export function createPlinko() {
  const group = new THREE.Group();
  group.position.set(4.4, 0, 2.95);
  group.rotation.y = -Math.PI / 2; // facing back into the room
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x1e2a24, roughness: 0.3, metalness: 0.15 });
  const oxblood = new THREE.MeshStandardMaterial({ color: 0x4a0f12, roughness: 0.35, metalness: 0.2 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, roughness: 0.25, metalness: 0.9 });
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const W = (ROWS + 1) * S + 0.12;
  // cabinet and backboard
  add(new THREE.BoxGeometry(W + 0.1, 0.9, 0.5), oxblood, 0, 0.45, -0.1);
  add(new THREE.BoxGeometry(W + 0.1, 1.45, 0.06), lacquer, 0, 0.9 + 0.72, -0.2);
  for (const x of [-(W / 2 + 0.05), W / 2 + 0.05]) add(new THREE.BoxGeometry(0.03, 1.45, 0.12), brass, x, 1.62, -0.16);
  add(new THREE.BoxGeometry(W + 0.16, 0.03, 0.12), brass, 0, 2.35, -0.16);
  // glass front
  const glass = add(
    new THREE.PlaneGeometry(W + 0.08, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x99bbaa, transparent: true, opacity: 0.06, roughness: 0.05 }),
    0,
    1.62,
    0.05,
  );
  glass.castShadow = false;

  // sign
  const signTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#120807';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#e9d39a';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PLINKO', 256, 50);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.8 });
  add(new THREE.PlaneGeometry(0.6, 0.11), signMat, 0, 2.24, -0.165);

  // pegs (one instanced mesh)
  const pegs = [];
  for (let r = 0; r < ROWS; r++) for (let j = -1; j <= r + 1; j++) pegs.push([(j - r / 2) * S, TOP_Y - r * S]);
  const pegMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0105, 12, 10), brass, pegs.length);
  const m4 = new THREE.Matrix4();
  pegs.forEach(([x, y], i) => {
    m4.makeTranslation(x, y, -0.16);
    pegMesh.setMatrixAt(i, m4);
  });
  pegMesh.castShadow = true;
  group.add(pegMesh);
  // bin dividers
  for (let k = 0; k <= ROWS + 1; k++) add(new THREE.BoxGeometry(0.004, 0.09, 0.05), brass, (k - (ROWS + 1) / 2) * S, BIN_Y - 0.02, -0.15);

  // payout strip, repainted per risk table
  let stripMesh = null;
  const lights = [];
  function setTable(table) {
    if (stripMesh) {
      group.remove(stripMesh);
      stripMesh.material.map.dispose();
    }
    const c = document.createElement('canvas');
    c.width = 1040;
    c.height = 96;
    const ctx = c.getContext('2d');
    const cw = c.width / table.length;
    table.forEach((m, k) => {
      ctx.fillStyle = colorFor(m);
      ctx.fillRect(k * cw + 2, 0, cw - 4, c.height);
      ctx.fillStyle = '#f4ecd8';
      ctx.font = `bold ${m >= 10 ? 30 : 28}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${m}×`, k * cw + cw / 2, c.height / 2);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    stripMesh = add(
      new THREE.PlaneGeometry(table.length * S, 0.07),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6 }),
      0,
      BIN_Y - 0.03,
      -0.165,
    );
  }
  for (let k = 0; k <= ROWS; k++) {
    const l = add(new THREE.SphereGeometry(0.01, 10, 8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 0.3 }), (k - ROWS / 2) * S, BIN_Y - 0.085, -0.15);
    l.castShadow = false;
    lights.push(l);
  }

  const glow = new THREE.PointLight(0xffc890, 3.2, 3.5, 1.4);
  glow.position.set(0, 1.75, 1.0);
  const fillLow = new THREE.PointLight(0xffb070, 1.2, 2.5, 1.6);
  fillLow.position.set(0, 1.0, 0.8);
  group.add(fillLow);
  group.add(glow);

  // the chip
  const chip = add(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.8, roughness: 0.3 }), 0, TOP_Y + 0.1, -0.13);
  chip.rotation.x = Math.PI / 2;
  chip.visible = false;

  let drop = null;
  let flash = -1;
  let flashSlot = -1;

  function update(dt, t) {
    lights.forEach((l, k) => (l.material.emissiveIntensity = flash > 0 && k === flashSlot ? (Math.floor(t * 12) % 2 ? 4 : 0.5) : 0.3 + 0.2 * Math.max(0, Math.sin(t * 2 - k * 0.5))));
    if (flash > 0) flash -= dt;
    if (!drop) return;
    drop.t += dt;
    const seg = drop.segs[drop.i];
    const u = Math.min(1, drop.t / seg.dur);
    chip.position.x = seg.x0 + (seg.x1 - seg.x0) * u;
    chip.position.y = seg.y0 + (seg.y1 - seg.y0) * u * u + Math.sin(u * Math.PI) * seg.hop;
    chip.rotation.y += dt * 8 * (seg.x1 > seg.x0 ? -1 : 1);
    if (u >= 1) {
      drop.t = 0;
      drop.onPeg?.(drop.i);
      drop.i++;
      if (drop.i >= drop.segs.length) {
        flash = 2;
        flashSlot = drop.slot;
        const r = drop.resolve;
        drop = null;
        r();
      }
    }
  }

  return {
    group,
    update,
    setTable,
    /** Drop the chip along a path of 0/1 bounces. */
    drop(path, onPeg) {
      const segs = [];
      let k = 0;
      let x = 0;
      let y = TOP_Y + 0.09;
      // fall onto the top peg
      segs.push({ x0: 0, x1: 0, y0: y, y1: TOP_Y + 0.022, hop: 0, dur: 0.22 });
      y = TOP_Y + 0.022;
      path.forEach((d, r) => {
        k += d;
        const nx = (k - (r + 1) / 2) * S;
        const ny = r + 1 < ROWS ? TOP_Y - (r + 1) * S + 0.022 : BIN_Y - 0.01;
        segs.push({ x0: x, x1: nx, y0: y, y1: ny, hop: 0.018, dur: Math.max(0.09, 0.16 - r * 0.005) });
        x = nx;
        y = ny;
      });
      chip.position.set(0, TOP_Y + 0.09, -0.13);
      chip.visible = true;
      return new Promise((resolve) => {
        drop = { segs, i: 0, t: 0, resolve, onPeg, slot: k };
      });
    },
    hideChip() {
      chip.visible = false;
    },
    labelPos: () => group.localToWorld(new THREE.Vector3(0, BIN_Y - 0.2, 0)),
  };
}
