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
// Yolun ölçüsü: asfalt yarı genişliği 4,2 m; hiçbir arabanın kenarı orta çizgiden 4,25 m'yi geçmez (kaldırıma çıkmaz).
// Biri geçerken (D.koridor) yerindeki arabalar yolAcPay kadar yana kayar, geçiş yolu boş kalır:
//   tek sıra: yerdekiler 0'dan -1,4'e, geçen +1,3'ten · iki şerit: şeritler ±1,75'ten ±2,5'e, geçen ortadan (0)
// En geniş araba (minibüs) 1,82 m: geçen ile şerit arasında ~0,6 m kalır, en dıştaki kenar 3,41 m'dir (sınır 4,25).
// Değerler 00-ayar.js YOL_OLCU'da.
// Katılan, öne geçen (hediye, yeni gelin arabası, drift) ve çıkan araba aynı geçiş yolunu kullanır; karşılaşırlarsa
// çarpışma çözücü (carpismaCoz) birini bekletir, içinden geçmezler.
function gecisL() { return YOL_OLCU.gecisYolu[D.kolon]; }
function yolAcPay(k) { return D.kolon === 1 ? YOL_OLCU.koridorKayma[1] : (k.hedefL > 0 ? 1 : -1) * YOL_OLCU.koridorKayma[2]; }
function cikisL() { return gecisL(); }
const YOL_SINIR = YOL_OLCU.arabaSinir;
// Yerinden uzakta olan (yeni katılan, öne ya da arkaya geçen) "geçen"dir: geçiş yolundan gider.
const GECEN_ESIK = 3;
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
  else if (k.gecer)
    // yerinden uzakta (yeni katılmış, öne ya da geriye geçen): geçiş yolundan gider
    hl = gecisL();
  // İleri geri: uzaktaysa hızlı (drift atan konvoyu sollayarak öne fırlar), yaklaştıkça yavaşlar.
  const ds = hs - k.gs, ads = Math.abs(ds);
  if (ads > 0.002) {
    const v = Math.min(yildiz ? 30 : 15, 1.2 + ads * (yildiz ? 1.4 : 1.0));
    let adim = Math.sign(ds) * Math.min(ads, v * dt);
    // Öne giden (geçen), önündeki (aynı yanal çizgideki) arabaya bir araba boyu + çözücü payından çok yaklaşmaz; öndeki
    // geri geliyorsa (yerine çekiliyor) geçen de yol verip geri çekilir: geçiş yolunda iki araba birbirini itmez.
    if (k.gecer) {
      const l0 = k.gl + k.ox, bosluk = YOL_OLCU.arabaBoy + CARPISMA_PAY + 0.15;
      for (const o of D.oy.values())
        if (o !== k && o.ar && o.gs > k.gs && o.gs - k.gs < 12 && Math.abs(o.gl + o.ox - l0) < YOL_OLCU.arabaEn + 0.15)
          adim = Math.min(adim, o.gs - k.gs - bosluk);
      adim = Math.max(adim, -6 * dt);
    }
    k.gs += adim;
  }
  const dl = hl - k.gl, adl = Math.abs(dl);
  if (adl > 0.002)
    k.gl += Math.sign(dl) * Math.min(adl, Math.min(3.4, 0.4 + adl * 2.2) * dt);
  const yerinde = ads < 1.2 && !k.cikiyor;
  k.yer += ((yerinde ? 1 : 0) - k.yer) * Math.min(1, dt * 6);

  // Şeritte hafif salınım (her arabanın kendi evresiyle) ve zigzag dalgası (öndeki sıra önce kıvrılır).
  let ox = azHareket ? 0 : 0.12 * Math.sin(TAU * B / 8 + k.ar.faz * TAU) * k.yer, os = 0, sapma = null;
  const zz = D.zigzag;
  // Zigzag şeritler arası boşluğa göre: tek sırada geniş, üç şeritte dar; biri geçerken (koridor) zigzag yapılmaz.
  // (koridor açıkken de kıvrılır ama az; geçen araba kıvrılmaz)
  if (zz && !yildiz && !k.cikiyor && !k.gecer && !azHareket) {
    const u = B - zz.bas, sira = -k.hedefS / SIRA_ARA;
    if (u >= 0 && u < zz.sure)
      // koridor açıkken genlik küçük: geçiş yolu boş kalsın
      ox += (D.koridor ? [0.4, 0.25] : [1.0, 0.75])[D.kolon - 1] * Math.sin(Math.PI * u / zz.sure) * Math.sin(TAU * u / 4 - sira * 0.9);
  }
  // Drift şovunda öteki arabalar iki yana açılır: ortada yıldızın koridoru kalır (tek sırada hepsi sağa).
  // Drift atan ya da yeni gelin arabası öne geçerken öteki arabalar geçiş yolundan yana açılır.
  const acik = (D.koridor || dr) && !yildiz && !k.cikiyor && !k.gecer;
  if (acik)
    ox += k === D.lider ? (dr && dr.donus === null ? SERIT_L + YOL_OLCU.koridorKayma[2] : 0) : yolAcPay(k);
  k.ox += (ox - k.ox) * Math.min(1, dt * (acik ? 4 : 10));
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
  // Zıplama bütün arabayı kaldırır (tekerlekler de). Süspansiyon yalnız gövdeyi taşır ve sınırlıdır: tekerleğin üstündeki
  // her köşede gövde en çok SUSP_INIS kadar iner, SUSP_KALKIS kadar kalkar (yaylanma + viraja yatma + fren eğilmesi
  // toplamı). Kemer ile lastik arasındaki boşluk 7,5 cm olduğu için tekerlek hiçbir hareket evresinde gövdeye girmez.
  k.zipY = azHareket ? 0 : zip;
  const K = KASA[k.ar.tip], xm = Math.max(Math.abs(K.teker[0]), Math.abs(K.teker[1])), zm = K.W / 2 - 0.13;
  const yayY = azHareket ? 0 : SUSP_YAY * yay, egilme = xm * Math.abs(k.bas) + zm * Math.abs(k.yalpa);
  const olcek = egilme > 1e-6 ? Math.min(1, (yayY + SUSP_INIS) / egilme, (SUSP_KALKIS - yayY) / egilme) : 1;
  k.yayY = yayY;
  k.basC = k.bas * olcek;
  k.yalpaC = k.yalpa * olcek;
  k.oy0 = k.zipY + yayY;
}
const SUSP_YAY = 0.03, SUSP_INIS = 0.035, SUSP_KALKIS = 0.07;

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
  // Kim geçiyor: yerinden GECEN_ESIK metreden uzak olan (gelin arabası hariç değil: öne geçen yeni gelin arabası da).
  // Biri geçiyorsa (ya da drift atan öne fırlıyorsa) koridor açıktır.
  let koridor = false;
  for (const k of D.oy.values()) {
    arabaHazir(k);
    // Geçen: öne doğru yerinden uzak (sollayan, katılan, öne geçen gelin arabası). Geriye kayan araba (önüne biri geçti)
    // geçiş yolunu kullanmaz, kendi şeridinde (ya da yeni şeridine) kayar: arkasındakiler de aynı anda kayar.
    const ileri = k.hedefS - k.gs;
    k.gecer = !k.cikiyor && !(dr2(k)) && ileri > (k.gecer ? 1.2 : GECEN_ESIK);
    // çıkan araba da geçiş yolunu kullanır: koridor onun için de açılır
    koridor = koridor || k.gecer || (k.cikiyor && !k.gitti) || (D.drift && D.drift.k === k && D.drift.donus === null);
  }
  D.koridor = koridor;
  for (const k of D.oy.values())
    arabaHareket(k, dt);
  carpismaCoz();
}
const dr2 = k => D.drift && D.drift.k === k;
/* ---- çarpışma: iki arabanın kutusu hiç kesişmez ---- */
// Her araba yolun (s, l) düzleminde yönlü bir kutudur (boyu tamponlar arası, eni aynalarla). Kesişen çiftler en kısa
// eksen boyunca (SAT) ayrılır: yerinde duran, gelin arabası ve dönen drift arabası ağır (az kayar), geçen, katılan ve
// çıkan hafif (yol verir). Birkaç tur; sonra en küçük aralık ve kesişen çift sayısı D.carpisma'ya yazılır (test okur).
const CARPISMA_PAY = 0.35;
function kutuBilgi(k) {
  const K = KASA[k.ar.tip], a = k.yonO || 0;
  return { k, s: k.gs + k.os, l: k.gl + k.ox, c: Math.cos(a), n: Math.sin(a), hl: YOL_OLCU.arabaBoy / 2, hw: YOL_OLCU.arabaEn / 2 + 0.03,
    m: k.cikiyor || k.gecer ? 1 : k === D.lider || dr2(k) ? 0.05 : 0.15 };
}
// İki kutunun en küçük ayrılma ekseni: [derinlik (eksi: aralık), eksen s, eksen l]
function kutuAyir(A, Bk, pay) {
  const ds = Bk.s - A.s, dl = Bk.l - A.l;
  let enAz = Infinity, es = 0, el = 0;
  for (const [us, ul] of [[A.c, A.n], [-A.n, A.c], [Bk.c, Bk.n], [-Bk.n, Bk.c]]) {
    const r = A.hl * Math.abs(A.c * us + A.n * ul) + A.hw * Math.abs(-A.n * us + A.c * ul) + Bk.hl * Math.abs(Bk.c * us + Bk.n * ul) + Bk.hw * Math.abs(-Bk.n * us + Bk.c * ul);
    const p = ds * us + dl * ul, derin = r + pay - Math.abs(p);
    if (derin < enAz) {
      enAz = derin;
      es = p >= 0 ? us : -us;
      el = p >= 0 ? ul : -ul;
    }
  }
  return [enAz, es, el];
}
// Kaldırım: arabanın kenarı yol çizgisini (YOL_SINIR) geçmesin; geçerse içeri alınır. Kaldırıma dayanan araba itilemez:
// kesişme çözülürken itilen öbür araba kalan payı alır (çözücü kaldırım sınırını her turda yeniden uygular).
function kaldirimSinir(A) {
  const tasma = Math.abs(A.l) + A.hw - 0.12 + A.hl * Math.abs(A.n) - YOL_SINIR;
  if (tasma <= 0)
    return false;
  const d = Math.sign(A.l) * tasma;
  A.l -= d;
  A.k.gl -= d;
  return true;
}
function carpismaCoz() {
  const kutular = [];
  for (const k of D.oy.values())
    if (k.ar)
      kutular.push(kutuBilgi(k));
  let kaldirim = 0;
  for (const A of kutular)
    if (kaldirimSinir(A))
      kaldirim++;
  kutular.sort((a, b) => a.s - b.s);
  for (let tur = 0; tur < 16; tur++) {
    let degisti = false;
    for (let i = 0; i < kutular.length; i++)
      for (let j = i + 1; j < kutular.length && kutular[j].s - kutular[i].s < 6; j++) {
        const A = kutular[i], Bk = kutular[j], [d, es, el] = kutuAyir(A, Bk, CARPISMA_PAY);
        if (d <= 0)
          continue;
        // kaldırıma dayanmış (o yöne itilemeyen) arabanın yan payı öbürüne geçer
        const duvarA = el !== 0 && Math.abs(A.l - el) + A.hw - 0.12 > YOL_SINIR && Math.sign(-el) === Math.sign(A.l);
        const duvarB = el !== 0 && Math.abs(Bk.l + el) + Bk.hw - 0.12 > YOL_SINIR && Math.sign(el) === Math.sign(Bk.l);
        let pa = A.m / (A.m + Bk.m);
        if (duvarA && !duvarB)
          pa = 0;
        else if (duvarB && !duvarA)
          pa = 1;
        const pb = 1 - pa;
        A.s -= es * d * pa;
        A.l -= el * d * pa;
        Bk.s += es * d * pb;
        Bk.l += el * d * pb;
        A.k.gs -= es * d * pa;
        A.k.gl -= el * d * pa;
        Bk.k.gs += es * d * pb;
        Bk.k.gl += el * d * pb;
        degisti = true;
      }
    for (const A of kutular)
      if (kaldirimSinir(A))
        degisti = true;
    if (!degisti)
      break;
    kutular.sort((a, b) => a.s - b.s);
  }
  // Son güvence: hâlâ kesişen kalırsa (yana itilecek yer yok) önden arkaya tek bir süpürme. Öndeki arabalar yerinde
  // kalır, sıradaki araba önündeki herhangi bir arabayla kesişiyorsa yol boyunca o kadar geri çekilir. Önden arkaya
  // gidildiği için sonunda hiçbir çift kesişmez (geride hep boş yol vardır): geçen araba sıradakinin arkasında bekler.
  kutular.sort((a, b) => b.s - a.s);
  const yerlesen = [];
  for (const A of kutular) {
    for (let tur = 0; tur < 4; tur++) {
      let geri = 0;
      for (const O of yerlesen) {
        if (O.s - A.s > 7)
          continue;
        if (kutuAyir(A, O, 0.05)[0] <= 0)
          continue;
        const r = A.hl * Math.abs(A.c) + A.hw * Math.abs(A.n) + O.hl * Math.abs(O.c) + O.hw * Math.abs(O.n) + 0.05;
        geri = Math.max(geri, r - (O.s - A.s));
      }
      if (geri <= 0)
        break;
      A.s -= geri;
      A.k.gs -= geri;
    }
    yerlesen.push(A);
  }
  // ölçüm (pay olmadan): kesişen çift ve en küçük aralık
  let cift = 0, enAz = Infinity;
  for (let i = 0; i < kutular.length; i++)
    for (let j = i + 1; j < kutular.length && kutular[j].s - kutular[i].s < 6; j++) {
      const d = kutuAyir(kutular[i], kutular[j], 0)[0];
      if (d > 0.01) {
        cift++;
        // ilk kesişmenin kimler arasında olduğu (test raporu için)
        const durum = k => (k === D.lider ? 'gelin ' : '') + (dr2(k) ? 'drift ' : '') + (k.cikiyor ? 'cikan ' : '') + (k.gecer ? 'gecen ' : '') + 'yer' + k.yer.toFixed(1);
        if (!D.carpisma.ornek)
          D.carpisma.ornek = [durum(kutular[i].k), durum(kutular[j].k), +d.toFixed(2), D.kolon, D.koridor];
      }
      enAz = Math.min(enAz, -d);
    }
  const o = D.carpisma;
  o.kaldirim = (o.kaldirim || 0) + (kaldirim ? 1 : 0);
  o.cift = Math.max(o.cift, cift);
  o.enAz = Math.min(o.enAz, enAz);
  o.kare++;
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
