/* ARABA ÇİZİMİ — her izleyicinin arabası ve plakası, tavandan çıkıp el sallayan sürücüsü, hediye süsleri (balon,
 * ışık zinciri, kaput çiçekleri), turbo alevi, liderin altın bayrağı, korna yazısı, konfeti parçaları.
 * Gövde, kabin ve sürücü Gelin Konvoyu'nun (oyunlar/konvoy/js/40-araba.js) çiziminden uyarlandı.
 * arabaUret(id): renk, kasa ve plaka kimlikten türer (aynı izleyici her yayında aynı araba ve plakayla gelir)
 * arabaHazir(k): oyuncu kaydına araba alanlarını bir kez ekler
 * arabaCiz(k, T): bütün araba tek bir çizim parçasıdır (derinliği arabanın ortası); gelin arabası da bununla çizilir
 * Kancalar: oyunCiz(), oyunUst(dt), oyunEkAdlar().
 * Yerel eksen: a = arabanın sol yanı (k.l), y yukarı, cc = ileri (k.f; π yönünde kameraya bakar).
 */
const ARABA_RENK = ['#e23d2f', '#3d5bd0', '#22b8a7', '#f2b632', '#2c2c38', '#e86a9a', '#4fae6c', '#8b55c9', '#ef7d2d', '#b9c6dc', '#c9364f', '#2f8fd8'];
const KURDELE = ['#e23d2f', '#ffd166', '#f6ecd9', '#22b8a7', '#e86a9a'];
// Plaka: il kodu, iki harf, üç rakam. Türk plakasında Ç, Ğ, İ, Ö, Ş, Ü kullanılmaz; harfler yalnız ASCII.
const PLAKA_IL = ['01', '06', '07', '12', '16', '21', '23', '24', '25', '27', '33', '34', '35', '38', '42', '44', '47', '55', '61', '63', '65'];
const PLAKA_HARF = 'ABCDEFGHJKLMNPRSTUVYZ';
function arabaUret(id) {
  const r = rastgeleUret(ozet('dugun-araba:' + id)), sec2 = a => a[Math.floor(r() * a.length)];
  const kasa = r() < 0.6 ? 'sedan' : 'hatch';
  const plaka = sec2(PLAKA_IL) + ' ' + sec2(PLAKA_HARF) + sec2(PLAKA_HARF) + ' ' + (100 + Math.floor(r() * 900));
  return { renk: sec2(ARABA_RENK), kasa, kurdele: sec2(KURDELE), faz: r(), elSag: r() < 0.5, plaka, balon: [sec2(KIRPINTI_RENK), sec2(KIRPINTI_RENK), sec2(KIRPINTI_RENK), sec2(KIRPINTI_RENK)] };
}
function arabaHazir(k) {
  if (k.ar)
    return;
  k.ar = arabaUret(k.id);
  k.ox = 0;
  k.oz = 0;
  k.oy0 = 0;
  k.korna = -99;
  k.far = -99;
  k.sus = 0;
  k.isik = -99;
  k.turbo = -99;
  k.konfetiB = -99;
}

/* ---- ölçüler (metre) ---- */
const GOVDE = { a: 0.44, y0: 0.1, y1: 0.42, c: 0.72 };
const KABIN = { sedan: { a: 0.38, y1: 0.74, c0: -0.42, c1: 0.24 }, hatch: { a: 0.38, y1: 0.76, c0: -0.7, c1: 0.2 } };

function arabaDonusum(k) {
  const fx = Math.sin(k.yonG), fz = Math.cos(k.yonG);
  return { x: k.x + k.ox, y: k.oy0, z: k.z + k.oz, fx, fz, lx: -fz, lz: fx, k: k.olcek || 1 };
}
// gelin: gelin arabası mı (izleyici değil; beyaz, tüllü, içinde gelin ile damat)
function arabaCiz(k, T, gelin) {
  const ar = k.ar, kb = KABIN[ar.kasa], cw = Math.max(1, pr([T.x, 0, T.z]).s * 0.012), renk = ar.renk;
  const lider = !gelin && k === D.lider;
  // tekerlekler gövdenin içinde kalır, altından görünür
  for (const sa of [-1, 1])
    for (const sc of [-1, 1])
      kutuCiz(T, sa > 0 ? 0.3 : -0.42, sa > 0 ? 0.42 : -0.3, -T.y / T.k, 0.26 - T.y * 0.5, sc * 0.46 - 0.13, sc * 0.46 + 0.13, '#231b2c', cw);
  // turbo alevi: arka tamponun iki yanından geriye; araba kameraya baktığı için gövdenin iki yanından taşar
  if (!gelin && turboVar(k))
    turboAlev(k, T, cw);
  const gv = kutuCiz(T, -GOVDE.a, GOVDE.a, GOVDE.y0, GOVDE.y1, -GOVDE.c, GOVDE.c, renk, cw);
  if (gv.on) {
    // ızgara, farlar, plaka
    yuzCiz(T, [[-0.2, 0.2, GOVDE.c + 0.005], [0.2, 0.2, GOVDE.c + 0.005], [0.2, 0.32, GOVDE.c + 0.005], [-0.2, 0.32, GOVDE.c + 0.005]], '#3a2f45', cw * 0.8);
    const yaniyor = B >= k.far && B < k.far + 3 && ((B - k.far) * 2 % 1) < 0.55;
    for (const s of [-1, 1]) {
      const f = pr(yerelNokta(T, s * 0.31, 0.29, GOVDE.c + 0.01));
      if (yaniyor && f.ok) {
        c.globalAlpha = 0.35;
        daireCiz(f, 0.22, '#ffe9a8');
        c.globalAlpha = 1;
      }
      daireCiz(f, 0.075, yaniyor ? '#fff6c8' : '#f3dca0', cw);
    }
    plakaCiz(T, cw, ar.plaka, lider);
  }
  if (gv.arka)
    for (const s of [-1, 1])
      yuzCiz(T, [[s * 0.38, 0.28, -GOVDE.c - 0.005], [s * 0.24, 0.28, -GOVDE.c - 0.005], [s * 0.24, 0.35, -GOVDE.c - 0.005], [s * 0.38, 0.35, -GOVDE.c - 0.005]], '#e23d2f', cw * 0.6);
  // kabin ve camları
  const kv = kutuCiz(T, -kb.a, kb.a, GOVDE.y1, kb.y1, kb.c0, kb.c1, renk, cw);
  const cam = '#a8d8e8', camK = '#7fb8cf', ic = 0.05;
  if (kv.on)
    yuzCiz(T, [[-kb.a + ic, GOVDE.y1 + 0.03, kb.c1 + 0.005], [kb.a - ic, GOVDE.y1 + 0.03, kb.c1 + 0.005], [kb.a - ic, kb.y1 - 0.04, kb.c1 + 0.005], [-kb.a + ic, kb.y1 - 0.04, kb.c1 + 0.005]], cam, cw * 0.7);
  if (kv.arka)
    yuzCiz(T, [[-kb.a + ic, GOVDE.y1 + 0.04, kb.c0 - 0.005], [kb.a - ic, GOVDE.y1 + 0.04, kb.c0 - 0.005], [kb.a - ic, kb.y1 - 0.05, kb.c0 - 0.005], [-kb.a + ic, kb.y1 - 0.05, kb.c0 - 0.005]], camK, cw * 0.7);
  for (const [s, gor] of [[1, kv.sol], [-1, kv.sag]])
    if (gor)
      yuzCiz(T, [[s * (kb.a + 0.005), GOVDE.y1 + 0.04, kb.c0 + 0.06], [s * (kb.a + 0.005), GOVDE.y1 + 0.04, kb.c1 - 0.06], [s * (kb.a + 0.005), kb.y1 - 0.05, kb.c1 - 0.06], [s * (kb.a + 0.005), kb.y1 - 0.05, kb.c0 + 0.06]], camK, cw * 0.7);
  if (gelin) {
    gelinSusu(k, T, kb, cw);
    gelinCiftCiz(k, T, kb, cw);
    return;
  }
  // anten: liderde altın bayrak, ötekilerde kurdele
  antenCiz(k, T, cw, lider);
  if (k.sus >= 1)
    balonCiz(k, T, cw);
  if (k.sus >= 3)
    kaputCicek(T, kb, cw);
  if (k.sus >= 2)
    isikZinciri(k, T, kb, cw);
  surucuCiz(k, T, kb, cw);
}
// Plaka: beyaz zemin, solda mavi şerit, ortada kimliğe bağlı plaka yazısı. Lider plakasının çerçevesi altındır.
function plakaCiz(T, cw, yazi, lider) {
  const z = GOVDE.c + 0.01;
  const pl = yuzCiz(T, [[-0.17, 0.11, z], [0.17, 0.11, z], [0.17, 0.2, z], [-0.17, 0.2, z]], '#fbf6ec', lider ? Math.max(2, cw * 1.4) : cw * 0.8);
  if (!pl)
    return;
  if (lider) {
    c.strokeStyle = RENK.vurgu;
    c.lineWidth = Math.max(1.5, cw);
    c.beginPath();
    c.moveTo(pl[0].x, pl[0].y);
    for (let i = 1; i < 4; i++)
      c.lineTo(pl[i].x, pl[i].y);
    c.closePath();
    c.stroke();
  }
  yuzCiz(T, [[0.17, 0.11, z + 0.002], [0.135, 0.11, z + 0.002], [0.135, 0.2, z + 0.002], [0.17, 0.2, z + 0.002]], '#2f5fc4');
  if (pl[0].s > 55) {
    c.fillStyle = MUREKKEP;
    c.font = '700 ' + Math.max(7, Math.round(pl[0].s * 0.07)) + 'px Rubik, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // yazı mavi şeridin sağında kalan beyaz alana ortalanır (ekranda araba kameraya bakar: yerel sol = ekranın sağı)
    const x = lerp(pl[0].x, pl[1].x, 0.55), y = (pl[0].y + pl[2].y) / 2 + 0.5;
    c.fillText(yazi, x, y, Math.abs(pl[1].x - pl[0].x) * 0.82);
    c.textBaseline = 'alphabetic';
  }
}
// Anten: ucunda kurdele vuruşla dalgalanır. Liderde anten uzar, ucunda üstünde "1" yazan altın bayrak dalgalanır.
function antenCiz(k, T, cw, lider) {
  const ar = k.ar, boy = lider ? 1.5 : 1.0;
  const an0 = pr(yerelNokta(T, -0.32, GOVDE.y1, -0.6)), an1 = pr(yerelNokta(T, -0.32, boy, -0.62));
  if (!an0.ok || !an1.ok)
    return;
  c.strokeStyle = MUREKKEP;
  c.lineWidth = Math.max(1, an0.s * (lider ? 0.018 : 0.012));
  c.beginPath();
  c.moveTo(an0.x, an0.y);
  c.lineTo(an1.x, an1.y);
  c.stroke();
  const dal = Math.sin(TAU * B + ar.faz * 5);
  if (!lider) {
    const u1 = pr(yerelNokta(T, -0.32 + dal * 0.06, 0.96, -0.95)), u2 = pr(yerelNokta(T, -0.32 - dal * 0.05, 0.88, -0.9));
    if (u1.ok && u2.ok)
      cokgenCiz([an1, u1, u2], ar.kurdele, Math.max(1, an0.s * 0.008));
    return;
  }
  // Bayrak, lider yeni değiştiyse direkte yukarı çekilir (bayrak uçuşu bitene dek).
  const bu = D.bayrakUcus, cek = bu && bu.kime === k ? clamp((B - bu.b0) / 1.2, 0, 1) : 1;
  const ust = boy, alt = boy - 0.34 * yumusak(cek);
  const b0 = pr(yerelNokta(T, -0.32, ust, -0.62)), b1 = pr(yerelNokta(T, -0.32, alt, -0.62));
  const u1 = pr(yerelNokta(T, -0.32 + dal * 0.05, ust - 0.04, -1.12)), u2 = pr(yerelNokta(T, -0.32 - dal * 0.05, alt + 0.03, -1.1));
  if (!(b0.ok && b1.ok && u1.ok && u2.ok))
    return;
  cokgenCiz([b0, u1, u2, b1], RENK.vurgu, Math.max(1.5, an0.s * 0.012));
  if (cek > 0.6 && b0.s > 60) {
    c.fillStyle = MUREKKEP;
    c.font = Math.round(b0.s * 0.16) + 'px "Paytone One", Rubik, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('1', (b0.x + u1.x + u2.x + b1.x) / 4, (b0.y + u1.y + u2.y + b1.y) / 4);
    c.textBaseline = 'alphabetic';
  }
  daireCiz(b0, 0.035, RENK.vurgu, cw * 0.7);
}
// Balonlar: arka köşelere iple bağlı, vuruşla sallanır. Üç süste dört balon.
function balonCiz(k, T, cw) {
  const n = k.sus >= 3 ? 4 : 2, yerler = [[0.4, -0.66], [-0.4, -0.66], [0.38, 0.6], [-0.38, 0.6]];
  for (let i = 0; i < n; i++) {
    const [a, cc] = yerler[i], sal = Math.sin(TAU * B / 2 + i * 1.7 + k.ar.faz * 4);
    const dip = pr(yerelNokta(T, a, GOVDE.y1, cc)), bas = pr(yerelNokta(T, a * 1.25 + sal * 0.06, 1.25 + 0.05 * Math.cos(TAU * B / 2 + i), cc - 0.15));
    if (!dip.ok || !bas.ok)
      continue;
    c.strokeStyle = 'rgba(40,24,48,.7)';
    c.lineWidth = Math.max(1, dip.s * 0.006);
    c.beginPath();
    c.moveTo(dip.x, dip.y);
    c.quadraticCurveTo((dip.x + bas.x) / 2 + sal * dip.s * 0.05, (dip.y + bas.y) / 2, bas.x, bas.y);
    c.stroke();
    const r = 0.14 * bas.s * T.k;
    c.fillStyle = k.ar.balon[i];
    c.strokeStyle = MUREKKEP;
    c.lineWidth = Math.max(1, cw * 0.8);
    c.beginPath();
    c.ellipse(bas.x, bas.y - r, r * 0.85, r, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.ellipse(bas.x - r * 0.3, bas.y - r * 1.35, r * 0.18, r * 0.28, -0.4, 0, TAU);
    c.fill();
  }
}
// Kaputta çiçek sırası (üçüncü süs).
function kaputCicek(T, kb, cw) {
  for (let i = 0; i < 5; i++) {
    const p = pr(yerelNokta(T, (i - 2) * 0.14, GOVDE.y1 + 0.03, GOVDE.c - 0.18));
    daireCiz(p, 0.055, i % 2 ? '#e86a9a' : '#fbefdc', cw * 0.7);
    daireCiz(p, 0.02, '#ffd166');
  }
}
// Tavanın kenarında ışık zinciri: süs geldikten sonra 8 vuruş hızlı ve parlak yanıp söner, sonra vuruşla sakin yanar.
const ISIK_RENK = ['#ffd166', '#ff6b6b', '#3ccfb4', '#f6ecd9', '#e86a9a'];
function isikZinciri(k, T, kb, cw) {
  const taze = B - k.isik < 8, n = 7;
  for (const s of [-1, 1])
    for (let i = 0; i < n; i++) {
      const cc = lerp(kb.c0, kb.c1, i / (n - 1)), p = pr(yerelNokta(T, s * (kb.a + 0.01), kb.y1 + 0.01, cc));
      if (!p.ok)
        continue;
      const yan = taze ? ((Math.floor(B * 4) + i) % 2 === 0) : ((Math.floor(B) + i) % 3 !== 0);
      const renkI = ISIK_RENK[(i + (s > 0 ? 2 : 0)) % ISIK_RENK.length];
      if (yan) {
        c.globalAlpha = taze ? 0.45 : 0.25;
        daireCiz(p, 0.07, renkI);
        c.globalAlpha = 1;
      }
      daireCiz(p, 0.028, yan ? renkI : '#5a4a62');
    }
}
// Turbo alevi: arka iki köşeden geriye doğru titreyen turuncu-sarı koniler.
function turboAlev(k, T, cw) {
  const u = (B - k.turbo) / TURBO_V, guc = u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1;
  for (const s of [-1, 1]) {
    const titre = 0.85 + 0.3 * Math.sin(zaman * 40 + s * 3);
    const kok = pr(yerelNokta(T, s * 0.22, 0.2, -GOVDE.c));
    const uc = pr(yerelNokta(T, s * 0.26, 0.22, -GOVDE.c - 1.1 * guc * titre));
    const yan1 = pr(yerelNokta(T, s * 0.22 + 0.09, 0.3, -GOVDE.c - 0.2)), yan2 = pr(yerelNokta(T, s * 0.22 - 0.09, 0.12, -GOVDE.c - 0.2));
    if (!(kok.ok && uc.ok && yan1.ok && yan2.ok))
      continue;
    cokgenCiz([kok, yan1, uc, yan2], '#ff8a3d', Math.max(1, cw * 0.6));
    const ic = pr(yerelNokta(T, s * 0.24, 0.21, -GOVDE.c - 0.6 * guc * titre));
    if (ic.ok)
      cokgenCiz([kok, yan1, ic, yan2], '#ffe08a');
  }
}
// Sürücü: tavan penceresinden göğsüne kadar çıkar, kameraya bakar, el sallar. Kornada iki elini kaldırır.
function surucuCiz(k, T, kb, cw) {
  const g = k.g, boy = clamp(g.boy, 0.98, 1.1), cc = (kb.c0 + kb.c1) / 2 + 0.04, ust = kb.y1;
  const delik = yuzCiz(T, [[-0.22, ust + 0.002, cc - 0.2], [0.22, ust + 0.002, cc - 0.2], [0.22, ust + 0.002, cc + 0.18], [-0.22, ust + 0.002, cc + 0.18]], '#1a1226', cw * 0.6);
  if (!delik)
    return;
  const korna = B >= k.korna && B < k.korna + KORNA_V, sevinc = korna || (B >= k.zip0 && B < k.zip1) || k.yildiz || turboVar(k);
  const gogus = pr(yerelNokta(T, 0, ust + 0.02, cc)), omuz = pr(yerelNokta(T, 0, ust + 0.2 * boy, cc));
  const ph = pr(yerelNokta(T, 0, ust + (0.2 + KAFA_R * 0.95) * boy + 0.01 * Math.cos(TAU * B), cc + 0.02));
  const sal = Math.sin(TAU * B + k.ar.faz * TAU);
  for (const s of [-1, 1]) {
    const omz = pr(yerelNokta(T, s * 0.15 * boy, ust + 0.17 * boy, cc));
    const sallayan = (s > 0) === k.ar.elSag;
    let el;
    if (sevinc)
      el = yerelNokta(T, s * (0.34 + 0.04 * sal) * boy, ust + (0.62 + 0.05 * Math.sin(TAU * B * 2 + s)) * boy, cc + 0.08);
    else if (sallayan)
      el = yerelNokta(T, s * (0.36 + 0.07 * sal) * boy, ust + (0.5 + 0.04 * Math.cos(TAU * B)) * boy, cc + 0.06);
    else
      el = yerelNokta(T, s * 0.3 * boy, ust + 0.03, cc + 0.16);
    const pe = pr(el);
    kapsulCiz(omz, 0.055 * boy, pe, 0.048 * boy, g.gomlek, cw);
    daireCiz(pe, 0.055 * boy, g.ten, cw);
  }
  kapsulCiz(gogus, 0.15 * boy, omuz, 0.165 * boy, g.yelek, cw);
  kafaCiz(k, ph, T.k);
}
// Sürücünün başının tepesi (ad etiketinin bağlandığı yer).
function basTepe(k, T) {
  const kb = KABIN[k.ar.kasa], boy = clamp(k.g.boy, 0.98, 1.1), cc = (kb.c0 + kb.c1) / 2 + 0.06;
  return pr(yerelNokta(T, 0, kb.y1 + (0.2 + KAFA_R * 0.95) * boy, cc));
}

/* ---- kancalar ---- */
function oyunCiz() {
  yolKenariEkle();
  gelinEkle();
  for (const k of D.oy.values()) {
    if (!k.ar)
      continue;
    const T = arabaDonusum(k), m = pr([T.x, 0.5, T.z]);
    if (!m.ok)
      continue;
    ozel(m.d, () => arabaCiz(k, T, false));
    const ph = basTepe(k, T);
    if (ph.ok) {
      const et = k._et || (k._et = { x: 0, y: 0, s: 0, d: 0 });
      et.x = ph.x;
      et.y = ph.y - KAFA_R * clamp(k.g.boy, 0.98, 1.1) * T.k * ph.s;
      et.s = ph.s;
      et.d = ph.d;
      // Ad sıralama kutusuna ve göstergeye girmesin: kadrajın üst kenarındaki arkadaki arabaların adı yazılmaz
      // (lider hariç). Şov yapanın adını oyunUst büyük yazar.
      const yildiz = D.sov && D.sov.k === k;
      if (!yildiz && (et.y >= ETIKET_UST || k === D.lider))
        k.et = et;
    }
  }
}
const ETIKET_UST = 560;
function oyunEkAdlar() { return [GELIN.etk]; }
// Ekranın üstünde, sıralı listenin üstüne çizilen ince yazı (korna, turbo): kontur + dolgu.
function ustYazi(metin, x, y, punto, renk) {
  c.font = punto + 'px "Paytone One", Rubik, system-ui, sans-serif';
  c.lineWidth = 4;
  c.strokeStyle = MUREKKEP;
  c.strokeText(metin, x, y);
  c.fillStyle = renk;
  c.fillText(metin, x, y);
}
// Listenin üstüne: konfeti parçaları, korna ve turbo yazıları, lider bayrağının uçuşu, şov yapanın büyük adı.
function oyunUst() {
  kirpintiCiz();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const k of D.oy.values()) {
    if (!k.ar)
      continue;
    const T = arabaDonusum(k);
    if (turboVar(k)) {
      // arabanın dış yanında (yol kenarına doğru), gövde hizasında: ad etiketine ve gelin arabasına binmesin
      const p = pr(yerelNokta(T, 0, 0.45, 0));
      if (p.ok) {
        const u = (B - k.turbo) / TURBO_V, yan = k.x + k.ox >= 0 ? 1 : -1;
        c.globalAlpha = Math.min(1, (1 - u) * 4);
        ustYazi('TURBO!', p.x + yan * p.s * 0.95, p.y, Math.round(clamp(p.s * 0.22, 15, 30)), RENK.sicak);
        c.globalAlpha = 1;
      }
      continue;
    }
    if (!(B >= k.korna && B < k.korna + KORNA_V))
      continue;
    const p = pr(yerelNokta(T, 0.5, 0.45, 0.6));
    if (!p.ok)
      continue;
    const u = (B - k.korna) / KORNA_V, olc = 0.8 + 0.35 * Math.sin(Math.min(1, u * 4) * HP), punto = Math.round(clamp(p.s * 0.2, 13, 26) * olc);
    c.globalAlpha = Math.min(1, (1 - u) * 3);
    ustYazi('DÜT!', p.x + (k.x + k.ox >= 0 ? 1 : -1) * p.s * 0.25, p.y - u * p.s * 0.3, punto, RENK.vurgu);
  }
  c.globalAlpha = 1;
  c.textBaseline = 'alphabetic';
  // Lider bayrağı el değiştirince eski liderin yerinden yenisine altın bir ışık izi akar.
  const bu = D.bayrakUcus;
  if (bu && bu.kime.ar) {
    const h2 = bu.kime, bas = B - bu.b0;
    for (let i = 0; i < 9; i++) {
      const t = clamp(bas / 0.9 - i * 0.07, 0, 1);
      if (t <= 0 || bas > 1.6)
        continue;
      const y = yumusak(t), p = pr([lerp(bu.x, h2.x + h2.ox, y), 0.8 + Math.sin(t * Math.PI) * 1.8, lerp(bu.z, h2.z + h2.oz, y)]);
      if (!p.ok)
        continue;
      c.globalAlpha = (1 - i / 9) * clamp(2 - bas, 0, 1);
      c.fillStyle = i % 2 ? '#ffd166' : '#fff4d0';
      c.beginPath();
      c.arc(p.x, p.y, p.s * (0.13 - i * 0.01), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  // Şov yapanın adı: sahnenin yıldızı, büyük ve vurgu renginde, arabanın önünde yola yazılır.
  if (D.sov && D.sov.k.ar && D.sov.k.yer > 0.3) {
    const k = D.sov.k, T = arabaDonusum(k), p = pr([T.x, 0, T.z - GOVDE.c * T.k - 0.35]);
    if (p.ok) {
      c.font = '30px "Paytone One", Rubik, system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const w = Math.min(420, c.measureText(k.ad).width + 40), x = clamp(p.x, w / 2 + 8, GW - w / 2 - 8), y = Math.min(ALAN_ALT - 30, p.y + 24);
      c.fillStyle = RENK.vurgu;
      c.strokeStyle = MUREKKEP;
      c.lineWidth = 3;
      c.beginPath();
      c.roundRect(x - w / 2, y - 24, w, 48, 24);
      c.fill();
      c.stroke();
      c.fillStyle = MUREKKEP;
      c.fillText(k.ad, x, y + 1, w - 24);
      ustYazi('DÜĞÜN ŞOVU!', x, y - 38, 22, RENK.sicak);
      c.textBaseline = 'alphabetic';
      k.oyunAd = { kutu: [x - w / 2, y - 24, w, 48], kare: kareSay };
    }
  }
}
// Konfeti parçaları: arabanın etrafında yukarı fırlar, dönerek düşer.
function kirpintiCiz() {
  for (const p of D.kirpinti) {
    const k = p.k, t = (B - p.b0) * 0.5;
    if (t < 0 || !k.ar)
      continue;
    const y = 0.6 + p.vy * t - 4.2 * t * t;
    if (y < 0)
      continue;
    const q = pr([k.x + k.ox + p.dx + p.vx * t, y, k.z + k.oz + p.dz + p.vz * t]);
    if (!q.ok)
      continue;
    const w = 0.07 * q.s, h = 0.04 * q.s * Math.abs(Math.cos(p.don + t * 9));
    c.globalAlpha = clamp((2.2 - (B - p.b0)) * 2, 0, 1);
    c.fillStyle = p.renk;
    c.fillRect(q.x - w / 2, q.y - h / 2, w, Math.max(1, h));
  }
  c.globalAlpha = 1;
}
