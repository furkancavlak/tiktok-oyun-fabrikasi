/* KONVOY HAREKETİ — kıvrılan yol, arabaların yerine sürülmesi, şerit salınımı, zigzag, drift, havai fişek, duman.
 * yolX(s) / yolEgim(s) / yolEgri(s): yolun orta çizgisi (s ileri metre; iki yavaş sinüsün toplamı, konvoy görünür
 * biçimde kıvrılır) · yolNokta(s, l, y, out): yolda s, yandan l (artı = sol), yerden y noktası, çizim koordinatında
 * (dünya eksi DUNYA.koken: uzun yayında sayılar büyüyüp titremesin diye) · yolYon(s): yolun o noktadaki yönü (açı)
 * arabaHareket(k, dt): yerine sür, çık, drift · Kanca: oyunGuncelle(dt).
 * Her araba: gs / gl (yoldaki yeri), os / ox (zigzag, drift dönüşü, koridor payı), yonO (yola göre sapma açısı),
 * oy0 (zıplama), yalpa / bas (yana yatma, öne eğilme), teker (tekerleğin dönüş açısı), hizM (gerçek hız, m/s).
 * Bütün hareket vuruşa (B) bağlıdır; yolun akışı da: B geri gitmediği için konvoy hiç geri gitmez.
 */
function yolX(s) { return 11 * Math.sin(s / 85) + 5 * Math.sin(s / 37 + 1.7); }
function yolEgim(s) { return 11 / 85 * Math.cos(s / 85) + 5 / 37 * Math.cos(s / 37 + 1.7); }
function yolEgri(s) { return -11 / 7225 * Math.sin(s / 85) - 5 / 1369 * Math.sin(s / 37 + 1.7); }
// Yolun yönü (y ekseni etrafında, three.js'in rotation.y anlamında): yerel +x ileri bakar.
function yolYon(s) { return Math.atan2(-1, yolEgim(s)); }
function yolNokta(s, l, y, out) {
  const e = yolEgim(s), n = 1 / Math.sqrt(1 + e * e);
  out.x = yolX(s) + l * n - DUNYA.kx;
  out.y = y;
  out.z = s - l * e * n - DUNYA.kz;
  return out;
}

let sonDt = 0.016;
// Geçiş yolu: arkadan gelen (yeni katılan, öne geçen yeni gelin arabası, drift atan) bu yanal çizgiden ilerler, yerine
// yaklaşınca kendi şeridine kayar. Öteki arabalar o sürerken geçiş yolundan yana açılır (yolAc).
function gecisL() { return D.kolon === 1 ? 2.1 : D.kolon === 2 ? 0 : -3.3; }
function yolAcPay(k) { return D.kolon === 1 ? -2.0 : D.kolon === 2 ? (k.hedefL > 0 ? 0.95 : -0.95) : 1.0; }
// Çıkan araba kaldırım tarafına çekilir (geçiş yolunun öbür yanı).
function cikisL(k) { return D.kolon === 1 ? -3.5 : D.kolon === 2 ? (k.gl >= 0 ? 3.5 : -3.5) : 3.6; }
function arabaHareket(k, dt) {
  let hs = k.hedefS, hl = k.hedefL;
  const dr = D.drift, yildiz = dr && dr.k === k;
  if (k.cikiyor) {
    // Çıkan arabanın hızı düşer, kaldırıma çekip geride kalır.
    if (k.cikS === undefined) {
      k.cikS = k.gs;
      k.cikL = cikisL(k);
    }
    hl = k.cikL;
    // önce kenara çeker, sonra geride kalır
    hs = k.gs - (Math.abs(k.gl - hl) < 0.8 ? 30 : 3);
    k.gitti = k.gs < k.cikS - 24;
  }
  else if (yildiz) {
    hs = DRIFT_ON;
    hl = dr.donus === null && Math.abs(hs - k.gs) > 4 ? gecisL() : 0;
  }
  else if (Math.abs(hs - k.gs) > 6 && k.yer < 0.9)
    // yerinden uzakta (yeni katılmış, öne geçen): geçiş yolundan gider
    hl = gecisL();
  // İleri geri: uzaktaysa hızlı (drift atan konvoyu sollayarak öne fırlar), yaklaştıkça yavaşlar.
  const ds = hs - k.gs, ads = Math.abs(ds);
  if (ads > 0.002) {
    const v = Math.min(yildiz ? 30 : 15, 1.2 + ads * (yildiz ? 1.4 : 1.0));
    k.gs += Math.sign(ds) * Math.min(ads, v * dt);
  }
  const dl = hl - k.gl, adl = Math.abs(dl);
  if (adl > 0.002)
    k.gl += Math.sign(dl) * Math.min(adl, Math.min(3.4, 0.4 + adl * 2.2) * dt);
  const yerinde = ads < 1.2 && !k.cikiyor;
  k.yer += ((yerinde ? 1 : 0) - k.yer) * Math.min(1, dt * 6);

  // Şeritte hafif salınım (her arabanın kendi evresiyle) ve zigzag dalgası (öndeki sıra önce kıvrılır).
  let ox = azHareket ? 0 : 0.12 * Math.sin(TAU * B / 8 + k.ar.faz * TAU) * k.yer, os = 0, sapma = null;
  const zz = D.zigzag;
  if (zz && !yildiz && !k.cikiyor && !azHareket) {
    const u = B - zz.bas, sira = -k.hedefS / SIRA_ARA;
    if (u >= 0 && u < zz.sure)
      ox += 1.15 * Math.sin(Math.PI * u / zz.sure) * Math.sin(TAU * u / 4 - sira * 0.9);
  }
  // Drift şovunda öteki arabalar iki yana açılır: ortada yıldızın koridoru kalır (tek sırada hepsi sağa).
  // Drift atan ya da yeni gelin arabası öne geçerken öteki arabalar geçiş yolundan yana açılır.
  const gecen = dr && dr.donus === null ? dr.k : D.yolAc;
  const acik = gecen && gecen !== k && !k.cikiyor && k.yer > 0.5;
  if (acik || (dr && !yildiz && !k.cikiyor))
    ox += yolAcPay(k);
  k.ox += (ox - k.ox) * Math.min(1, dt * (dr || acik ? 4 : 10));
  if (yildiz && dr.donus !== null && !azHareket) {
    // Drift: dört vuruşun ikisinde yerinde küçük bir daire çizerek tam tur döner, ikisinde poz verir.
    const su = B - dr.donus;
    if (su >= 0) {
      const u = su % 4, t = u < 2 ? yumusak(u / 2) : 1, a = TAU * t;
      sapma = a;
      k.ox = 1.5 * Math.sin(a);
      os = 1.1 * (1 - Math.cos(a));
      // duman vuruş saatiyle çıkar: vuruşun her on altıda birinde iki lastikten birer bulut
      if (u < 2 && D.duman.length < 70 && Math.floor(B * 16) !== Math.floor((k._dumanB ?? B) * 16))
        for (const ar of [-1.3, 1.3]) {
          const p = yolNokta(D.yol + k.gs + os + ar * Math.cos(a), k.gl + k.ox - ar * Math.sin(a), 0, rejiV0);
          D.duman.push({ x: p.x + DUNYA.kx + (Math.random() - 0.5) * 0.6, z: p.z + DUNYA.kz + (Math.random() - 0.5) * 0.6, b0: B, r: 0.6 + Math.random() * 0.5 });
        }
    }
  }
  k._dumanB = B;
  k.os = os;
  // Yön: arabanın gerçek hızının yönü (yola göre). Şerit değiştiren, zigzag yapan araba gittiği yana kırılır.
  const sToplam = k.gs + k.os, lToplam = k.gl + k.ox;
  const vs = D.hiz + (sToplam - (k._sOnce ?? sToplam)) / Math.max(dt, 1e-3), vl = (lToplam - (k._lOnce ?? lToplam)) / Math.max(dt, 1e-3);
  k._sOnce = sToplam;
  k._lOnce = lToplam;
  const hedefYon = sapma !== null ? sapma : clamp(Math.atan2(vl, Math.max(2, vs)), -0.6, 0.6);
  const yonOnce = k.yonO;
  k.yonO = sapma !== null ? sapma : k.yonO + aciFark(k.yonO, hedefYon) * Math.min(1, dt * 6);
  const yonHiz = aciFark(yonOnce, k.yonO) / Math.max(dt, 1e-3) + D.hiz * yolEgri(D.yol + k.gs);
  k.hizM = Math.hypot(vs, vl);
  // Viraja yatma ve fren / gaz eğilmesi (yumuşatılmış); tekerlekler gerçek hızla döner.
  k.yalpa += (clamp(-k.hizM * yonHiz * 0.012, -0.07, 0.07) - k.yalpa) * Math.min(1, dt * 5);
  const ivme = (vs - (k._vOnce ?? vs)) / Math.max(dt, 1e-3);
  k._vOnce = vs;
  k.bas += (clamp(-ivme * 0.004, -0.04, 0.04) - k.bas) * Math.min(1, dt * 4);
  k.teker = (k.teker + k.hizM * dt / TEKER_R) % TAU;
  // Yükseklik: her vuruşta süspansiyon yaylanır (sıra arkaya doğru gecikir), hediye sevincinde araba zıplar.
  const yay = 0.5 + 0.5 * Math.cos(TAU * (B + k.hedefS * 0.012));
  let zip = 0;
  if (B >= k.zip0 && B < k.zip1)
    zip = (yildiz ? 0.14 : 0.3) * Math.abs(Math.sin(Math.PI * (B - k.zip0)));
  k.oy0 = azHareket ? 0 : 0.035 * yay + zip;
  k.zipY = azHareket ? 0 : zip;
}

function oyunGuncelle(dt) {
  sonDt = dt;
  // Yol konvoyun altından akar: hız vuruşa bağlı, gaz (coşku) arttıkça hızlanır. B geri gitmez.
  const db = clamp(B - D.sonB, 0, 1), adim = db * (3.6 + 4.6 * D.cosku);
  D.sonB = B;
  D.yol += adim;
  D.hiz += (adim / Math.max(dt, 1e-3) - D.hiz) * Math.min(1, dt * 3);
  if (D.zigzag && B > D.zigzag.bas + D.zigzag.sure)
    D.zigzag = null;
  // drift: sırası gelen en öne fırlar; vardığı vuruştan sonra 16 vuruş döner (12 vuruşta varamazsa yine başlar)
  const dr = D.drift;
  if (dr && dr.donus === null && (dr.k.yer > 0.6 || B > dr.bas + 12)) {
    // vardı: dönüşler başlar, reji şovu ona verir (bir sonraki ölçü çizgisinde keser)
    dr.donus = Math.ceil(B);
    rejiOlay('sov', dr.k);
  }
  if (dr && ((dr.donus !== null && B > dr.donus + DRIFT_V) || dr.k.cikiyor || !D.oy.has(dr.k.id))) {
    dr.k.yildiz = dr.k.guler = false;
    D.drift = null;
  }
  if (!D.drift && D.driftKuyruk.length) {
    const k = D.driftKuyruk.shift();
    if (!k.cikiyor && D.oy.has(k.id)) {
      k.yildiz = k.guler = true;
      k.yer = 0;
      D.drift = { k, bas: Math.ceil(B) + 1, donus: null };
      kornaCal(k);
    }
  }
  if (D.kurdeleUcus && B - D.kurdeleUcus.b0 > D.kurdeleUcus.sure)
    D.kurdeleUcus = null;
  // havai fişek: şov sürerken her vuruşta bir yenisi atılır
  if (B < D.fisekBit && Math.floor(B) !== Math.floor(B - db))
    fisekAt(1);
  for (let i = D.fisekler.length - 1; i >= 0; i--)
    if (B - D.fisekler[i].b0 > 4)
      D.fisekler.splice(i, 1);
  for (let i = D.duman.length - 1; i >= 0; i--)
    if (B - D.duman[i].b0 > 3)
      D.duman.splice(i, 1);
  muzik.sov = B < D.sovBit;
  for (const k of D.oy.values()) {
    arabaHazir(k);
    arabaHareket(k, dt);
  }
}
// Gökte bir havai fişek: önce yükselir, sonra açılır. Kameranın baktığı yönde, ufkun üstünde patlar (gök gösteren
// çekimlerde görünür; reji şov sürerken gök göstermeyen çekime geçmez). Görünüm süs olduğu için Math.random kullanır.
function fisekAt(n) {
  for (let i = 0; i < n && D.fisekler.length < 14; i++) {
    const kam3 = DUNYA.kamera, ileri = Math.atan2(kam3 ? DUNYA.bakis.x : 0, kam3 ? DUNYA.bakis.z : 1);
    const uz = 70 + Math.random() * 50, yan = (Math.random() - 0.5) * 1.1, a = ileri + yan;
    const cx = kam3 ? kam3.position.x + DUNYA.kx : 0, cz = kam3 ? kam3.position.z + DUNYA.kz : D.yol + 80;
    D.fisekler.push({ x: cx + Math.sin(a) * uz, z: cz + Math.cos(a) * uz, y: 26 + Math.random() * 22, b0: B + i * 0.35,
      renk: FISEK_RENK[Math.floor(Math.random() * FISEK_RENK.length)], renk2: Math.random() < 0.5 ? '#ffe08a' : '#ffffff', n: 34 + Math.floor(Math.random() * 14), aci: Math.random() * TAU });
  }
}
const FISEK_RENK = ['#ff3b30', '#ff2d95', '#2e7dff', '#19c37d', '#ffb000', '#b04dff'];
