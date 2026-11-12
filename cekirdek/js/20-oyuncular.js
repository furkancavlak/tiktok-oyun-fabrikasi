/* OYUNCULAR VE OLAYLAR — kim sahnede, kim lider, hangi olay neyi tetikler. Oyundan bağımsızdır.
 * D: ortak oyun durumu (oyun kendi alanlarını ekler) · karakterYap / gorunumUret: izleyiciden karakter
 * katil / cikar / siraGuncelle: sahnedeki sıra · olay(o): DIŞARIDAN GELEN HER ŞEYİN TEK GİRİŞ KAPISI
 * (sahte izleyici, köprü ve testler hep bunu çağırır). Olay biçimi docs/OLAYLAR.md'de.
 * Kullanıcı metni burada temizlenir; hiçbir yerde HTML olarak yazılmaz.
 * Oyuna sorulanlar: oyunGiris(k) giriş yeri · oyunYerlesim() herkesin hedef yeri · oyunHediye(k, jeton, kademe, hediye, sayi)
 * hediyenin sahnedeki etkisi · oyunLiderDegisti(eski, yeni) rol devri. Ayrıntı: docs/KANCALAR.md.
 */
// Eksik yazılar genel karşılıklarıyla doldurulur; oyun yalnız kendine özgü olanı yazar.
OYUN.yazi = Object.assign({ sira: 'Sıra', gosterge: 'Coşku', bos: 'Sahne boş. İlk yorumu yazan girer.', birim: 'kişi', ses: 'Müziği başlat',
  sahne: String(OYUN.ad || 'Oyun') + ' sahnesi', giris: 'sahneye girer', bosalt: 'Sahneyi boşalt' }, OYUN.yazi || {});
OYUN.nasil = OYUN.nasil || {};
const MAKS = Math.max(1, Math.round(OYUN.kapasite) || 36);
OYUN.kapasite = MAKS;
// Kademeler büyükten küçüğe sıralanır; en küçüğü her hediyeyi karşılasın diye 1'e çekilir.
const KADEME = (OYUN.kademe && OYUN.kademe.length ? OYUN.kademe : [{ min: 1, ad: 'Hediye', tip: 'hediye', etki: 'Gönderen sevinir' }])
  .map(x => ({ ...x, min: Math.max(1, Math.round(x.min) || 1) })).sort((a, b) => b.min - a.min);
KADEME[KADEME.length - 1].min = 1;
const D = { oy: new Map(), sira: [], lider: null, cosku: 0.15, begeni: 0, sarsinti: 0 };
let zaman = 0, B = 0; // oyun saati (sn) ve müzik vuruşu

const TEN = ['#f2c9a0', '#e3ad7e', '#c98d5e', '#a86d45', '#f6d9bb'];
const SAC = ['#1d1513', '#3a2416', '#5b3a1f', '#2a2a35', '#7b4a22'];
const KUMAS = ['#e23d2f', '#22b8a7', '#f2b632', '#f6ecd9', '#3d5bd0', '#e86a9a', '#4fae6c', '#8b55c9', '#ef7d2d'];
const KOYU = ['#20264f', '#3a2a2c', '#1d3b3a', '#2c2c38', '#4a2238'];
// Görünüm kimlikten türetilir: aynı izleyici her girişinde aynı kıyafetle gelir.
function gorunumUret(id) {
  const r = rastgeleUret(ozet(id)), sec = a => a[Math.floor(r() * a.length)];
  const kadin = r() < 0.5, ana = sec(KUMAS);
  let ikinci = sec(KUMAS);
  if (ikinci === ana)
    ikinci = KUMAS[(KUMAS.indexOf(ana) + 3) % KUMAS.length];
  return {
    kadin, ten: sec(TEN), sac: sec(SAC), boy: 0.98 + r() * 0.13,
    gomlek: kadin ? ana : (r() < 0.7 ? '#f6ecd9' : '#dfe6f5'), yelek: kadin ? ana : sec(KUMAS),
    alt: kadin ? ana : sec(KOYU), onluk: ikinci, kusak: kadin ? ikinci : (ana === '#e23d2f' ? '#f2b632' : '#e23d2f'),
    baslik: kadin ? sec(['yazma', 'yazma', 'orgu', 'cicek']) : sec(['kasket', 'kasket', 'yok', 'bere']),
    baslikRenk: kadin ? ikinci : sec(KOYU), biyik: !kadin && r() < 0.55, ayakkabi: sec(['#2a1c16', '#191a2a', '#5a3620']), salin: r()
  };
}
// Oyuncu kaydı. Alanların anlamı docs/KANCALAR.md'de; oyun kendi alanlarını bu nesneye ekleyebilir.
function karakterYap(id, ad) {
  return { id, ad, jeton: 0, son: zaman, katilim: zaman, g: gorunumUret(id), x: 0, z: 0, y0: 0, yon: Math.PI, yer: 0, sn: 0,
    cikiyor: false, balon: null, zip0: -9, zip1: -9, kos: 0, j: {}, p: {}, f: [0, 0, -1], l: [1, 0, 0], mod: 'oyuncu', yeni: zaman, et: null };
}
const calgi = { dumP: 0, tekP: 0, perde: 3 };

// Önce ANSI kaçışları (ESC [ … harf) ve Unicode biçim karakterleri (Cf: U+061C, U+2060, U+FEFF, yön işaretleri …; emoji
// birleştiricisi U+200D yalnız iki emoji arasında kalır) ile görünmez dolgu ve birleşik harfler (U+034F, U+115F, U+1160,
// U+17B4, U+17B5, U+180B–180D, U+3164, U+FFA0, U+2800) atılır; OSC / DCS kaçışları içindeki metinle birlikte gider.
const temiz = s => String(s == null ? '' : s).replace(/\x1b[\]P_^X][\s\S]*?(?:\x07|\x1b\\|$)|[\x9d\x90\x9e\x9f][\s\S]*?(?:\x07|\x9c|$)/g, '').replace(/(?:\x1b\[|\x9b)[0-9;?]*[ -\/]*[@-~]/g, '').replace(/\x1b[@-_]?/g, '').replace(/(?!\u200d)[\p{Cf}\u034f\u115f\u1160\u17b4\u17b5\u180b-\u180d\u3164\uffa0\u2800]/gu, '').replace(/(?<![\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F])\u200d|\u200d(?![\p{Extended_Pictographic}])/gu, '').replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
// balon: konuşma balonları açık mı · yasak: gizlenecek kelimeler · gizli / cikan: yayıncının panelden adını
// gizlediği ve sahneden çıkardığı izleyiciler ({ id, ad }). Hepsi tarayıcıda saklanır (ayarOku / ayarYaz).
const ayar = { balon: true, yasak: [], gizli: [], cikan: [] };
const modKume = { gizli: new Set(), cikan: new Set() };
function modKur() { modKume.gizli = new Set(ayar.gizli.map(x => x.id)); modKume.cikan = new Set(ayar.cikan.map(x => x.id)); }
function balonlariSil(f) { for (const k of D.oy.values())
  if (k.balon && (!f || f(k)))
    k.balon = null; }
const yasakVar = m => { const k = m.toLocaleLowerCase('tr'); return ayar.yasak.some(y => k.includes(y)); };
const balonMetni = m => yasakVar(m) ? '' : m.replace(/(https?:\/\/|www\.)\S+/gi, '…').replace(/\d[\d\s().+-]{6,}\d/g, '…');
const kisalt = (s, n) => { const a = Array.from(s); return a.length > n ? a.slice(0, n - 1).join('') + '…' : s; };
// Hediyenin kimliği (docs/OLAYLAR.md): { id, ad } ya da yoksa null. Ad da yabancıdan gelir: düz metindir, temizlenir,
// 40 karaktere kısaltılır; hiçbir yerde HTML olarak yazılmaz. Kimlik platformun hediye numarasıdır (metin, en çok 32).
// Yalnız metin ve sayı kabul edilir; boş kalan alan düşer, ikisi de boşsa null.
const hediyeAlan = v => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? temiz(v) : '';
function hediyeKimlik(h) {
  if (!h || typeof h !== 'object')
    return null;
  const id = Array.from(hediyeAlan(h.id)).slice(0, 32).join(''), ad = kisalt(hediyeAlan(h.ad), 40), s = {};
  if (id)
    s.id = id;
  if (ad)
    s.ad = ad;
  return id || ad ? s : null;
}

function katil(id, ad, zorla) {
  let k = D.oy.get(id);
  if (k && !k.cikiyor) {
    if (ad)
      k.ad = ad;
    return k;
  }
  if (D.sira.length >= MAKS) {
    // Yer doluysa en az jetonlu, en uzun süredir sessiz olan yerini bırakır. Lider ve yıldız (k.yildiz) korunur;
    // yorumcu, hediye atmış birini yerinden edemez.
    let kurban = null;
    for (const a of D.sira) {
      if (a === D.lider || a.yildiz)
        continue;
      if (!zorla && a.jeton > 0)
        continue;
      if (!kurban || a.jeton < kurban.jeton || (a.jeton === kurban.jeton && a.son < kurban.son))
        kurban = a;
    }
    if (!kurban)
      return null;
    cikar(kurban);
  }
  k = karakterYap(id, ad || id);
  D.oy.set(id, k);
  siraGuncelle();
  oyunGiris(k);
  return k;
}
function cikar(k) { k.cikiyor = true; k.cikis = zaman; siraGuncelle(); }
function siraGuncelle() {
  D.sira = [...D.oy.values()].filter(k => !k.cikiyor).sort((a, b) => b.jeton - a.jeton || a.katilim - b.katilim);
  D.sira.forEach((k, i) => k.sn = i);
  D.lider = D.sira[0] || null;
  oyunYerlesim();
  D.siraKirli = true;
}

function olay(o) {
  if (!o || !o.tip)
    return;
  const kim = o.kullanici || {}, id = temiz(kim.id || kim.ad).slice(0, 64);
  if (!id)
    return;
  // Yayıncının sahneden çıkardığı izleyicinin hiçbir olayı oyuna işlenmez (panelden geri alınana kadar).
  if (modKume.cikan.has(id))
    return;
  let ad = kisalt(temiz(kim.ad || kim.id), 18);
  if (yasakVar(ad) || modKume.gizli.has(id))
    ad = 'misafir';
  if (o.tip === 'yorum') {
    const m = temiz(o.metin).slice(0, 200), b = ayar.balon ? balonMetni(m) : '';
    const k = katil(id, ad, false);
    if (k) {
      k.son = zaman;
      if (b)
        k.balon = { m: kisalt(b, 30), t0: zaman };
    }
    gunluk('yorum', ad, m, false, id);
  }
  else if (o.tip === 'begeni') {
    const n = clamp(Math.round(o.adet) || 1, 1, 500);
    D.begeni += n;
    D.cosku = Math.min(1, D.cosku + n * 0.006);
    const k = D.oy.get(id);
    if (k)
      k.son = zaman;
    kalpAt(n);
    gunluk('beğeni', ad, '×' + n, false, id);
  }
  else if (o.tip === 'takip') {
    const k = katil(id, ad, false);
    if (k) {
      k.son = zaman;
      k.yeni = zaman;
    }
    bildir(ad, 'takip etti, hoş geldin');
    gunluk('takip', ad, '', false, id);
  }
  else if (o.tip === 'paylasim') {
    D.cosku = Math.min(1, D.cosku + 0.05);
    gunluk('paylaşım', ad, '', false, id);
  }
  else if (o.tip === 'katilim') {
    gunluk('geldi', ad, '', false, id);
  }
  else if (o.tip === 'hediye') {
    const adet = clamp(Math.round(+o.adet) || 0, 0, 1e7), j = clamp(Math.round((+o.jeton || 1) * (+o.adet || 1)), 1, 1e7), onceki = D.lider;
    // tek hediyenin değeri (jeton) ve kaç tane geldiği: oyunun "tek seferde şu kadar" kuralları için (oyunHediye'nin beşinci bilgisi)
    const birim = clamp(Math.round(+o.jeton || 1), 1, 1e7), say = { birim, adet: Math.max(1, adet) };
    const k = katil(id, ad, true), hd = hediyeKimlik(o.hediye);
    if (!k)
      return;
    k.jeton += j;
    k.son = zaman;
    D.cosku = Math.min(1, D.cosku + Math.min(0.35, j / 300));
    const kd = KADEME.find(x => j >= x.min) || KADEME[KADEME.length - 1];
    // Kademeye yalnız seriyle (tek hediyesi eşiğin altında) gelindiyse ve kademe ayrı bir "seriAd" taşıyorsa bildirim ve
    // akış o adı yazar (docs/KANCALAR.md, OYUN.kademe). seriAd vermeyen oyunda kademenin adı yazar, değişen bir şey yok.
    const kdAd = kd.seriAd && birim < kd.min ? kd.seriAd : kd.ad;
    // Hediye sevinci: bir sonraki yarım vuruştan başlayıp 4 vuruş sürer (oyun k.zip0–k.zip1 arasında zıplatır).
    k.zip0 = Math.ceil(B * 2) / 2;
    k.zip1 = k.zip0 + 4;
    bildir(ad, j + ' jeton', kdAd + '!');
    muzik.zil(Math.min(1, j / 200));
    // Akış satırı: hediyenin adı ve olayın taşıdığı adet (yoksa yazılmaz), jeton, tetiklenen kademe (25-yazilar.js).
    gunluk('hediye', ad, '', { jeton: j, ad: hd && hd.ad || '', adet: adet > 1 ? adet : 0, kademe: kdAd }, id);
    // Dördüncü bilgi hediyenin kimliği ({ id, ad } ya da null), beşinci tek hediyenin değeri ve adedi ({ birim, adet });
    // daha az bilgiyle yazılmış kancalar eskisi gibi çalışır.
    oyunHediye(k, j, kd, hd, say);
    siraGuncelle();
    if (onceki && D.lider !== onceki)
      oyunLiderDegisti(onceki, D.lider);
  }
}
