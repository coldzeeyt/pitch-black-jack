// A roulette wheel set into the felt: a turned wooden bowl, a spinning rotor with numbered
// pockets and brass frets, a brass turret, and an ivory ball that runs the track the other way
// before dropping into the drawn pocket.
import * as THREE from 'three';
import { label, colorOf } from './roulette.js';

const R_BOWL = 0.47;
const R_ROTOR = 0.33;
const R_POCKET = 0.265;
const R_TRACK = 0.405;

function wheelTexture(order) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const n = order.length;
  const d = (Math.PI * 2) / n;
  const px = (r) => (r / R_ROTOR) * (S / 2);
  ctx.fillStyle = '#2a170c';
  ctx.fillRect(0, 0, S, S);
  // numbered ring and pocket floors
  order.forEach((num, i) => {
    const a = -i * d; // canvas angles run the other way (y is flipped in the texture)
    const col = colorOf(num) === 'red' ? '#8e1b1b' : colorOf(num) === 'green' ? '#1f6b3a' : '#141414';
    for (const [r0, r1, shade] of [[R_POCKET + 0.008, R_ROTOR - 0.004, 1], [0.205, R_POCKET + 0.008, 0.7]]) {
      ctx.beginPath();
      ctx.arc(cx, cx, px(r1), a - d / 2, a + d / 2);
      ctx.arc(cx, cx, px(r0), a + d / 2, a - d / 2, true);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.globalAlpha = shade;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(cx + Math.cos(a) * px(R_POCKET + 0.034), cx + Math.sin(a) * px(R_POCKET + 0.034));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#efe6d0';
    ctx.font = `bold ${Math.round(px(0.03))}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label(num), 0, 0);
    ctx.restore();
  });
  // inner cone
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, px(0.205));
  g.addColorStop(0, '#5a3418');
  g.addColorStop(1, '#2b170a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cx, px(0.205), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b38b40';
  ctx.lineWidth = 6;
  for (const r of [0.205, R_POCKET + 0.008, R_ROTOR - 0.004]) {
    ctx.beginPath();
    ctx.arc(cx, cx, px(r), 0, Math.PI * 2);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createRouletteWheel({ tableY, position = new THREE.Vector3(0, 0, 0.95) }) {
  const group = new THREE.Group();
  group.position.set(position.x, tableY, position.z);
  group.visible = false;
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a3a1c, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb38b40, roughness: 0.3, metalness: 0.85 });

  // bowl: a turned wooden rim sloping down to the ball track
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(
      [[R_ROTOR + 0.005, 0.02], [R_TRACK - 0.02, 0.035], [R_TRACK + 0.03, 0.06], [R_BOWL, 0.075], [R_BOWL + 0.02, 0.07], [R_BOWL + 0.02, 0.0]].map(
        ([r, y]) => new THREE.Vector2(r, y),
      ),
      96,
    ),
    wood,
  );
  bowl.receiveShadow = true;
  bowl.castShadow = true;
  group.add(bowl);
  // brass deflectors on the track
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dfl = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), brass);
    dfl.scale.set(1, 0.6, 2);
    dfl.position.set(Math.cos(a) * (R_TRACK - 0.005), 0.04, -Math.sin(a) * (R_TRACK - 0.005));
    dfl.rotation.y = a;
    group.add(dfl);
  }

  let order = [];
  let rotorFace = null;
  const rotor = new THREE.Group();
  rotor.position.y = 0.02;
  group.add(rotor);
  const frets = new THREE.Group();
  rotor.add(frets);

  function build(newOrder) {
    order = newOrder;
    if (rotorFace) {
      rotor.remove(rotorFace);
      rotorFace.material.map.dispose();
      rotorFace.material.dispose();
    }
    rotorFace = new THREE.Mesh(new THREE.CircleGeometry(R_ROTOR, 96), new THREE.MeshStandardMaterial({ map: wheelTexture(order), roughness: 0.4 }));
    rotorFace.rotation.x = -Math.PI / 2;
    rotorFace.receiveShadow = true;
    rotor.add(rotorFace);
    frets.clear();
    const d = (Math.PI * 2) / order.length;
    for (let i = 0; i < order.length; i++) {
      const a = i * d + d / 2;
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.016, 0.003), brass);
      f.position.set(Math.cos(a) * (R_POCKET - 0.025), 0.008, -Math.sin(a) * (R_POCKET - 0.025));
      f.rotation.y = a;
      frets.add(f);
    }
  }

  // turret with a cross handle
  const turret = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.09, 24), brass);
  turret.position.y = 0.05;
  rotor.add(turret);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), brass);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = (i * Math.PI) / 2;
    arm.position.set(Math.cos((i * Math.PI) / 2) * 0.045, 0.085, -Math.sin((i * Math.PI) / 2) * 0.045);
    rotor.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), brass);
    knob.position.set(Math.cos((i * Math.PI) / 2) * 0.09, 0.085, -Math.sin((i * Math.PI) / 2) * 0.09);
    rotor.add(knob);
  }

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.013, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf4efe3, roughness: 0.15 }));
  ball.castShadow = true;
  group.add(ball);

  // animation
  let rotorAngle = 0;
  let rotorSpeed = 0.25; // idle drift, radians/s
  let spin = null;
  let ballAngle = 0;
  let ballR = R_TRACK;
  let ballLocked = -1; // pocket index the ball sits in, if any

  const ease = (u) => 1 - Math.pow(1 - u, 3);

  function placeBall(angle, r, y) {
    ball.position.set(Math.cos(angle) * r, y, -Math.sin(angle) * r);
  }

  function update(dt) {
    if (!group.visible) return;
    if (spin) {
      spin.t += dt;
      const t = spin.t;
      // rotor slows gently through the spin
      rotorSpeed = spin.w0 * Math.max(0.12, 1 - (t / spin.total) * 0.85);
      rotorAngle += rotorSpeed * dt;
      const lock = rotorAngle + spin.pocketAngle;
      if (t < spin.land) {
        const u = t / spin.land;
        const free = spin.b0 - spin.travel * ease(u);
        // ball rides the track, then spirals in and rattles over the frets
        const inward = u < 0.72 ? 0 : (u - 0.72) / 0.28;
        ballR = R_TRACK - (R_TRACK - R_POCKET) * inward * inward;
        const rattle = inward > 0 ? Math.abs(Math.sin(inward * 22)) * 0.012 * (1 - inward) : 0;
        ballAngle = free;
        placeBall(ballAngle, ballR, 0.045 - inward * 0.02 + rattle);
        if (inward > 0 && Math.floor(inward * 7) !== spin.lastClick) {
          spin.lastClick = Math.floor(inward * 7);
          spin.onClick?.();
        }
      } else {
        ballLocked = spin.index;
        ballAngle = lock;
        placeBall(ballAngle, R_POCKET, 0.026);
        if (!spin.done) {
          spin.done = true;
          spin.onLand?.();
        }
        if (t >= spin.total) {
          const r = spin.resolve;
          spin = null;
          r();
        }
      }
    } else {
      rotorSpeed += (0.25 - rotorSpeed) * Math.min(1, dt * 0.5);
      rotorAngle += rotorSpeed * dt;
      if (ballLocked >= 0) placeBall(rotorAngle + (ballLocked * Math.PI * 2) / order.length, R_POCKET, 0.026);
    }
    rotor.rotation.y = rotorAngle;
  }

  return {
    group,
    update,
    setWheel(newOrder) {
      build(newOrder);
      ballLocked = -1;
      placeBall(0, R_TRACK, 0.045);
    },
    show() {
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    worldPos: () => group.getWorldPosition(new THREE.Vector3()),
    /** Spin and land the ball in pocket `index` (position on the wheel). */
    spin(index, { onClick, onLand } = {}) {
      const d = (Math.PI * 2) / order.length;
      const land = 4.6;
      const total = land + 1.6;
      const w0 = 2.2;
      // where the pocket will be (rotor angle at landing) so the ball can be aimed at it
      let ra = rotorAngle;
      {
        let s = 0;
        const steps = Math.ceil(land / 0.004);
        const h = land / steps;
        for (let i = 0; i < steps; i++) {
          s += h;
          ra += w0 * Math.max(0.12, 1 - (s / total) * 0.85) * h;
        }
      }
      const pocketAngle = index * d;
      const target = ra + pocketAngle;
      const b0 = ballAngle;
      let travel = b0 - target;
      travel = ((travel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      travel += Math.PI * 2 * 6; // six laps the other way round
      ballLocked = -1;
      return new Promise((resolve) => {
        spin = { t: 0, land, total, w0, b0, travel, pocketAngle, index, resolve, onClick, onLand, lastClick: -1, done: false };
      });
    },
  };
}
