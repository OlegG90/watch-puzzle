// Shared materials, with finishes drawn on canvas so nothing has to be downloaded.

import * as THREE from 'three';

/** Côtes de Genève: the broad, gently shaded stripes on a fine watch's bridges. */
function genevaStripes(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const stripes = 12;
  const w = size / stripes;
  for (let i = 0; i < stripes; i += 1) {
    const grad = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.5, '#cfcfcf');
    grad.addColorStop(1, '#fff');
    ctx.fillStyle = grad;
    ctx.fillRect(i * w, 0, w + 1, size);
  }
  return canvasTexture(canvas, 1 / 40);
}

/** Perlage: overlapping circular grains, the classic finish for a mainplate. */
function perlage(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 0, size, size);
  const step = size / 16;
  for (let row = 0; row <= 16; row += 1) {
    for (let col = 0; col <= 16; col += 1) {
      const x = col * step + (row % 2) * step * 0.5;
      const y = row * step;
      const grad = ctx.createRadialGradient(x - step * 0.2, y - step * 0.2, 1, x, y, step * 0.72);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.75, '#e2e2e2');
      grad.addColorStop(1, '#bdbdbd');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvasTexture(canvas, 1 / 12);
}

/** ExtrudeGeometry's UVs are in millimetres, so repeat sets the print scale. */
function canvasTexture(canvas, repeat) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createMaterials() {
  const metal = (color, roughness = 0.32, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, ...extra });
  return {
    plate: metal(0xc79a3c, 0.5, { map: perlage() }),
    bridge: metal(0xd8ab48, 0.38, { map: genevaStripes() }),
    gold: metal(0xdba93a, 0.28),
    brass: metal(0xc99a3e, 0.34),
    wheel: metal(0xe0b552, 0.3),
    steel: metal(0x9da2aa, 0.38),
    darkSteel: metal(0x6d7178, 0.35),
    blued: metal(0x4468dc, 0.3),
    dark: new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.8 }),
    ruby: new THREE.MeshStandardMaterial({ color: 0xc40f3c, roughness: 0.1, metalness: 0.2 }),
    black: new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.4, metalness: 0.5 }),
    hand: metal(0x2c46b4, 0.3),
    // Unlit on purpose: a real reflection here would wash out the whole dial.
    glass: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.03,
      depthWrite: false,
    }),
  };
}

/** The enamel dial, with Roman hours and a small seconds track. */
export function createDialTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const scale = size / 40; // mm → px, the dial being 40 mm across

  const enamel = ctx.createRadialGradient(c, c * 0.7, 0, c, c, c);
  enamel.addColorStop(0, '#fffdf6');
  enamel.addColorStop(1, '#f3ecd9');
  ctx.fillStyle = enamel;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#1c1c22';
  ctx.fillStyle = '#1c1c22';
  ctx.translate(c, c);

  const track = (radius, count, every, long, short) => {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const major = i % every === 0;
      const len = (major ? long : short) * scale;
      ctx.lineWidth = (major ? 0.14 : 0.06) * scale;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * radius, -Math.cos(a) * radius);
      ctx.lineTo(Math.sin(a) * (radius - len), -Math.cos(a) * (radius - len));
      ctx.stroke();
    }
  };

  track(18.8 * scale, 60, 5, 1, 0.5);
  ctx.lineWidth = 0.08 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, 18.9 * scale, 0, Math.PI * 2);
  ctx.stroke();

  // Upright numerals, except the one the seconds dial replaces.
  const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', '', 'VII', 'VIII', 'IX', 'X', 'XI'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  numerals.forEach((text, i) => {
    if (!text) return;
    const a = (i / 12) * Math.PI * 2;
    const r = 14.6 * scale;
    ctx.save();
    ctx.translate(Math.sin(a) * r, -Math.cos(a) * r);
    ctx.rotate(a);
    ctx.font = `600 ${3.1 * scale}px Georgia, 'Times New Roman', serif`;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  });

  ctx.save();
  ctx.translate(0, 11 * scale);
  ctx.lineWidth = 0.08 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2);
  ctx.stroke();
  track(3.9 * scale, 60, 5, 0.55, 0.28);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
