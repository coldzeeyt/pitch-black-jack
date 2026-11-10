// 3D playing cards: rounded slabs with your own art on them.
//
// Card art is configured in assets/cards/cards.json (see assets/README.md):
//   back  - image used for every face-down card
//   face  - blank card front; the game draws rank + suit on top of it
//   ranks - optional fronts per rank, reused for all four suits (the game adds the suit symbol),
//           e.g. { "A": "A.png", "2": "2.png", ... "K": "K.png" }
//   sheet - optional "master" image with many cards in a grid, sliced automatically:
//           { "image": "master.png", "columns": 7, "rows": 2,
//             "order": ["A","2","3","4","5","6","7","8","9","10","J","Q","K","back"] }
//           Each name in `order` fills the next grid cell (left to right, top to bottom) and is
//           treated like a `ranks` entry, or the card back for "back", "face" for "face",
//           or a single card for codes like "AS".
//   cards - optional full custom fronts for individual cards, e.g. { "AS": "ace-of-spades.png" }
// Anything left null falls back to built-in placeholder art (grey back, thick black rounded border).
import * as THREE from 'three';
import { SUIT_SYMBOLS } from './blackjack.js';

export const CARD_W = 0.32; // matches the 5:8 proportions of the master sheet
export const CARD_H = 0.5;
const CARD_T = 0.006;
const CORNER = 0.055; // matches the generous rounded corners of the sketch
const TEX_W = 320;
const TEX_H = 500;
const TEX_R = (CORNER / CARD_W) * TEX_W;
const BORDER = 14;

const RED = '#8e1b1b';
const INK = '#141414';

let art = { back: null, face: null, ranks: {}, cards: {} };
const loadedImages = new Map();
const textureCache = new Map();
let anisotropy = 4;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`[cards] could not load ${src}, using placeholder art`);
      resolve(null);
    };
    img.src = src;
  });
}

/** Loads the manifest and any images it names. Never throws: missing art falls back. */
export async function loadCardArt(renderer) {
  anisotropy = renderer.capabilities.getMaxAnisotropy();
  const base = 'assets/cards/';
  let manifest = {};
  try {
    const res = await fetch(base + 'cards.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch {
    /* no manifest: placeholders */
  }
  const jobs = [];
  const want = (key, file) => {
    if (!file) return;
    jobs.push(loadImage(base + file).then((img) => img && loadedImages.set(key, img)));
  };
  jobs.push(loadImage('assets/logo-cream.png').then((img) => img && loadedImages.set('logo', img)));
  want('back', manifest.back);
  want('face', manifest.face);
  for (const [rank, file] of Object.entries(manifest.ranks || {})) want('rank:' + rank, file);
  for (const [code, file] of Object.entries(manifest.cards || {})) want('card:' + code, file);
  if (manifest.sheet && manifest.sheet.image) {
    jobs.push(
      loadImage(base + manifest.sheet.image).then((img) => {
        if (img) sliceSheet(img, manifest.sheet);
      }),
    );
  }
  await Promise.all(jobs);
  const pick = (prefix) =>
    Object.fromEntries(
      [...loadedImages].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]),
    );
  art = {
    back: loadedImages.get('back') || null,
    face: loadedImages.get('face') || null,
    logo: loadedImages.get('logo') || null,
    ranks: pick('rank:'),
    cards: pick('card:'),
  };
}

function sliceSheet(img, { columns = 1, rows = 1, order = [], gap = 0 }) {
  const cw = (img.width - gap * (columns - 1)) / columns;
  const ch = (img.height - gap * (rows - 1)) / rows;
  order.forEach((name, i) => {
    if (!name || i >= columns * rows) return;
    const col = i % columns;
    const row = Math.floor(i / columns);
    const c = trimToBorder(img, col * (cw + gap), row * (ch + gap), cw, ch);
    const n = String(name);
    let key;
    if (n === 'back' || n === 'face') key = n;
    else if (/^(A|[2-9]|10|J|Q|K)$/.test(n)) key = 'rank:' + n;
    else key = 'card:' + n;
    // Files listed explicitly in the manifest win over sheet cells.
    if (!loadedImages.has(key)) loadedImages.set(key, c);
  });
}

/**
 * Cuts one grid cell out of a sheet and trims it to the card's dark outline, so any
 * margin around the card is dropped, whether it's transparent, white, or a checkerboard
 * baked into a screenshot.
 */
function trimToBorder(img, sx, sy, sw, sh) {
  const w = Math.round(sw);
  const h = Math.round(sh);
  const cell = document.createElement('canvas');
  cell.width = w;
  cell.height = h;
  const cctx = cell.getContext('2d', { willReadFrequently: true });
  cctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  try {
    const d = cctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dark = d[i + 3] > 128 && d[i] + d[i + 1] + d[i + 2] < 240;
        if (dark) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } catch {
    /* tainted canvas: keep the full cell */
  }
  if (maxX - minX < w * 0.3 || maxY - minY < h * 0.3) return cell; // no clear outline found
  // 1) crop to the drawn outline
  const ow = maxX - minX + 1;
  const oh = maxY - minY + 1;
  const outline = document.createElement('canvas');
  outline.width = ow;
  outline.height = oh;
  const lctx = outline.getContext('2d', { willReadFrequently: true });
  lctx.drawImage(cell, minX, minY, ow, oh, 0, 0, ow, oh);
  // 2) measure how thick the outline is, then cut just inside it so the card is clean white
  const od = lctx.getImageData(0, 0, ow, oh).data;
  const isDark = (x, y) => {
    const i = (y * ow + x) * 4;
    return od[i + 3] > 128 && od[i] + od[i + 1] + od[i + 2] < 384;
  };
  const run = (x0, y0, dx, dy) => {
    let n = 0;
    let x = x0, y = y0;
    while (x >= 0 && y >= 0 && x < ow && y < oh && (isDark(x, y) || n < 1)) {
      n++;
      x += dx;
      y += dy;
      if (n > ow / 6) break;
    }
    return n;
  };
  const midY = Math.floor(oh / 2);
  const midX = Math.floor(ow / 2);
  const thick = Math.max(run(0, midY, 1, 0), run(ow - 1, midY, -1, 0), run(midX, oh - 1, 0, -1));
  const inset = Math.ceil(thick + Math.max(2, ow * 0.01));
  const out = document.createElement('canvas');
  out.width = ow - inset * 2;
  out.height = oh - inset * 2;
  const octx = out.getContext('2d', { willReadFrequently: true });
  octx.drawImage(outline, inset, inset, out.width, out.height, 0, 0, out.width, out.height);
  whitenCorners(octx, out.width, out.height);
  return out;
}

/** Paints whatever is left of the rounded outline in the four corners with the card's paper colour. */
function whitenCorners(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // paper colour, sampled from a quiet spot on the left edge halfway down
  const si = (Math.floor(h * 0.5) * w + Math.floor(w * 0.06)) * 4;
  const paper = [d[si], d[si + 1], d[si + 2]];
  const r = Math.round(w * 0.16);
  for (const [cx, cy, sx, sy] of [[r, r, 0, 0], [w - r, r, w - r, 0], [r, h - r, 0, h - r], [w - r, h - r, w - r, h - r]]) {
    for (let y = sy; y < sy + r; y++) {
      for (let x = sx; x < sx + r; x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r - 1) {
          const i = (y * w + x) * 4;
          d[i] = paper[0];
          d[i + 1] = paper[1];
          d[i + 2] = paper[2];
          d[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  return [c, c.getContext('2d')];
}

function drawCover(ctx, img) {
  ctx.drawImage(img, 0, 0, TEX_W, TEX_H);
}

function placeholderBorder(ctx, fill) {
  // clean card stock edge to edge, with a faint printed frame line
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  roundRectPath(ctx, BORDER, BORDER, TEX_W - BORDER * 2, TEX_H - BORDER * 2, TEX_R - BORDER * 0.6);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function grime(ctx, amount) {
  // A little age and dirt so the cards feel handled.
  for (let i = 0; i < amount; i++) {
    ctx.fillStyle = `rgba(40,30,20,${Math.random() * 0.05})`;
    const r = Math.random() * 18 + 2;
    ctx.beginPath();
    ctx.arc(Math.random() * TEX_W, Math.random() * TEX_H, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

export function backTexture() {
  if (textureCache.has('back')) return textureCache.get('back');
  const [c, ctx] = canvas();
  if (art.back) drawCover(ctx, art.back);
  else {
    // Placeholder in the style of the sketch: grey card, thick black rounded border.
    placeholderBorder(ctx, '#666666');
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    roundRectPath(ctx, 34, 34, TEX_W - 68, TEX_H - 68, TEX_R * 0.6);
    ctx.stroke();
    if (art.logo) {
      const h = TEX_H * 0.62;
      const w = h * (art.logo.width / art.logo.height);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(art.logo, (TEX_W - w) / 2, (TEX_H - h) / 2, w, h);
      ctx.globalAlpha = 1;
    }
    grime(ctx, 30);
  }
  const t = toTexture(c);
  textureCache.set('back', t);
  return t;
}

// Pip layouts for number cards, as [x, y] fractions of the inner area.
const PIPS = {
  2: [[0.5, 0.15], [0.5, 0.85]],
  3: [[0.5, 0.15], [0.5, 0.5], [0.5, 0.85]],
  4: [[0.28, 0.15], [0.72, 0.15], [0.28, 0.85], [0.72, 0.85]],
  5: [[0.28, 0.15], [0.72, 0.15], [0.5, 0.5], [0.28, 0.85], [0.72, 0.85]],
  6: [[0.28, 0.15], [0.72, 0.15], [0.28, 0.5], [0.72, 0.5], [0.28, 0.85], [0.72, 0.85]],
  7: [[0.28, 0.15], [0.72, 0.15], [0.5, 0.33], [0.28, 0.5], [0.72, 0.5], [0.28, 0.85], [0.72, 0.85]],
  8: [[0.28, 0.15], [0.72, 0.15], [0.5, 0.33], [0.28, 0.5], [0.72, 0.5], [0.5, 0.67], [0.28, 0.85], [0.72, 0.85]],
  9: [[0.28, 0.15], [0.72, 0.15], [0.28, 0.383], [0.72, 0.383], [0.5, 0.5], [0.28, 0.617], [0.72, 0.617], [0.28, 0.85], [0.72, 0.85]],
  10: [[0.28, 0.15], [0.72, 0.15], [0.5, 0.267], [0.28, 0.383], [0.72, 0.383], [0.28, 0.617], [0.72, 0.617], [0.5, 0.733], [0.28, 0.85], [0.72, 0.85]],
};

function drawIndex(ctx, rank, sym, color) {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic ${rank === '10' ? 42 : 50}px Palatino, "Palatino Linotype", Georgia, serif`;
  ctx.fillText(rank, 46, 62);
  ctx.font = '38px Georgia, serif';
  ctx.fillText(sym, 46, 106);
}

export function faceTexture(card) {
  const code = card.rank + card.suit;
  if (textureCache.has(code)) return textureCache.get(code);
  const [c, ctx] = canvas();
  const custom = art.cards[code];
  const rankArt = art.ranks[card.rank];
  if (custom) {
    drawCover(ctx, custom);
  } else if (rankArt) {
    // Player-drawn rank art: reuse for every suit and add small suit marks in two corners.
    drawCover(ctx, rankArt);
    const color = card.suit === 'H' || card.suit === 'D' ? RED : INK;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '60px Georgia, serif';
    ctx.fillText(SUIT_SYMBOLS[card.suit], 56, 66);
    ctx.save();
    ctx.translate(TEX_W - 56, TEX_H - 66);
    ctx.rotate(Math.PI);
    ctx.fillText(SUIT_SYMBOLS[card.suit], 0, 0);
    ctx.restore();
  } else {
    if (art.face) drawCover(ctx, art.face);
    else {
      placeholderBorder(ctx, '#fbfaf6');
      grime(ctx, 25);
    }
    const sym = SUIT_SYMBOLS[card.suit];
    const color = card.suit === 'H' || card.suit === 'D' ? RED : INK;

    // corner indices (top-left, and rotated bottom-right)
    drawIndex(ctx, card.rank, sym, color);
    ctx.save();
    ctx.translate(TEX_W, TEX_H);
    ctx.rotate(Math.PI);
    drawIndex(ctx, card.rank, sym, color);
    ctx.restore();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ix = 92, iy = 70, iw = TEX_W - 184, ih = TEX_H - 140;
    if (card.rank === 'A') {
      ctx.font = '150px Georgia, serif';
      ctx.fillText(sym, TEX_W / 2, TEX_H / 2 + 6);
    } else if (PIPS[card.rank]) {
      ctx.font = '56px Georgia, serif';
      for (const [px, py] of PIPS[card.rank]) {
        ctx.save();
        ctx.translate(ix + px * iw, iy + py * ih);
        if (py > 0.5) ctx.rotate(Math.PI);
        ctx.fillText(sym, 0, 0);
        ctx.restore();
      }
    } else {
      // Court cards: framed panel with a big letter.
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRectPath(ctx, ix - 8, iy - 4, iw + 16, ih + 8, 10);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = 'bold 130px Georgia, serif';
      ctx.fillText(card.rank, TEX_W / 2, TEX_H / 2 - 20);
      ctx.font = '60px Georgia, serif';
      ctx.fillText(sym, TEX_W / 2, TEX_H / 2 + 90);
    }
  }
  const t = toTexture(c);
  textureCache.set(code, t);
  return t;
}

function roundedShape() {
  const s = new THREE.Shape();
  const w = CARD_W / 2, h = CARD_H / 2, r = CORNER;
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}

function faceGeometry(flip) {
  const g = new THREE.ShapeGeometry(roundedShape(), 6);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let u = pos.getX(i) / CARD_W + 0.5;
    let v = pos.getY(i) / CARD_H + 0.5;
    if (flip) (u = 1 - u), (v = 1 - v);
    uv.setXY(i, u, v);
  }
  // Lie flat: front faces +Y with the card's top pointing away (-Z); back faces -Y.
  g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
  g.translate(0, flip ? -CARD_T / 2 - 0.0002 : CARD_T / 2 + 0.0002, 0);
  return g;
}

let sharedGeo = null;
function geometries() {
  if (sharedGeo) return sharedGeo;
  const edge = new THREE.ExtrudeGeometry(roundedShape(), {
    depth: CARD_T,
    bevelEnabled: false,
    curveSegments: 6,
  });
  edge.rotateX(-Math.PI / 2);
  edge.translate(0, -CARD_T / 2, 0);
  sharedGeo = { edge, front: faceGeometry(false), back: faceGeometry(true) };
  return sharedGeo;
}

const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xefebe2, roughness: 0.8 }); // white card stock edge

/** A card object. Face-up when rotation.z === 0, face-down when rotation.z === PI. */
export function createCardMesh(card) {
  const g = geometries();
  const group = new THREE.Group();
  const mat = (map) =>
    new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0.0 });
  const edge = new THREE.Mesh(g.edge, edgeMaterial);
  const front = new THREE.Mesh(g.front, mat(faceTexture(card)));
  const back = new THREE.Mesh(g.back, mat(backTexture()));
  for (const m of [edge, front, back]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  group.userData.card = card;
  return group;
}

export function disposeCardMesh(group) {
  group.traverse((o) => {
    if (o.isMesh && o.material !== edgeMaterial) o.material.dispose();
  });
}
