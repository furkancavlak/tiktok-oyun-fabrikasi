#!/usr/bin/env node
/* Hazır araba modellerini oyuna gömülebilir düz betiğe çevirir: kitaplik/araba-modelleri.js (genel ARABA_MODELLERI).
 *
 *   node araclar/kitaplik-araba.js            kitaplik/kenney-car-kit/ → kitaplik/araba-modelleri.js
 *   node araclar/kitaplik-araba.js --incele   üretmez; her modelin renk hücrelerini (alan payıyla) yazar
 *
 * Girdi: Kenney "Car Kit" 3.1 (CC0, kitaplik/kenney-car-kit/License.txt): GLB dosyaları ve ortak renk dokusu
 * (Textures/colormap.png). Kodu yok, yalnız veri okunur; ağ yok, bağımlılık yok (PNG'yi node'un zlib'i açar).
 * Çıktı: her model için gövde, cam ve tekerlek konumları; köşe başına konum (Int16), normal (Int8), renk (RGB) ve
 * "boya" işareti (izleyicinin rengini alan köşe), üçgen dizini (Uint16). Hepsi base64 metin: oyun.html tek dosya kalır.
 * Dokuyu gömmeyiz: her köşenin rengi derlemede dokudan okunur (Kenney'in paleti zaten düz renk şeritleridir).
 * Eksenler oyununkine çevrilir (Kenney: +z ileri, +x sol; oyun: +x ileri, +z sağ) ve ölçek oyunun metresine getirilir.
 * Aynı girdi her seferinde aynı çıktıyı verir.
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const KOK = path.join(__dirname, '..');
const KAYNAK = path.join(KOK, 'kitaplik', 'kenney-car-kit');

// Oyunun kasa tipine karşılık gelen model, ölçeği ve renk kuralları.
// olcek: [ileri, yukarı, yan] (oyunun eksenlerinde). Kenney arabaları oyuncak oranlıdır (kısa, tombul); oyunun
// şeritleri 4,3 m boyunda, 1,7 m eninde arabaya göre kuruldu, bu yüzden boy biraz daha çok uzatılır.
// Tekerlek her zaman eşit ölçeklenir (yuvarlak kalsın), yeri gövdeyle birlikte uzar.
const MODELLER = {
  // seksenlerin dört kapılı sedanı (Şahin / Doğan duruşuna en yakın olanı)
  sedan: { dosya: 'sedan.glb', olcek: [1.6, 1.15, 1.15] },
  // Kenney'in adı "suv-luxury" ama silüeti uzun tavanlı bir station wagon: oyunun kombisi
  kombi: { dosya: 'suv-luxury.glb', olcek: [1.55, 1.15, 1.15] },
  // panelvan / minibüs
  van: { dosya: 'van.glb', olcek: [1.55, 1.25, 1.18] }
};
const TEKER_OLCEK = 1.1;

/* ---- GLB okuma (yalnız veri: JSON + ikili tampon) ---- */
function glbOku(dosya) {
  const b = fs.readFileSync(dosya);
  if (b.readUInt32LE(0) !== 0x46546c67)
    hata(dosya + ': GLB değil.');
  let o = 12, json = null, bin = null;
  while (o < b.length) {
    const uz = b.readUInt32LE(o), tur = b.readUInt32LE(o + 4), veri = b.subarray(o + 8, o + 8 + uz);
    if (tur === 0x4e4f534a)
      json = JSON.parse(veri.toString('utf8'));
    else if (tur === 0x004e4942)
      bin = veri;
    o += 8 + uz;
  }
  const erisim = i => {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
    const bilesen = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const tip = { 5126: ['readFloatLE', 4], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4], 5121: ['readUInt8', 1] }[a.componentType];
    if (!tip)
      hata(dosya + ': bilinmeyen bileşen türü ' + a.componentType);
    const adim = bv.byteStride || bilesen * tip[1], bas = (bv.byteOffset || 0) + (a.byteOffset || 0), out = [];
    for (let k = 0; k < a.count; k++)
      for (let c = 0; c < bilesen; c++)
        out.push(bin[tip[0]](bas + k * adim + c * tip[1]));
    return out;
  };
  const parcalar = [];
  for (const n of json.nodes) {
    if (n.mesh === undefined)
      continue;
    if (n.rotation && Math.abs(n.rotation[3] - 1) > 1e-6 || n.scale && n.scale.some(s => Math.abs(s - 1) > 1e-6))
      hata(dosya + ': ' + n.name + ' döndürülmüş ya da ölçeklenmiş; bu araç yalnız ötelemeyi destekler.');
    const t = n.translation || [0, 0, 0];
    for (const p of json.meshes[n.mesh].primitives) {
      const P = erisim(p.attributes.POSITION), N = erisim(p.attributes.NORMAL), UV = erisim(p.attributes.TEXCOORD_0);
      const I = p.indices !== undefined ? erisim(p.indices) : [...Array(P.length / 3).keys()];
      parcalar.push({ ad: n.name, t, P, N, UV, I });
    }
  }
  return parcalar;
}

/* ---- PNG okuma (8 bit RGBA/RGB, taramasız) ---- */
function pngOku(dosya) {
  const b = fs.readFileSync(dosya);
  let o = 8, w = 0, h = 0, renkTur = 0;
  const idat = [];
  while (o < b.length) {
    const uz = b.readUInt32BE(o), tur = b.toString('ascii', o + 4, o + 8), veri = b.subarray(o + 8, o + 8 + uz);
    if (tur === 'IHDR') {
      w = veri.readUInt32BE(0);
      h = veri.readUInt32BE(4);
      renkTur = veri[9];
      if (veri[8] !== 8 || veri[12] !== 0 || (renkTur !== 6 && renkTur !== 2))
        hata(dosya + ': yalnız 8 bit RGB/RGBA, taramasız PNG okunur.');
    }
    else if (tur === 'IDAT')
      idat.push(veri);
    o += 12 + uz;
  }
  const bpp = renkTur === 6 ? 4 : 3, ham = zlib.inflateSync(Buffer.concat(idat)), satir = w * bpp, px = Buffer.alloc(w * h * 4);
  const onceki = Buffer.alloc(satir), simdi = Buffer.alloc(satir);
  for (let y = 0; y < h; y++) {
    const f = ham[y * (satir + 1)], s = ham.subarray(y * (satir + 1) + 1, (y + 1) * (satir + 1));
    for (let x = 0; x < satir; x++) {
      const a = x >= bpp ? simdi[x - bpp] : 0, u = onceki[x], c = x >= bpp ? onceki[x - bpp] : 0;
      let v = s[x];
      if (f === 1) v += a;
      else if (f === 2) v += u;
      else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) {
        const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c;
      }
      simdi[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      px[(y * w + x) * 4] = simdi[x * bpp];
      px[(y * w + x) * 4 + 1] = simdi[x * bpp + 1];
      px[(y * w + x) * 4 + 2] = simdi[x * bpp + 2];
      px[(y * w + x) * 4 + 3] = bpp === 4 ? simdi[x * bpp + 3] : 255;
    }
    simdi.copy(onceki);
  }
  return { w, h, px };
}

/* ---- dönüştürme ---- */
// Dokunun renk hücresi: 16 sütun × 4 satır şerit (Kenney paleti). Hücre numarası satır × 16 + sütun.
const hucre = (u, v) => Math.min(3, Math.floor(v * 4)) * 16 + Math.min(15, Math.floor(u * 16));
function renkOku(doku, u, v) {
  const x = Math.min(doku.w - 1, Math.max(0, Math.floor(u * doku.w))), y = Math.min(doku.h - 1, Math.max(0, Math.floor(v * doku.h)));
  const i = (y * doku.w + x) * 4;
  return [doku.px[i], doku.px[i + 1], doku.px[i + 2]];
}
// Üçgenlerin hücre başına toplam alanı: boyalı hücre, gövdenin en büyük alanlı renkli hücresidir.
function hucreAlan(p) {
  const alan = new Map();
  for (let i = 0; i < p.I.length; i += 3) {
    const [a, b, c] = [p.I[i], p.I[i + 1], p.I[i + 2]].map(k => [p.P[k * 3], p.P[k * 3 + 1], p.P[k * 3 + 2]]);
    const ab = a.map((x, j) => b[j] - x), ac = a.map((x, j) => c[j] - x);
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const s = Math.hypot(...cr) / 2, k = p.I[i];
    const h = hucre(p.UV[k * 2], p.UV[k * 2 + 1]);
    alan.set(h, (alan.get(h) || 0) + s);
  }
  return [...alan.entries()].sort((a, b) => b[1] - a[1]);
}
const parlaklik = r => 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2];
const doygunluk = r => (Math.max(...r) - Math.min(...r)) / Math.max(1, Math.max(...r));
// Cam hücresi: Kenney camları paletin son satırındaki açık mavi beyaz şerittir (49). Cam ayrı geometri olur: oyunda
// yarı saydam çizilir, sürücü ve yolcu görünür.
const CAM_HUCRE = new Set([49]);

function modelCevir(ad, M, doku) {
  const parcalar = glbOku(path.join(KAYNAK, M.dosya));
  const govdeP = parcalar.filter(p => p.ad === 'body'), tekerP = parcalar.filter(p => /^wheel-(front|back)-(left|right)$/.test(p.ad));
  if (!govdeP.length || tekerP.length !== 4)
    hata(M.dosya + ': "body" ve dört "wheel-*" parçası bekleniyordu (' + parcalar.map(p => p.ad).join(', ') + ').');
  // boyalı hücre: gövdenin en büyük alanlı, doygun rengi (gri, siyah, cam değil)
  const alanlar = hucreAlan(govdeP[0]);
  const boyaHucre = M.boya !== undefined ? M.boya : alanlar.map(a => a[0]).find(h => !CAM_HUCRE.has(h) && (() => {
    const r = renkOku(doku, ((h % 16) + 0.25) / 16, (Math.floor(h / 16) + 0.5) / 4);
    return doygunluk(r) > 0.3 && parlaklik(r) > 60;
  })());
  const [sx, sy, sz] = M.olcek;
  // Kenney (x sol, y yukarı, z ileri) → oyun (x ileri, y yukarı, z sağ): oyunX = kz, oyunZ = -kx
  const cevir = (x, y, z) => [z * sx, y * sy, -x * sz];
  const cevirN = (x, y, z) => {
    // eşit olmayan ölçekte normal ters ölçekle döner
    const n = [z / sx, y / sy, -x / sz], l = Math.hypot(...n) || 1;
    return n.map(v => v / l);
  };
  const govde = { P: [], N: [], C: [], B: [], I: [] }, cam = { P: [], N: [], C: [], B: [], I: [] };
  let boyaRenk = null;
  const noktalar = []; // [hücre, x, y, z]: ölçü için (far, stop, plaka, cam, tavan)
  for (const p of govdeP) {
    const harita = new Map();
    for (let i = 0; i < p.I.length; i += 3) {
      const k0 = p.I[i], h = hucre(p.UV[k0 * 2], p.UV[k0 * 2 + 1]), hedef = CAM_HUCRE.has(h) ? cam : govde;
      for (let j = 0; j < 3; j++) {
        const k = p.I[i + j], anahtar = (hedef === cam ? 'c' : 'g') + k;
        if (!harita.has(anahtar)) {
          const u = p.UV[k * 2], v = p.UV[k * 2 + 1], renk = renkOku(doku, u, v), boyali = hedef === govde && hucre(u, v) === boyaHucre;
          if (boyali && !boyaRenk)
            boyaRenk = renkOku(doku, ((boyaHucre % 16) + 0.25) / 16, (Math.floor(boyaHucre / 16) + 0.5) / 4);
          harita.set(anahtar, hedef.P.length / 3);
          hedef.P.push(...cevir(p.P[k * 3] + p.t[0], p.P[k * 3 + 1] + p.t[1], p.P[k * 3 + 2] + p.t[2]));
          hedef.N.push(...cevirN(p.N[k * 3], p.N[k * 3 + 1], p.N[k * 3 + 2]));
          if (boyali) {
            // boyalı köşe: rengin yerine gölgesi (şeridin degradesi) kalır; izleyicinin rengiyle çarpılır
            // degrade yumuşatılır: koyu renkli izleyicinin arabasının alt yarısı simsiyah olmasın
            const g = 0.45 + 0.55 * Math.min(1, parlaklik(renk) / Math.max(1, parlaklik(boyaRenk)));
            hedef.C.push(...[g, g, g].map(x => Math.round(x * 255)));
          }
          else
            hedef.C.push(...renk);
          hedef.B.push(boyali ? 1 : 0);
          noktalar.push([hedef === cam ? 'cam' : hucre(u, v), ...hedef.P.slice(-3)]);
        }
        hedef.I.push(harita.get(anahtar));
      }
    }
  }
  // tekerlekler: konumları (oyunun ekseninde). Tekerlek eşit ölçeklenir ve yere basar (merkezi yarıçap kadar yukarıda);
  // gövde yukarı doğru biraz daha çok uzadığı için kemerin üstünde boşluk kalır: zıplamada lastik gövdeye girmez.
  const tekerler = tekerP.map(p => cevir(p.t[0], p.t[1], p.t[2]));
  const xs = [...new Set(tekerler.map(t => +t[0].toFixed(3)))].sort((a, b) => b - a);
  const r0 = Math.max(...tekerP[0].P.filter((_, i) => i % 3 === 1).map(Math.abs));
  // gövdenin ölçüleri: oyunun KASA kaydına benzer bilgiler oyunda bunlardan kurulur
  const kutu = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
  for (let i = 0; i < govde.P.length; i += 3)
    for (let j = 0; j < 3; j++) {
      kutu.min[j] = Math.min(kutu.min[j], govde.P[i + j]);
      kutu.max[j] = Math.max(kutu.max[j], govde.P[i + j]);
    }
  // Ölçüler: renk hücresinin köşelerinin kutusu, arabanın dört çeyreğinde (ön/arka × sol/sağ). Kenney'de far sarı (51),
  // stop kırmızı (53), plaka beyaz (45) şerittir; oyun kendi ışıklarını ve plakasını bunların üstüne koyar.
  const bolgeKutu = (secim) => {
    const k = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], n: 0 };
    for (const q of noktalar)
      if (secim(q)) {
        k.n++;
        for (let j = 0; j < 3; j++) {
          k.min[j] = Math.min(k.min[j], q[j + 1]);
          k.max[j] = Math.max(k.max[j], q[j + 1]);
        }
      }
    return k.n ? { min: k.min.map(v => +v.toFixed(3)), max: k.max.map(v => +v.toFixed(3)) } : null;
  };
  const olcu = {};
  for (const h of [45, 51, 53])
    for (const [ad, sx_] of [['on', 1], ['arka', -1]])
      olcu[h + ad] = bolgeKutu(q => q[0] === h && Math.sign(q[1]) === sx_ && q[3] > 0);
  olcu.cam = bolgeKutu(q => q[0] === 'cam');
  olcu.tavan = bolgeKutu(q => q[0] !== 'cam' && q[2] > kutu.max[1] - 0.05);
  olcu.kaput = olcu.cam && bolgeKutu(q => q[0] !== 'cam' && q[1] > olcu.cam.max[0] + 0.05);
  olcu.bagaj = olcu.cam && bolgeKutu(q => q[0] !== 'cam' && q[1] < olcu.cam.min[0] - 0.05);
  return {
    ad, kaynak: M.dosya, boyaHucre, boyaRenk, alanlar: alanlar.slice(0, 8),
    govde, cam, tekerler, tekerX: [xs[0], xs[xs.length - 1]], tekerY: +(r0 * TEKER_OLCEK).toFixed(3), tekerZ: Math.abs(tekerler[0][2]),
    tekerR: +(r0 * TEKER_OLCEK).toFixed(3), kutu, olcu
  };
}
function tekerCevir(doku) {
  // sol ön tekerlek (kendi merkezinde): dış yüzü +z (sağ) yerine -z'ye bakar; oyunda sağdakiler 180° döndürülür
  const p = glbOku(path.join(KAYNAK, 'sedan.glb')).find(q => q.ad === 'wheel-front-left');
  const G = { P: [], N: [], C: [], B: [], I: p.I.slice() };
  const s = TEKER_OLCEK;
  for (let k = 0; k < p.P.length / 3; k++) {
    G.P.push(p.P[k * 3 + 2] * s, p.P[k * 3 + 1] * s, -p.P[k * 3] * s);
    G.N.push(p.N[k * 3 + 2], p.N[k * 3 + 1], -p.N[k * 3]);
    G.C.push(...renkOku(doku, p.UV[k * 2], p.UV[k * 2 + 1]));
    G.B.push(0);
  }
  return G;
}

/* ---- sıkıştırma: base64 tamsayı dizileri ---- */
function paketle(G) {
  const kutu = [0, 1, 2].map(j => {
    let a = 1e9, b = -1e9;
    for (let i = j; i < G.P.length; i += 3) {
      a = Math.min(a, G.P[i]);
      b = Math.max(b, G.P[i]);
    }
    return [a, b];
  });
  const P = new Int16Array(G.P.length);
  for (let i = 0; i < G.P.length; i++) {
    const [a, b] = kutu[i % 3];
    P[i] = Math.round(((G.P[i] - a) / Math.max(1e-6, b - a)) * 65535 - 32768);
  }
  const N = Int8Array.from(G.N, v => Math.round(v * 127));
  const C = Uint8Array.from(G.C), B = Uint8Array.from(G.B);
  if (G.P.length / 3 > 65535)
    hata('65535 köşeden çok.');
  const I = Uint16Array.from(G.I);
  const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  return { kutu: kutu.map(k => k.map(v => +v.toFixed(4))), p: b64(P), n: b64(N), c: b64(C), b: b64(B), i: b64(I) };
}

function hata(ileti) { console.error(ileti); process.exit(1); }

const doku = pngOku(path.join(KAYNAK, 'Textures', 'colormap.png'));
const modeller = Object.entries(MODELLER).map(([ad, M]) => modelCevir(ad, M, doku));
if (process.argv.includes('--incele')) {
  for (const m of modeller) {
    console.log(m.ad, m.kaynak, 'boya hücresi', m.boyaHucre, m.boyaRenk, 'köşe', m.govde.P.length / 3, '+ cam', m.cam.P.length / 3);
    console.log('  alanlar', m.alanlar.map(([h, a]) => h + ':' + a.toFixed(2) + ' ' + renkOku(doku, ((h % 16) + 0.25) / 16, (Math.floor(h / 16) + 0.5) / 4)).join(' | '));
    console.log('  kutu', JSON.stringify(m.kutu), 'teker x', m.tekerX, 'y', m.tekerY, 'z', m.tekerZ, 'r', m.tekerR);
    console.log('  ölçü', JSON.stringify(m.olcu));
  }
  process.exit(0);
}
const lisans = fs.readFileSync(path.join(KAYNAK, 'License.txt'), 'utf8').replace(/\r\n/g, '\n').replace(/\t/g, '  ').replace(/\*\//g, '* /').trim();
const veri = { kaynak: 'Kenney Car Kit 3.1 (www.kenney.nl), CC0 1.0', teker: paketle(tekerCevir(doku)), modeller: {} };
for (const m of modeller)
  veri.modeller[m.ad] = {
    kaynak: m.kaynak, govde: paketle(m.govde), cam: paketle(m.cam), tekerX: m.tekerX.map(v => +v.toFixed(3)), tekerY: +m.tekerY.toFixed(3),
    tekerZ: +m.tekerZ.toFixed(3), tekerR: m.tekerR, kutu: { min: m.kutu.min.map(v => +v.toFixed(3)), max: m.kutu.max.map(v => +v.toFixed(3)) },
    olcu: m.olcu
  };
const metin = JSON.stringify(veri);
if (/<\/script|<!--|<script/i.test(metin))
  hata('Çıktıda "</script", "<!--" ya da "<script" geçiyor: sayfaya gömülemez.');
const cikti = '/*\n * Hazır araba modelleri: Kenney Car Kit 3.1 (sedan, suv-luxury, van, tekerlek), CC0.\n * Lisans metni (kitaplik/kenney-car-kit/License.txt):\n *\n' +
  lisans.split('\n').map(s => ' * ' + s.trimEnd()).join('\n') + '\n */\n' +
  '/* Bu dosya üretilir: node araclar/kitaplik-araba.js. Kaynak: kitaplik/kenney-car-kit/*.glb, Textures/colormap.png. */\n' +
  'var ARABA_MODELLERI = ' + metin + ';\n';
fs.writeFileSync(path.join(KOK, 'kitaplik', 'araba-modelleri.js'), cikti);
console.log('kitaplik/araba-modelleri.js yazıldı (' + cikti.length + ' karakter, ' + modeller.length + ' model).');
