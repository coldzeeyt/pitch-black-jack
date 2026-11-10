// Jack, the dealer. A tall, thin man in a three-piece suit, built piece by piece with smooth
// shading and real proportions, standing on his own two legs behind the table, with a fedora
// pulled low so his face is only ever a shadow. Arms use two-bone IK with fixed bone lengths,
// so he reaches for cards instead of stretching.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const SCULPT_NOISE = false; // true gives him a hand-carved, faceted look

/** Deterministic per-vertex nudge so pieces read as carved, not generated. Shared vertices move together. */
function chisel(geo, amount, seed = 1) {
  if (!SCULPT_NOISE) {
    geo.computeVertexNormals();
    return geo;
  }
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h =
      Math.sin(Math.round(v.x * 1e4) * 12.9898 + Math.round(v.y * 1e4) * 78.233 + Math.round(v.z * 1e4) * 37.719 + seed) *
      43758.5453;
    v.multiplyScalar(1 + ((h - Math.floor(h)) * 2 - 1) * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Flat plate cut from a 2D outline (lapels, bow tie, hat band bow). */
function plate(points, depth) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

export const PALETTE = {
  jacket: 0x1b191c,
  jacketLight: 0x2c282e,
  vest: 0x2b2226,
  shirt: 0xcfc6b4,
  tie: 0x6a1717,
  hat: 0x141114,
  hatBand: 0x3a1114,
  skin: 0xb3a191,
  skinDark: 0x8f7d6f,
  shadow: 0x0a0809,
  brass: 0xb38b40,
};

/**
 * @param {object} opts
 * @param {number} opts.tableY  height of the felt; hands rest on it
 */
export function createJack({ tableY = 0.92 } = {}) {
  const P = PALETTE;
  const m = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, flatShading: false, ...extra });
  const M = {
    jacket: m(P.jacket),
    jacketLight: m(P.jacketLight, { roughness: 0.32 }), // satin lapels
    vest: m(P.vest, { roughness: 0.6 }),
    shirt: m(P.shirt),
    tie: m(P.tie, { roughness: 0.5 }),
    hat: m(P.hat, { roughness: 0.95 }),
    band: m(P.hatBand),
    skin: m(P.skin),
    skinDark: m(P.skinDark),
    shadow: m(P.shadow, { roughness: 1 }),
    brass: m(P.brass, { metalness: 0.7, roughness: 0.35 }),
  };

  const root = new THREE.Group();
  root.name = 'Jack';

  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // The upper body pivots at the waist so he can lean and turn toward the shoe.
  const waist = new THREE.Group();
  waist.position.set(0, 0.95, 0);
  root.add(waist);

  // ---- torso ------------------------------------------------------------------------------
  // Profile (radius, height above the waist). Narrow waist, full chest, square shoulders.
  const torsoProfile = [
    [0.0, 0.0], [0.165, 0.0], [0.17, 0.12], [0.19, 0.28], [0.205, 0.4], [0.2, 0.48], [0.16, 0.54], [0.07, 0.58], [0.0, 0.58],
  ];
  const lathe = (profile, grow, segs, gap = 0) =>
    new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r ? r + grow : 0, y)),
      segs,
      gap / 2,
      Math.PI * 2 - gap,
    );
  const shirt = add(chisel(lathe(torsoProfile, 0, 40), 0.012, 2), M.shirt, waist);
  shirt.scale.set(1, 1, 0.62);
  const vest = add(chisel(lathe(torsoProfile.slice(0, 7), 0.012, 40), 0.012, 3), M.vest, waist);
  vest.scale.set(1, 1, 0.64);
  const jacket = add(chisel(lathe(torsoProfile.slice(0, 8), 0.03, 40, 1.1), 0.015, 4), M.jacket, waist);
  jacket.material.side = THREE.DoubleSide;
  jacket.scale.set(1.04, 1, 0.68);

  // Notched lapels: flat plates lying on the chest, angled out along the jacket opening.
  for (const s of [-1, 1]) {
    const lapel = add(
      plate([[0, 0], [0.055, 0.02], [0.085, 0.2], [0.07, 0.215], [0.085, 0.235], [0.05, 0.27], [0.018, 0.24]], 0.012),
      M.jacketLight,
      waist,
      s * 0.035,
      0.27,
      0.142,
    );
    lapel.scale.x = s;
    lapel.rotation.set(-0.16, s * 0.42, 0);
  }
  // V of white shirt showing above the vest.
  const vee = add(plate([[-0.062, 0], [0.062, 0], [0.0, -0.2]], 0.004), M.shirt, waist, 0, 0.585, 0.104);
  vee.rotation.x = -0.14;
  // Vest buttons and a pocket-watch chain.
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.008, 12, 8), M.brass, waist, 0, 0.1 + i * 0.062, 0.135);
  const chain = add(new THREE.TorusGeometry(0.055, 0.0025, 6, 24, Math.PI), M.brass, waist, 0.06, 0.14, 0.125);
  chain.rotation.set(0, -0.5, Math.PI);
  // Shirt collar points and bow tie.
  for (const s of [-1, 1]) {
    const pt = add(plate([[0, 0], [0.045, -0.012], [0.012, -0.05]], 0.008), M.shirt, waist, s * 0.012, 0.565, 0.075);
    pt.scale.x = s;
    pt.rotation.x = -0.5;
  }
  const bow = add(
    plate([[-0.05, 0.022], [-0.008, 0.006], [0.008, 0.006], [0.05, 0.022], [0.056, -0.022], [0.008, -0.006], [-0.008, -0.006], [-0.056, -0.022]], 0.014),
    M.tie,
    waist,
    0,
    0.54,
    0.088,
  );
  bow.rotation.x = -0.14;
  bow.position.set(0, 0.555, 0.112);
  add(new THREE.SphereGeometry(0.012, 16, 10), M.tie, waist, 0, 0.555, 0.117);
  // Shirt collar band around the neck.
  add(new THREE.CylinderGeometry(0.058, 0.07, 0.05, 32, 1, true), M.shirt, waist, 0, 0.575, -0.005).material.side = THREE.DoubleSide;
  // Jacket skirt below the waist, open at the front.
  const skirt = add(
    new THREE.LatheGeometry([new THREE.Vector2(0.205, -0.2), new THREE.Vector2(0.19, -0.08), new THREE.Vector2(0.195, 0.02)], 40, 0.7, Math.PI * 2 - 1.4),
    M.jacket,
    waist,
  );
  skirt.material = M.jacket;
  skirt.scale.set(1.04, 1, 0.7);
  // Pocket square, a sliver of red.
  const square = add(plate([[0, 0], [0.04, 0], [0.032, 0.025], [0.02, 0.012], [0.008, 0.028]], 0.006), M.tie, waist, -0.155, 0.33, 0.1);
  square.rotation.y = 0.6;

  // Shoulders: squared off, padded.
  const shoulderGeo = new THREE.SphereGeometry(0.085, 32, 20);
  for (const s of [-1, 1]) {
    const sh = add(shoulderGeo, M.jacket, waist, s * 0.175, 0.505, -0.005);
    sh.scale.set(1.25, 0.42, 0.95);
  }

  // ---- hips + legs (they stay planted while the upper body leans) ----------------------------
  const trousers = m(0x1f1c20, { roughness: 0.75 });
  const shoeMat = m(0x0a0909, { roughness: 0.25, metalness: 0.1 });
  const pelvis = add(new THREE.SphereGeometry(0.17, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), trousers, root, 0, 0.98, 0);
  pelvis.scale.set(1.0, 0.9, 0.68);
  pelvis.rotation.x = Math.PI;
  add(new THREE.CylinderGeometry(0.166, 0.166, 0.05, 40), m(0x111012, { roughness: 0.4 }), root, 0, 0.96, 0).scale.set(1, 1, 0.66); // belt
  for (const s of [-1, 1]) {
    // thigh: hip to knee, a touch forward; shin: knee to ankle
    const hip = new THREE.Vector3(s * 0.09, 0.9, 0);
    const knee = new THREE.Vector3(s * 0.1, 0.5, 0.025);
    const ankle = new THREE.Vector3(s * 0.105, 0.085, 0.0);
    for (const [a, b, r1, r2] of [[hip, knee, 0.088, 0.064], [knee, ankle, 0.062, 0.05]]) {
      const geo = new THREE.CylinderGeometry(r2, r1, 1, 28);
      const leg = add(geo, trousers, root);
      leg.position.lerpVectors(a, b, 0.5);
      leg.quaternion.setFromUnitVectors(UP, new THREE.Vector3().subVectors(a, b).normalize());
      leg.scale.y = a.distanceTo(b);
    }
    add(new THREE.SphereGeometry(0.06, 20, 14), trousers, root, knee.x, knee.y, knee.z);
    // trouser crease cuff and a polished oxford shoe
    add(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 28), trousers, root, ankle.x, 0.1, ankle.z);
    const shoe = add(new THREE.SphereGeometry(0.06, 28, 16), shoeMat, root, s * 0.108, 0.045, 0.06);
    shoe.scale.set(0.85, 0.62, 2.1);
    const heel = add(new THREE.BoxGeometry(0.08, 0.035, 0.06), shoeMat, root, s * 0.108, 0.018, -0.03);
    heel.castShadow = true;
  }

  // ---- neck + head ---------------------------------------------------------------------------
  add(new THREE.CylinderGeometry(0.048, 0.056, 0.11, 24), M.shadow, waist, 0, 0.62, -0.01);
  const head = new THREE.Group();
  head.position.set(0, 0.75, 0.0);
  waist.add(head);
  // Skull and a long jaw, all in shadow: the hat hides whatever face he has.
  const skull = add(chisel(new THREE.SphereGeometry(0.105, 40, 28), 0.035, 21), M.shadow, head, 0, 0.02, -0.01);
  skull.scale.set(0.86, 1.06, 1.0);
  const jaw = add(chisel(new THREE.SphereGeometry(0.075, 32, 20), 0.05, 22), M.shadow, head, 0, -0.055, 0.025);
  jaw.scale.set(0.95, 1.1, 1.05);
  for (const s of [-1, 1]) {
    const ear = add(new THREE.SphereGeometry(0.026, 16, 12), M.shadow, head, s * 0.093, 0.0, -0.005);
    ear.scale.set(0.4, 1.2, 0.8);
  }
  // A cigarette: the one light on his face.
  const cig = add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.075, 12), M.shirt, head, 0.032, -0.07, 0.115);
  cig.rotation.set(Math.PI / 2 + 0.35, 0, -0.35);
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff5a1a, emissiveIntensity: 3 });
  const ember = add(new THREE.SphereGeometry(0.006, 10, 8), emberMat, head, 0.045, -0.083, 0.148);
  ember.castShadow = false;
  const emberLight = new THREE.PointLight(0xff6a2a, 0.02, 0.12, 2);
  emberLight.position.set(0.045, -0.083, 0.16);
  head.add(emberLight);

  // ---- fedora ----------------------------------------------------------------------------------
  const hat = new THREE.Group();
  hat.position.set(0, 0.075, 0.005);
  hat.rotation.x = 0.2; // tipped forward over the eyes
  head.add(hat);
  // Brim: a lathe with a slight upward curl at the edge, front and back snapped down.
  const brimGeo = new THREE.LatheGeometry(
    [[0.095, 0.004], [0.15, 0.0], [0.205, 0.0], [0.235, 0.01], [0.24, 0.016], [0.235, 0.008], [0.2, -0.008], [0.15, -0.008], [0.095, -0.004]].map(
      ([r, y]) => new THREE.Vector2(r, y),
    ),
    64,
  );
  {
    const p = brimGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 0.12) {
        const front = z / r; // 1 at the front, -1 at the back
        const snap = (front > 0 ? front * 0.55 : -front * 0.25) * (r - 0.12);
        const curl = Math.pow(Math.abs(x / r), 3) * (r - 0.12) * 0.35; // sides roll up
        p.setY(i, p.getY(i) - snap + curl);
      }
    }
    brimGeo.computeVertexNormals();
  }
  const brim = add(chisel(brimGeo, 0.01, 51), M.hat, hat);
  brim.material.side = THREE.DoubleSide;
  brim.scale.set(1, 1, 1.12);
  // Crown: tapered, with a center crease and two front pinches.
  const crownGeo = new THREE.LatheGeometry(
    [[0.0, 0.14], [0.05, 0.142], [0.085, 0.13], [0.1, 0.09], [0.108, 0.03], [0.11, 0.0], [0.0, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)),
    56,
  );
  {
    const p = crownGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      if (y > 0.1) {
        const crease = Math.exp(-(x * x) / 0.0012) * 0.035; // teardrop dent down the middle
        const pinch = z > 0.03 ? Math.exp(-((Math.abs(x) - 0.05) ** 2) / 0.0006) * (z - 0.03) * 0.5 : 0;
        p.setY(i, y - crease * ((y - 0.1) / 0.04) - pinch);
      }
    }
    crownGeo.computeVertexNormals();
  }
  const crown = add(chisel(crownGeo, 0.012, 52), M.hat, hat);
  crown.scale.set(1, 1, 1.15);
  const band = add(new THREE.CylinderGeometry(0.111, 0.112, 0.026, 56, 1, true), M.band, hat, 0, 0.014, 0);
  band.scale.set(1, 1, 1.15);
  band.material.side = THREE.DoubleSide;
  const knot = add(plate([[0, 0.012], [0.03, 0.006], [0.03, -0.012], [0, -0.006]], 0.006), M.band, hat, -0.1, 0.014, 0.04);
  knot.rotation.y = -1.1;

  // ---- arms --------------------------------------------------------------------------------------
  const UPPER = 0.31;
  const FORE = 0.29;
  const upperGeo = new THREE.CylinderGeometry(0.045, 0.054, 1, 28);
  upperGeo.translate(0, -0.5, 0); // pivot at the shoulder, bone runs along -Y
  const foreGeo = new THREE.CylinderGeometry(0.036, 0.046, 1, 28);
  foreGeo.translate(0, -0.5, 0);
  const elbowGeo = new THREE.SphereGeometry(0.047, 24, 16);

  function makeHand(side) {
    // Built palm-down in a frame where +Z points out along the fingers.
    const hand = new THREE.Group();
    const palm = add(new THREE.SphereGeometry(0.05, 24, 16), M.skin, hand, 0, 0, 0.045);
    palm.scale.set(0.78, 0.28, 0.92);
    const knuckle = add(new THREE.CapsuleGeometry(0.011, 0.05, 4, 12), M.skin, hand, 0, 0.003, 0.082);
    knuckle.rotation.z = Math.PI / 2;
    // Four long fingers, each two segments, curling over the felt.
    const fingerLens = [0.05, 0.058, 0.055, 0.044];
    fingerLens.forEach((len, i) => {
      const x = (i - 1.5) * 0.018;
      const f1 = new THREE.Group();
      f1.position.set(x, 0, 0.086);
      f1.rotation.set(0.25, (i - 1.5) * 0.06, 0);
      hand.add(f1);
      const p1 = add(new THREE.CapsuleGeometry(0.0072, len * 0.55 - 0.012, 4, 12), M.skin, f1, 0, 0, len * 0.275);
      p1.rotation.x = Math.PI / 2;
      const f2 = new THREE.Group();
      f2.position.set(0, 0, len * 0.55);
      f2.rotation.x = 0.55;
      f1.add(f2);
      const p2 = add(new THREE.CapsuleGeometry(0.0065, len * 0.45 - 0.01, 4, 12), M.skin, f2, 0, 0, len * 0.225);
      p2.rotation.x = Math.PI / 2;
    });
    const t1 = new THREE.Group();
    t1.position.set(-side * 0.036, -0.004, 0.03);
    t1.rotation.set(0.2, -side * 0.7, 0);
    hand.add(t1);
    const tp1 = add(new THREE.CapsuleGeometry(0.0085, 0.025, 4, 12), M.skin, t1, 0, 0, 0.02);
    tp1.rotation.x = Math.PI / 2;
    const t2 = new THREE.Group();
    t2.position.set(0, 0, 0.04);
    t2.rotation.y = side * 0.35;
    t1.add(t2);
    const tp2 = add(new THREE.CapsuleGeometry(0.0075, 0.018, 4, 12), M.skin, t2, 0, 0, 0.015);
    tp2.rotation.x = Math.PI / 2;
    // Shirt cuff and a brass cufflink at the wrist.
    const cuff = add(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 24), M.shirt, hand, 0, 0.004, -0.008);
    cuff.rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.007, 12, 8), M.brass, hand, side * 0.04, 0.004, -0.008);
    return hand;
  }

  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Vector3(side * 0.205, 0.49, 0.0); // in waist space
    const upper = add(upperGeo, M.jacket, waist);
    const fore = add(foreGeo, M.jacket, waist);
    const elbow = add(elbowGeo, M.jacket, waist);
    const hand = makeHand(side);
    waist.add(hand);
    // Hands rest on the felt just in front of him, slightly turned in.
    const rest = new THREE.Vector3(side * 0.3, tableY + 0.025, 0.28);
    return { side, shoulder, upper, fore, elbow, hand, rest, target: rest.clone(), pos: rest.clone() };
  });

  // ---- animation ---------------------------------------------------------------------------------
  const tmp = new THREE.Vector3();
  const local = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const elbowPos = new THREE.Vector3();
  const wrist = new THREE.Vector3();
  const look = new THREE.Vector3(0, 1.5, 3);
  const lookSmoothed = look.clone();
  let lean = 0;
  let yaw = 0;

  function solveArm(arm) {
    // Work in waist space so the arms follow the body's lean and turn.
    local.copy(arm.pos);
    root.localToWorld(local); // arm.pos is in root space; convert to world
    waist.worldToLocal(local);
    dir.subVectors(local, arm.shoulder);
    const reach = UPPER + FORE - 0.002;
    let d = dir.length();
    if (d > reach) {
      dir.multiplyScalar(reach / d);
      d = reach;
    }
    wrist.copy(arm.shoulder).add(dir);
    const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
    dir.normalize();
    // Elbows point out and back, the way a dealer holds his arms.
    pole.set(arm.side * 0.9, -0.35, -0.7);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    elbowPos.copy(arm.shoulder).addScaledVector(dir, a).addScaledVector(pole, h);

    arm.upper.position.copy(arm.shoulder);
    tmp.subVectors(arm.shoulder, elbowPos).normalize(); // bone runs along -Y, so +Y points back up
    arm.upper.quaternion.setFromUnitVectors(UP, tmp);
    arm.upper.scale.set(1, UPPER, 1);
    arm.elbow.position.copy(elbowPos);
    arm.fore.position.copy(elbowPos);
    tmp.subVectors(elbowPos, wrist).normalize();
    arm.fore.quaternion.setFromUnitVectors(UP, tmp);
    arm.fore.scale.set(1, FORE, 1);
    // Hand lies flat, pointing the way the forearm points (projected onto the table plane).
    arm.hand.position.copy(wrist);
    tmp.subVectors(wrist, elbowPos);
    arm.hand.rotation.set(0, Math.atan2(tmp.x, tmp.z), 0);
  }

  function update(dt, t) {
    // Breathing.
    const breath = Math.sin(t * 1.15);
    shirt.scale.x = 1 + breath * 0.008;
    jacket.scale.x = 1.04 + breath * 0.008;
    // Lean and turn toward whichever hand is reaching furthest.
    let wantYaw = 0;
    let wantLean = 0.04;
    for (const arm of arms) {
      const dx = arm.target.x - arm.rest.x;
      const dz = arm.target.z - arm.rest.z;
      if (Math.abs(dx) > 0.05) wantYaw -= dx * 0.22;
      wantLean = Math.max(wantLean, THREE.MathUtils.clamp(0.04 + Math.hypot(dx, dz) * 0.18, 0, 0.3));
    }
    yaw += (THREE.MathUtils.clamp(wantYaw, -0.35, 0.35) - yaw) * Math.min(1, dt * 3);
    lean += (wantLean - lean) * Math.min(1, dt * 3);
    waist.rotation.set(lean, -yaw, 0);
    // Head follows the look target, slowly.
    lookSmoothed.lerp(look, 1 - Math.pow(0.03, dt));
    tmp.copy(lookSmoothed);
    head.parent.worldToLocal(tmp);
    tmp.sub(head.position);
    head.rotation.y = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -0.8, 0.8);
    head.rotation.x = THREE.MathUtils.clamp(-Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)) * 0.7, -0.3, 0.5) + 0.12;
    head.rotation.z = Math.sin(t * 0.21) * 0.05;
    // Arms glide toward their targets.
    for (const arm of arms) {
      arm.pos.lerp(arm.target, 1 - Math.pow(0.0008, dt));
      solveArm(arm);
    }
    // The cigarette breathes with him.
    emberMat.emissiveIntensity = 2.2 + Math.max(0, Math.sin(t * 0.45)) * 3 + Math.random() * 0.3;
    emberLight.intensity = 0.01 + Math.max(0, Math.sin(t * 0.45)) * 0.03;
  }

  const worldToRoot = (p) => root.worldToLocal(p.clone());

  return {
    object: root,
    update,
    /** World point the cigarette tip is at (for smoke). */
    emberWorld: (out = new THREE.Vector3()) => ember.getWorldPosition(out),
    /** Reach a hand (side: 1 right, -1 left) toward a world point; null returns it to rest. */
    reach(point, side = 1) {
      const arm = arms[side > 0 ? 1 : 0];
      if (point) arm.target.copy(worldToRoot(point)).add(new THREE.Vector3(0, 0.03, 0));
      else arm.target.copy(arm.rest);
    },
    look(point) {
      look.copy(point);
    },
  };
}
