/* GELİN ARABASI — konvoyun en önündeki süslü beyaz araba. İzleyici değildir (D.oy'da yoktur): sıralamaya girmez,
 * boşta kalıp çıkmaz, hediye almaz. Tavanından gelin (duvaklı, taçlı) ile damat çıkıp el sallar. Kaputta kırmızı
 * fiyonk, köşelerden tavana tül, ön camın dibinde çiçek. Coşku yükseldikçe çevresine pırıltı saçar.
 * GELIN: arabanın durumu (araba çizimi izleyici arabalarıyla aynı alanları okur) · GELIN.etk: ad etiketi için özel
 * oyuncu (oyunEkAdlar) · gelinHazir / gelinGuncelle / gelinEkle.
 * Şov yapan araba gelin arabasının önüne geçerken gelin arabası yana yol verir (gelinGuncelle).
 */
const GELIN = { x: 0, z: GELIN_Z, ox: 0, oz: 0, oy0: 0, yonG: Math.PI, olcek: GELIN_OLCEK, korna: -99, far: -99,
  ar: { renk: '#fbf6ee', kasa: 'sedan', kurdele: '#e86a9a', faz: 0.3, plaka: 'GELİN' }, gelin: null, damat: null, etk: null };
function gelinHazir() {
  if (GELIN.gelin)
    return;
  // Baş çizimi (kafaCiz) bir oyuncu kaydı ister: karakterYap kaydı D.oy'a eklemez, yalnız görünüm üretir.
  const ge = karakterYap('npc-gelin', 'Gelin'), da = karakterYap('npc-damat', 'Damat');
  Object.assign(ge.g, { kadin: true, baslik: 'cicek', baslikRenk: '#fbefdc', gomlek: '#fbf6ee', yelek: '#fbf6ee', boy: 1.0, ten: '#f1c9a5', sac: '#5a3620' });
  Object.assign(da.g, { kadin: false, baslik: 'yok', gomlek: '#fbf6ee', yelek: '#2c2c38', boy: 1.06, biyik: false, ten: '#e3b48c', sac: '#2a1c16' });
  ge.guler = da.guler = true;
  GELIN.gelin = ge;
  GELIN.damat = da;
  // Etiket: vurgu renginde, öncelikli (ozel). Her karede gelinEkle yerini yazar.
  const et = karakterYap('npc-gelin-arabasi', 'Gelin arabası');
  et.ozel = true;
  et.son = -1e9;
  et.yeni = -1e9;
  et.sn = 99;
  GELIN.etk = et;
}
function gelinGuncelle(dt) {
  gelinHazir();
  // Şov yapan araba koridordan geçerken gelin arabası sağa çekilir, geçince ortaya döner.
  const sk = D.sov && D.sov.k, yolVer = sk && sk.z > GELIN_Z - 2.4 ? 1.5 : 0;
  const sal = azHareket ? 0 : 0.04 * Math.sin(TAU * B / 8);
  const once = GELIN.ox;
  GELIN.ox += (yolVer + sal - GELIN.ox) * Math.min(1, dt * 4);
  GELIN.oy0 = (0.02 + 0.02 * D.cosku) * (0.5 + 0.5 * Math.cos(TAU * B));
  // yana çekilirken burnu gittiği yana döner
  GELIN.yonG = Math.PI + clamp(-(GELIN.ox - once) / Math.max(dt, 1e-3) * 0.25, -0.3, 0.3);
  for (const h of [GELIN.gelin, GELIN.damat]) {
    const fx = Math.sin(GELIN.yonG), fz = Math.cos(GELIN.yonG);
    h.f[0] = fx;
    h.f[2] = fz;
    h.l[0] = -fz;
    h.l[2] = fx;
  }
  // Coşku yüksekken gelin arabasından pırıltı yükselir (konfeti parçasıyla aynı çizim, sahibi gelin arabası).
  if (!azHareket && D.cosku > 0.7 && Math.random() < dt * 10 * D.cosku && D.kirpinti.length < 260) {
    const a = Math.random() * TAU;
    D.kirpinti.push({ k: GELIN, b0: B, dx: Math.cos(a) * 0.5, dz: Math.sin(a) * 0.4, vx: Math.cos(a) * 0.4, vz: Math.sin(a) * 0.3, vy: 2.6, renk: Math.random() < 0.5 ? '#ffd166' : '#fbefdc', don: a });
  }
}
// D.kirpinti'nin sahibi kontrolü (D.oy.has) gelin arabasını tanımaz; onun parçaları için ayrı kimlik.
GELIN.id = 'npc-gelin-arabasi';
function gelinEkle() {
  gelinHazir();
  const T = arabaDonusum(GELIN), m = pr([T.x, 0.5, T.z]);
  if (!m.ok)
    return;
  ozel(m.d, () => arabaCiz(GELIN, T, true));
  // Adın yeri: gelin ile damadın başlarının ortasının üstü.
  const kb = KABIN.sedan, p = pr(yerelNokta(T, 0, kb.y1 + (0.2 + KAFA_R * 2.1) * 1.06, (kb.c0 + kb.c1) / 2 + 0.06));
  const et = GELIN.etk;
  if (p.ok)
    et.et = { x: p.x, y: p.y, s: p.s, d: p.d };
  else
    et.et = null;
}
// Gelin arabasının süsü: kaputta kocaman kırmızı fiyonk, köşelerden tavana tül kurdeleler, ön camın dibinde çiçekler.
function gelinSusu(k, T, kb, cw) {
  for (const s of [-1, 1]) {
    const a = pr(yerelNokta(T, s * 0.42, GOVDE.y1, GOVDE.c - 0.02)), b = pr(yerelNokta(T, s * kb.a, kb.y1, kb.c1)), o = pr(yerelNokta(T, s * 0.5, GOVDE.y1 + 0.16, (GOVDE.c + kb.c1) / 2));
    if (!a.ok || !b.ok || !o.ok)
      continue;
    for (const [renk, w] of [[MUREKKEP, 0.085], ['#fbefdc', 0.06], ['#e86a9a', 0.022]]) {
      c.strokeStyle = renk;
      c.lineWidth = w * a.s;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.quadraticCurveTo(o.x, o.y, b.x, b.y);
      c.stroke();
    }
  }
  for (let i = 0; i < 5; i++) {
    const p = pr(yerelNokta(T, (i - 2) * 0.13, GOVDE.y1 + 0.04, kb.c1 + 0.06));
    daireCiz(p, 0.06, i % 2 ? '#e86a9a' : '#fbefdc', cw * 0.7);
    daireCiz(p, 0.022, '#ffd166');
  }
  // arka tamponda teneke kutular (konvoy geleneği): iple bağlı, yolda zıplar
  for (let i = 0; i < 3; i++) {
    const zip = Math.abs(Math.sin(TAU * B + i * 1.3)) * 0.06;
    const ip = pr(yerelNokta(T, (i - 1) * 0.25, 0.15, -GOVDE.c)), kutu = pr(yerelNokta(T, (i - 1) * 0.3, 0.05 + zip, -GOVDE.c - 0.55 - i * 0.08));
    if (!ip.ok || !kutu.ok)
      continue;
    c.strokeStyle = 'rgba(40,24,48,.6)';
    c.lineWidth = Math.max(1, ip.s * 0.006);
    c.beginPath();
    c.moveTo(ip.x, ip.y);
    c.lineTo(kutu.x, kutu.y);
    c.stroke();
    daireCiz(kutu, 0.06, '#c9c3cf', cw * 0.6);
  }
  fiyonkCiz(pr(yerelNokta(T, 0, GOVDE.y1 + 0.03, GOVDE.c - 0.16)), T.k, Math.sin(TAU * B) * 0.06);
}
// Fiyonk: iki ilmek, düğüm ve iki kuyruk. p ekrandaki merkez, b büyüklük çarpanı, aci hafif sallanma.
function fiyonkCiz(p, b, aci) {
  if (!p.ok)
    return;
  const r = 0.2 * b * p.s;
  c.save();
  c.translate(p.x, p.y);
  c.rotate(aci);
  c.lineWidth = Math.max(1.5, p.s * 0.014);
  c.strokeStyle = MUREKKEP;
  c.fillStyle = '#c92a2a';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * r * 0.15, r * 0.1);
    c.lineTo(s * r * 0.35, r * 1.1);
    c.lineTo(s * r * 0.7, r * 0.95);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.fillStyle = '#e23d2f';
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * r * 0.62, -r * 0.05, r * 0.62, r * 0.38, s * -0.25, 0, TAU);
    c.fill();
    c.stroke();
  }
  c.fillStyle = '#ff7a6a';
  c.beginPath();
  c.arc(0, 0, r * 0.26, 0, TAU);
  c.fill();
  c.stroke();
  c.restore();
}
// Gelin ile damat tavan penceresinden yan yana çıkar. Gelinin arkasında tül duvak, başında taç; damat papyonlu.
// Biri hep el sallar; gelin arabası korna çaldığında (büyük hediyelerde) ikisi birden kollarını kaldırır.
function gelinCiftCiz(k, T, kb, cw) {
  const ust = kb.y1, cc = (kb.c0 + kb.c1) / 2 + 0.04;
  yuzCiz(T, [[-0.3, ust + 0.002, cc - 0.2], [0.3, ust + 0.002, cc - 0.2], [0.3, ust + 0.002, cc + 0.18], [-0.3, ust + 0.002, cc + 0.18]], '#1a1226', cw * 0.6);
  const sevinc = B >= k.korna && B < k.korna + 3;
  // yerel sol (+a) ekranın sağıdır: gelin ekranın solunda dursun diye -a tarafında
  for (const [h, a] of [[GELIN.damat, 0.16], [GELIN.gelin, -0.16]]) {
    const g = h.g, boy = g.boy, sal = Math.sin(TAU * B + a * 9);
    const omuz = pr(yerelNokta(T, a, ust + 0.2 * boy, cc)), gogus = pr(yerelNokta(T, a, ust + 0.02, cc));
    const ph = pr(yerelNokta(T, a, ust + (0.2 + KAFA_R * 0.95) * boy + 0.01 * Math.cos(TAU * B + a * 5), cc + 0.02));
    if (h === GELIN.gelin && ph.ok) {
      // duvak: başın arkasından omuzlara inen yarı saydam tül
      const R = KAFA_R * boy * T.k * ph.s;
      c.globalAlpha = 0.8;
      c.fillStyle = '#fffaf4';
      c.strokeStyle = 'rgba(40,24,48,.5)';
      c.lineWidth = Math.max(1, cw * 0.6);
      c.beginPath();
      c.moveTo(ph.x - R * 0.9, ph.y - R * 0.6);
      c.quadraticCurveTo(ph.x - R * 1.9, ph.y + R * 1.6, ph.x - R * 1.4, ph.y + R * 2.6);
      c.lineTo(ph.x + R * 1.4, ph.y + R * 2.6);
      c.quadraticCurveTo(ph.x + R * 1.9, ph.y + R * 1.6, ph.x + R * 0.9, ph.y - R * 0.6);
      c.closePath();
      c.fill();
      c.stroke();
      c.globalAlpha = 1;
    }
    // kollar: dışarıdaki kol sallanır (sevinçte ikisi de havada), içerideki tavana dayanır
    for (const s of [-1, 1]) {
      const omz = pr(yerelNokta(T, a + s * 0.13 * boy, ust + 0.17 * boy, cc));
      const disari = Math.sign(a) === s;
      let el;
      if (sevinc || disari)
        el = yerelNokta(T, a + s * (0.26 + 0.06 * sal) * boy, ust + (sevinc ? 0.6 : 0.48 + 0.04 * Math.cos(TAU * B)) * boy, cc + 0.07);
      else
        el = yerelNokta(T, a + s * 0.12 * boy, ust + 0.04, cc + 0.16);
      const pe = pr(el);
      kapsulCiz(omz, 0.05 * boy, pe, 0.044 * boy, g.gomlek, cw);
      daireCiz(pe, 0.05 * boy, h === GELIN.gelin ? '#fbf6ee' : g.ten, cw);
    }
    kapsulCiz(gogus, 0.14 * boy, omuz, 0.15 * boy, g.yelek, cw);
    if (h === GELIN.damat) {
      // papyon
      const pp = pr(yerelNokta(T, a, ust + 0.19 * boy, cc + 0.13));
      if (pp.ok) {
        const r = 0.04 * pp.s * T.k;
        c.fillStyle = '#c92a2a';
        c.beginPath();
        c.moveTo(pp.x, pp.y);
        c.lineTo(pp.x - r * 1.6, pp.y - r);
        c.lineTo(pp.x - r * 1.6, pp.y + r);
        c.closePath();
        c.moveTo(pp.x, pp.y);
        c.lineTo(pp.x + r * 1.6, pp.y - r);
        c.lineTo(pp.x + r * 1.6, pp.y + r);
        c.closePath();
        c.fill();
      }
    }
    kafaCiz(h, ph, T.k);
    if (h === GELIN.gelin && ph.ok) {
      // taç: başın tepesinde altın üç sivri
      const R = KAFA_R * boy * T.k * ph.s, y = ph.y - R * 0.95;
      c.fillStyle = '#ffd166';
      c.strokeStyle = MUREKKEP;
      c.lineWidth = Math.max(1, cw * 0.6);
      c.beginPath();
      c.moveTo(ph.x - R * 0.5, y + R * 0.18);
      c.lineTo(ph.x - R * 0.42, y - R * 0.22);
      c.lineTo(ph.x - R * 0.2, y);
      c.lineTo(ph.x, y - R * 0.34);
      c.lineTo(ph.x + R * 0.2, y);
      c.lineTo(ph.x + R * 0.42, y - R * 0.22);
      c.lineTo(ph.x + R * 0.5, y + R * 0.18);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
}
