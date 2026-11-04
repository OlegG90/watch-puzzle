// Draws the app icons from code: a gold gear on the dark bench, written as plain
// PNGs with nothing but zlib, so no image tooling is needed.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const png = (size, rgb) => {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  rgb.copy(raw);
  for (let y = size - 1; y >= 0; y -= 1) {
    const row = y * (size * 3 + 1);
    rgb.copy(raw, row + 1, y * size * 3, (y + 1) * size * 3);
    raw[row] = 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const BENCH = [0x17, 0x12, 0x0c];
const GOLD = [0xe6, 0xbd, 0x5a];
const DEEP = [0x8f, 0x66, 0x1e];
const RUBY = [0xc4, 0x0f, 0x3c];
const TEETH = 14;

/** The colour at a point; `scale` is the gear's outer radius as a fraction of half the icon. */
function shade(nx, ny, scale) {
  const r = Math.hypot(nx, ny) / scale;
  const a = Math.atan2(ny, nx);
  const tooth = Math.cos(a * TEETH) > 0;
  if (r < 0.14) return RUBY;
  if (r < 0.22) return DEEP;
  if (r > (tooth ? 1 : 0.84)) return BENCH;
  if (r > 0.3 && r < 0.68) {
    const spoke = Math.abs(Math.sin(a * 2.5)) < 0.2;
    return spoke ? GOLD : BENCH;
  }
  return r > 0.68 && r < 0.72 ? DEEP : GOLD;
}

function draw(size, scale) {
  const rgb = Buffer.alloc(size * size * 3);
  const SS = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sum = [0, 0, 0];
      for (let i = 0; i < SS * SS; i += 1) {
        const sx = x + ((i % SS) + 0.5) / SS;
        const sy = y + (Math.floor(i / SS) + 0.5) / SS;
        const c = shade((sx / size) * 2 - 1, (sy / size) * 2 - 1, scale);
        for (let k = 0; k < 3; k += 1) sum[k] += c[k];
      }
      for (let k = 0; k < 3; k += 1) rgb[(y * size + x) * 3 + k] = Math.round(sum[k] / (SS * SS));
    }
  }
  return png(size, rgb);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', draw(192, 0.86));
writeFileSync('icons/icon-512.png', draw(512, 0.86));
// Launchers crop maskable icons to a circle or squircle: stay inside the safe zone.
writeFileSync('icons/icon-maskable-512.png', draw(512, 0.68));
