#!/usr/bin/env node
/* Hazır sokak modellerini (kaldırımdaki insanlar ve sokak eşyası) oyuna gömülebilir düz betiğe çevirir:
 * kitaplik/sokak-modelleri.js (genel SOKAK_MODELLERI).
 *
 *   node araclar/kitaplik-sokak.js            kitaplik/kenney-*\/ → kitaplik/sokak-modelleri.js
 *   node araclar/kitaplik-sokak.js --incele   üretmez; her modelin ölçüsünü, köşe ve üçgen sayısını yazar
 *
 * Girdiler (hepsi Kenney, CC0; her paketin License.txt'si kendi klasöründe):
 *   kitaplik/kenney-mini-characters/   Mini Characters 2.0: altı karakter (iskeletli GLB) ve renk dokusu
 *   kitaplik/kenney-city-kit-roads/    City Kit (Roads) 2.2: sokak lambası, trafik ışığı, çöp konteyneri, sokak tabelası
 *   kitaplik/kenney-holiday-kit/       Holiday Kit 2.0: yalnız bank (yılbaşı eşyası alınmadı)
 *   kitaplik/kenney-city-kit-suburban/ City Kit (Suburban) 2.0: yalnız saksılık (planter)
 * Kodu yok, yalnız veri okunur; ağ yok, bağımlılık yok (PNG'yi node'un zlib'i açar).
 *
 * İnsanlar: iskelet çalışma anında OYNATILMAZ. Kenney karakterinin yedi kemiği (kök, iki bacak, gövde, iki kol, baş)
 * her köşeyi tek bir kemiğe bağlar; araç köşeleri o kemiğin eklemine göre yazar (Int16) ve oranları burada düzeltir:
 * bacak ve gövde uzar, baş küçülür (Kenney'in "mini" karakteri arabanın yanında dev kafalı bir bebek gibi duruyordu).
 * Pozlar (ayakta, kollar havada, alkış iki karesi, el sallama) eklem dönüşleri olarak yazılır; oyun bunları
 * yüklenirken BİR KEZ uygulayıp her karakter ve poz için düz (iskeletsiz) bir geometri kurar.
 * Eşya: düz geometri; köşe rengi dokudan okunur (Kenney paleti düz renk şeritleridir, doku gömülmez).
 * Eksenler oyunun yol kenarı çerçevesine çevrilir: yerel +z yola doğru (öne bakan yüz), +y yukarı; ölçek metredir.
 * Aynı girdi her seferinde aynı çıktıyı verir.
 *
 * Not: GLB ve PNG okuyucuları araclar/kitaplik-araba.js'dekilerin genişletilmiş kopyasıdır (iskelet, düğüm dönüşleri,
 * 8/16 bit eklem dizini). O araç çağrıldığında kendini çalıştırdığı için içinden alınamadı; onun arayüzü değişmedi.
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const KOK = path.join(__dirname, '..');
const KIT = path.join(KOK, 'kitaplik');

/* ---- ayar: ne alınır, nasıl ölçeklenir ---- */
// Karakterler: kaldırımda düğün seyreden mahalle. Takım elbiseli (male-d) düğün misafiri gibi durur.
// Polis, silahlı, zırhlı ya da kostümlü olanlar alınmadı.
const INSAN_KLASOR = 'kenney-mini-characters';
const INSANLAR = ['character-male-a', 'character-male-b', 'character-male-d', 'character-female-b', 'character-female-c', 'character-female-d'];
// Oran düzeltmesi (kemiğin kendi ekseninde): bacak boyu, gövde boyu, kol boyu, baş ölçüsü; sonra bütün boy.
const ORAN = { bacak: 1.9, govde: 1.3, govdeEn: 0.92, kol: 1.3, bas: 0.78 };
const INSAN_BOY = 1.72; // metre (ayak tabanından başın tepesine, ayakta)
// Pozlar: eklem başına [x, y, z] derece (eklemin kendi ekseninde, XYZ sırası). Kenney karakteri +z'ye bakar,
// bağ pozunda kolları yana açıktır (T); "kolAsagi" bekleme klibinin ilk karesinden okunur.
const POZLAR = {
  ayakta: { kol: 'asagi' },
  cosku: { 'arm-left': [0, 0, 62], 'arm-right': [0, 0, -62], head: [-12, 0, 0], torso: [-4, 0, 0] },
  alkisA: { 'arm-left': [0, -70, -25], 'arm-right': [0, 70, 25], torso: [4, 0, 0] },
  alkisB: { 'arm-left': [0, -88, -20], 'arm-right': [0, 88, 20], torso: [4, 0, 0] },
  salla: { 'arm-left': [0, 0, 75], kolSag: 'asagi', head: [-6, 0, 6] }
};

// Eşya: dosya, klasör, ölçek [yatay, dikey] ve yön (y ekseni etrafında derece; öne bakan yüz +z'ye, yani yola döner).
const ESYALAR = {
  // sokak lambası: kolu yola uzanır. Oyunun lambasıyla aynı boy (6,6 m); Kenney'in kalın borusu yatayda inceltilir.
  lamba: { klasor: 'kenney-city-kit-roads', dosya: 'light-curved', olcek: [6.5, 9.8], don: 180 },
  isik: { klasor: 'kenney-city-kit-roads', dosya: 'traffic-light', olcek: [6.5, 7.2], don: 0 },
  cop: { klasor: 'kenney-city-kit-roads', dosya: 'dumpster', olcek: [4.6, 4.6], don: 90 },
  tabela: { klasor: 'kenney-city-kit-roads', dosya: 'road-sign-street', olcek: [6, 6], don: 0 },
  bank: { klasor: 'kenney-holiday-kit', dosya: 'bench', olcek: [1.6, 1.25], don: 0 },
  saksi: { klasor: 'kenney-city-kit-suburban', dosya: 'planter', olcek: [4.4, 4.4], don: 0 }
};

/* ---- matris yardımcıları (4×4, sütun öncelikli, glTF gibi) ---- */
const M4 = {
  birim: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  carp(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  trs(t, q, s) {
    const [x, y, z, w] = q || [0, 0, 0, 1], [sx, sy, sz] = s || [1, 1, 1], T = t || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, T[0], T[1], T[2], 1];
  },
  nokta: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]],
  yon: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]
};
// Euler (derece, XYZ) → dördey
function dordey(d) {
  const [x, y, z] = d.map(v => v * Math.PI / 360), cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz];
}
function dordeyCarp(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}

/* ---- GLB okuma (yalnız veri) ---- */
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
    const bilesen = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
    const tip = { 5126: ['readFloatLE', 4], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4], 5121: ['readUInt8', 1] }[a.componentType];
    if (!tip)
      hata(dosya + ': bilinmeyen bileşen türü ' + a.componentType);
    const adim = bv.byteStride || bilesen * tip[1], bas = (bv.byteOffset || 0) + (a.byteOffset || 0), out = [];
    for (let k = 0; k < a.count; k++)
      for (let c = 0; c < bilesen; c++) {
        let v = bin[tip[0]](bas + k * adim + c * tip[1]);
        if (a.normalized && tip[0] === 'readUInt8')
          v /= 255;
        else if (a.normalized && tip[0] === 'readUInt16LE')
          v /= 65535;
        out.push(v);
      }
    return out;
  };
  // düğümlerin dünya matrisleri (sahne kökünden)
  const dunya = new Array(json.nodes.length), ebeveyn = new Array(json.nodes.length).fill(-1);
  json.nodes.forEach((n, i) => (n.children || []).forEach(c => { ebeveyn[c] = i; }));
  const yerel = n => n.matrix ? n.matrix.slice() : M4.trs(n.translation, n.rotation, n.scale);
  const hesapla = i => dunya[i] || (dunya[i] = ebeveyn[i] < 0 ? yerel(json.nodes[i]) : M4.carp(hesapla(ebeveyn[i]), yerel(json.nodes[i])));
  json.nodes.forEach((_, i) => hesapla(i));
  return { json, erisim, dunya, ebeveyn };
}

/* ---- PNG okuma (8 bit RGB/RGBA ya da 8 bit paletli, taramasız) ---- */
function pngOku(dosya) {
  const b = fs.readFileSync(dosya);
  let o = 8, w = 0, h = 0, renkTur = 0, palet = null;
  const idat = [];
  while (o < b.length) {
    const uz = b.readUInt32BE(o), tur = b.toString('ascii', o + 4, o + 8), veri = b.subarray(o + 8, o + 8 + uz);
    if (tur === 'IHDR') {
      w = veri.readUInt32BE(0);
      h = veri.readUInt32BE(4);
      renkTur = veri[9];
      if (veri[8] !== 8 || veri[12] !== 0 || (renkTur !== 6 && renkTur !== 2 && renkTur !== 3))
        hata(dosya + ': yalnız 8 bit RGB/RGBA ya da paletli, taramasız PNG okunur.');
    }
    else if (tur === 'PLTE')
      palet = veri;
    else if (tur === 'IDAT')
      idat.push(veri);
    o += 12 + uz;
  }
  const bpp = renkTur === 6 ? 4 : renkTur === 3 ? 1 : 3, ham = zlib.inflateSync(Buffer.concat(idat)), satir = w * bpp, px = Buffer.alloc(w * h * 4);
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
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 4; k++)
        px[(y * w + x) * 4 + k] = bpp === 1 ? (k < 3 ? palet[simdi[x] * 3 + k] : 255) : k < 3 || bpp === 4 ? simdi[x * bpp + k] : 255;
    simdi.copy(onceki);
  }
  return { w, h, px };
}
function renkOku(doku, u, v) {
  const x = Math.min(doku.w - 1, Math.max(0, Math.floor(u * doku.w))), y = Math.min(doku.h - 1, Math.max(0, Math.floor(v * doku.h)));
  const i = (y * doku.w + x) * 4;
  return [doku.px[i], doku.px[i + 1], doku.px[i + 2]];
}

/* ---- birleştirme: aynı konum, normal, renk ve kemikteki köşeler tek köşe olur (UV dikişleri gereksiz) ---- */
function kaynastir(G) {
  const harita = new Map(), Y = { P: [], N: [], C: [], J: [], I: [] }, eski = [];
  const n = G.P.length / 3;
  for (let k = 0; k < n; k++) {
    const anahtar = [G.P[k * 3], G.P[k * 3 + 1], G.P[k * 3 + 2]].map(v => v.toFixed(4)).join(',') + '|' +
      [G.N[k * 3], G.N[k * 3 + 1], G.N[k * 3 + 2]].map(v => v.toFixed(2)).join(',') + '|' + G.C.slice(k * 3, k * 3 + 3).join(',') + '|' + (G.J ? G.J[k] : 0);
    if (!harita.has(anahtar)) {
      harita.set(anahtar, Y.P.length / 3);
      Y.P.push(G.P[k * 3], G.P[k * 3 + 1], G.P[k * 3 + 2]);
      Y.N.push(G.N[k * 3], G.N[k * 3 + 1], G.N[k * 3 + 2]);
      Y.C.push(G.C[k * 3], G.C[k * 3 + 1], G.C[k * 3 + 2]);
      if (G.J)
        Y.J.push(G.J[k]);
    }
    eski[k] = harita.get(anahtar);
  }
  for (const i of G.I)
    Y.I.push(eski[i]);
  if (!G.J)
    delete Y.J;
  return Y;
}

/* ---- insanlar ---- */
const EKLEM = ['root', 'leg-left', 'leg-right', 'torso', 'arm-left', 'arm-right', 'head'];
const EBEVEYN = { 'leg-left': 'root', 'leg-right': 'root', torso: 'root', 'arm-left': 'torso', 'arm-right': 'torso', head: 'torso' };
let kolAsagi = null; // bekleme klibinin ilk karesindeki kol dönüşleri (ilk karakterden)
function insanCevir(ad, doku) {
  const { json, erisim, dunya } = glbOku(path.join(KIT, INSAN_KLASOR, ad + '.glb'));
  const dugum = isim => json.nodes.findIndex(n => n.name === isim);
  for (const e of EKLEM)
    if (dugum(e) < 0)
      hata(ad + ': "' + e + '" kemiği yok.');
  for (const e of EKLEM) {
    const n = json.nodes[dugum(e)];
    if (n.rotation && Math.abs(n.rotation[3] - 1) > 1e-5 || n.scale && n.scale.some(s => Math.abs(s - 1) > 1e-5))
      hata(ad + ': ' + e + ' bağ pozunda döndürülmüş ya da ölçeklenmiş; bu araç yalnız ötelemeli iskeleti okur.');
  }
  // eklemlerin bağ pozundaki dünya konumları
  const eklemP = {};
  for (const e of EKLEM)
    eklemP[e] = dunya[dugum(e)].slice(12, 15);
  if (!kolAsagi) {
    const a = json.animations.find(x => x.name === 'idle');
    if (!a)
      hata(ad + ': "idle" klibi yok.');
    kolAsagi = {};
    for (const ch of a.channels) {
      const isim = json.nodes[ch.target.node].name;
      if (ch.target.path === 'rotation' && /^arm-/.test(isim))
        kolAsagi[isim] = erisim(a.samplers[ch.sampler].output).slice(0, 4);
    }
    if (!kolAsagi['arm-left'] || !kolAsagi['arm-right'])
      hata(ad + ': bekleme klibinde kol dönüşü yok.');
  }
  // köşeler: her köşe en ağır kemiğine bağlanır (Kenney'de ağırlıklar zaten 1)
  const G = { P: [], N: [], C: [], J: [], I: [] };
  let enAgirIkinci = 0;
  for (let ni = 0; ni < json.nodes.length; ni++) {
    const n = json.nodes[ni];
    if (n.mesh === undefined)
      continue;
    const skin = n.skin !== undefined ? json.skins[n.skin] : null;
    if (!skin)
      hata(ad + ': iskeletsiz parça ' + n.name);
    const jAd = skin.joints.map(j => json.nodes[j].name);
    for (const p of json.meshes[n.mesh].primitives) {
      const P = erisim(p.attributes.POSITION), N = erisim(p.attributes.NORMAL), UV = erisim(p.attributes.TEXCOORD_0);
      const JJ = erisim(p.attributes.JOINTS_0), WW = erisim(p.attributes.WEIGHTS_0), I = erisim(p.indices);
      const t0 = G.P.length / 3;
      for (let k = 0; k < P.length / 3; k++) {
        let en = 0;
        for (let q = 1; q < 4; q++)
          if (WW[k * 4 + q] > WW[k * 4 + en])
            en = q;
        const ikinci = [0, 1, 2, 3].filter(q => q !== en).reduce((m, q) => Math.max(m, WW[k * 4 + q]), 0);
        enAgirIkinci = Math.max(enAgirIkinci, ikinci);
        const e = jAd[JJ[k * 4 + en]], ei = EKLEM.indexOf(e);
        if (ei < 0)
          hata(ad + ': bilinmeyen kemik ' + e);
        // köşe, bağ pozunda karakter uzayında (örgü düğümünün dünya matrisi birimdir: Kenney'de öyle; değilse uygula)
        const v = M4.nokta(dunya[ni], [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]);
        const nn = M4.yon(dunya[ni], [N[k * 3], N[k * 3 + 1], N[k * 3 + 2]]);
        // eklemin yerel uzayına (bağ pozunda dönüş yok: yalnız öteleme)
        const pv = eklemP[e], l = [v[0] - pv[0], v[1] - pv[1], v[2] - pv[2]];
        // oran düzeltmesi
        const nl = nn.slice();
        if (/^leg-/.test(e))
          l[1] *= ORAN.bacak;
        else if (e === 'torso') {
          l[1] *= ORAN.govde;
          l[0] *= ORAN.govdeEn;
        }
        else if (/^arm-/.test(e))
          l[0] *= ORAN.kol;
        else if (e === 'head')
          for (let q = 0; q < 3; q++)
            l[q] *= ORAN.bas;
        G.P.push(...l);
        G.N.push(...nl);
        G.C.push(...renkOku(doku, UV[k * 2], UV[k * 2 + 1]));
        G.J.push(ei);
      }
      for (const i of I)
        G.I.push(t0 + i);
    }
  }
  if (enAgirIkinci > 0.01)
    hata(ad + ': bir köşe iki kemiğe bağlı (ikinci ağırlık ' + enAgirIkinci.toFixed(2) + '); bu araç tek kemikli köşe ister.');
  // yeni eklem konumları (ebeveyne göre): bacak ve gövde kalçadan, kollar ve baş gövdenin yeni boyuna göre
  const kalca = eklemP.torso[1] * ORAN.bacak;
  const ofs = {
    root: [0, 0, 0],
    'leg-left': [eklemP['leg-left'][0], kalca, eklemP['leg-left'][2]],
    'leg-right': [eklemP['leg-right'][0], kalca, eklemP['leg-right'][2]],
    torso: [eklemP.torso[0], kalca, eklemP.torso[2]]
  };
  for (const e of ['arm-left', 'arm-right', 'head']) {
    const d = eklemP[e].map((v, q) => v - eklemP.torso[q]);
    ofs[e] = [d[0] * (e === 'head' ? 1 : ORAN.govdeEn), d[1] * ORAN.govde, d[2]];
  }
  return { ad, G: kaynastir(G), ofs };
}
// Bir pozun bütün eklemlerdeki dönüşü (dördey); veri dosyasına yazılır, oyun uygular.
function pozCevir(P) {
  const o = {};
  for (const e of EKLEM.slice(1)) {
    let q = [0, 0, 0, 1];
    if (/^arm-/.test(e) && (P.kol === 'asagi' || (e === 'arm-right' && P.kolSag === 'asagi')))
      q = kolAsagi[e];
    if (P[e])
      q = dordeyCarp(q, dordey(P[e]));
    o[e] = q.map(v => +v.toFixed(4));
  }
  return o;
}
// Ayakta pozda boy: bütün köşeleri pozla yerleştirip en yükseği ölçer (oyunun yaptığının aynısı).
function pozla(ins, poz) {
  const dunyaQ = {}, dunyaP = {};
  const qDon = (q, v) => {
    const m = M4.trs(null, q, null);
    return M4.yon(m, v);
  };
  for (const e of EKLEM) {
    if (e === 'root') {
      dunyaQ[e] = [0, 0, 0, 1];
      dunyaP[e] = [0, 0, 0];
      continue;
    }
    const pe = EBEVEYN[e], o = qDon(dunyaQ[pe], ins.ofs[e]);
    dunyaP[e] = [dunyaP[pe][0] + o[0], dunyaP[pe][1] + o[1], dunyaP[pe][2] + o[2]];
    dunyaQ[e] = dordeyCarp(dunyaQ[pe], poz[e]);
  }
  const P = [];
  for (let k = 0; k < ins.G.J.length; k++) {
    const e = EKLEM[ins.G.J[k]], v = qDon(dunyaQ[e], ins.G.P.slice(k * 3, k * 3 + 3));
    P.push(v[0] + dunyaP[e][0], v[1] + dunyaP[e][1], v[2] + dunyaP[e][2]);
  }
  return P;
}

/* ---- eşya ---- */
function esyaCevir(ad, E) {
  const { json, erisim, dunya } = glbOku(path.join(KIT, E.klasor, E.dosya + '.glb'));
  const doku = pngOku(path.join(KIT, E.klasor, 'Textures', 'colormap.png'));
  const G = { P: [], N: [], C: [], I: [] }, a = E.don * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), [sh, sv] = E.olcek;
  for (let ni = 0; ni < json.nodes.length; ni++) {
    const n = json.nodes[ni];
    if (n.mesh === undefined)
      continue;
    for (const p of json.meshes[n.mesh].primitives) {
      const P = erisim(p.attributes.POSITION), N = erisim(p.attributes.NORMAL), UV = erisim(p.attributes.TEXCOORD_0), I = erisim(p.indices);
      const t0 = G.P.length / 3;
      for (let k = 0; k < P.length / 3; k++) {
        const v = M4.nokta(dunya[ni], [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]), nn = M4.yon(dunya[ni], [N[k * 3], N[k * 3 + 1], N[k * 3 + 2]]);
        // y ekseni etrafında döndür, sonra ölçekle (yatay sh, dikey sv); normal ters ölçekle döner
        const x = v[0] * ca + v[2] * sa, z = -v[0] * sa + v[2] * ca;
        G.P.push(x * sh, v[1] * sv, z * sh);
        const nx = nn[0] * ca + nn[2] * sa, nz = -nn[0] * sa + nn[2] * ca, m = [nx / sh, nn[1] / sv, nz / sh], l = Math.hypot(...m) || 1;
        G.N.push(m[0] / l, m[1] / l, m[2] / l);
        G.C.push(...renkOku(doku, UV[k * 2], UV[k * 2 + 1]));
      }
      for (const i of I)
        G.I.push(t0 + i);
    }
  }
  return kaynastir(G);
}

/* ---- sıkıştırma: base64 tamsayı dizileri ---- */
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
function kutuBul(P) {
  return [0, 1, 2].map(j => {
    let a = 1e9, b = -1e9;
    for (let i = j; i < P.length; i += 3) {
      a = Math.min(a, P[i]);
      b = Math.max(b, P[i]);
    }
    return [+a.toFixed(4), +b.toFixed(4)];
  });
}
function paketle(G, kutu) {
  kutu = kutu || kutuBul(G.P);
  const P = new Int16Array(G.P.length);
  for (let i = 0; i < G.P.length; i++) {
    const [a, b] = kutu[i % 3];
    P[i] = Math.round(((G.P[i] - a) / Math.max(1e-6, b - a)) * 65535 - 32768);
  }
  if (G.P.length / 3 > 65535)
    hata('65535 köşeden çok.');
  // renkler paletten: modelin birkaç düzine düz rengi bir kez yazılır, köşe başına bir bayt dizin
  const pal = [], pi = new Map(), C = new Uint8Array(G.C.length / 3);
  for (let k = 0; k < C.length; k++) {
    const a = G.C.slice(k * 3, k * 3 + 3).join(',');
    if (!pi.has(a)) {
      pi.set(a, pal.length / 3);
      pal.push(...G.C.slice(k * 3, k * 3 + 3));
    }
    C[k] = pi.get(a);
  }
  if (pal.length / 3 > 256)
    hata('256 renkten çok.');
  const o = { kutu, p: b64(P), n: b64(Int8Array.from(G.N, v => Math.round(v * 127))), pal: b64(Uint8Array.from(pal)), c: b64(C), i: b64(Uint16Array.from(G.I)) };
  if (G.J)
    o.j = b64(Uint8Array.from(G.J));
  return o;
}

function hata(ileti) { console.error(ileti); process.exit(1); }

/* ---- çalıştır ---- */
const insDoku = pngOku(path.join(KIT, INSAN_KLASOR, 'Textures', 'colormap.png'));
const insanlar = INSANLAR.map(a => insanCevir(a, insDoku));
const pozlar = {};
for (const [a, P] of Object.entries(POZLAR))
  pozlar[a] = pozCevir(P);
// bütün boy: ilk karakterin ayakta boyu INSAN_BOY olacak şekilde tek ölçek (hepsine aynı: boyları birbirine göre kalsın)
const ilkBoy = Math.max(...pozla(insanlar[0], pozlar.ayakta).filter((_, i) => i % 3 === 1));
const olcek = INSAN_BOY / ilkBoy;
for (const ins of insanlar) {
  for (let i = 0; i < ins.G.P.length; i++)
    ins.G.P[i] *= olcek;
  for (const e in ins.ofs)
    ins.ofs[e] = ins.ofs[e].map(v => +(v * olcek).toFixed(4));
}
const esyalar = {};
for (const [a, E] of Object.entries(ESYALAR))
  esyalar[a] = esyaCevir(a, E);

if (process.argv.includes('--incele')) {
  for (const ins of insanlar) {
    const P = pozla(ins, pozlar.ayakta), k = kutuBul(P);
    console.log(ins.ad, 'köşe', ins.G.P.length / 3, 'üçgen', ins.G.I.length / 3, 'ayakta kutu', JSON.stringify(k));
  }
  for (const [a, G] of Object.entries(esyalar))
    console.log(a, ESYALAR[a].dosya, 'köşe', G.P.length / 3, 'üçgen', G.I.length / 3, 'kutu', JSON.stringify(kutuBul(G.P)));
  console.log('pozlar', JSON.stringify(pozlar));
  process.exit(0);
}
const lisans = k => fs.readFileSync(path.join(KIT, k, 'License.txt'), 'utf8').replace(/\r\n/g, '\n').replace(/\t/g, '  ').replace(/\*\//g, '* /').trim();
const veri = {
  kaynak: 'Kenney Mini Characters 2.0, City Kit (Roads) 2.2, Holiday Kit 2.0, City Kit (Suburban) 2.0 (www.kenney.nl), CC0 1.0',
  insan: { eklem: EKLEM, ebeveyn: EKLEM.map(e => EBEVEYN[e] ? EKLEM.indexOf(EBEVEYN[e]) : -1), pozlar: {}, cesit: [] },
  esya: {}
};
for (const [a, q] of Object.entries(pozlar))
  veri.insan.pozlar[a] = EKLEM.map(e => q[e] || [0, 0, 0, 1]);
for (const ins of insanlar)
  veri.insan.cesit.push(Object.assign({ ad: ins.ad, ofs: EKLEM.map(e => ins.ofs[e]) }, paketle(ins.G)));
for (const [a, G] of Object.entries(esyalar))
  veri.esya[a] = paketle(G);
const metin = JSON.stringify(veri);
if (/<\/script|<!--|<script/i.test(metin))
  hata('Çıktıda "</script", "<!--" ya da "<script" geçiyor: sayfaya gömülemez.');
const klasorler = [INSAN_KLASOR, ...new Set(Object.values(ESYALAR).map(E => E.klasor))];
const cikti = '/*\n * Hazır sokak modelleri (Kenney, CC0): kaldırımdaki insanlar (' + INSANLAR.join(', ') + ') ve sokak eşyası (' +
  Object.values(ESYALAR).map(E => E.dosya).join(', ') + ').\n' +
  klasorler.map(k => ' *\n * Lisans metni (kitaplik/' + k + '/License.txt):\n *\n' + lisans(k).split('\n').map(s => ' * ' + s.trimEnd()).join('\n')).join('\n') + '\n */\n' +
  '/* Bu dosya üretilir: node araclar/kitaplik-sokak.js. Kaynak: kitaplik/kenney-mini-characters, kenney-city-kit-roads, kenney-holiday-kit, kenney-city-kit-suburban. */\n' +
  'var SOKAK_MODELLERI = ' + metin + ';\n';
fs.writeFileSync(path.join(KIT, 'sokak-modelleri.js'), cikti);
console.log('kitaplik/sokak-modelleri.js yazıldı (' + cikti.length + ' karakter; ' + insanlar.length + ' insan, ' + Object.keys(POZLAR).length + ' poz, ' + Object.keys(esyalar).length + ' eşya).');
