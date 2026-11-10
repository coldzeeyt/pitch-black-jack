// Glacier Edge, on the table: a long slab of glacier ice ending at a lip over black water,
// payout bands painted near the edge, and the tin penguin sliding on his belly.
import * as THREE from 'three';
import { buildPenguin } from './thinice3d.js';

const PX_PER_M = 512;
const ZONE_COLORS = ['#ff4a3a', '#ffbf3a', '#7fe08a', '#5ed0e0', '#9fb4c8'];

export function createGlacier({ tableY, z = 1.12, rules }) {
  const L = rules.length;
  const W = 0.44;
  const startX = -L / 2 - 0.12;
  const edgeX = startX + L;
  const top = tableY + 0.06;
  const group = new THREE.Group();
  group.visible = false;

  // the slab, with payout bands painted on its top face near the edge
  const c = document.createElement('canvas');
  c.width = Math.round(L * PX_PER_M);
  c.height = Math.round(W * PX_PER_M);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, c.width, 0);
  g.addColorStop(0, '#cfe9f4');
  g.addColorStop(1, '#9fd0e6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.35})`;
    ctx.lineWidth = Math.random() * 2;
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }
  // bands, widest first so the narrow ones paint on top
  const zones = rules.zones;
  for (let i = zones.length - 1; i >= 0; i--) {
    const x0 = c.width - zones[i].within * PX_PER_M;
    ctx.fillStyle = ZONE_COLORS[i] + 'aa';
    ctx.fillRect(x0, 0, c.width - x0, c.height);
    ctx.fillStyle = ZONE_COLORS[i];
    ctx.fillRect(x0, 0, 6, c.height);
  }
  // start line
  ctx.fillStyle = 'rgba(20,20,20,0.6)';
  for (let y = 0; y < c.height; y += 24) ctx.fillRect(40 + ((y / 24) % 2) * 12, y, 12, 12);
  const topTex = new THREE.CanvasTexture(c);
  topTex.colorSpace = THREE.SRGBColorSpace;
  topTex.anisotropy = 8;
  const iceSide = new THREE.MeshStandardMaterial({ color: 0x8cc4dc, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85 });
  const iceTop = new THREE.MeshStandardMaterial({ map: topTex, color: 0xa9cfdc, roughness: 0.2, metalness: 0.1, emissive: 0x0e2c38, emissiveIntensity: 0.2 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, W), [iceSide, iceSide, iceTop, iceSide, iceSide, iceSide]);
  slab.position.set(startX + L / 2, tableY + 0.03, z);
  slab.receiveShadow = true;
  slab.castShadow = true;
  group.add(slab);
  // jagged lip at the edge
  for (let i = 0; i < 7; i++) {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06 + Math.random() * 0.05, 4), iceSide);
    shard.position.set(edgeX + 0.01, tableY + 0.03, z - W / 2 + (i + 0.5) * (W / 7));
    shard.rotation.z = -Math.PI / 2;
    group.add(shard);
  }

  // black water past the edge, with drifting floes
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x041018, roughness: 0.05, metalness: 0.5, emissive: 0x08303f, emissiveIntensity: 0.35 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.9), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(edgeX + 0.38, tableY + 0.004, z);
  group.add(water);
  const floes = Array.from({ length: 3 }, (_, i) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + i * 0.015, 0.06 + i * 0.015, 0.015, 6), iceSide);
    f.position.set(edgeX + 0.2 + i * 0.2, tableY + 0.01, z - 0.25 + i * 0.22);
    group.add(f);
    return f;
  });

  // penguin, lying on his belly, facing the water
  const peng = buildPenguin();
  const holder = new THREE.Group();
  holder.add(peng.group);
  peng.group.rotation.set(Math.PI / 2 - 0.12, 0, 0); // tipped forward onto the belly
  peng.group.position.set(0, 0.075, -0.02);
  holder.rotation.order = 'ZYX'; // so the nose-dip at the edge turns about the world z axis
  holder.rotation.y = Math.PI / 2; // nose toward +x (the edge)
  group.add(holder);

  // ice spray when braking, water spray when he goes in
  const sprayMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.8 });
  const spray = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.006 + Math.random() * 0.006, 6, 4), sprayMat.clone());
    m.visible = false;
    group.add(m);
    return { m, v: new THREE.Vector3(), life: 0 };
  });
  let sprayIdx = 0;
  function emit(x, y, zz, vx, vy, spread) {
    const s = spray[sprayIdx++ % spray.length];
    s.m.visible = true;
    s.m.position.set(x, y, zz + (Math.random() - 0.5) * 0.12);
    s.v.set(vx + (Math.random() - 0.5) * spread, vy + Math.random() * spread, (Math.random() - 0.5) * spread);
    s.life = 0.6;
  }

  let fall = null;
  let lastBrake = false;

  function reset() {
    holder.visible = true;
    holder.position.set(startX + 0.05, top, z);
    holder.rotation.set(0, Math.PI / 2, 0);
    fall = null;
    spray.forEach((s) => (s.m.visible = false));
  }

  function update(dt, t) {
    if (!group.visible) return;
    waterMat.emissiveIntensity = 0.3 + Math.sin(t * 1.7) * 0.08;
    floes.forEach((f, i) => {
      f.position.y = tableY + 0.008 + Math.sin(t * 1.3 + i) * 0.004;
      f.rotation.y += dt * 0.1 * (i % 2 ? 1 : -1);
    });
    peng.key.rotation.z += dt * 2;
    for (const s of spray) {
      if (!s.m.visible) continue;
      s.life -= dt;
      s.v.y -= 4 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.material.opacity = Math.max(0, s.life / 0.6);
      if (s.life <= 0) s.m.visible = false;
    }
    if (fall) {
      fall.t += dt;
      const p = Math.min(1, fall.t / 0.9);
      holder.position.x = fall.x + fall.v * fall.t * 0.6;
      holder.position.y = top - p * p * 0.35;
      holder.rotation.z = -p * 1.4; // nose dips into the water
      if (fall.t > 0.25 && !fall.splashed) {
        fall.splashed = true;
        for (let i = 0; i < 26; i++) emit(holder.position.x, tableY + 0.02, z, 0, 0.8, 0.9);
      }
      if (p >= 1) {
        holder.visible = false;
        const r = fall.resolve;
        fall = null;
        r();
      }
    }
  }

  return {
    group,
    update,
    reset,
    show() {
      group.visible = true;
      reset();
    },
    hide() {
      group.visible = false;
    },
    /** World position for a distance along the glacier (metres from the start line). */
    at: (x, y = top) => new THREE.Vector3(startX + x, y, z),
    zoneLabelPos: (i) => {
      const inner = i + 1 < zones.length ? zones[i + 1].within : 0;
      // label each band at its middle, measured back from the edge
      const outer = zones[i].within;
      const mid = i === 0 ? outer / 2 : (outer + zones[i - 1].within) / 2;
      void inner;
      return new THREE.Vector3(edgeX - mid, tableY, z + W / 2 + 0.07);
    },
    /** Move the penguin to x metres along the glacier at speed v. */
    pose(x, v, braking, dt) {
      if (fall) return;
      holder.position.x = startX + 0.05 + x;
      holder.position.y = top + Math.sin(x * 25) * 0.002 * Math.min(1, v);
      holder.rotation.x = Math.sin(x * 9) * 0.05 * Math.min(1, v); // wobble as he skims
      peng.flippers.forEach((f, i) => (f.rotation.z = (i ? 1 : -1) * (braking ? 1.2 : 0.3)));
      if (braking && v > 0.2 && Math.random() < dt * 60) {
        emit(holder.position.x + 0.1, top + 0.01, z, v * 0.4, 0.4, 0.5);
        emit(holder.position.x + 0.1, top + 0.01, z, v * 0.4, 0.3, 0.5);
      }
      lastBrake = braking;
    },
    plunge(x, v) {
      return new Promise((resolve) => {
        fall = { t: 0, x: startX + 0.05 + x, v: Math.max(0.4, v), resolve, splashed: false };
      });
    },
    get braking() {
      return lastBrake;
    },
  };
}
