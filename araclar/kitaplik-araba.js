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
  van: { dosya: 'van.glb', olcek: [1.55, 1.25, 1.18] },
  // süper araba (tek seferde büyük hediye): Quaternius "Sports Car", CC0 (kitaplik/quaternius-sports-car/LICENSE.txt).
  // Düz renkli malzemeler: boya "White", cam "Windows", far "Headlights", stop "TailLights". Eni 1,84 m
  // (YOL_OLCU.arabaEn 1,85 içinde), tekerleği kendinedir ve biraz küçültülür: kemerle lastik arası 7,5 cm olsun.
  super: { kaynak: 'quaternius-sports-car', dosya: 'sports-car.glb', olcek: [1.12, 1.05, 0.98], kendiTeker: true, tekerOlcek: 0.92,
    boyaMalz: ['White'], cam: ['Windows'], farMalz: 'Headlights', stopMalz: 'TailLights' }
};
// 1,0: tekerlek Kenney'deki boyunda kalır; kemerin tepesiyle lastik arasında 9 cm (sedan, kombi), 15 cm (van) boşluk olur
// (hareket dalının süspansiyon sınırı 3,5 cm iner, YOL_OLCU'daki ölçülere sığar: araclar --incele yazar).
const TEKER_OLCEK = 1.0;

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
  // Düğümün dünya matrisi (öteleme, döndürme, ölçek; ebeveyn zinciri): köşeler ve normaller derlemede buna çevrilir.
  const ebeveyn = new Map();
  json.nodes.forEach((n, i) => (n.children || []).forEach(c => ebeveyn.set(c, i)));
  const yerel = n => {
    const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], sc = n.scale || [1, 1, 1];
    const [x, y, z, w] = q;
    const R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
    return [R[0] * sc[0], R[1] * sc[1], R[2] * sc[2], t[0], R[3] * sc[0], R[4] * sc[1], R[5] * sc[2], t[1], R[6] * sc[0], R[7] * sc[1], R[8] * sc[2], t[2]];
  };
  const carp = (A, B) => {
    const o = [];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 4; j++)
        o.push(A[i * 4] * B[j] + A[i * 4 + 1] * B[4 + j] + A[i * 4 + 2] * B[8 + j] + (j === 3 ? A[i * 4 + 3] : 0));
    return o;
  };
  const dunya = i => ebeveyn.has(i) ? carp(dunya(ebeveyn.get(i)), yerel(json.nodes[i])) : yerel(json.nodes[i]);
  const parcalar = [];
  json.nodes.forEach((n, ni) => {
    if (n.mesh === undefined)
      return;
    const M = dunya(ni);
    for (const p of json.meshes[n.mesh].primitives) {
      const P0 = erisim(p.attributes.POSITION), N0 = erisim(p.attributes.NORMAL);
      const UV = p.attributes.TEXCOORD_0 !== undefined ? erisim(p.attributes.TEXCOORD_0) : null;
      const I = p.indices !== undefined ? erisim(p.indices) : [...Array(P0.length / 3).keys()];
      const P = [], N = [];
      for (let k = 0; k < P0.length; k += 3) {
        const [x, y, z] = [P0[k], P0[k + 1], P0[k + 2]], [a, b, c] = [N0[k], N0[k + 1], N0[k + 2]];
        P.push(M[0] * x + M[1] * y + M[2] * z + M[3], M[4] * x + M[5] * y + M[6] * z + M[7], M[8] * x + M[9] * y + M[10] * z + M[11]);
        const nx = M[0] * a + M[1] * b + M[2] * c, ny = M[4] * a + M[5] * b + M[6] * c, nz = M[8] * a + M[9] * b + M[10] * c, l = Math.hypot(nx, ny, nz) || 1;
        N.push(nx / l, ny / l, nz / l);
      }
      const mz = p.material !== undefined ? json.materials[p.material] : {}, pbr = mz.pbrMetallicRoughness || {};
      // malzemenin düz rengi (doğrusal → sRGB 0..255); dokulu malzemede renk dokudan okunur
      const renk = (pbr.baseColorFactor || [1, 1, 1]).slice(0, 3).map(v => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255));
      parcalar.push({ ad: n.name, P, N, UV, I, malz: mz.name || '', renk, dokulu: !!pbr.baseColorTexture && !!UV });
    }
  });
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

function modelCevir(ad, M) {
  const kaynak = path.join(KOK, 'kitaplik', M.kaynak || 'kenney-car-kit'), doku = dokuOku(kaynak);
  const parcalar = glbOku(path.join(kaynak, M.dosya));
  // tekerlek: adında "wheel" geçen düğümler (Kenney: her tekerlek ayrı; Quaternius: arka iki tekerlek tek düğümde)
  const tekerP = parcalar.filter(p => /wheel/i.test(p.ad)), govdeP = parcalar.filter(p => !/wheel/i.test(p.ad));
  if (!govdeP.length || !tekerP.length)
    hata(M.dosya + ': gövde ve tekerlek düğümleri bulunamadı (' + parcalar.map(p => p.ad).join(', ') + ').');
  const dokulu = govdeP.some(p => p.dokulu);
  const hucreOf = (p, k) => p.dokulu ? hucre(p.UV[k * 2], p.UV[k * 2 + 1]) : -1;
  // boyalı yer: dokulu modelde gövdenin en büyük alanlı, doygun renk hücresi; düz renkli modelde M.boyaMalz malzemeleri
  const alanlar = dokulu ? hucreAlan(govdeP.find(p => p.dokulu)) : [];
  const boyaHucre = !dokulu ? null : M.boya !== undefined ? M.boya : alanlar.map(a => a[0]).find(h => !CAM_HUCRE.has(h) && (() => {
    const c = renkOku(doku, ((h % 16) + 0.25) / 16, (Math.floor(h / 16) + 0.5) / 4);
    return doygunluk(c) > 0.3 && parlaklik(c) > 60;
  })());
  const camMi = (p, k) => p.dokulu ? CAM_HUCRE.has(hucreOf(p, k)) : (M.cam || []).includes(p.malz);
  const boyaMi = (p, k) => p.dokulu ? hucreOf(p, k) === boyaHucre : (M.boyaMalz || []).includes(p.malz);
  const renkOf = (p, k) => p.dokulu ? renkOku(doku, p.UV[k * 2], p.UV[k * 2 + 1]) : p.renk;
  const [sx, sy, sz] = M.olcek;
  // Kenney / Quaternius (x sol, y yukarı, z ileri) → oyun (x ileri, y yukarı, z sağ): oyunX = kz, oyunZ = -kx
  const cevir = (x, y, z) => [z * sx, y * sy, -x * sz];
  const cevirN = (x, y, z) => {
    // eşit olmayan ölçekte normal ters ölçekle döner
    const n = [z / sx, y / sy, -x / sz], l = Math.hypot(...n) || 1;
    return n.map(v => v / l);
  };
  const govde = { P: [], N: [], C: [], B: [], I: [] }, cam = { P: [], N: [], C: [], B: [], I: [] };
  const boyaRenk = dokulu ? renkOku(doku, ((boyaHucre % 16) + 0.25) / 16, (Math.floor(boyaHucre / 16) + 0.5) / 4) : null;
  const noktalar = []; // [hücre ya da malzeme, x, y, z]: ölçü için (far, stop, plaka, cam, tavan)
  for (const p of govdeP) {
    const harita = new Map();
    for (let i = 0; i < p.I.length; i += 3) {
      const k0 = p.I[i], hedef = camMi(p, k0) ? cam : govde;
      for (let j = 0; j < 3; j++) {
        const k = p.I[i + j], anahtar = (hedef === cam ? 'c' : 'g') + k;
        if (!harita.has(anahtar)) {
          const renk = renkOf(p, k), boyali = hedef === govde && boyaMi(p, k);
          harita.set(anahtar, hedef.P.length / 3);
          hedef.P.push(...cevir(p.P[k * 3], p.P[k * 3 + 1], p.P[k * 3 + 2]));
          hedef.N.push(...cevirN(p.N[k * 3], p.N[k * 3 + 1], p.N[k * 3 + 2]));
          if (boyali) {
            // boyalı köşe: rengin yerine gölgesi (şeridin degradesi) kalır; izleyicinin rengiyle çarpılır
            // degrade yumuşatılır: koyu renkli izleyicinin arabasının alt yarısı simsiyah olmasın
            const g = dokulu ? 0.45 + 0.55 * Math.min(1, parlaklik(renk) / Math.max(1, parlaklik(boyaRenk))) : 1;
            hedef.C.push(...[g, g, g].map(x => Math.round(x * 255)));
          }
          else
            hedef.C.push(...renk);
          hedef.B.push(boyali ? 1 : 0);
          noktalar.push([hedef === cam ? 'cam' : p.dokulu ? hucreOf(p, k) : p.malz, ...hedef.P.slice(-3)]);
        }
        hedef.I.push(harita.get(anahtar));
      }
    }
  }
  // Tekerlekler: köşeleri dört çeyreğe (ön/arka × sol/sağ) ayrılır; her çeyreğin kutusunun ortası tekerleğin yeri.
  // Tekerlek eşit ölçeklenir (yuvarlak kalsın) ve yere basar (merkezi yarıçap kadar yukarıda); gövde yukarı doğru biraz
  // daha çok uzadığı için kemerin üstünde boşluk kalır: zıplamada lastik gövdeye girmez.
  const tO = M.tekerOlcek || TEKER_OLCEK, ceyrek = {};
  for (const p of tekerP)
    for (let k = 0; k < p.P.length / 3; k++) {
      const x = p.P[k * 3], y = p.P[k * 3 + 1], z = p.P[k * 3 + 2], c = (z > 0 ? 'on' : 'arka') + (x > 0 ? 'Sol' : 'Sag');
      const q = ceyrek[c] || (ceyrek[c] = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
      [x, y, z].forEach((v, j) => { q.min[j] = Math.min(q.min[j], v); q.max[j] = Math.max(q.max[j], v); });
    }
  if (Object.keys(ceyrek).length !== 4)
    hata(M.dosya + ': dört tekerlek bulunamadı (' + Object.keys(ceyrek).join(', ') + ').');
  const orta = q => q.min.map((v, j) => (v + q.max[j]) / 2), r0 = (ceyrek.onSol.max[1] - ceyrek.onSol.min[1]) / 2;
  const onX = orta(ceyrek.onSol)[2] * sx, arkaX = orta(ceyrek.arkaSol)[2] * sx;
  // tekerleğin yanal yeri (oyunun tz'si): tekerleğin iç yüzü; tekerlek geometrisi iç yüzden dışa (-z) uzanır
  const tekerZ = Math.abs(ceyrek.onSol.min[0]) * sz;
  // Kemer boşluğu: tekerleğin üstünde (lastiğin yanal genişliğinde) duran gövde köşelerinin lastiğin yüzeyine en küçük
  // dikey uzaklığı, ön ve arka aks için. Oyun bunu kemerin yarıçapı olarak kullanır (KASA.kemerR = r + boşluk): hareket
  // dalının tekerlek denetimi (tekerOlc) hazır gövdelerde de gerçek kemere göre ölçer.
  const tR = r0 * tO, tDis = tekerZ + (ceyrek.onSol.max[0] - ceyrek.onSol.min[0]) * tO;
  const kemerBosluk = [onX, arkaX].map(X => {
    let en = Infinity;
    for (let i = 0; i < govde.P.length; i += 3) {
      const dx = govde.P[i] - X, y = govde.P[i + 1], z = Math.abs(govde.P[i + 2]);
      if (Math.abs(dx) < tR * 0.95 && y > tR && z > tekerZ - 0.02 && z < tDis + 0.02)
        en = Math.min(en, y - (tR + Math.sqrt(tR * tR - dx * dx)));
    }
    return +en.toFixed(3);
  });
  // kendi tekerleği: sol ön tekerleğin üçgenleri, iç yüzü sıfırda, dış yüzü -z'de (oyunda sağdakiler yarım tur çevrilir)
  let teker = null;
  if (M.kendiTeker) {
    teker = { P: [], N: [], C: [], B: [], I: [] };
    const m = orta(ceyrek.onSol);
    for (const p of tekerP) {
      const harita = new Map();
      for (let i = 0; i < p.I.length; i += 3) {
        const a = p.I[i];
        if (!(p.P[a * 3 + 2] > 0 && p.P[a * 3] > 0))
          continue;
        for (let j = 0; j < 3; j++) {
          const k = p.I[i + j];
          if (!harita.has(k)) {
            harita.set(k, teker.P.length / 3);
            teker.P.push((p.P[k * 3 + 2] - m[2]) * tO, (p.P[k * 3 + 1] - m[1]) * tO, -(p.P[k * 3] - ceyrek.onSol.min[0]) * tO);
            teker.N.push(p.N[k * 3 + 2], p.N[k * 3 + 1], -p.N[k * 3]);
            teker.C.push(...renkOf(p, k));
            teker.B.push(0);
          }
          teker.I.push(harita.get(k));
        }
      }
    }
  }
  // gövdenin ölçüleri: oyunun KASA kaydına benzer bilgiler oyunda bunlardan kurulur
  const kutu = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
  for (let i = 0; i < govde.P.length; i += 3)
    for (let j = 0; j < 3; j++) {
      kutu.min[j] = Math.min(kutu.min[j], govde.P[i + j]);
      kutu.max[j] = Math.max(kutu.max[j], govde.P[i + j]);
    }
  // Ölçüler: renk hücresinin köşelerinin kutusu, arabanın dört çeyreğinde (ön/arka × sol/sağ). Kenney'de far sarı (51),
  // stop kırmızı (53), plaka beyaz (45) şerittir; düz renkli modelde M.farMalz / M.stopMalz / M.plakaMalz. Oyun kendi
  // ışıklarını ve plakasını bunların üstüne koyar.
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
  const olcu = {}, isikAd = { 45: M.plakaMalz || 45, 51: M.farMalz || 51, 53: M.stopMalz || 53 };
  for (const h of [45, 51, 53])
    for (const [ad, sx_] of [['on', 1], ['arka', -1]])
      olcu[h + ad] = bolgeKutu(q => q[0] === isikAd[h] && Math.sign(q[1]) === sx_ && q[3] > 0);
  olcu.cam = bolgeKutu(q => q[0] === 'cam');
  olcu.tavan = bolgeKutu(q => q[0] !== 'cam' && q[2] > kutu.max[1] - 0.05);
  olcu.kaput = olcu.cam && bolgeKutu(q => q[0] !== 'cam' && q[1] > olcu.cam.max[0] + 0.05);
  olcu.bagaj = olcu.cam && bolgeKutu(q => q[0] !== 'cam' && q[1] < olcu.cam.min[0] - 0.05);
  return {
    ad, kaynak: M.dosya, boyaHucre, boyaRenk, alanlar: alanlar.slice(0, 8),
    govde, cam, teker, tekerX: [onX, arkaX], tekerY: +(r0 * tO).toFixed(3), tekerZ,
    tekerR: +(r0 * tO).toFixed(3), kemerBosluk, tekerDis: +tDis.toFixed(3), kutu, olcu
  };
}
function tekerCevir() {
  // sol ön tekerlek (kendi merkezinde): dış yüzü +z (sağ) yerine -z'ye bakar; oyunda sağdakiler 180° döndürülür.
  // Köşeler düğümün yerine taşınmış okunur (glbOku): düğümün yeri (sedan.glb, wheel-front-left) geri çıkarılır.
  const doku = dokuOku(KAYNAK), p = glbOku(path.join(KAYNAK, 'sedan.glb')).find(q => q.ad === 'wheel-front-left');
  const G = { P: [], N: [], C: [], B: [], I: p.I.slice() };
  // iç yüz (x = 0,25) sıfıra gelir: tekerlek iç yüzünden dışa (-z) uzanır, oyunda tz iç yüzün yeridir
  const s = TEKER_OLCEK, t = [0.25, 0.3, 0.66];
  for (let k = 0; k < p.P.length / 3; k++) {
    G.P.push((p.P[k * 3 + 2] - t[2]) * s, (p.P[k * 3 + 1] - t[1]) * s, -(p.P[k * 3] - t[0]) * s);
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

const DOKULAR = new Map();
// Kaynağın renk dokusu (varsa): <kaynak>/Textures/colormap.png
function dokuOku(kaynak) {
  if (!DOKULAR.has(kaynak)) {
    const y = path.join(kaynak, 'Textures', 'colormap.png');
    DOKULAR.set(kaynak, fs.existsSync(y) ? pngOku(y) : null);
  }
  return DOKULAR.get(kaynak);
}
const modeller = Object.entries(MODELLER).map(([ad, M]) => modelCevir(ad, M));
const doku = dokuOku(KAYNAK);
if (process.argv.includes('--incele')) {
  for (const m of modeller) {
    console.log(m.ad, m.kaynak, 'boya hücresi', m.boyaHucre, m.boyaRenk, 'köşe', m.govde.P.length / 3, '+ cam', m.cam.P.length / 3);
    console.log('  alanlar', m.alanlar.map(([h, a]) => h + ':' + a.toFixed(2) + ' ' + renkOku(doku, ((h % 16) + 0.25) / 16, (Math.floor(h / 16) + 0.5) / 4)).join(' | '));
    console.log('  kutu', JSON.stringify(m.kutu), 'teker x', m.tekerX, 'y', m.tekerY, 'z', m.tekerZ, 'r', m.tekerR);
    console.log('  ölçü', JSON.stringify(m.olcu));
    console.log('  kemer boşluğu (ön, arka)', m.kemerBosluk, 'tekerlek dış yüzü', m.tekerDis, 'boy', +(m.kutu.max[0] - m.kutu.min[0]).toFixed(3), 'en', +(2 * Math.max(m.kutu.max[2], -m.kutu.min[2], m.tekerDis)).toFixed(3));
  }
  process.exit(0);
}
// Her kaynağın lisans metni çıktının başına yazılır: derlenen oyun.html kendi lisanslarını taşır.
const lisansOku = (kl, ad) => fs.readFileSync(path.join(KOK, 'kitaplik', kl, ad), 'utf8').replace(/\r\n/g, '\n').replace(/\t/g, '  ').replace(/\*\//g, '* /').trim();
const lisanslar = [['kenney-car-kit', 'License.txt']];
for (const M of Object.values(MODELLER))
  if (M.kaynak && !lisanslar.some(l => l[0] === M.kaynak))
    lisanslar.push([M.kaynak, 'LICENSE.txt']);
const lisans = lisanslar.map(([kl, ad]) => 'kitaplik/' + kl + '/' + ad + ':\n\n' + lisansOku(kl, ad)).join('\n\n');
const veri = { kaynak: 'Kenney Car Kit 3.1 (www.kenney.nl), CC0 1.0; Quaternius Sports Car (poly.pizza/m/1mkmFkAz5v), CC0 1.0', teker: paketle(tekerCevir()), modeller: {} };
for (const m of modeller)
  veri.modeller[m.ad] = {
    kaynak: m.kaynak, govde: paketle(m.govde), cam: paketle(m.cam), tekerX: m.tekerX.map(v => +v.toFixed(3)), tekerY: +m.tekerY.toFixed(3),
    tekerZ: +m.tekerZ.toFixed(3), tekerR: m.tekerR, kutu: { min: m.kutu.min.map(v => +v.toFixed(3)), max: m.kutu.max.map(v => +v.toFixed(3)) },
    kemerBosluk: m.kemerBosluk, tekerDis: m.tekerDis, olcu: m.olcu
  };
for (const m of modeller)
  if (m.teker)
    veri.modeller[m.ad].teker = paketle(m.teker);
const metin = JSON.stringify(veri);
if (/<\/script|<!--|<script/i.test(metin))
  hata('Çıktıda "</script", "<!--" ya da "<script" geçiyor: sayfaya gömülemez.');
const cikti = '/*\n * Hazır araba modelleri: Kenney Car Kit 3.1 (sedan, suv-luxury, van, tekerlek) ve Quaternius Sports Car (süper\n * araba), ikisi de CC0. Lisans metinleri:\n *\n' +
  lisans.split('\n').map(s => ' * ' + s.trimEnd()).join('\n') + '\n */\n' +
  '/* Bu dosya üretilir: node araclar/kitaplik-araba.js. Kaynak: kitaplik/kenney-car-kit/, kitaplik/quaternius-sports-car/. */\n' +
  'var ARABA_MODELLERI = ' + metin + ';\n';
fs.writeFileSync(path.join(KOK, 'kitaplik', 'araba-modelleri.js'), cikti);
console.log('kitaplik/araba-modelleri.js yazıldı (' + cikti.length + ' karakter, ' + modeller.length + ' model).');
