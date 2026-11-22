import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blurMasked, boxToPx, coverCrop, containSize, dilate, enhance, inpaint, levelBounds } from './imageOps';
import { initials, slugName, specChips } from './studioRender';

const solid = (w: number, h: number, rgb: [number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return data;
};

test('coverCrop memotong tengah sesuai rasio tujuan', () => {
  assert.deepEqual(coverCrop(2000, 1000, 1080, 1080), { sx: 500, sy: 0, sw: 1000, sh: 1000 });
  assert.deepEqual(coverCrop(1000, 2000, 1080, 1080, 0), { sx: 0, sy: 0, sw: 1000, sh: 1000 });
  assert.deepEqual(containSize(2000, 1000, 1000, 1000), { x: 0, y: 250, w: 1000, h: 500 });
});

test('boxToPx mengubah kotak 0–1000 ke piksel dengan kelonggaran', () => {
  assert.deepEqual(boxToPx([100, 200, 300, 400], 1000, 1000, 0), { x: 200, y: 100, w: 200, h: 200 });
  const r = boxToPx([0, 0, 100, 100], 1000, 1000, 0.5);
  assert.equal(r.x, 0);
  assert.equal(r.w, 150);
});

test('inpaint menambal area bertanda dengan warna sekitarnya', () => {
  const w = 40;
  const h = 30;
  const data = solid(w, h, [200, 180, 160]);
  const mask = new Uint8Array(w * h);
  for (let y = 10; y < 20; y++)
    for (let x = 15; x < 25; x++) {
      mask[y * w + x] = 1;
      const p = (y * w + x) * 4;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
    }
  inpaint({ data, width: w, height: h }, mask);
  const p = (15 * w + 20) * 4;
  assert.ok(Math.abs(data[p] - 200) < 8 && Math.abs(data[p + 1] - 180) < 8 && Math.abs(data[p + 2] - 160) < 8);
});

test('dilate memperlebar mask', () => {
  const mask = new Uint8Array(25);
  mask[12] = 1;
  const out = dilate(mask, 5, 5, 1);
  assert.equal(out.reduce((a, b) => a + b, 0), 9);
});

test('blurMasked hanya mengubah area bertanda', () => {
  const w = 20;
  const h = 20;
  const data = solid(w, h, [255, 255, 255]);
  for (let i = 0; i < w * 4; i += 4) data[i] = data[i + 1] = data[i + 2] = 0; // baris hitam di atas
  const mask = new Uint8Array(w * h);
  mask[1 * w + 5] = 1;
  const before = data[(10 * w + 10) * 4];
  blurMasked({ data, width: w, height: h }, mask, 1);
  assert.equal(data[(10 * w + 10) * 4], before);
  assert.ok(data[(1 * w + 5) * 4] < 255);
});

test('levelBounds & enhance meratakan foto yang pudar', () => {
  const w = 10;
  const h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const v = 100 + (p % 50);
    data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = v;
    data[p * 4 + 3] = 255;
  }
  const [lo, hi] = levelBounds(data);
  assert.ok(lo >= 100 && hi <= 149);
  enhance({ data, width: w, height: h }, { sharpen: 0, autoLevel: 1, vibrance: 0 });
  const vals = Array.from({ length: w * h }, (_, p) => data[p * 4]);
  assert.ok(Math.min(...vals) < 10 && Math.max(...vals) > 245);
});

test('specChips, initials, slugName', () => {
  assert.deepEqual(specChips({ lt: '120', lb: '90', kt: '3', km: '' }), ['LT 120 m²', 'LB 90 m²', '3 KT']);
  assert.equal(initials('monika sari dewi'), 'MS');
  assert.equal(initials(''), 'B');
  assert.equal(slugName('Rumah Hook  Citra Gran!'), 'rumah-hook-citra-gran');
  assert.equal(slugName('***', 'foto'), 'foto');
});

test('compressToTarget menjaga resolusi dan mencari kualitas tertinggi di bawah target', async () => {
  const { compressToTarget, formatBytes } = await import('./compress');
  // Ukuran tiruan: sebanding luas gambar × kualitas.
  const enc = async (scale: number, q: number) => ({ blob: { size: Math.round(5_000_000 * scale * scale * q) }, scale, q });
  const a = await compressToTarget(3_000_000, enc);
  assert.equal(a.scale, 1);
  assert.ok(a.blob.size <= 3_000_000 && a.q > 0.55);
  const b = await compressToTarget(300 * 1024, enc);
  assert.ok(b.scale < 1 && b.blob.size <= 300 * 1024);
  assert.equal(formatBytes(300 * 1024), '300 KB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1,5 MB');
});
