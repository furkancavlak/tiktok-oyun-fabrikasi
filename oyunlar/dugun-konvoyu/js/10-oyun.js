/* KONVOY DURUMU — diziliş, hediye etkileri, liderlik devri, şov kuyruğu.
 * Konvoy kameraya doğru gider (yerel ileri = -z). En önde gelin arabası (GELIN: izleyici değildir, 45-gelin.js),
 * sağ arkasında konvoy lideri (D.lider, en çok hediye atan), onun arkasında en çok dört şeritte uzayan konvoy.
 * Öndeki sıralar daha çok hediye atanlardır; komşu şeritler yarım sıra kaydırılır ki arkadakinin yüzü öndekinin
 * arkasında kalmasın.
 * D'ye eklenenler: kolon (şerit sayısı), sovKuyruk + sov ({ k, bas }: gelin arabasının önüne geçip dönen),
 * bayrakUcus (lider bayrağının yeni lidere uçuşu), fisekler, fisekBit / sovBit, yolW, kayma, duman, kirpinti
 * (arabanın etrafındaki konfeti parçaları, dünya ekseninde), sonB, sonHediye (aynı hediyenin iki kez işlenmesine karşı).
 * Oyuncuya eklenenler (arabaHazir): ar (renk, kasa, plaka), korna, far, sus (0–3 kalıcı süs), isik (süs ışığının
 * parladığı vuruş), turbo (turbonun başladığı vuruş), konfetiB.
 * Süreler vuruşla (B) ölçülür: korna 1,5 vuruş, turbo 6, bayrak geçişi 2, şov 16.
 * Kancalar: oyunYerlesim, oyunGiris, oyunHediye, oyunLiderDegisti, oyunBaslat, oyunBosalt, oyunDurum.
 */
const ARA_X = 1.25;     // yan yana iki şerit arası (metre)
const ARA_X2 = 2.0;     // iki şeritte daha açık: arkadakiler liderin iki yanından görünsün
const ARA_Z = 2.4;      // aynı şeritte iki araba arası
const GELIN_Z = -1.6;   // gelin arabasının yeri (x = 0)
const LIDER_Z = 1.6;    // konvoy liderinin yeri: gelin arabasının hemen arkası,
const LIDER_X = 1.1;    // biraz sağında: tam arkasında olsa gelin ile damadın başları onu örterdi
const ILK_SIRA = 2.6;   // lider ile ilk sıra arası
const SOV_Z = -5.6;     // şov yapanın yeri: gelin arabasının önündeki boş yol
const KORNA_V = 1.5, TURBO_V = 6, SOV_V = 16, BAYRAK_V = 2;
const GELIN_OLCEK = 1.28, LIDER_OLCEK = 1.12, SOV_OLCEK = 2.0;
const SUS_EN = 3;       // süs en çok üç kat birikir: 1 balon + kurdele, 2 ışık zinciri, 3 kaputta çiçek
Object.assign(D, { kolon: 1, sovKuyruk: [], sov: null, bayrakUcus: null, fisekler: [], fisekBit: -1, sovBit: -1, yolW: 2.4, kayma: 0, duman: [], kirpinti: [], sonB: 0, sonHediye: new Map() });

// Konvoy önce uzar, sonra genişler: liderin arkasında 1–2 araba tek sıra, 9'da iki şerit, 36'da dört şerit.
function kolonSayisi(m) { return m <= 1 ? 1 : m <= 8 ? 2 : m <= 20 ? 3 : 4; }
function oyunYerlesim() {
  const m = D.sira.length - 1, kol = kolonSayisi(m), yerler = [];
  D.kolon = kol;
  for (let i = 0; i < kol; i++)
    yerler.push(i - (kol - 1) / 2);
  // Sıranın içi ortadan kenara dolar: sıradaki en yüksek jeton ortaya gelir.
  yerler.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  D.sira.forEach((k, i) => {
    arabaHazir(k);
    if (i === 0) {
      k.hedefX = LIDER_X;
      k.hedefZ = LIDER_Z;
      return;
    }
    const s = Math.floor((i - 1) / kol), o = yerler[(i - 1) % kol];
    const kay = kol === 2 ? (o > 0 ? 0.5 : 0) : Math.abs(o) >= 1 ? 0.5 : 0;
    k.hedefX = o * (kol === 2 ? ARA_X2 : ARA_X);
    k.hedefZ = LIDER_Z + ILK_SIRA + ARA_Z * (s + kay);
  });
}
// Yeni gelen konvoyun sonuna arkadan, kendi şeridinin biraz dışından gelip yerine girer; motoru kükrer.
function oyunGiris(k) {
  arabaHazir(k);
  k.x = k.hedefX + (k.hedefX >= 0 ? 0.8 : -0.8);
  k.z = k.hedefZ + 9;
  k.yon = Math.PI;
  sesMotor();
}

/* ---- hediyeler ---- */
function kornaCal(k, gecikme) {
  k.korna = B + (gecikme || 0);
  k.far = k.korna;
}
// Bütün konvoy korna çalar: öndekiler biraz önce başlar, ses arkaya doğru dalga gibi yayılır.
function hepsiKorna() {
  for (const k of D.oy.values())
    if (!k.cikiyor)
      kornaCal(k, Math.min(1, k.sn * 0.06));
  GELIN.korna = B;
}
// Aynı hediye olayı (aynı kişi, aynı hediye, aynı adet) çok kısa arayla ikinci kez gelirse sahnedeki etki
// yinelenmez. Jetonu çekirdek sayar (cekirdek/js/20-oyuncular.js); olay kimliğine göre süzmek çekirdeğin işi
// olurdu, oyun yalnız görüntüyü korur. 0,35 sn: elle iki kez basılan aynı hediye ayrı sayılsın diye kısa.
const HEDIYE_TEKRAR_SN = 0.35;
function hediyeTekrarMi(k, hediye, sayi) {
  const anahtar = k.id + '|' + (hediye && hediye.id || '') + '|' + (sayi ? sayi.birim + 'x' + sayi.adet : '');
  const once = D.sonHediye.get(anahtar);
  D.sonHediye.set(anahtar, zaman);
  if (D.sonHediye.size > 200)
    for (const [a, t] of D.sonHediye)
      if (zaman - t > 5)
        D.sonHediye.delete(a);
  return once !== undefined && zaman - once < HEDIYE_TEKRAR_SN;
}
function oyunHediye(k, j, kd, hediye, sayi) {
  arabaHazir(k);
  if (hediyeTekrarMi(k, hediye, sayi))
    return;
  const v = Math.ceil(B);
  // Her hediyede gönderenin kornası çalar ve arabası zıplar (zıplamayı çekirdeğin hediye sevinci, k.zip0/zip1, yapar).
  kornaCal(k);
  sesKorna(kd.tip === 'korna' ? 1 : 1.2);
  if (kd.tip !== 'korna') {
    k.konfetiB = B;
    kirpintiAt(k, kd.tip === 'konfeti' ? 34 : 22);
  }
  if (kd.tip === 'sus' || kd.tip === 'turbo' || kd.tip === 'sov') {
    k.sus = Math.min(SUS_EN, (k.sus || 0) + 1);
    k.isik = B;
  }
  if (kd.tip === 'turbo' || kd.tip === 'sov') {
    k.turbo = B;
    hepsiKorna();
    sesTurbo();
  }
  if (kd.tip === 'sov') {
    if (!D.sovKuyruk.includes(k) && !(D.sov && D.sov.k === k) && D.sovKuyruk.length < 4)
      D.sovKuyruk.push(k);
    D.fisekBit = Math.max(D.fisekBit, v + 12);
    D.sovBit = Math.max(D.sovBit, v + 16);
    fisekAt(3);
    konfeti(110, 1);
    D.sarsinti = 1;
    sesKutlama(1);
  }
  muzik.sov = B < D.sovBit;
}
// Lider bayrağı eski liderin arabasından yenisine uçar; pankart ve konfeti herkese gösterir.
function oyunLiderDegisti(eski, yeni) {
  arabaHazir(yeni);
  D.bayrakUcus = { x: eski && eski.ar ? eski.x + eski.ox : 0, z: eski && eski.ar ? eski.z : LIDER_Z, b0: B, sure: BAYRAK_V, kime: yeni };
  pankart('Konvoyun yeni lideri', yeni.ad + ' gelin arabasının arkasına geçti');
  konfeti(80, 0.9);
  D.sarsinti = 0.6;
  kornaCal(yeni);
  sesKutlama(0.6);
}
function oyunBaslat() {
  for (const k of D.sira) {
    arabaHazir(k);
    k.x = k.hedefX;
    k.z = k.hedefZ;
    k.yer = 1;
    k.yon = Math.PI;
    k.yeni = -9;
  }
  D.sonB = B;
  gelinHazir();
  arkaHazirla();
}
function oyunBosalt() {
  D.sovKuyruk.length = 0;
  D.sov = null;
  D.bayrakUcus = null;
  D.fisekler.length = 0;
  D.duman.length = 0;
  D.kirpinti.length = 0;
  D.sonHediye.clear();
  D.fisekBit = D.sovBit = -1;
  muzik.sov = false;
}
function oyunDurum(d) {
  d.konvoyLideri = d.lider;
  d.etiketUst = ETIKET_UST;
  d.sov = D.sov ? D.sov.k.ad : null;
  d.sovKuyruk = D.sovKuyruk.length;
  d.fisek = D.fisekler.length;
  let korna = 0, turbo = 0, susLu = 0;
  for (const k of D.oy.values()) {
    if (kornaCaliyor(k))
      korna++;
    if (turboVar(k))
      turbo++;
    if (k.sus)
      susLu++;
  }
  d.korna = korna;
  d.turbo = turbo;
  d.susLu = susLu;
  d.kirpinti = D.kirpinti.length;
  d.gelinX = +GELIN.ox.toFixed(2);
}
// Korna çalıyor ya da birazdan çalacak (dalga hâlinde başlayanlar için).
function kornaCaliyor(k) { return k.korna !== undefined && B < k.korna + KORNA_V; }
function turboVar(k) { return k.turbo !== undefined && B >= k.turbo && B < k.turbo + TURBO_V; }
// Arabanın etrafında patlayan konfeti: dünya ekseninde parçalar, araba ilerledikçe geride kalmaz (arabaya göre konum).
const KIRPINTI_RENK = ['#ff6b6b', '#ffd166', '#3ccfb4', '#f6ecd9', '#e86a9a', '#8b7cf6'];
function kirpintiAt(k, n) {
  for (let i = 0; i < n && D.kirpinti.length < 260; i++) {
    const a = Math.random() * TAU, h = 1.6 + Math.random() * 2.2;
    D.kirpinti.push({ k, b0: B, dx: Math.cos(a) * 0.25, dz: Math.sin(a) * 0.25, vx: Math.cos(a) * h * 0.55, vz: Math.sin(a) * h * 0.4, vy: 2.2 + Math.random() * 1.6, renk: KIRPINTI_RENK[i % KIRPINTI_RENK.length], don: Math.random() * TAU });
  }
}
