/* KONVOY DURUMU — diziliş, hediye etkileri, gelin süsünün el değiştirmesi, drift kuyruğu (Gelin Konvoyu'nun
 * kuralları, gerçek ölçülerle).
 * Konvoy kıvrılan bir yolda ilerler. Her araba yolun üstünde iki sayıyla durur: gs (gelin arabasının önünden geriye
 * doğru metre, eksi = arkada) ve gl (yolun ortasından yana metre, artı = sol). En önde gelin arabası (lider), arkasında
 * önce tek sıra, beş arabadan sonra iki şerit: öndeki sıralar daha çok hediye atanlardır, sağ şerit yarım sıra
 * kaydırılır ki arabalar birbirinin yanını örtmesin.
 * D'ye eklenenler: kolon (şerit sayısı), zigzag ({ bas, sure }), fisekler (gökteki havai fişekler), fisekBit / sovBit
 * (fişek ve davul şovu hangi vuruşa dek sürer), driftKuyruk + drift ({ k, bas, vardi }), kurdeleUcus (gelin süsünün yeni
 * arabaya geçişi), yol (gelin arabasının yolda aldığı yol, metre; hiç geri gitmez), hiz (metre / saniye), duman
 * (drift dumanı), sonB, reji (kamera rejisi, js/50-reji.js).
 * Süreler vuruşla (B) ölçülür: korna 1,5 vuruş, kurdele geçişi 2 vuruş, drift 16 vuruş.
 * Kancalar: oyunYerlesim, oyunGiris, oyunHediye, oyunLiderDegisti, oyunBaslat, oyunBosalt, oyunDurum.
 */
// ölçüler 00-ayar.js YOL_OLCU'dan
const SERIT_L = YOL_OLCU.serit[2][0];
const SIRA_ARA = YOL_OLCU.siraAra;
const ILK_ARA = YOL_OLCU.ilkAra;
const DRIFT_ON = YOL_OLCU.driftOn;
const KORNA_V = 1.5;    // bir kornanın süresi (vuruş)
const DRIFT_V = 16;     // drift şovunun (dönüşlerin) süresi (vuruş)
Object.assign(D, { kolon: 1, zigzag: null, fisekler: [], fisekBit: -1, sovBit: -1, driftKuyruk: [], drift: null, kurdeleUcus: null, yol: 0, hiz: 8, duman: [], sonB: 0, yolAc: null, tekerOlc: {}, koridor: false, carpisma: { cift: 0, enAz: Infinity, kare: 0 } });

// Konvoy önce uzar, sonra genişler: beş arabaya kadar tek sıra, 17'ye kadar iki şerit, sonrası üç şerit (36 arabada
// konvoy ~90 metre kalır; iki şeritte ~140 metreydi ve izleyicilerin çoğu her kameradan uzak düşüyordu).
// Üç şerit denendi, geri alındı: 8,4 metrelik yolda üç şeridin yanında bir geçiş yolu kalmıyor (sollayan, katılan,
// çıkan araba ya birinin içinden geçiyor ya kaldırıma çıkıyordu). İki şerit + ortada geçiş yolu her hâlde sığar.
function kolonSayisi(m) { return m <= 4 ? 1 : 2; }
function oyunYerlesim() {
  const m = D.sira.length - 1, kol = kolonSayisi(m);
  D.kolon = kol;
  // Her araba bir şeride bağlıdır (k.serit: 0 sol, 1 sağ) ve sıra değişince şeridini korur: hediyeyle biri öne geçince
  // önündekiler kendi şeritlerinde birer sıra geri kayar (hep birlikte, birbirine değmeden), yalnız öne geçen geçiş
  // yolunu kullanır. Şeritlerin sayısı bir farkı aşınca en arkadaki şerit değiştirir (seyrek).
  for (const k of D.sira)
    arabaHazir(k);
  const L = D.sira[0];
  if (L) {
    L.hedefS = 0;
    L.hedefL = 0;
  }
  const kalan = D.sira.slice(1);
  if (kol === 1) {
    kalan.forEach((k, r) => { k.hedefL = 0; k.hedefS = -(ILK_ARA + SIRA_ARA * r); });
    return;
  }
  const say = [0, 0];
  for (const k of kalan) {
    if (k.serit !== 0 && k.serit !== 1)
      k.serit = say[0] <= say[1] ? 0 : 1;
    say[k.serit]++;
  }
  // denge: fark birden büyükse kalabalık şeridin en arkadaki arabası öbür şeride geçer
  while (Math.abs(say[0] - say[1]) > 1) {
    const cok = say[0] > say[1] ? 0 : 1, son = [...kalan].reverse().find(k => k.serit === cok);
    son.serit = 1 - cok;
    say[cok]--;
    say[1 - cok]++;
  }
  const sira = [0, 0];
  for (const k of kalan) {
    const r = sira[k.serit]++;
    k.hedefL = k.serit === 0 ? SERIT_L : -SERIT_L;
    k.hedefS = -(ILK_ARA + SIRA_ARA * (r + (k.serit === 1 ? 0.5 : 0)));
  }
}
// Yeni gelen arkadan, geçiş yolundan (gecisL) hızla gelip yerine girer; çıkanlar kaldırım tarafına çekilir, birbirinin
// içinden geçmezler.
function oyunGiris(k) {
  arabaHazir(k);
  k.gs = k.hedefS - 34;
  k.gl = gecisL(k);
  k.yer = 0;
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
}
function oyunHediye(k, j, kd) {
  const v = Math.ceil(B);
  // Her hediyede gönderen korna çalar; büyüdükçe bütün konvoy katılır.
  if (kd.tip !== 'tek')
    hepsiKorna();
  kornaCal(k);
  if (kd.tip === 'zigzag' || kd.tip === 'fisek' || kd.tip === 'drift')
    D.zigzag = { bas: v, sure: 8 };
  if (kd.tip === 'fisek' || kd.tip === 'drift') {
    D.fisekBit = Math.max(D.fisekBit, v + 12);
    D.sovBit = Math.max(D.sovBit, v + 16);
    fisekAt(3);
    konfeti(40, 0.5);
  }
  if (kd.tip === 'drift') {
    if (!D.driftKuyruk.includes(k) && !(D.drift && D.drift.k === k) && D.driftKuyruk.length < 4)
      D.driftKuyruk.push(k);
    konfeti(120, 1);
    D.sarsinti = 1;
  }
  muzik.sov = B < D.sovBit;
  // reji: hediye atan izleyiciyi yakın çekimde (ya da öne geçiyorsa sollamasıyla) gösterir; drift kendi şovunu alır
  if (kd.tip !== 'drift')
    rejiOlay('hediye', k);
}
// Gelin süsü eski gelin arabasından yenisine uçar; reji yeni gelin arabasının öne geçişini gösterir.
function oyunLiderDegisti(eski, yeni) {
  D.kurdeleUcus = { eski, b0: B, sure: 2, kime: yeni };
  pankart('Gelin arabası el değiştirdi', 'Kurdele artık ' + yeni.ad + ' arabasında');
  konfeti(90, 0.9);
  D.sarsinti = 0.7;
  kornaCal(yeni);
  rejiOlay('lider', yeni);
}
function oyunBaslat() {
  for (const k of D.sira) {
    arabaHazir(k);
    k.gs = k.hedefS;
    k.gl = k.hedefL;
    k.yer = 1;
    k.yeni = -9;
  }
  D.sonB = B;
  dunyaKur();
}
function oyunBosalt() {
  D.driftKuyruk.length = 0;
  D.drift = null;
  D.zigzag = null;
  D.kurdeleUcus = null;
  D.fisekler.length = 0;
  D.duman.length = 0;
  D.fisekBit = D.sovBit = -1;
  D.yolAc = null;
  muzik.sov = false;
  rejiSifirla();
  if (DUNYA.r)
    plakaSifirla();
}
function oyunDurum(d) {
  d.gelinArabasi = d.lider;
  d.drift = D.drift ? D.drift.k.ad : null;
  d.driftKuyruk = D.driftKuyruk.length;
  d.zigzag = !!D.zigzag;
  d.fisek = D.fisekler.length;
  let n = 0;
  for (const k of D.oy.values())
    if (kornaCaliyor(k))
      n++;
  d.korna = n;
  d.cekim = D.reji.cekim ? D.reji.cekim.ad : null;
  d.cekimGecis = !!D.reji.gecis;
  d.cekimZorla = D.reji.zorla;
  d.cekimKonu = D.reji.konu ? D.reji.konu.ad : null;
  d.gpu = DUNYA.gpu;
  d.konuKadraj = D.reji.kadraj || null;
  d.webgl = !!DUNYA.r;
  d.kalite = KALITE.kademe;
  d.kareAralik = +KALITE.aralik.toFixed(1);
  d.kaliteTemel = Number.isFinite(KALITE.temel) ? +KALITE.temel.toFixed(1) : null;
  d.kaliteBekleme = KALITE.bekleme;
  d.ornek = Object.assign({}, ORNEK);
}
// Korna çalıyor ya da birazdan çalacak (dalga halinde başlayanlar için).
function kornaCaliyor(k) { return k.korna !== undefined && B < k.korna + KORNA_V; }
