/* KONVOY DURUMU — diziliş, hediye etkileri, gelin süsünün el değiştirmesi, drift kuyruğu (Gelin Konvoyu'nun
 * kuralları, gerçek ölçülerle).
 * Konvoy kıvrılan bir yolda ilerler. Her araba yolun üstünde iki sayıyla durur: gs (gelin arabasının önünden geriye
 * doğru metre, eksi = arkada) ve gl (yolun ortasından yana metre, artı = sol). En önde gelin arabası (lider), arkasında
 * önce tek sıra, beş arabadan sonra iki şerit: öndeki sıralar daha çok hediye atanlardır, sağ şerit yarım sıra
 * kaydırılır ki arabalar birbirinin yanını örtmesin.
 * D'ye eklenenler: kolon (şerit sayısı), zigzag ({ bas, sure }), fisekler (gökteki havai fişekler), fisekBit / sovBit
 * (fişek ve davul şovu hangi vuruşa dek sürer), driftKuyruk + drift ({ k, bas, vardi }), kurdeleUcus (gelin süsünün yeni
 * arabaya geçişi), yol (gelin arabasının yolda aldığı yol, metre; hiç geri gitmez), hiz (metre / saniye), duman
 * (drift dumanı), sonB, reji (kamera rejisi, js/50-reji.js), superAn ({ k, b0, birim, yeni, lider }: son süper araba
 * anı), kartYazi (sahnede çizilen büyük kartın yazıları, 60-cizim.js).
 * Süper araba: tek seferde SUPER_ESIK jetonluk hediye atanın arabası süper arabaya döner (aşağıda "süper araba").
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
Object.assign(D, { kolon: 1, zigzag: null, fisekler: [], fisekBit: -1, sovBit: -1, driftKuyruk: [], drift: null, superAn: null, kurdeleUcus: null, yol: 0, hiz: 8, duman: [], sonB: 0, yolAc: null, tekerOlc: {}, koridor: false, carpisma: { cift: 0, enAz: Infinity, kare: 0 } });

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
// Süper araba anı (D.superAn, rejiye de bu nesne gider): k, b0 (vuruş), birim (hediyenin jetonu), yeni (kasa bu hediyeyle
// değişti), tekrar (bu yayında daha önce de kazanmıştı), lider (aynı hediye onu gelin arabası da yaptı; oyunLiderDegisti
// yazar). Büyük kart bundan okur: üstte
// "SÜPER ARABA", ortada ad, altta "Gelin arabası da artık onda" ya da hediyenin jetonu (60-cizim.js).
function superAraba(k, birim) {
  const tekrar = SUPER_IDLER.has(k.id);
  SUPER_IDLER.add(k.id);
  const yeni = superGiydir(k);
  D.superAn = { k, b0: B, birim, yeni, tekrar, lider: false };
  if (yeni) {
    D.superDegisim = (D.superDegisim || 0) + 1;
    konfeti(80, 0.9);
  }
  // Her süper araba hediyesi rejide kendi anını alır (50-reji.js: superSira). Kamera bir sonraki ölçüde süper araba
  // çekimine keser; bekleme süresindeyse geniş çekimin üstünde kart ve halka çıkar; başka birinin olay çekimi sürüyorsa
  // o bitince sıra ona gelir. Adı ekrana yalnız rejinin kartı yazar: pankart açılmaz.
  D.reji.olayAt('super', k);
}
function oyunHediye(k, j, kd) {
  const v = Math.ceil(B), birim = hediyeBirim(k, j);
  if (birim >= SUPER_ESIK)
    superAraba(k, birim);
  else if (kd.tip === 'drift')
    superDegilYaz(k, j);
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
// En üst kademeye küçük hediyelerin toplamıyla gelindi (seri: 100 × 10): süper araba yok. Çekirdek bildirimi ve günlüğü
// kademe adıyla ("Süper araba!") az önce yazdı; ikisi de "Drift şov" diye düzeltilir. Bildirim satırı aynı anda gelen
// bildirimle yer değiştirir (bildir, 25-yazilar.js); günlüğün son satırı henüz sayfaya yazılmadı (karede bir kez).
// ÇEKİRDEĞE EKLENMELİ: kademe seçimi birim jetonu da bilsin (oyunHediye(k, j, kd, o)), ya da kademe bir "seri adı" taşısın.
function superDegilYaz(k, j) {
  bildir(k.ad, j + ' jeton', 'Drift şov!');
  const son = gunlukBekleyen[gunlukBekleyen.length - 1];
  if (son && son[0] === 'hediye' && son[1] === k.ad && son[2] === j + ' jeton → ' + OYUN.kademe[0].ad)
    son[2] = j + ' jeton → Drift şov';
}
// Gelin süsü eski gelin arabasından yenisine uçar; reji yeni gelin arabasının öne geçişini gösterir.
// Aynı hediye süper arabayı da verdiyse (oyunHediye bu çağrıdan hemen önce, aynı vuruşta) an tektir: pankart açılmaz,
// süper araba kartının alt satırı "Gelin arabası da artık onda" der; reji lider olayını süper araba anına katar.
function oyunLiderDegisti(eski, yeni) {
  D.kurdeleUcus = { eski, b0: B, sure: 2, kime: yeni };
  const an = D.superAn, ayniHediye = !!an && an.k === yeni && an.b0 === B;
  if (ayniHediye)
    an.lider = true;
  else
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
  d.superSira = D.reji.superSira.map(a => a.k.ad);
  // sahnede şu an çizilen büyük kart: [üst satır, ad, alt satır] (60-cizim.js oyunUst; yoksa null)
  const ky = D.kartYazi;
  d.kart = ky && kareSay - ky.kare <= 2 ? [ky.ust, ky.ad, ky.alt] : null;
  d.arabaTipleri = ARABA_TIPLERI.slice();
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
  d.kaliteTemel = Number.isFinite(KALITE.temel) ? +KALITE.temel.toFixed(1) : null;
  d.kaliteBekleme = KALITE.bekleme;
  d.ornek = Object.assign({}, ORNEK);
}
// Korna çalıyor ya da birazdan çalacak (dalga halinde başlayanlar için).
function kornaCaliyor(k) { return k.korna !== undefined && B < k.korna + KORNA_V; }
