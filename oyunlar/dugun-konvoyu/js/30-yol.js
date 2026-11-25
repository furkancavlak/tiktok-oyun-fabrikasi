/* YOL — Gelin Konvoyu'nun yolundan (oyunlar/konvoy/js/30-yol.js) uyarlandı, altın saat renklerinde. Gök,
 * kasaba silueti, tarla, akan yol (şerit çizgileri, turkuaz-beyaz bordür), gölgeler,
 * gelin arabasının ve liderin ışık halkası, şov ışığı, duman, havai fişekler. Yol kenarı direkleri, bayrak ipleri ve
 * ağaçlar derinlikleri olduğu için çizim listesine girer (yolKenariEkle, oyunCiz'den çağrılır).
 * arkaHazirla: gök ve siluet bir kez çizilir · Kanca: oyunZemin().
 */
// UFUK: gerçek ufuk çizgisinin ekrandaki satırı. Kamera kalabalığa göre yaklaşıp uzaklaştıkça her karede
// yeniden hesaplanır (ufukDuzelt); gök perdesi o satıra oturur. UFUK_ARKA: perdenin içindeki ufuk satırı.
let UFUK = 440;
const UFUK_ARKA = 560;
function ufukDuzelt() { UFUK = clamp(kam.cy - kam.F * Math.tan(kam.egim), 220, 640); }
// Yol kenarındaki şeyler bu satırın altında kalır: üstü sıralama kutusu ve gösterge (stil.css .sira, .cosku).
const KENAR_UST = 492;
let arkaKatman = null;
function arkaHazirla() {
  const t = document.createElement('canvas');
  t.width = 1100;
  t.height = UFUK_ARKA + 160;
  const a = t.getContext('2d'), r = rastgeleUret(77), H = UFUK_ARKA + 2;
  const gr = a.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#3b1f5c');
  gr.addColorStop(0.42, '#9a3f78');
  gr.addColorStop(0.72, '#ff7a7a');
  gr.addColorStop(0.9, '#ffae6b');
  gr.addColorStop(1, '#ffe1a0');
  a.fillStyle = gr;
  a.fillRect(0, 0, 1100, H + 160);
  // ilk yıldızlar yalnız göğün üst yarısında
  for (let i = 0; i < 60; i++) {
    a.globalAlpha = 0.2 + r() * 0.6;
    a.fillStyle = '#fbefdc';
    a.beginPath();
    a.arc(r() * 1100, r() * H * 0.4, 0.5 + r() * 1.2, 0, TAU);
    a.fill();
  }
  // batan güneş
  a.globalAlpha = 0.22;
  a.fillStyle = '#ffd166';
  a.beginPath();
  a.arc(560, H - 40, 130, 0, TAU);
  a.fill();
  a.globalAlpha = 1;
  a.fillStyle = '#ffe2a0';
  a.beginPath();
  a.arc(560, H - 40, 62, 0, TAU);
  a.fill();
  // ince bulut şeritleri
  a.fillStyle = 'rgba(255,196,140,.35)';
  for (const [x, y, w] of [[200, 250, 260], [700, 290, 300], [420, 330, 220], [880, 200, 180]]) {
    a.beginPath();
    a.ellipse(x, y, w / 2, 7, 0, 0, TAU);
    a.fill();
  }
  const tepe = (renk, yuk, f1, f2, kay) => {
    a.fillStyle = renk;
    a.beginPath();
    a.moveTo(0, H + 160);
    for (let x = 0; x <= 1100; x += 10)
      a.lineTo(x, H - yuk * (0.55 + 0.3 * Math.sin(x * f1 + kay) + 0.15 * Math.sin(x * f2 + kay * 2)));
    a.lineTo(1100, H + 160);
    a.closePath();
    a.fill();
  };
  tepe('#c46a8c', 70, 0.0061, 0.017, 0.4);
  tepe('#8f4277', 44, 0.0102, 0.023, 3.3);
  // kasaba: evler, kavaklar, ışığı yanmış pencereler, bir su kulesi
  for (let x = 10; x < 1090;) {
    if (r() < 0.28) {
      const h = 40 + r() * 30;
      a.fillStyle = '#5d2a62';
      a.beginPath();
      a.ellipse(x + 7, H - h / 2 - 2, 7, h / 2, 0, 0, TAU);
      a.fill();
      x += 20;
      continue;
    }
    const w = 30 + r() * 30, h = 18 + r() * 22;
    a.fillStyle = '#5d2a62';
    a.fillRect(x, H - h, w, h + 4);
    a.beginPath();
    a.moveTo(x - 4, H - h);
    a.lineTo(x + w / 2, H - h - 10 - r() * 8);
    a.lineTo(x + w + 4, H - h);
    a.closePath();
    a.fill();
    a.fillStyle = '#ffd166';
    for (let px = x + 6; px < x + w - 8; px += 12)
      if (r() < 0.55)
        a.fillRect(px, H - h + 6, 5, 7);
    x += w + 6 + r() * 24;
  }
  a.fillStyle = '#5d2a62';
  a.fillRect(842, H - 78, 6, 70);
  a.fillRect(866, H - 78, 6, 70);
  a.beginPath();
  a.ellipse(857, H - 84, 26, 16, 0, 0, TAU);
  a.fill();
  arkaKatman = t;
}

// Yolun ve çevresinin renkleri: tek altın saat paleti.
const YOL = { tarlaUzak: '#b8687e', tarlaYakin: '#4d2c50', asfalt: '#3a2948', asfaltKenar: '#4a3458', cizgi: '#fbefdc', bordur: '#3ccfb4', bordur2: '#fbefdc', pus: '#ffb489' };

// Yerde bir dörtgen: köşeleri [x, z]; yükseklik 0.
function yerDortgen(noktalar, renk) {
  const p = noktalar.map(n => pr([n[0], 0, n[1]]));
  if (p.some(q => !q.ok))
    return;
  c.beginPath();
  c.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++)
    c.lineTo(p[i].x, p[i].y);
  c.closePath();
  c.fillStyle = renk;
  c.fill();
}
function yolCiz() {
  c.fillStyle = '#3b1f5c';
  c.fillRect(0, 0, GW, Math.max(0, UFUK - UFUK_ARKA) + 2);
  c.drawImage(arkaKatman, -190 - kam.yaw * 520, UFUK - UFUK_ARKA);
  c.save();
  c.beginPath();
  c.rect(0, UFUK, GW, GH - UFUK);
  c.clip();
  {
    const tarlaBoya = c.createLinearGradient(0, UFUK, 0, GH);
    tarlaBoya.addColorStop(0, YOL.tarlaUzak);
    tarlaBoya.addColorStop(0.35, '#5a3f58');
    tarlaBoya.addColorStop(1, YOL.tarlaYakin);
    c.fillStyle = tarlaBoya;
  }
  c.fillRect(0, UFUK, GW, GH - UFUK);
  const W = D.yolW, z0 = kam.C[2] + 1.5, z1 = kam.tz + 60;
  // tarla sürülmüş gibi: yola paralel koyu çizgiler, yol akarken onlar da akar
  c.globalAlpha = 0.18;
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const x = s * (W + 2.2 + i * 1.6);
      yerDortgen([[x - 0.25, z0], [x + 0.25, z0], [x + 0.25, z1], [x - 0.25, z1]], '#1e1630');
    }
  c.globalAlpha = 1;
  // asfalt ve kenar şeridi
  yerDortgen([[-W - 0.45, z0], [W + 0.45, z0], [W + 0.45, z1], [-W - 0.45, z1]], YOL.asfaltKenar);
  yerDortgen([[-W, z0], [W, z0], [W, z1], [-W, z1]], YOL.asfalt);
  // akan çizgiler: kesik şerit çizgileri ve turkuaz-beyaz bordür. Konvoy kameraya doğru gittiği için yol
  // ekranda yukarı akar.
  const kay = D.kayma, zBas = kam.C[2] + 1, zSon = kam.tz + 50;
  const kol = D.kolon, ayrac = [];
  if (kol === 1)
    ayrac.push(-0.5 * ARA_X, 0.5 * ARA_X);
  else if (kol === 2)
    ayrac.push(0);
  else
    for (let i = 0; i < kol - 1; i++)
      ayrac.push((i + 1 - kol / 2) * ARA_X);
  const P = 2.4, ilk = Math.floor((zBas - kay) / P) * P + kay;
  for (let z = ilk; z < zSon; z += P)
    for (const x of ayrac)
      yerDortgen([[x - 0.045, z], [x + 0.045, z], [x + 0.045, z + 1.1], [x - 0.045, z + 1.1]], YOL.cizgi);
  const PB = 0.9, ilkB = Math.floor((zBas - kay) / PB) * PB + kay;
  let say = Math.round((ilkB - kay) / PB);
  for (let z = ilkB; z < zSon; z += PB, say++)
    for (const s of [-1, 1])
      yerDortgen([[s * W, z], [s * (W + 0.22), z], [s * (W + 0.22), z + PB], [s * W, z + PB]], say % 2 ? YOL.bordur : YOL.bordur2);
  c.restore();
  // ufuk pusu: yolun ucu kasabanın önünde ışığa karışır
  const pusBoya = c.createLinearGradient(0, UFUK - 4, 0, UFUK + 110);
  pusBoya.addColorStop(0, renkSaydam(YOL.pus, 0.95));
  pusBoya.addColorStop(1, renkSaydam(YOL.pus, 0));
  c.fillStyle = pusBoya;
  c.fillRect(0, UFUK - 4, GW, 114);
}

// Yol kenarı: iki yanda direkler (aralarında üçgen bayraklı ip) ve ağaçlar, yol akarken onlar da akar.
const DIREK_ARA = 4.2;
function yolKenariEkle() {
  const kay = D.kayma, zBas = kam.C[2] + 1.5, zSon = kam.tz + kam.son.hd + 24;
  const ilk = Math.floor((zBas - kay) / DIREK_ARA) * DIREK_ARA + kay;
  for (const s of [-1, 1]) {
    const xd = s * (D.yolW + 0.75), xa = s * (D.yolW + 2.1);
    let onceki = null;
    for (let z = ilk, i = Math.round((ilk - kay) / DIREK_ARA); z < zSon; z += DIREK_ARA, i++) {
      // Tepesi gök perdesine taşan uzaktaki direk ve ağaç çizilmez: üstteki yazıların arkası temiz kalsın.
      const alt = pr([xd, 0, z]), ust = pr([xd, 1.9, z]);
      if (alt.ok && ust.ok && ust.y > KENAR_UST) {
        ozel(alt.d, () => direkCiz(alt, ust));
        if (onceki)
          ipEkle(onceki, [xd, 1.8, z], i);
        onceki = [xd, 1.8, z];
      }
      else
        onceki = null;
      // ağaçlar direklerin dışında, yarım aralık kaydırılmış
      const za = z + DIREK_ARA / 2, tr = rastgeleUret(i * 2 + (s > 0 ? 1 : 0))(), boy = 0.8 + tr * 0.5, xt = xa + s * tr * 0.6;
      const ag = pr([xt, 0, za]), tepe = pr([xt, 1.9 * boy, za]);
      if (ag.ok && tepe.ok && tepe.y > KENAR_UST)
        ozel(ag.d, () => agacCiz(xt, za, boy));
    }
  }
  seyirciEkle(zBas, zSon);
}
// Yol kenarında konvoyu karşılayan köylüler: el sallar, yol akarken geride kalır. İzleyici değildirler: D.oy'da
// durmazlar, adları yazılmaz. Kim olduğu yerinden (sıra numarası) türer, her geçişte aynı kişi aynı yerde durur.
const SEYIRCI_ARA = 6.3, seyirciler = new Map();
function seyirciEkle(zBas, zSon) {
  const kay = D.kayma * 1.0, ilk = Math.floor((zBas - kay) / SEYIRCI_ARA) * SEYIRCI_ARA + kay;
  for (let z = ilk, i = Math.round((ilk - kay) / SEYIRCI_ARA); z < zSon; z += SEYIRCI_ARA, i++) {
    const r = rastgeleUret(i * 7 + 3), s = (i & 1) ? 1 : -1, var_ = r();
    if (var_ < 0.25)
      continue;
    const x = s * (D.yolW + 1.25 + r() * 0.5), tepe = pr([x, 1.25, z]);
    if (!tepe.ok || tepe.y < KENAR_UST)
      continue;
    let k = seyirciler.get(i);
    if (!k) {
      k = karakterYap('__seyirci' + i, '');
      k.guler = true;
      k.mod = 'seyirci';
      seyirciler.set(i, k);
      // Bellek şişmesin: en eski kayıt bırakılır (Map'ten çıkarmak, yalnız bellekteki kaydı unutmaktır).
      if (seyirciler.size > 30)
        seyirciler.delete(seyirciler.keys().next().value);
    }
    k.x = x;
    k.z = z;
    k.y0 = 0;
    // Kameraya dönük, biraz yola doğru kırılmış; konvoya el sallar.
    k.yon = Math.atan2(kam.C[0] - x, kam.C[2] - z) - s * 0.45;
    const poz = pozBekle(k), W = iskeletKur(k, poz), sal = Math.sin(TAU * B + var_ * 6);
    const sallayanSag = var_ > 0.6;
    k.j.haR = sallayanSag ? W(-0.3 - 0.06 * sal, poz.hipY + 0.62, 0.05) : W(-0.2, poz.hipY + 0.06, 0.05);
    k.j.haL = !sallayanSag ? W(0.3 + 0.06 * sal, poz.hipY + 0.62, 0.05) : W(0.2, poz.hipY + 0.06, 0.05);
    kolKur(k);
    golge(k.x, k.z, 0.25 * k.g.boy, 0.13 * k.g.boy);
    insanEkle(k);
  }
}
function direkCiz(alt, ust) {
  c.strokeStyle = MUREKKEP;
  c.lineWidth = Math.max(2, alt.s * 0.07);
  c.beginPath();
  c.moveTo(alt.x, alt.y);
  c.lineTo(ust.x, ust.y);
  c.stroke();
  c.strokeStyle = '#d9c7e6';
  c.lineWidth = Math.max(1, alt.s * 0.035);
  c.beginPath();
  c.moveTo(alt.x, alt.y);
  c.lineTo(ust.x, ust.y);
  c.stroke();
  // tepedeki lamba vuruşla parlar
  const par = 0.6 + 0.4 * calgi.dumP;
  c.globalAlpha = 0.25 * par;
  c.fillStyle = '#ffd166';
  c.beginPath();
  c.arc(ust.x, ust.y, ust.s * 0.3, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
  c.fillStyle = '#ffe2a0';
  c.beginPath();
  c.arc(ust.x, ust.y, Math.max(2, ust.s * 0.08), 0, TAU);
  c.fill();
}
// İki direk arasında sarkan ip ve üstünde vuruşla sallanan üçgen bayraklar.
function ipEkle(a, b, tohum) {
  const n = 7, noktalar = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    noktalar.push(pr([lerp(a[0], b[0], t), lerp(a[1], b[1], t) - 0.35 * 4 * t * (1 - t), lerp(a[2], b[2], t)]));
  }
  if (noktalar.some(p => !p.ok))
    return;
  ozel((noktalar[0].d + noktalar[n].d) / 2 + 0.3, () => {
    c.strokeStyle = 'rgba(8,10,28,.8)';
    c.lineWidth = 1.5;
    c.beginPath();
    noktalar.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    c.stroke();
    for (let i = 1; i < n; i++) {
      const p = noktalar[i], q = noktalar[i + 1], b2 = p.s * 0.16, sal = Math.sin(TAU * B / 2 + i + tohum) * 0.25;
      c.fillStyle = KUMAS[(i + tohum) % KUMAS.length];
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(lerp(p.x, q.x, 0.6), lerp(p.y, q.y, 0.6));
      c.lineTo(lerp(p.x, q.x, 0.3) + sal * b2, lerp(p.y, q.y, 0.3) + b2);
      c.closePath();
      c.fill();
    }
  });
}
function agacCiz(x, z, boy) {
  const g = pr([x, 0, z]), t = pr([x, 0.7 * boy, z]), u = pr([x, 1.35 * boy, z]);
  if (!g.ok || !t.ok || !u.ok)
    return;
  c.fillStyle = 'rgba(40,24,30,.3)';
  c.beginPath();
  c.ellipse(g.x, g.y, 0.55 * boy * g.s, 0.25 * boy * g.s, 0, 0, TAU);
  c.fill();
  c.strokeStyle = MUREKKEP;
  c.lineWidth = Math.max(1, g.s * 0.012);
  kapYol(g.x, g.y, 0.07 * g.s, t.x, t.y, 0.06 * t.s);
  c.fillStyle = '#5a3a2c';
  c.fill();
  c.stroke();
  // taç: rüzgârda vuruşla hafif sallanır
  const sal = Math.sin(TAU * B / 4 + x) * 0.04 * u.s;
  c.beginPath();
  c.arc(u.x + sal, u.y, 0.52 * boy * u.s, 0, TAU);
  c.fillStyle = '#2f6f5e';
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(u.x + sal - 0.16 * boy * u.s, u.y - 0.16 * boy * u.s, 0.24 * boy * u.s, 0, TAU);
  c.fillStyle = '#4a9a6e';
  c.fill();
}

// Gökte havai fişekler: vuruşla yükselir, açılır, söner (D.fisekler, 20-hareket.js fisekAt).
function fisekCiz() {
  for (const f of D.fisekler) {
    const u = B - f.b0;
    if (u < 0)
      continue;
    if (u < 0.8) {
      // yükselen iz
      const y = lerp(UFUK, UFUK - f.y, yumusak(u / 0.8));
      c.strokeStyle = renkSaydam('#ffe2a0', 0.8);
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(f.x, y);
      c.lineTo(f.x, y + 26);
      c.stroke();
      continue;
    }
    const t = (u - 0.8) / 2.6;
    if (t > 1)
      continue;
    const r = 125 * Math.sqrt(t), dus = 40 * t * t, al = 1 - t, fy = UFUK - f.y;
    if (t < 0.15) {
      c.globalAlpha = (0.15 - t) / 0.15 * 0.5;
      c.fillStyle = '#ffe2a0';
      c.beginPath();
      c.arc(f.x, fy, r * 1.4 + 20, 0, TAU);
      c.fill();
    }
    c.globalAlpha = al;
    for (let i = 0; i < f.n; i++) {
      const a = f.aci + i / f.n * TAU, x = f.x + Math.cos(a) * r, y = fy + Math.sin(a) * r + dus;
      c.fillStyle = i % 2 ? f.renk : f.renk2;
      c.beginPath();
      c.arc(x, y, 4.5 * (1 - t * 0.6), 0, TAU);
      c.fill();
      c.strokeStyle = c.fillStyle;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(f.x + Math.cos(a) * r * 0.75, fy + Math.sin(a) * r * 0.75 + dus * 0.8);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}

// Yerde vuruşla atan ışık halkası: gelin arabasının altında beyaz-pembe, liderin altında altın.
function yerHalka(x, z, r, dolgu, cizgi) {
  const g = pr([x, 0, z]);
  if (!g.ok)
    return;
  const n = 1 + 0.08 * Math.sin(B * TAU);
  c.fillStyle = dolgu;
  c.beginPath();
  c.ellipse(g.x, g.y, r * g.s * n, r * 0.63 * g.s * n, 0, 0, TAU);
  c.fill();
  c.strokeStyle = cizgi;
  c.lineWidth = Math.max(2, g.s * 0.03);
  c.beginPath();
  c.ellipse(g.x, g.y, r * 0.9 * g.s * n, r * 0.56 * g.s * n, 0, 0, TAU);
  c.stroke();
}
function oyunZemin() {
  ufukDuzelt();
  yolCiz();
  fisekCiz();
  yerHalka(GELIN.x + GELIN.ox, GELIN.z, 1.25, 'rgba(255,235,245,.18)', '#fbd3e4');
  const L = D.lider;
  if (L && L.ar && !(D.sov && D.sov.k === L))
    yerHalka(L.x + L.ox, L.z + L.oz, 0.95 * (L.olcek || 1), 'rgba(255,209,102,.22)', RENK.vurgu);
  // şov yapanın üstüne düşen ışık
  if (D.sov && D.sov.k.yer > 0.5) {
    const k = D.sov.k, g = pr([k.x + k.ox, 0, k.z + k.oz]);
    if (g.ok) {
      const gr = c.createLinearGradient(0, 0, 0, g.y);
      gr.addColorStop(0, 'rgba(255,209,102,0)');
      gr.addColorStop(1, 'rgba(255,209,102,.16)');
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(g.x - 40, 0);
      c.lineTo(g.x + 40, 0);
      c.lineTo(g.x + 1.2 * g.s, g.y);
      c.lineTo(g.x - 1.2 * g.s, g.y);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,209,102,.28)';
      c.beginPath();
      c.ellipse(g.x, g.y, 1.2 * g.s, 0.7 * g.s, 0, 0, TAU);
      c.fill();
    }
  }
  // gölgeler
  golge(GELIN.x + GELIN.ox, GELIN.z, 0.6 * GELIN_OLCEK, 0.58 * GELIN_OLCEK);
  for (const k of D.oy.values())
    if (k.ar)
      golge(k.x + k.ox, k.z + k.oz, 0.58 * (k.olcek || 1), 0.55 * (k.olcek || 1));
  // şov ve turbo dumanı yere yakın, arabaların altında kalır
  for (const p of D.duman) {
    const u = (B - p.b0) / 2.5, g = pr([p.x, 0.15 + u * 0.4, p.z]);
    if (!g.ok || u < 0)
      continue;
    c.globalAlpha = 0.45 * (1 - u);
    c.fillStyle = '#f3e3f0';
    c.beginPath();
    c.arc(g.x, g.y, (p.r + u * 0.6) * g.s, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}
