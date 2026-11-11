/* KONVOY DURUMU — diziliş, hediye etkileri, gelin süsünün el değiştirmesi, drift kuyruğu (Gelin Konvoyu'nun
 * kuralları, gerçek ölçülerle).
 * Konvoy kıvrılan bir yolda ilerler. Her araba yolun üstünde iki sayıyla durur: gs (gelin arabasının önünden geriye
 * doğru metre, eksi = arkada) ve gl (yolun ortasından yana metre, artı = sol). En önde gelin arabası (lider), arkasında
 * önce tek sıra, beş arabadan sonra iki şerit: öndeki sıralar daha çok hediye atanlardır, sağ şerit yarım sıra
 * kaydırılır ki arabalar birbirinin yanını örtmesin.
 * D'ye eklenenler: kolon (şerit sayısı), zigzag ({ bas, sure }), fisekler (gökteki havai fişekler), fisekBit / sovBit
 * (fişek ve davul şovu hangi vuruşa dek sürer), driftKuyruk + drift ({ k, bas, vardi }), kurdeleUcus (gelin süsünün yeni
 * arabaya geçişi), yol (gelin arabasının yolda aldığı yol, metre; hiç geri gitmez), hiz (metre / saniye), duman
 * (drift dumanı), sonB, reji (kamera rejisi, js/50-reji.js), superAn ({ k, b0 }: son süper araba anı, büyük kart için).
 * Süper araba: tek seferde SUPER_ESIK jetonluk hediye atanın arabası süper arabaya döner (aşağıda "süper araba").
 * Süreler vuruşla (B) ölçülür: korna 1,5 vuruş, kurdele geçişi 2 vuruş, drift 16 vuruş.
 * Kancalar: oyunYerlesim, oyunGiris, oyunHediye, oyunLiderDegisti, oyunBaslat, oyunBosalt, oyunDurum.
 */
const SERIT_L = 1.75;     // iki şeritli dizilişte şeridin yolun ortasına uzaklığı (metre)
const SERIT_3 = 2.75;     // üç şeritli dizilişte yan şeritlerin yolun ortasına uzaklığı
const SIRA_ARA = 7.6;   // aynı şeritte iki arabanın arası (araba boyu ~4,3 m + boşluk)
const ILK_ARA = 9.6;    // gelin arabası ile ilk sıra arası
const DRIFT_ON = 17;    // drift atanın yeri: gelin arabasının önündeki boş yol
const KORNA_V = 1.5;    // bir kornanın süresi (vuruş)
const DRIFT_V = 16;     // drift şovunun (dönüşlerin) süresi (vuruş)
Object.assign(D, { kolon: 1, zigzag: null, fisekler: [], fisekBit: -1, sovBit: -1, driftKuyruk: [], drift: null, superAn: null, kurdeleUcus: null, yol: 0, hiz: 8, duman: [], sonB: 0, yolAc: null });

// Konvoy önce uzar, sonra genişler: beş arabaya kadar tek sıra, 17'ye kadar iki şerit, sonrası üç şerit (36 arabada
// konvoy ~90 metre kalır; iki şeritte ~140 metreydi ve izleyicilerin çoğu her kameradan uzak düşüyordu).
function kolonSayisi(m) { return m <= 4 ? 1 : m <= 16 ? 2 : 3; }
function oyunYerlesim() {
  const m = D.sira.length - 1, kol = kolonSayisi(m);
  D.kolon = kol;
  D.sira.forEach((k, i) => {
    arabaHazir(k);
    if (i === 0) {
      k.hedefS = 0;
      k.hedefL = 0;
      return;
    }
    const s = Math.floor((i - 1) / kol), o = (i - 1) % kol;
    // İki şeritte sıradaki en yüksek jeton sol şeride (gelin arabasının arkasındaki ilk yer), sağ şerit yarım sıra geride.
    // Üç şeritte sıranın en yüksek jetonu ortaya, sonra sol ve sağa; yan şeritler yarım sıra geride.
    k.hedefL = kol === 1 ? 0 : kol === 2 ? (o === 0 ? SERIT_L : -SERIT_L) : [0, SERIT_3, -SERIT_3][o];
    k.hedefS = -(ILK_ARA + SIRA_ARA * (s + ((kol === 2 && o === 1) || (kol === 3 && o > 0) ? 0.5 : 0)));
  });
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
/* ---- süper araba ----
 * Kural: TEK bir hediyenin birim değeri (bir hediye öğesinin jetonu, olayın "jeton" alanı) SUPER_ESIK (00-ayar) ya da
 * üstüyse gönderenin arabası o anda süper arabaya döner (superGiydir, js/40-araba.js) ve yayının geri kalanında öyle
 * kalır: çıkıp geri gelse de (SUPER_IDLER kimliği tutar; "Yolu boşalt" sıfırlar). Seri (aynı küçük hediyeden adet × 1000)
 * ve birkaç hediyenin toplamı saymaz. Aynı izleyici yine eşik üstü hediye atarsa kasa ikinci kez değişmez ama an yine
 * onundur: olay yeniden kalkar. Süper arabanın sürücüsü gelin arabasıysa süs onun üstündedir (gelin süsü tipe göre kurulur).
 * Çekirdek oyunHediye'ye yalnız toplamı (jeton × adet) verir. Birimi görmek için oyuna gelen hediye olayları geçerken
 * not edilir: köprüden gelenler Yayin.cevir'den, deneme / test olayları CanliOyun.olay'dan geçer; sahte izleyici ve panel
 * düğmeleri adet vermez (toplam = birim). ÇEKİRDEĞE EKLENMELİ: oyunHediye(k, j, kd, o) — o.jeton ve o.adet ile; o zaman
 * bu iki sarmalayıcı kalkar.
 */
const SUPER_IDLER = new Set(), SON_HEDIYE = { id: null, jeton: 0, adet: 1 };
function superMi(id) { return SUPER_IDLER.has(id); }
function hediyeNotEt(o) {
  if (o && o.tip === 'hediye') {
    const kim = o.kullanici || {};
    SON_HEDIYE.id = temiz(kim.id || kim.ad).slice(0, 64);
    SON_HEDIYE.jeton = +o.jeton || 1;
    SON_HEDIYE.adet = +o.adet || 1;
  }
  return o;
}
{
  const cevir = Yayin.cevir, kapi = window.CanliOyun.olay;
  Yayin.cevir = function (m) { return hediyeNotEt(cevir.call(this, m)); };
  window.CanliOyun.olay = o => kapi(hediyeNotEt(o));
}
// Bu hediyenin birim değeri: not edilen olay bu kişinin bu hediyesiyse onun jetonu, değilse (adetsiz olay) toplamın kendisi.
function hediyeBirim(k, j) {
  const n = SON_HEDIYE, birim = n.id === k.id && Math.min(1e7, Math.max(1, Math.round(n.jeton * n.adet))) === j ? n.jeton : j;
  n.id = null;
  return birim;
}
function superAraba(k) {
  SUPER_IDLER.add(k.id);
  const yeni = superGiydir(k);
  D.superAn = { k, b0: B };
  if (yeni) {
    D.superDegisim = (D.superDegisim || 0) + 1;
    pankart('SÜPER ARABA', k.ad + ' artık süper arabada');
    konfeti(80, 0.9);
  }
  // REJİ KANCASI (super): olay rejiye 'sov' ve 'lider' ile aynı yoldan (rejiOlay) gider. Reji bugün yalnız 'sov' ve
  // 'lider' için keser; 'super' için yakın çekim rejiyi yeniden yazan çalışmada eklenecek (50-reji.js rejiGuncelle,
  // "olay çekimi" dalı: o.tur === 'super' → kes(..., { k: o.k })). Bekleyen daha büyük olayı (şov, gelin değişimi) ezmez.
  // Büyük kart ("SÜPER ARABA" + ad) rejiden bağımsız, D.superAn ile 60-cizim.js'te çizilir.
  if (!D.reji.olay || D.reji.olay.tur === 'super')
    rejiOlay('super', k);
}
function oyunHediye(k, j, kd) {
  const v = Math.ceil(B);
  if (hediyeBirim(k, j) >= SUPER_ESIK)
    superAraba(k);
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
  D.superAn = null;
  D.superDegisim = 0;
  SUPER_IDLER.clear();
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
  d.superAraba = [...D.oy.values()].filter(k => k.ar && k.ar.tip === 'super' && !k.cikiyor).map(k => k.ad);
  d.superAn = D.superAn ? D.superAn.k.ad : null;
  d.superDegisim = D.superDegisim || 0;
  d.gelinSusu = DUNYA.r ? Object.keys(GELIN.gruplar).filter(t => GELIN.gruplar[t].visible) : [];
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
  d.ornek = Object.assign({}, ORNEK);
}
// Korna çalıyor ya da birazdan çalacak (dalga halinde başlayanlar için).
function kornaCaliyor(k) { return k.korna !== undefined && B < k.korna + KORNA_V; }
