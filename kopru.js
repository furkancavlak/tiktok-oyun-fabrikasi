#!/usr/bin/env node
/* TikTok köprüsü — depodaki her oyun için aynı program
 *
 * Ne yapar:
 *   1. Oyunu bu bilgisayarda bir adresten açar:  http://localhost:8787
 *   2. Verdiğin TikTok kullanıcı adının canlı yayınını dışarıdan, YALNIZCA OKUYARAK izler
 *      (yorum, hediye, beğeni, takip) ve bunları oyuna aktarır.
 *
 * Ne yapmaz:
 *   Hesabına giriş yapmaz, şifre ya da oturum bilgisi istemez, yayına mesaj yazmaz, hiçbir ayarı değiştirmez.
 *
 * Kullanım:
 *   node kopru.js kullanici_adin --oyun halay   gerçek yayın (önce: npm install)
 *   node kopru.js --deneme --oyun halay         TikTok olmadan sahte olaylarla dener
 *   node kopru.js kullanici_adin --port 9000
 *   node kopru.js kullanici_adin --ac           oyunu tarayıcıda kendisi açar
 *   node kopru.js --ana-sayfa --ac              ana sayfa: oyunlar listelenir, oyun ve kip sayfadan seçilir
 *   node kopru.js --ana-sayfa --ac --gizli      aynısı, penceresiz (BASLAT.bat böyle çalıştırır): bu süreç yalnız
 *                                               başlatıcıdır; motoru arka planda açar, motor yanıt verince çıkar
 *
 * Penceresiz motor (--gizli): başlatıcı, motoru aynı bağımsız değişkenlerle ve iç işaret --arka-plan ile ayrı (detached),
 * penceresiz bir süreç olarak açar; motorun çıktısı motor-gunlugu.txt dosyasına gider. Motorun penceresi olmadığı için
 * kapatmanın iki yolu vardır: ana sayfadaki "Motoru kapat" (POST /kapat) ve boşta kapanma (hiçbir sayfa soketle bağlı
 * değilken ve 10 dakika boyunca motora hiçbir istek gelmezse motor kendiliğinden kapanır; unutulan gizli bir süreç
 * klasörü sonsuza dek tutmasın). Kapıda aynı klasörün aynı sürümü zaten çalışıyorsa yenisi açılmaz; başka bir klasörün
 * ya da sürümün motoru çalışıyorsa ona kapanmasını söyler, kapı boşalınca kendi motorunu açar.
 * Hangi oyun: --oyun <ad> verilirse oyunlar/<ad>/oyun.html. Verilmezse önce bu dosyanın yanındaki oyun.html
 * (yayıncı paketi böyle gelir), o da yoksa depoda tek oyun varsa o açılır. Birden çok oyun varsa hangisinin
 * açılacağını sorar (komut satırında elle çalıştırılınca ya da --sor ile).
 *
 * Ana sayfa kipi (--ana-sayfa): köprü oyunsuz ve kullanıcı adsız açılır, / adresinde ana sayfayı
 * (cekirdek/ana-sayfa.html; pakette köprünün yanında) sunar. Sayfadaki düğmeler POST /api/baslat ile hangi oyunun
 * hangi kipte (deneme ya da canlı) çalışacağını söyler; köprü çalışanı durdurup yenisini başlatır. POST /api/durdur
 * çalışanı durdurur; köprü boşta bekler (ana sayfada bu sürece "motor" denir). POST /kapat motoru kapatır. Oyunlar:
 * köprünün yanında oyun.html varsa yalnız o (paket), yoksa derlenmiş her oyunlar/<ad>/ ("vitrin": false olanlar hariç).
 */
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const ANA = args.includes('--ana-sayfa');
const DENEME = args.includes('--deneme');
// --gizli: bu süreç yalnız başlatıcıdır (BASLAT.bat). --arka-plan: başlatıcının açtığı penceresiz motor (iç işaret;
// elle verilmez). Arka plandaki motor boşta kalınca kendiliğinden kapanır.
const GIZLI = args.includes('--gizli') && !args.includes('--arka-plan');
const ARKA = args.includes('--arka-plan');
const pi = args.indexOf('--port');
const PORT = pi >= 0 ? parseInt(args[pi + 1], 10) || 8787 : 8787;
const oi = args.indexOf('--oyun');
// Değer alan seçenekler: değerleri kullanıcı adı sanılmaz. --kurulum-betigi ve --kurulum-sinir yalnız testler içindir
// (npm yerine taklit kurulum betiği ve süre sınırı); BASLAT.bat bunları hiç vermez.
const DEGERLI = ['--port', '--oyun', '--kurulum-betigi', '--kurulum-sinir'];
const KULLANICI = (args.find((a, i) => !a.startsWith('--') && !DEGERLI.includes(args[i - 1])) || '').replace(/^@/, '').trim();
function oyunlariBul() {
  const kl = path.join(__dirname, 'oyunlar');
  try { return fs.readdirSync(kl).filter(a => fs.existsSync(path.join(kl, a, 'oyun.html'))); } catch (e) { return []; }
}
function oyunKlasoru() {
  if (oi >= 0) { const ad = args[oi + 1] || ''; return /^[\w-]+$/.test(ad) ? path.join(__dirname, 'oyunlar', ad) : null; }
  if (fs.existsSync(path.join(__dirname, 'oyun.html'))) return __dirname;
  const adlar = oyunlariBul();
  return adlar.length === 1 ? path.join(__dirname, 'oyunlar', adlar[0]) : null;
}
// Açılan oyun. Çoğu zaman açılışta bellidir; birden çok oyun varken ad verilmediyse sorulduktan sonra atanır.
// Hazır parçalar açılan oyunun kendi klasöründen gelir: oyunlar/<ad>/muzik/ (paketlenince paketin muzik/ klasörü).
// Bütün oyunların ortak kullandığı bir müzik klasörü yoktur: her oyunun müziği kendinedir (docs/MUZIK.md).
let KLASOR = null, OYUN = null, MUZIK_KLASOR = null;
function oyunAta(klasor) {
  KLASOR = klasor;
  OYUN = klasor ? path.join(klasor, 'oyun.html') : null;
  MUZIK_KLASOR = klasor ? path.join(klasor, 'muzik') : null;
}
oyunAta(ANA ? null : oyunKlasoru()); // ana sayfa kipinde oyun sayfadan seçilir
// "Hangi oyun?" sorusunun yanıtını oyun adına çevirir: listedeki sıra numarası ya da oyunun adı.
function oyunSec(adlar, yanit) {
  const y = String(yanit == null ? '' : yanit).trim().toLowerCase();
  if (/^\d+$/.test(y))
    return adlar[parseInt(y, 10) - 1] || null;
  return adlar.find(a => a.toLowerCase() === y) || null;
}

const yaz = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
// Başlatıcı ve pencere adı platforma göre: Windows BASLAT.bat + siyah pencere, macOS BASLAT.command + Terminal penceresi,
// Linux BASLAT.sh + terminal penceresi. Ana sayfa da aynı adları kullanır (/api/oyunlar içindeki platform alanı).
const PLATFORM = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
const METIN = {
  windows: { baslatici: 'BASLAT.bat', pencere: 'siyah pencere', pencereyi: 'siyah pencereyi', yeniden: 'BASLAT.bat dosyasına yeniden çift tıkla' },
  mac: { baslatici: 'BASLAT.command', pencere: 'Terminal penceresi', pencereyi: 'Terminal penceresini', yeniden: 'BASLAT.command dosyasına yeniden çift tıkla (açılmazsa Terminal\'de klasöre girip sh BASLAT.command yaz)' },
  linux: { baslatici: 'BASLAT.sh', pencere: 'terminal penceresi', pencereyi: 'terminal penceresini', yeniden: 'BASLAT.sh dosyasını yeniden çalıştır' }
}[PLATFORM];

// Motorun kimliği: klasör + sürüm (SURUM.txt, hazır pakette) + köprünün kendi kodu, kısa bir özet olarak. Başlatıcı kapıda
// çalışan motorun aynı klasörün aynı sürümü olup olmadığını buna bakarak anlar. Klasörün yolu dışarı verilmez, yalnız özeti.
const MOTOR_KIMLIK = (() => {
  const h = crypto.createHash('sha256');
  let kl = __dirname;
  try { kl = fs.realpathSync.native(__dirname); } catch (e) { }
  h.update(process.platform === 'win32' ? kl.toLowerCase() : kl);
  for (const d of [path.join(__dirname, 'SURUM.txt'), __filename]) { h.update('\0'); try { h.update(fs.readFileSync(d)); } catch (e) { } }
  return h.digest('hex').slice(0, 16);
})();
// Arka plandaki motorun günlüğü (konsol çıktısı) ve boşta kapanma süresi. Süreyi yalnız testler kısaltır.
const GUNLUK = path.join(__dirname, 'motor-gunlugu.txt');
const BOS_KAPANIS_MS = +process.env.KOPRU_BOS_KAPANIS_MS > 0 ? +process.env.KOPRU_BOS_KAPANIS_MS : 10 * 60e3;
// Motor kapanınca sayfalara giden cümle (ana sayfa da aynısını yazar).
const KAPANDI = 'Motor kapandı. Yeniden açmak için ' + (PLATFORM === 'linux' ? 'BASLAT.sh dosyasını çalıştır.' : 'BASLAT\'a çift tıkla.');
const sureYazi = ms => ms >= 60e3 ? Math.round(ms / 60e3) + ' dakika' : Math.max(1, Math.round(ms / 1000)) + ' saniye';

/* ------------------------------------------------------------------ oyun sayfası + WebSocket sunucusu */
const istemciler = new Set();
let sonDurum = ANA ? 'Henüz bir oyun açılmadı.' : DENEME ? 'Deneme kipi: olaylar sahte.' : 'TikTok yayınına bağlanılıyor…';
// Bağlantı durumu, oyun sayfasının masasındaki Bağlantı hücresi için (docs/OLAYLAR.md): deneme · baglaniyor · bekliyor
// (yayın açık değil, yeniden denenecek) · bagli (TikTok'tan gerçekten olay geliyor) · durdu · hata. "Canlı" yalnız bagli.
let sonBaglanti = ANA ? 'durdu' : DENEME ? 'deneme' : 'baglaniyor';
const sayac = { yorum: 0, hediye: 0, begeni: 0, takip: 0, paylasim: 0, katilim: 0 };
// Ana sayfa kipinde şu an çalışan: { oyun, ad, kip, kullanici, calistirma, durdur }. Öbür kiplerde boş kalır.
// calistirma: her başlatmanın kimliği; oyun sayfası soketini bununla açar, yeni başlatmada eskiler kapatılır.
let calisan = null;

function cerceve(metin) { // sunucudan istemciye tek parça metin çerçevesi
  const veri = Buffer.from(metin, 'utf8'), n = veri.length;
  let bas;
  if (n < 126) bas = Buffer.from([0x81, n]);
  else if (n < 65536) { bas = Buffer.alloc(4); bas[0] = 0x81; bas[1] = 126; bas.writeUInt16BE(n, 2); }
  else { bas = Buffer.alloc(10); bas[0] = 0x81; bas[1] = 127; bas.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([bas, veri]);
}
// Ana sayfa kipinde her oyun sayfası çalışan başlatmanın kimliğiyle bağlanır (/olay/<ad>/<calistirma>); başka bir
// soket kabul edilmez. Öbür kiplerde tek oyun vardır, bağlanan her sayfa (adres ve kaynak denetiminden geçtiyse) alır.
const alici = s => !ANA || (calisan && s.calistirma === calisan.calistirma);
function yayinla(nesne) {
  const c = cerceve(JSON.stringify(nesne));
  for (const s of istemciler) { if (!alici(s)) continue; try { s.write(c); } catch (e) { istemciler.delete(s); } }
}
function durumBildir(ileti, baglanti) { sonDurum = ileti; if (baglanti) sonBaglanti = baglanti; yaz(ileti); yayinla({ tip: 'kopru', ileti, baglanti: sonBaglanti }); }
// Eski başlatmaların soketlerini kapatır (önce kısa bir ileti, sonra WebSocket kapanış çerçevesi).
function soketleriKapat(kosul, ileti) {
  const c = ileti ? cerceve(JSON.stringify({ tip: 'kopru', ileti, baglanti: 'durdu' })) : null;
  for (const s of [...istemciler]) {
    if (!kosul(s)) continue;
    istemciler.delete(s);
    try { if (c) s.write(c); s.end(Buffer.from([0x88, 0])); } catch (e) { }
    setTimeout(() => { try { s.destroy(); } catch (e) { } }, 500);
  }
}
// Yalnız bu köprünün kendi adresi: başka bir ad taşıyan istek (DNS yeniden bağlama) her kipte geri çevrilir.
const IZINLI_HOST = ['127.0.0.1:' + PORT, 'localhost:' + PORT];
// Komut satırı kiplerinde olay akışının adresi: her açılışta yeni, tahmin edilemez bir kimlik (/olay/<kimlik>). Köprü
// kendi sunduğu sayfaya bunu yazar; diskten açılan sayfa ya da başka bir program siyah pencerede yazan tam adresi
// kullanır. Kimliği bilmeyen (başka bir sitenin sayfası, kum havuzlu iframe'i dahil) el sıkışmadan önce 403 alır.
const KIMLIK = crypto.randomBytes(12).toString('hex'), OLAY_YOL = '/olay/' + KIMLIK;
// Başka bir site köprünün sayfalarını çerçeveye alıp (görünmez iframe) panelin düğmelerine tıklatamasın: her HTML yanıtı
// yalnız aynı kökenden çerçevelenebilir (ana sayfanın önizlemeleri aynı kökendir).
const CERCEVE_YASAK = { 'x-frame-options': 'SAMEORIGIN', 'content-security-policy': "frame-ancestors 'self'" };
const hostIyi = req => IZINLI_HOST.includes(String(req.headers.host || '').toLowerCase());
// Boşta kapanma için son temas: motorun kendi adresine gelen her istek (başka bir sitenin sayfasından gelenler sayılmaz:
// tarayıcı onlara Sec-Fetch-Site: cross-site yazar) ve bağlanan / ayrılan her soket.
let sonTemas = Date.now();
const temas = () => { sonTemas = Date.now(); };

const sunucu = http.createServer((req, res) => {
  const yol = (req.url || '/').split('?')[0];
  if (!hostIyi(req)) { res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Bu adres yalnız bu bilgisayardan, köprünün kendi adresiyle açılır.'); return; }
  const site = req.headers['sec-fetch-site'];
  if (!site || site === 'same-origin' || site === 'none') temas();
  if (ANA) { anaSayfaIstegi(req, res, yol); return; }
  if (yol === '/' || yol === '/index.html') {
    fs.readFile(OYUN, 'utf8', (hata, html) => {
      if (hata) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('oyun.html bulunamadı. Önce derle: node araclar/derle.js <ad>'); return; }
      // Oyuna "seni köprü açtı, şu adrese bağlan" bilgisini ver.
      const ek = '<script>window.OYUN_KOPRU = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "' + OLAY_YOL + '";</script>';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...CERCEVE_YASAK });
      res.end(html.replace('<body>', '<body>\n' + ek));
    });
  } else if (yol === '/durum') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ durum: sonDurum, bagliSayfa: istemciler.size, sayac }));
  } else if (yol.startsWith('/muzik/')) {
    muzikSun(yol.slice(7), req, res);
  } else { res.writeHead(404); res.end(); }
});
// İsteğe bağlı hazır parçalar: yalnız açılan oyunun muzik/ klasöründeki düz adlı .js ve ses dosyaları sunulur.
const MUZIK_TUR = { '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
function muzikSun(ad, req, res, klasor = MUZIK_KLASOR) {
  const tur = MUZIK_TUR[path.extname(ad).toLowerCase()];
  if (!tur || !klasor || !/^[\w.-]+$/.test(ad) || ad.includes('..')) { res.writeHead(404); res.end(); return; }
  const dosya = path.join(klasor, ad);
  fs.stat(dosya, (hata, bilgi) => {
    // Oyunun hazır parçası yoksa sayfa her açılışta liste.js ister; konsola 404 düşmesin diye boş bir betik döner
    // (çekirdek boş listede üretilen müzikle devam eder).
    if ((hata || !bilgi.isFile()) && ad === 'liste.js') { res.writeHead(200, { 'content-type': tur, 'cache-control': 'no-store' }); res.end('/* bu oyunun hazır parçası yok */\n'); return; }
    if (hata || !bilgi.isFile()) { res.writeHead(404); res.end(); return; }
    // Ses öğesi parçanın içinde gezinebilsin diye aralık isteği desteklenir.
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let bas = 0, son = bilgi.size - 1;
    if (m && (m[1] || m[2])) {
      if (m[1]) { bas = parseInt(m[1], 10); if (m[2]) son = Math.min(son, parseInt(m[2], 10)); }
      else bas = Math.max(0, bilgi.size - parseInt(m[2], 10));
      if (!(bas <= son)) { res.writeHead(416, { 'content-range': 'bytes */' + bilgi.size }); res.end(); return; }
      res.writeHead(206, { 'content-type': tur, 'accept-ranges': 'bytes', 'content-range': 'bytes ' + bas + '-' + son + '/' + bilgi.size, 'content-length': son - bas + 1 });
    } else res.writeHead(200, { 'content-type': tur, 'accept-ranges': 'bytes', 'content-length': bilgi.size });
    fs.createReadStream(dosya, { start: bas, end: son }).on('error', () => res.destroy()).pipe(res);
  });
}
sunucu.on('upgrade', (req, soket) => {
  // Hata dinleyicisi en başta: geri çevrilen ya da yarıda kesilen bir bağlantının ECONNRESET'i köprüyü düşürmesin
  // (dinleyicisiz soketteki 'error' bütün süreci kapatır; başka bir site yalnız yoklayarak motoru durdurabilirdi).
  soket.on('error', () => { });
  const anahtar = req.headers['sec-websocket-key'];
  if (!anahtar || String(req.headers.upgrade).toLowerCase() !== 'websocket') { soket.destroy(); return; }
  const reddet = () => { try { soket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); } catch (e) { } setTimeout(() => soket.destroy(), 200); };
  // Kaynak (Origin) denetimi: başka bir site tarayıcıda açıkken olay akışını (ve yayıncının adını) okuyamasın.
  // Ana sayfa kipinde yalnız köprünün kendi sayfası. Komut satırı kiplerinde ayrıca kaynak bildirmeyen istemci ve
  // diskten açılmış oyun sayfası (null / file:) kabul edilir: orada oyun.html elle de bağlanabilir (docs/OLAYLAR.md).
  const kaynak = String(req.headers.origin || '').toLowerCase();
  const kendi = IZINLI_HOST.some(h => kaynak === 'http://' + h);
  // Komut satırı kiplerinde yalnız /olay/<kimlik>; yanlış ya da eksik kimlik, kaynağına bakılmadan geri çevrilir.
  if (!ANA && (req.url || '').split('?')[0] !== OLAY_YOL) { reddet(); return; }
  if (!hostIyi(req) || !(kendi || (!ANA && (!kaynak || kaynak === 'null' || kaynak.startsWith('file:'))))) { reddet(); return; }
  if (ANA) { // yalnız çalışan başlatmanın adresi: /olay/<oyun>/<calistirma>
    const m = /^\/olay\/([\w-]+)\/([a-f0-9]{12})$/.exec((req.url || '').split('?')[0]);
    if (!m || !calisan || calisan.oyun !== m[1] || calisan.calistirma !== m[2]) { reddet(); return; }
    soket.calistirma = m[2];
  }
  const kabul = crypto.createHash('sha1').update(anahtar + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  soket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + kabul + '\r\n\r\n');
  soket.setNoDelay(true); istemciler.add(soket); temas();
  // Yoklama paketi: sayfa sessizce yok olursa (uyku, çökme) soket listede sonsuza dek kalıp boşta kapanmayı engellemesin.
  try { soket.setKeepAlive(true, 60e3); } catch (e) { }
  yaz('Oyun sayfası bağlandı (' + istemciler.size + ' sayfa).');
  soket.write(cerceve(JSON.stringify({ tip: 'kopru', ileti: sonDurum, baglanti: sonBaglanti })));
  let tampon = Buffer.alloc(0);
  soket.on('data', parca => { // istemciden yalnızca kapanış ve ping beklenir
    tampon = Buffer.concat([tampon, parca]);
    while (tampon.length >= 2) {
      const islem = tampon[0] & 0x0f, maskeli = tampon[1] & 0x80; let uz = tampon[1] & 0x7f, i = 2;
      if (uz === 126) { if (tampon.length < 4) return; uz = tampon.readUInt16BE(2); i = 4; }
      else if (uz === 127) { if (tampon.length < 10) return; uz = Number(tampon.readBigUInt64BE(2)); i = 10; }
      if (uz > 1 << 20) { soket.destroy(); return; }
      const toplam = i + (maskeli ? 4 : 0) + uz; if (tampon.length < toplam) return;
      let yuk = tampon.subarray(i + (maskeli ? 4 : 0), toplam);
      if (maskeli) { const m = tampon.subarray(i, i + 4); yuk = Buffer.from(yuk.map((b, k) => b ^ m[k & 3])); }
      tampon = tampon.subarray(toplam);
      if (islem === 0x8) { try { soket.end(Buffer.from([0x88, 0])); } catch (e) {} return; }
      if (islem === 0x9) { try { soket.write(Buffer.concat([Buffer.from([0x8a, yuk.length & 0x7f]), yuk.subarray(0, 125)])); } catch (e) {} }
    }
  });
  const birak = () => { temas(); if (istemciler.delete(soket)) yaz('Oyun sayfası ayrıldı (' + istemciler.size + ' sayfa).'); };
  soket.on('close', birak); soket.on('error', birak);
});
sunucu.on('error', e => {
  if (e.code === 'EADDRINUSE' && ANA) { zatenAcik(); return; }
  if (e.code === 'EADDRINUSE') console.log('\n' + PORT + ' numaralı kapı dolu. Köprü zaten açık olabilir; kapatıp yeniden dene ya da --port 9000 ekle.\n');
  else console.log('Sunucu hatası:', e.message);
  process.exit(1);
});
function calistir() {
  if (args.includes('--gizli') && !ANA) { console.log('\n  --gizli yalnız --ana-sayfa ile birlikte kullanılır.\n'); process.exit(1); }
  if (GIZLI) { gizliBaslat(); return; }
  if (ANA) { dinle(); return; }
  if (!DENEME && !KULLANICI) {
    console.log('\nKullanım:\n  node kopru.js tiktok_kullanici_adin --oyun <ad>\n  node kopru.js --deneme --oyun <ad>     (TikTok olmadan dener)\n');
    process.exit(1);
  }
  if (!OYUN || !fs.existsSync(OYUN)) {
    const adlar = oyunlariBul();
    // Ad verilmemiş ve birden çok oyun var: kişi karşıdaysa (BASLAT.bat --sor verir ya da komut satırında elle
    // çalıştırılmıştır) sor. Köprüyü başka bir program çalıştırıyorsa sorup asılı kalma, eskisi gibi söyleyip dur.
    if (oi < 0 && adlar.length > 1 && (args.includes('--sor') || process.stdin.isTTY)) {
      oyunSor(adlar);
      return;
    }
    console.log('\nHangi oyun açılacak? --oyun <ad> ekle.' + (adlar.length ? ' Derlenmiş oyunlar: ' + adlar.join(', ') : ' Henüz derlenmiş oyun yok: node araclar/derle.js <ad>') + '\n');
    process.exit(1);
  }
  dinle();
}
// Derlenmiş oyunları sıralar, birini seçtirir, seçilenle köprüyü açar. Listede olmayan yanıtta yeniden sorar.
function oyunSor(adlar) {
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  let secildi = false;
  console.log('\nHangi oyun açılsın?\n');
  adlar.forEach((ad, i) => {
    let gorunen = '';
    try { gorunen = JSON.parse(fs.readFileSync(path.join(__dirname, 'oyunlar', ad, 'oyun.json'), 'utf8')).ad || ''; } catch (e) { }
    console.log('  ' + (i + 1) + ') ' + ad + (gorunen ? '   (' + gorunen + ')' : ''));
  });
  const sor = () => rl.question('\nNumarasını ya da adını yazıp Enter\'a bas: ', yanit => {
    const ad = oyunSec(adlar, yanit);
    if (!ad) {
      console.log('  Listede yok: ' + String(yanit).trim());
      sor();
      return;
    }
    secildi = true;
    rl.close();
    oyunAta(path.join(__dirname, 'oyunlar', ad));
    dinle();
  });
  // Yanıt gelmeden girdi biterse (pencere kapatıldı, girdi başka yerden geliyordu) asılı kalma.
  rl.on('close', () => { if (!secildi) { console.log('\nOyun seçilmedi. Doğrudan açmak için: --oyun <ad>\n'); process.exit(1); } });
  sor();
}
function dinle() {
  // Yalnızca bu bilgisayardan erişilir (127.0.0.1); ağdaki başka cihazlar bağlanamaz.
  sunucu.listen(PORT, '127.0.0.1', () => {
    if (ANA) {
      console.log('\n  TikTok Oyun Fabrikası açık:  http://localhost:' + PORT + '/');
      if (ARKA) {
        yaz('Motor açıldı (süreç ' + process.pid + '), penceresiz çalışıyor.');
        console.log('  Kapatmak için ana sayfada "Motoru kapat"a bas. Tarayıcıda hiçbir oyun fabrikası sayfası açık değilken ' + sureYazi(BOS_KAPANIS_MS) + ' sonra kendiliğinden kapanır.\n');
        bostaKapanmayiKur();
      } else console.log('  Bu ' + METIN.pencere + ' oyunların motorudur. Açık kalsın; kapatınca oyunlar durur. Ana sayfadaki "Motoru kapat" da kapatır.\n');
      if (args.includes('--ac')) tarayicidaAc('http://localhost:' + PORT + '/');
      kutuphaneHazirla(); // sayfa açılırken kütüphane yoksa indirmeye başlar; sayfa durumu gösterir
      return;
    }
    console.log('\n  Köprü çalışıyor. Oyun: ' + path.relative(__dirname, OYUN));
    console.log('  Oyun (panelli):      http://localhost:' + PORT + '/');
    console.log('  Yalnızca sahne:      http://localhost:' + PORT + '/#yayin');
    console.log('  Olay adresi:         ws://127.0.0.1:' + PORT + OLAY_YOL + '   (diskten açılan oyunda Yayın sekmesine bunu yaz)');
    let parca = [];
    try { parca = fs.readdirSync(MUZIK_KLASOR).filter(a => /\.(mp3|ogg|wav|m4a)$/i.test(a)); } catch (e) { }
    const mk = path.relative(__dirname, MUZIK_KLASOR) || 'muzik';
    console.log('  Müzik:               ' + (parca.length && fs.existsSync(path.join(MUZIK_KLASOR, 'liste.js')) ? parca.length + ' hazır parça (' + mk + ')' : 'oyunun kendi üretilen müziği (' + mk + ' içinde hazır parça yok)'));
    console.log('  Kapatmak için bu pencerede Ctrl+C.\n');
    if (DENEME) denemeBaslat(); else tiktokBaslat();
    if (args.includes('--ac')) tarayicidaAc('http://localhost:' + PORT + '/'); // köprü dinlemeye başladıktan sonra
  });
  const kapat = () => { kurulumuKes(); console.log(ANA ? '\nMotor kapatıldı.' : '\nKöprü kapatıldı.'); process.exit(0); };
  // SIGHUP: Windows'ta pencere kapatılınca gelir. 'exit': başka bir yoldan çıkılsa da kurulum ağacı arkada kalmaz.
  for (const sinyal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) { try { process.on(sinyal, kapat); } catch (e) { } }
  process.on('exit', kurulumuKes);
}
function tarayicidaAc(adres) { // varsayılan tarayıcıda açar
  const { exec } = require('child_process');
  const komut = process.platform === 'win32' ? 'start "" "' + adres + '"' : process.platform === 'darwin' ? 'open "' + adres + '"' : 'xdg-open "' + adres + '"';
  // windowsHide: penceresiz motorun konsolu yoktur; bayraksız açılan komut istemi yeni bir siyah pencere gösterirdi.
  try { exec(komut, { windowsHide: true }, () => {}); } catch (e) {}
}

/* ------------------------------------------------------------------ penceresiz başlatma (--gizli) ve kapanma */
// Kapıya kısa bir JSON isteği: geri çağrı (hata, json, durumKodu). En çok `sure` ms; yanıt bitmezse vazgeçer.
function kapiIstek(yol, sec, sonra) {
  let bitti = false;
  const son = (h, j, kod) => { if (bitti) return; bitti = true; clearTimeout(t); sonra(h, j, kod); };
  const govde = sec.govde === undefined ? null : JSON.stringify(sec.govde);
  const basliklar = Object.assign({ host: '127.0.0.1:' + PORT }, govde === null ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(govde) }, sec.basliklar || {});
  const r = http.request({ host: '127.0.0.1', port: PORT, path: yol, method: sec.yontem || 'GET', headers: basliklar }, y => {
    let g = ''; y.setEncoding('utf8');
    y.on('data', p => { g += p; if (g.length > 65536) r.destroy(); });
    y.on('end', () => { let j = null; try { j = JSON.parse(g); } catch (e) { } son(null, j, y.statusCode); });
    y.on('error', e => son(e, null, 0));
  });
  r.on('error', e => son(e, null, 0));
  const t = setTimeout(() => { try { r.destroy(); } catch (e) { } son(new Error('zaman aşımı'), null, 0); }, sec.sure || 3000);
  r.end(govde === null ? undefined : govde);
}
// Kapıda ne var: 'bos' (kimse dinlemiyor), 'ana' (bir ana sayfa motoru; j = /api/oyunlar), 'eski' (tek oyunla, eski
// yoldan açılmış köprü) ya da 'yabanci' (başka bir program).
function kapiyaBak(sonra) {
  kapiIstek('/api/oyunlar', {}, (h, j) => {
    if (h && h.code === 'ECONNREFUSED') return sonra({ tur: 'bos' });
    if (j && j.anaSayfa === true) return sonra({ tur: 'ana', j });
    if (h) return sonra({ tur: 'yabanci' });
    kapiIstek('/durum', {}, (h2, d) => sonra(d && d.sayac && typeof d.durum === 'string' ? { tur: 'eski' } : { tur: 'yabanci' }));
  });
}
const KAPI_DOLU = () => '\n  ' + PORT + ' numaralı kapı başka bir program tarafından kullanılıyor (kapı dolu).\n  O programı kapatıp yeniden dene.\n';
// BASLAT.bat'ın çalıştırdığı kısa ömürlü başlatıcı. Motor yanıt verince sessizce çıkar (0): pencere kendiliğinden kapanır.
// Motor açılamazsa düz bir cümle ve günlüğün son satırlarını yazıp 1 ile çıkar (BASLAT.bat pencereyi açık tutar).
function gizliBaslat() {
  const adres = 'http://localhost:' + PORT + '/';
  kapiyaBak(k => {
    if (k.tur === 'bos') return motoruAc();
    if (k.tur === 'ana' && k.j.motor === MOTOR_KIMLIK) {
      console.log('\n  Oyun fabrikası zaten açık: ' + adres + '\n');
      if (args.includes('--ac')) tarayicidaAc(adres);
      setTimeout(() => process.exit(0), args.includes('--ac') ? 600 : 0);
      return;
    }
    if (k.tur === 'ana') { // başka bir klasörün ya da başka bir sürümün motoru: kapanmasını iste, kapı boşalınca aç
      console.log('\n  Başka bir oyun klasöründen ya da başka bir sürümden açılmış motor çalışıyor; o kapatılıyor.');
      kapiIstek('/kapat', { yontem: 'POST', govde: {}, basliklar: { 'x-fabrika': 'kapat' } }, (h, j, kod) => {
        if (kod !== 200) {
          console.log('\n  Oyun fabrikasının eski bir motoru açık ve kendiliğinden kapanmıyor.\n  O ' + METIN.pencereyi + ' kapat, sonra ' + METIN.yeniden + '.\n');
          process.exit(1);
        }
        kapiBosalinca(bos => {
          if (bos) return motoruAc();
          console.log('\n  Eski motor kapanmadı. Bilgisayarı yeniden başlatıp ' + METIN.yeniden + '.\n');
          process.exit(1);
        });
      });
      return;
    }
    if (k.tur === 'eski') {
      console.log('\n  Oyun motoru başka bir pencerede zaten açık (tek oyunla, eski yoldan başlatılmış).\n  O ' + METIN.pencereyi + ' kapat, sonra ' + METIN.yeniden + '.\n');
      process.exit(1);
    }
    console.log(KAPI_DOLU());
    process.exit(1);
  });
}
// Kapıyı tutan süreç kapanana dek bekler (en çok 10 sn): sonra(true) kapı boş.
function kapiBosalinca(sonra) {
  const t0 = Date.now();
  (function bak() {
    const s = require('net').connect(PORT, '127.0.0.1');
    s.on('connect', () => { s.destroy(); if (Date.now() - t0 > 10000) sonra(false); else setTimeout(bak, 200); });
    s.on('error', e => { if (e.code === 'ECONNREFUSED') sonra(true); else if (Date.now() - t0 > 10000) sonra(false); else setTimeout(bak, 200); });
  })();
}
// Günlüğün son açılışından son satırlar (başlatıcının hata iletisi için).
function gunlukSonu(n) {
  try {
    const t = fs.readFileSync(GUNLUK, 'utf8'), bas = t.lastIndexOf('\n==== ');
    return (bas >= 0 ? t.slice(bas + 1) : t).split(/\r?\n/).filter(s => s.trim()).slice(-n);
  } catch (e) { return []; }
}
// Gerçek motoru penceresiz ve başlatıcıdan bağımsız açar, kapıda yanıt verene dek bekler (en çok 20 sn).
function motoruAc() {
  let fd = null;
  try {
    let bayrak = 'a';
    try { if (fs.statSync(GUNLUK).size > 1024 * 1024) bayrak = 'w'; } catch (e) { } // günlük büyüdüyse baştan başlar
    fd = fs.openSync(GUNLUK, bayrak);
    fs.writeSync(fd, '\n==== ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC · motor başlatılıyor ====\n');
  } catch (e) { fd = null; } // klasöre yazılamıyorsa günlüksüz açılır; motor yine çalışır
  const cocukArg = [__filename, ...args.filter(a => a !== '--gizli'), '--arka-plan'];
  let c;
  try {
    c = require('child_process').spawn(process.execPath, cocukArg, { detached: true, windowsHide: true, cwd: __dirname, stdio: ['ignore', fd === null ? 'ignore' : fd, fd === null ? 'ignore' : fd] });
  } catch (e) { c = null; }
  if (fd !== null) { try { fs.closeSync(fd); } catch (e) { } }
  let olum = c ? 0 : Date.now();
  if (c) { c.on('error', () => { if (!olum) olum = Date.now(); }); c.on('exit', () => { if (!olum) olum = Date.now(); }); c.unref(); }
  const t0 = Date.now();
  const basarisiz = neden => {
    console.log('\n  Oyun motoru açılamadı: ' + neden);
    const satirlar = gunlukSonu(15);
    if (satirlar.length) console.log('\n  Motorun son yazdıkları (' + path.basename(GUNLUK) + '):\n' + satirlar.map(s => '    ' + s).join('\n'));
    console.log('\n  Bu pencerenin ekran görüntüsünü gönderirsen sorun bulunur.\n');
    process.exit(1);
  };
  (function bak() {
    kapiIstek('/api/oyunlar', { sure: 2000 }, (h, j) => {
      if (j && j.anaSayfa === true && j.motor === MOTOR_KIMLIK) process.exit(0); // motor hazır; pencere kapanabilir
      if (olum && Date.now() - olum > 1500) return basarisiz('motor açılırken durdu.');
      if (Date.now() - t0 > 20000) {
        // Yanıt vermeyen motor gizli kalıp klasörü tutmasın: bu başlatıcının açtığı süreç kapatılır.
        if (c && !olum) { try { process.kill(c.pid); } catch (e) { } }
        return basarisiz('motor 20 saniyede yanıt vermedi.');
      }
      setTimeout(bak, 250);
    });
  })();
}
// Motoru düzgün kapatır: çalışan oyun durur (sahte olay saati, TikTok bağlantısı), açık oyun sayfalarına "motor
// kapandı" denir (yeniden bağlanmayı bırakırlar), süren kurulum ağacıyla öldürülür, kapı bırakılır, süreç çıkar.
let kapaniyor = false;
function motoruKapat(neden) {
  if (kapaniyor) return;
  kapaniyor = true;
  oyunDurdur(KAPANDI);
  soketleriKapat(() => true, KAPANDI);
  kurulumuKes();
  if (neden === 'bos') yaz('Motor ' + sureYazi(BOS_KAPANIS_MS) + ' boyunca hiçbir sayfayla görüşmedi; kendiliğinden kapanıyor.');
  else yaz('Motor ana sayfadan kapatıldı.');
  try { sunucu.close(); } catch (e) { }
  setTimeout(() => process.exit(0), 600); // soketlere kapanış iletisi gitsin
}
// Yalnız arka plandaki motorda: hiçbir oyun sayfası soketle bağlı değilken ve süre boyunca motora istek gelmezse kapanır.
// Bağlı bir soket hep temas sayılır (yayında saatlerce arka planda kalan sekmenin zamanlayıcıları kısılır, soket kalır).
// Kütüphane inerken de kapanmaz (kurulumun kendi süre sınırı vardır).
function bostaKapanmayiKur() {
  const t = setInterval(() => {
    if (istemciler.size || kutuphane.cocuk) { temas(); return; }
    if (Date.now() - sonTemas >= BOS_KAPANIS_MS) { clearInterval(t); motoruKapat('bos'); }
  }, Math.max(200, Math.min(30000, Math.floor(BOS_KAPANIS_MS / 5))));
}

/* ------------------------------------------------------------------ ana sayfa kipi */
// TikTok kullanıcı adı: harf, rakam, alt çizgi ve nokta; 2-24 karakter; noktayla bitmez. Başka her şey geri çevrilir.
const KULLANICI_DESEN = /^(?!.*\.$)[A-Za-z0-9_.]{2,24}$/;
const OYUN_DESEN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const htmlCoz = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function oyunBilgi(klasor, id) {
  let b = {};
  try { b = JSON.parse(fs.readFileSync(path.join(klasor, 'oyun.json'), 'utf8').replace(/^﻿/, '')) || {}; } catch (e) { }
  let ad = typeof b.ad === 'string' ? b.ad.trim() : '';
  if (!ad) { // oyun.json yoksa (eski paket) derlemenin yazdığı sekme başlığı
    try { const m = /<title>([^<]*)<\/title>/.exec(fs.readFileSync(path.join(klasor, 'oyun.html'), 'utf8').slice(0, 30000)); if (m) ad = htmlCoz(m[1]).trim(); } catch (e) { }
  }
  return { id, ad: (ad || id).slice(0, 60), aciklama: typeof b.aciklama === 'string' ? b.aciklama.trim().slice(0, 300) : '', vitrin: b.vitrin !== false, klasor };
}
// Ana sayfadaki oyunlar. Her istekte yeniden okunur: yeni derlenen oyun köprü kapanmadan listeye girer.
function vitrindekiler() {
  if (fs.existsSync(path.join(__dirname, 'oyun.html'))) { // yayıncı paketi: tek oyun, vitrin ayarına bakılmaz
    const b = oyunBilgi(__dirname, 'oyun'), p = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'oyun.json'), 'utf8').replace(/^﻿/, '')).paket; } catch (e) { return ''; } })();
    if (typeof p === 'string' && OYUN_DESEN.test(p)) b.id = p;
    return [b];
  }
  return oyunlariBul().filter(a => OYUN_DESEN.test(a)).sort().map(a => oyunBilgi(path.join(__dirname, 'oyunlar', a), a)).filter(o => o.vitrin);
}
const paketMi = () => fs.existsSync(path.join(__dirname, 'oyun.html'));

// TikTok kütüphanesi (yalnız ana sayfa kipinde): yoksa motor kendisi indirir; sayfa durumu /api/oyunlar'dan okur.
// Komut sabittir (npm install --omit=dev, köprünün klasöründe); içine kullanıcıdan gelen hiçbir şey girmez, ayrı pencere
// açılmaz. Testler ağa ve gerçek npm'e dokunmasın diye yalnız komut satırındaki --kurulum-betigi <yol> verilirse npm
// yerine o betik node ile çalıştırılır (--kurulum-sinir <sn> süre sınırını kısaltır, yalnız betikle birlikte geçer);
// ortam değişkeni okunmaz, BASLAT.bat bunları vermez. Deneme kipi kütüphaneye hiç ihtiyaç duymaz.
// Aynı anda en çok bir kurulum yaşar: süre dolunca ya da motor kapanırken motorun başlattığı sürecin bütün ağacı
// öldürülür (Windows'ta taskkill /T, başka yerde ayrı süreç grubu); ağaç gerçekten bitmeden durum "iniyor" kalır,
// "Yeniden dene" ikinci bir kurulum başlatamaz.
const secenekDeger = ad => { const i = args.indexOf(ad); return i >= 0 ? args[i + 1] : undefined; };
const KURULUM_BETIGI = secenekDeger('--kurulum-betigi') || '';
const KURULUM_SINIR = (KURULUM_BETIGI && +secenekDeger('--kurulum-sinir') > 0 ? +secenekDeger('--kurulum-sinir') : 600) * 1000;
const KURULUM_NEDEN = {
  internet: 'İndirilemedi. İnternet bağlantını kontrol et.',
  sure: 'İndirme çok uzun sürdü. İnternet bağlantını kontrol edip yeniden dene.',
  npmYok: 'İndirme programı bulunamadı: Node.js kurulumu eksik görünüyor. Node.js\'i nodejs.org adresinden yeniden kur.',
  izin: 'Bu klasöre yazılamıyor. Oyun klasörünü Masaüstü ya da Belgeler gibi yazılabilir bir yere taşı.',
  eksik: 'İndirme bitti ama kütüphane klasörde görünmüyor. Yeniden dene; düzelmezse paketi baştan aç.',
  paketEksik: 'Hazır paket eksik: TikTok kütüphanesi paketin içinde yok. ZIP\'i yeniden indir, bir klasöre çıkar ve oradan aç.'
};
// Windows hazır paketi (araclar/surum.js) kendi Node'unu taşır: node\node.exe köprünün yanında. Onunla çalışırken npm
// yoktur; kütüphane de paketin içindedir, eksikse indirmek yerine paketin eksik olduğu söylenir.
const PAKET_NODU = path.resolve(process.execPath).toLowerCase() === path.join(__dirname, 'node', process.platform === 'win32' ? 'node.exe' : 'node').toLowerCase();
const kutuphane = { durum: 'bilinmiyor', basladi: 0, neden: '', cocuk: null };
// Kütüphane hazır mı: yarım kalmış bir kurulum (elektrik kesildi, motor sert kapatıldı, ZIP yarım açıldı) klasörde
// tiktok-live-connector'ı bırakıp bağımlılıklarını bırakmayabilir; yalnız dosyanın varlığına bakmak "hazır" der ama
// canlı başlatma çöker. Bu yüzden hazır = (1) kurulum kilidi yoksa ya da "bitti" diyorsa ve (2) kütüphane kısa ömürlü
// ayrı bir node sürecinde gerçekten yükleniyorsa. Motorun kendi sürecinde denenmez (yarım modül önbelleği bozmasın).
// Sonuç bir sonraki kuruluma kadar saklanır (her /api/oyunlar isteğinde süreç açılmaz).
let kutuphaneYuklenir = null;
function kilitBitmemis() { try { const k = JSON.parse(fs.readFileSync(KILIT, 'utf8')); return !(k && k.bitti === true); } catch (e) { return fs.existsSync(KILIT); } }
function kutuphaneVarMi(tazele = false, kilidiYoksay = false) {
  if (!tazele && kutuphaneYuklenir !== null) return kutuphaneYuklenir;
  let sonuc = false;
  try {
    require.resolve('tiktok-live-connector');
    if (kilidiYoksay || !kilitBitmemis()) {
      const y = require('child_process').spawnSync(process.execPath, ['-e', "require('tiktok-live-connector')"], { cwd: __dirname, windowsHide: true, stdio: 'ignore', timeout: 30000 });
      sonuc = y.status === 0;
    }
  } catch (e) { sonuc = false; }
  kutuphaneYuklenir = sonuc;
  return sonuc;
}
function kutuphaneDurum() {
  if (kutuphane.durum === 'bilinmiyor' && kutuphaneVarMi()) kutuphane.durum = 'hazir';
  return { durum: kutuphane.durum, sure: kutuphane.durum === 'iniyor' ? Math.max(0, Math.round((Date.now() - kutuphane.basladi) / 1000)) : 0, neden: kutuphane.neden };
}
// Kurulumun başarısızlık nedeni: npm'in son satırlarından düz bir cümle seçilir (ham satırlar yalnız konsola yazılır).
function kurulumNedeni(kod, cikti, baslamadi) {
  if (baslamadi || kod === 127 || kod === 9009 || /is not recognized as an internal or external command|tanınmıyor|command not found|npm: not found|ENOENT[^\n]*npm/i.test(cikti)) return KURULUM_NEDEN.npmYok;
  if (/EACCES|EPERM|EROFS|permission denied|operation not permitted|read-only file system/i.test(cikti)) return KURULUM_NEDEN.izin;
  if (kod === 0) return KURULUM_NEDEN.eksik;
  return KURULUM_NEDEN.internet;
}
// npm yolda (PATH) var mı? Yoksa kurulum hiç başlatılmaz. Windows'ta komut isteminin "tanınmıyor" iletisi dile göre
// değiştiği için çıktıdan anlamak güvenilir değil; önce dosyaya bakılır.
function npmVarMi() {
  const adlar = process.platform === 'win32' ? ['npm.cmd', 'npm.exe', 'npm'] : ['npm'];
  return String(process.env.PATH || process.env.Path || '').split(path.delimiter).filter(Boolean)
    .some(k => adlar.some(a => { try { return fs.statSync(path.join(k.replace(/^"|"$/g, ''), a)).isFile(); } catch (e) { return false; } }));
}
const surecBitti = c => c.exitCode !== null || c.signalCode !== null;
// Motorun başlattığı kurulum sürecini bütün ağacıyla öldürür; ağaç gidince sonra() çağrılır. platform ve oldur yalnız
// testler içindir (Windows dışı yol sahte süreçle sınanır).
function agacKes(c, sonra, platform = process.platform, oldur = (p, s) => process.kill(p, s)) {
  const bekle = () => { if (surecBitti(c)) sonra(); else c.once('exit', () => sonra()); };
  if (platform === 'win32') {
    require('child_process').execFile('taskkill', ['/pid', String(c.pid), '/T', '/F'], { windowsHide: true }, () => bekle());
  } else {
    try { oldur(-c.pid, 'SIGKILL'); } catch (e) { try { c.kill('SIGKILL'); } catch (e2) { } }
    bekle();
  }
}
// Kurulum komutu sabittir ve yalnız köprünün kendi klasörüne kurar: çalışma klasörü orasıdır, --prefix . npm'in üst
// klasörde bir "workspaces" package.json'u bulup oraya kurmasını engeller, --workspaces=false çalışma alanı işlemeyi kapatır.
// (Göreli "." kullanılır: klasör yolundaki boşluk, %, & kabuğa hiç girmez.)
const KURULUM_KOMUTU = 'npm install --omit=dev --no-audit --no-fund --prefix . --workspaces=false';
// Kurulum kilidi: köprünün klasöründe .kurulum-kilidi.json = { pid, basladi } (kurulumu yürüten süreç). Motor sert
// kapatılsa da (Görev Yöneticisi, çökme) npm sürer; yeniden açılan motor kilitteki süreç yaşıyorsa ikinci bir kurulum
// başlatmaz, onun bitmesini bekler. Süreç yoksa ya da kilit kurulum sınırından eskiyse kilit bayattır, üstüne yazılır.
// Kilit silinmez: kurulum bitince { bitti: true } yazılır.
const KILIT = path.join(__dirname, '.kurulum-kilidi.json');
const surecYasiyor = pid => { if (!(pid > 0)) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
// Kilit sıkı okunur: alanların türü ve aralığı tutmazsa, kilit kurulum sınırından eskiyse ya da ileri tarihliyse bayattır.
// Kaydedilen bir süreç ancak "bizim kurucumuz" olabilecekse sayılır: yaşıyor, adı node / npm / cmd (başka sistemlerde
// sh de) ve kilitten önce başlamamış, kilidin son yazılışından sonra da başlamamış (aynı numarayı sonradan alan başka bir
// süreç, sistem süreci ya da uzun süredir çalışan ilgisiz bir program sayılmaz).
const pidGecerli = p => Number.isInteger(p) && p > 4 && p < 2147483648 && p !== process.pid;
const surecBilgiOnbellek = new Map();
function surecBilgisi(pid) { // { ad, basladi } ya da null (okunamadı)
  if (surecBilgiOnbellek.has(pid)) return surecBilgiOnbellek.get(pid);
  let b = null;
  try {
    const cp = require('child_process');
    if (process.platform === 'win32') {
      const c = cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '$p=Get-Process -Id ' + pid + ' -ErrorAction SilentlyContinue; if($p){ $p.ProcessName + "|" + ([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds() }'], { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const m = /^([^|]+)\|(\d+)$/.exec(c); if (m) b = { ad: m[1], basladi: +m[2] };
    } else {
      const c = cp.execFileSync('ps', ['-o', 'etimes=,comm=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const m = /^(\d+)\s+(.+)$/.exec(c); if (m) b = { ad: m[2].split('/').pop(), basladi: Date.now() - +m[1] * 1000 };
    }
  } catch (e) { b = null; }
  surecBilgiOnbellek.set(pid, b);
  return b;
}
function bizimKurucu(pid, k) {
  if (!surecYasiyor(pid)) return false;
  const b = surecBilgisi(pid);
  if (!b || !/^(node|npm|cmd|sh|bash|dash)(\.exe)?$/i.test(b.ad)) return false;
  const pay = 3000, son = Number.isFinite(k.yazildi) ? k.yazildi : k.basladi + Math.max(KURULUM_SINIR, 60e3);
  return b.basladi >= k.basladi - pay && b.basladi <= son + pay;
}
function kilitOku() {
  try {
    const k = JSON.parse(fs.readFileSync(KILIT, 'utf8')), simdi = Date.now();
    if (!k || typeof k !== 'object' || Array.isArray(k) || k.bitti === true) return null;
    if (!Number.isFinite(k.basladi) || k.basladi > simdi + 5000 || simdi - k.basladi > Math.max(KURULUM_SINIR, 60e3)) return null;
    if (k.pidler !== undefined && !Array.isArray(k.pidler)) return null;
    const pidler = [k.pid, ...(k.pidler || [])].filter(pidGecerli);
    if (!pidGecerli(k.pid)) return null;
    return pidler.slice(0, 32).some(p => bizimKurucu(p, k)) ? k : null;
  } catch (e) { }
  return null;
}
// Windows'ta motor sert kapatılınca (Görev Yöneticisi) motorun doğrudan çocuğu (kabuk) onunla ölür, kabuğun açtığı npm
// yaşamaya devam eder. Bu yüzden kilit, kurulum başladıktan kısa süre sonra doğrudan çocuğun altındaki süreçleri de
// (npm) kaydeder; kilit bunlardan biri yaşadıkça geçerlidir. Başka sistemlerde kurulum ayrı süreç grubudur.
function kilitYaz(pid, pidler = []) { try { fs.writeFileSync(KILIT, JSON.stringify({ pid, pidler, basladi: kutuphane.basladi || Date.now(), yazildi: Date.now(), motor: process.pid })); } catch (e) { } }
function altSurecler(pid, sonra) {
  if (process.platform !== 'win32') { sonra([]); return; }
  const komut = '$a=@(' + Number(pid) + ');$t=@();for($i=0;$i -lt 4 -and $a.Count;$i++){$a=@(Get-CimInstance Win32_Process | ? { $a -contains $_.ParentProcessId } | % { $_.ProcessId });$t+=$a};$t -join ","';
  require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', komut], { windowsHide: true, timeout: 20000 }, (h, cikti) => {
    sonra(String(cikti || '').trim().split(',').map(Number).filter(p => p > 0));
  });
}
function kilitBirak() { try { if (fs.existsSync(KILIT)) fs.writeFileSync(KILIT, JSON.stringify({ bitti: true, zaman: Date.now() })); } catch (e) { } }
function kilitBekle(k) {
  kutuphane.durum = 'iniyor'; kutuphane.basladi = Math.min(Date.now(), +k.basladi || Date.now()); kutuphane.neden = '';
  console.log('  TikTok kütüphanesi başka bir pencerede hâlâ iniyor; bitmesi bekleniyor (ikinci kurulum başlatılmaz).');
  const t = setInterval(() => {
    if (kilitOku()) return;
    clearInterval(t);
    // Beklenen kurulumun süreçlerinin bittiğini bu motor gördü. Onu başlatan motor sert kapatıldıysa kilide "bitti"
    // yazacak kimse kalmamıştır; kütüphane ayrı bir süreçte gerçekten yükleniyorsa kurulum tamam sayılır, kilit kapatılır.
    // (Açılışta bitmemiş kilit ve yaşamayan kurucu görülürse ise kurulum yarım sayılır ve yeniden yapılır.)
    if (kutuphaneVarMi(true, true)) { kilitBirak(); kutuphane.durum = 'hazir'; console.log('  TikTok kütüphanesi indi. Yayın düğmeleri hazır.\n'); return; }
    kutuphane.durum = 'bilinmiyor';
    kutuphaneHazirla(); // öbür kurulum kütüphanesiz bitti: bu motor kendisi dener
  }, 1000);
}
function kutuphaneHazirla() {
  if (kutuphane.durum === 'iniyor' || kutuphane.durum === 'hazir' || kutuphane.cocuk) return;
  const baskasiSuruyor = kilitOku(); // başka bir motorun süren kurulumu: "hazır" denmez, beklenir (aşağıda)
  if (!baskasiSuruyor && kutuphaneVarMi(true)) { kutuphane.durum = 'hazir'; return; }
  if (PAKET_NODU) {
    kutuphane.durum = 'hata'; kutuphane.neden = KURULUM_NEDEN.paketEksik;
    console.log('  TikTok kütüphanesi hazır paketin içinde bulunamadı (node_modules eksik). ZIP\'i yeniden indirip çıkar.\n');
    return;
  }
  // Yalnız köprünün kendi klasöründe, kütüphaneyi isteyen bir package.json varsa kurulur. Yoksa npm üst klasörlere
  // tırmanıp ilk bulduğu başka bir projeyi değiştirir (--omit=dev o projenin geliştirme paketlerini siler).
  // Ne eksikse onu söyler: dosya yok, okunamıyor ya da kütüphaneyi (dependencies altında) istemiyor.
  let paketSorun = '';
  const pjYol = path.join(__dirname, 'package.json');
  if (!fs.existsSync(pjYol)) paketSorun = 'Bu klasörde oyunun package.json dosyası yok; kütüphane indirilemez. Oyun klasörünün tamamını (package.json ile) kullan.';
  else {
    let pj = null;
    try { pj = JSON.parse(fs.readFileSync(pjYol, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { }
    if (!pj || typeof pj !== 'object') paketSorun = 'Bu klasördeki package.json okunamıyor (bozuk); kütüphane indirilemez. Oyun klasörünü baştan indir.';
    else if (!(pj.dependencies && pj.dependencies['tiktok-live-connector'])) paketSorun = 'Bu klasördeki package.json TikTok kütüphanesini (tiktok-live-connector) bağımlılık olarak istemiyor; kütüphane indirilemez. Oyun klasörünün asıl package.json dosyasını kullan.';
  }
  if (paketSorun) {
    kutuphane.durum = 'hata'; kutuphane.neden = paketSorun;
    console.log('  TikTok kütüphanesi kurulmadı: ' + paketSorun + ' (başka bir projeye dokunulmasın diye) Dene yine çalışır.\n');
    return;
  }
  // Başka bir motor (aynı klasörde, ör. kapanmadan yeniden açılan) kurulumu hâlâ sürdürüyorsa ikincisi başlatılmaz:
  // o bitene kadar "iniyor" denir, sonra kütüphaneye bakılır (N2, kurulum kilidi).
  const baskasi = kilitOku();
  if (baskasi) { kilitBekle(baskasi); return; }
  kutuphane.durum = 'iniyor'; kutuphane.basladi = Date.now(); kutuphane.neden = ''; kutuphaneYuklenir = null;
  console.log('  TikTok kütüphanesi iniyor (yalnız ilk sefer, yaklaşık bir dakika). Beklerken ana sayfada Dene çalışır.');
  const { spawn } = require('child_process');
  let son = '', bitti = false, c = null;
  const bitir = (kod, neden) => {
    if (bitti) return;
    bitti = true; clearTimeout(sinir); kutuphane.cocuk = null;
    // Kilit yalnız npm başarıyla bittiyse "bitti" olur; yarıda kalan kurulum sonraki açılışta yeniden yapılır.
    if (kod === 0) kilitBirak();
    if (kod === 0 && kutuphaneVarMi(true)) { kutuphane.durum = 'hazir'; console.log('  TikTok kütüphanesi indi. Yayın düğmeleri hazır.\n'); return; }
    kutuphane.durum = 'hata';
    kutuphane.neden = neden || kurulumNedeni(kod, son, false);
    const iz = son.trim().split(/\r?\n/).filter(Boolean).slice(-2).join(' | ').slice(0, 300);
    console.log('  TikTok kütüphanesi indirilemedi.' + (iz ? ' (' + iz + ')' : '') + ' Ana sayfadaki "Yeniden dene" ile yeniden denenir; Dene yine çalışır.\n');
  };
  // Süre dolunca: önce ağaç ölür, sonra durum "hata" olur (o zamana kadar yeniden deneme başlatılamaz).
  const sinir = setTimeout(() => {
    if (c && !surecBitti(c)) { c.kesiliyor = true; agacKes(c, () => bitir(null, KURULUM_NEDEN.sure)); }
    else bitir(null, KURULUM_NEDEN.sure);
  }, KURULUM_SINIR);
  if (!KURULUM_BETIGI && !npmVarMi()) { bitir(null, KURULUM_NEDEN.npmYok); return; }
  try {
    const sec = { cwd: __dirname, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' };
    c = KURULUM_BETIGI
      ? spawn(process.execPath, [KURULUM_BETIGI], sec)
      : spawn(KURULUM_KOMUTU, { ...sec, shell: true });
  } catch (e) { bitir(null, KURULUM_NEDEN.npmYok); return; }
  kutuphane.cocuk = c;
  kilitYaz(c.pid);
  // 1,5 ve 8 sn sonra: kurulumun alt süreçleri kilide eklenir (npm kabuğun altında açılır)
  for (const ms of [1500, 8000]) setTimeout(() => { if (!bitti && !surecBitti(c)) altSurecler(c.pid, p => { if (!bitti && p.length) kilitYaz(c.pid, p); }); }, ms);
  const topla = p => { son = (son + p).slice(-4000); };
  c.stdout.on('data', topla); c.stderr.on('data', topla);
  c.on('error', () => { if (!c.kesiliyor) bitir(null, kurulumNedeni(null, son, true)); });
  // 'close' değil 'exit': torun süreç boruları açık tutsa da sonuç beklemez (son satırlar için kısa bir pay bırakılır).
  // Kesilen kurulumun sonucunu kesen yazar.
  c.on('exit', kod => { if (!c.kesiliyor) setTimeout(() => bitir(kod), 100); });
}
// Motor kapanırken (Ctrl+C, pencere kapatılırken, process.exit): kurulum ağacını beklemeden, eşzamanlı öldürür.
function kurulumuKes() {
  const c = kutuphane.cocuk;
  if (!c || surecBitti(c)) return;
  c.kesiliyor = true;
  try {
    if (process.platform === 'win32') require('child_process').execFileSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(-c.pid, 'SIGKILL');
  } catch (e) { try { c.kill('SIGKILL'); } catch (e2) { } }
}
function anaDurum() {
  return {
    // motor: klasör + sürüm özeti (başlatıcı karşılaştırır); arkaPlan: motor penceresiz mi (sayfanın yazısı buna göre)
    anaSayfa: true, paket: paketMi(), platform: PLATFORM, motor: MOTOR_KIMLIK, arkaPlan: ARKA,
    oyunlar: vitrindekiler().map(o => ({ id: o.id, ad: o.ad, aciklama: o.aciklama })),
    aktif: calisan ? { oyun: calisan.oyun, ad: calisan.ad, kip: calisan.kip, kullanici: calisan.kullanici, calistirma: calisan.calistirma, baglanti: sonBaglanti } : null,
    durum: sonDurum,
    kutuphane: kutuphaneDurum()
  };
}
function jsonYaz(res, kod, nesne) {
  res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(nesne));
}
// İstek bu köprünün kendi sayfasından mı? Host başka bir ad taşıyorsa (DNS yeniden bağlama) ya da istek başka bir
// siteden geliyorsa geri çevrilir. Tarayıcı başka sitenin JSON gövdeli POST'una önce izin sorar; köprü izin vermez.
function yerelIstek(req, kaynakGerekli) {
  const izinli = ['127.0.0.1:' + PORT, 'localhost:' + PORT];
  if (!izinli.includes(String(req.headers.host || '').toLowerCase())) return false;
  if (!kaynakGerekli) return true;
  const kaynak = String(req.headers.origin || '').toLowerCase();
  if (!izinli.some(h => kaynak === 'http://' + h)) return false;
  const site = req.headers['sec-fetch-site'];
  return !site || site === 'same-origin';
}
function anaSayfaIstegi(req, res, yol) {
  if (yol === '/' || yol === '/index.html') {
    const dosya = [path.join(__dirname, 'ana-sayfa.html'), path.join(__dirname, 'cekirdek', 'ana-sayfa.html')].find(y => fs.existsSync(y));
    if (!dosya) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('ana-sayfa.html bulunamadı (köprünün yanında ya da cekirdek/ içinde olmalı).'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...CERCEVE_YASAK });
    fs.createReadStream(dosya).pipe(res);
    return;
  }
  if (yol === '/api/oyunlar') {
    if (!yerelIstek(req, false)) { jsonYaz(res, 403, { tamam: false, hata: 'Bu adres yalnız bu bilgisayardaki ana sayfaya açıktır.' }); return; }
    jsonYaz(res, 200, anaDurum());
    return;
  }
  if (yol === '/api/baslat') { baslatIstegi(req, res); return; }
  if (yol === '/api/durdur') { durdurIstegi(req, res); return; }
  if (yol === '/kapat') { kapatIstegi(req, res); return; }
  if (yol === '/api/kutuphane') { postAl(req, res, () => { if (kutuphane.durum === 'hata') kutuphaneHazirla(); jsonYaz(res, 200, { tamam: true, ...anaDurum() }); }); return; }
  if (yol === '/durum') { jsonYaz(res, 200, { durum: sonDurum, bagliSayfa: istemciler.size, sayac, aktif: anaDurum().aktif }); return; }
  const m = /^\/(oyun|onizleme)\/([^/]+)(\/.*)?$/.exec(yol);
  const o = m && OYUN_DESEN.test(m[2]) ? vitrindekiler().find(x => x.id === m[2]) : null;
  if (!o) { res.writeHead(404); res.end(); return; }
  const alt = m[3];
  if (alt === undefined) { res.writeHead(301, { location: '/' + m[1] + '/' + o.id + '/' }); res.end(); return; } // muzik/ göreli adresi için sonda / gerekir
  if (alt === '/' || alt === '/index.html') {
    if (m[1] === 'onizleme') { oyunSayfasi(o, ONIZLEME_EK, res); return; }
    // Çalışmayan oyunun sayfası açılırsa (köprü yeniden başladı, eski sekme yenilendi) ana sayfaya gönder.
    if (!calisan || calisan.oyun !== o.id) { res.writeHead(302, { location: '/', 'cache-control': 'no-store' }); res.end(); return; }
    // Kimlikler yalnız [\w-] ve onaltılık rakamdır: betiğin içine güvenle yazılır.
    const ek = '<script>window.OYUN_KOPRU = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/olay/' + o.id + '/' + calisan.calistirma + '";' +
      'window.OYUN_CALISTIRMA = { oyun: "' + o.id + '", kimlik: "' + calisan.calistirma + '" };</script>\n' +
      (calisan.kip === 'canli' ? DENEME_ADLARINI_SIL : '') + GERI_DON_EK;
    oyunSayfasi(o, ek, res);
    return;
  }
  if (m[1] === 'oyun' && alt.startsWith('/muzik/')) { muzikSun(alt.slice(7), req, res, path.join(o.klasor, 'muzik')); return; }
  res.writeHead(404); res.end();
}
function oyunSayfasi(o, ek, res) {
  fs.readFile(path.join(o.klasor, 'oyun.html'), 'utf8', (hata, html) => {
    if (hata) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('oyun.html okunamadı.'); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...CERCEVE_YASAK });
    res.end(html.replace('<body>', '<body>\n' + ek));
  });
}
// Ana sayfadan açılan oyun sayfasına eklenen: masanın başına "← Oyunlar" bağlantısı (yalnız sahne görünümünde gizli) ve
// başlatma bekçisi. Bekçi iki saniyede bir motorun durumuna bakar: aynı oyun yeniden başlatıldıysa (ör. denemeden canlıya)
// sayfa kendini yeni başlatmaya yeniler; başka oyun açıldıysa ya da oyun durdurulduysa sessizce ölü kalmak yerine açık bir
// örtü gösterir ("Oyunlar'a dön"); örtü gelince sayfa yeniden bağlanmayı bırakır (CanliOyun.kopruBitti, varsa), masa
// "Durdu" der. Metinler textContent ile yazılır.
const GERI_DON_EK = '<style>.ana-don{display:inline-flex;align-items:center;gap:7px;align-self:flex-start;margin:0 0 6px;padding:6px 13px 6px 10px;' +
  'border-radius:99px;border:1px solid var(--cizgi);background:var(--zemin-2);color:var(--acik);font-size:13px;font-weight:500;text-decoration:none;line-height:1.2}' +
  '.ana-don:hover{border-color:var(--soluk)}.ana-don:focus-visible{outline:2px solid var(--vurgu);outline-offset:2px}body.yayin .ana-don{display:none}' +
  '.calistirma-ortu{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(8,10,28,.86)}' +
  '.calistirma-ortu>div{max-width:440px;padding:22px 24px;border-radius:16px;background:var(--zemin-2);border:1px solid var(--cizgi);color:var(--acik);text-align:center;font-size:15px;line-height:1.5}' +
  '.calistirma-ortu b{display:block;font-family:var(--baslik);font-weight:400;font-size:22px;margin-bottom:6px}' +
  '.calistirma-ortu a{display:inline-block;margin-top:14px;padding:9px 18px;border-radius:99px;background:var(--vurgu);color:var(--murekkep);font-weight:700;text-decoration:none}</style>\n' +
  '<script>addEventListener("DOMContentLoaded",function(){var y=document.querySelector(".masa-ad");if(!y)return;var a=document.createElement("a");' +
  'a.href="/";a.className="ana-don";a.textContent="\\u2190 Oyunlar";y.insertBefore(a,y.firstChild);});' +
  '(function(){var C=window.OYUN_CALISTIRMA;if(!C)return;var ortu=null;function kapak(baslik,metin){if(!ortu){ortu=document.createElement("div");ortu.className="calistirma-ortu";' +
  'ortu.id="calistirma-ortu";var i=document.createElement("div"),b=document.createElement("b"),p=document.createElement("p"),a=document.createElement("a");p.style.margin="0";' +
  'a.href="/";a.textContent="Oyunlar\'a d\\u00f6n";i.append(b,p,a);ortu.append(i);document.body.appendChild(ortu);}ortu.querySelector("b").textContent=baslik;ortu.querySelector("p").textContent=metin;try{if(window.CanliOyun&&CanliOyun.kopruBitti)CanliOyun.kopruBitti(metin);}catch(e){}}' +
  'function bak(){fetch("/api/oyunlar",{cache:"no-store"}).then(function(r){return r.json();}).then(function(d){var a=d&&d.aktif;' +
  'if(a&&a.oyun===C.oyun&&a.calistirma===C.kimlik){if(ortu){ortu.remove();ortu=null;}return;}' +
  'if(a&&a.oyun===C.oyun){location.reload();return;}' +
  'kapak("Bu oyun artık çalışmıyor",a?"Şu an başka bir oyun açık: "+a.ad+". Bu sayfa olay almıyor.":"Oyun ana sayfadan durduruldu. Bu sayfa olay almıyor.");}).catch(function(){});}' +
  'setInterval(bak,2000);addEventListener("kopru-durdu",function(){setTimeout(bak,150);});})();</script>';
// Canlı yayına geçerken: oyun, köprüden açılınca tarayıcıda sakladığı jeton sırasını geri yükler. Az önce Dene ile
// gelen sahte izleyiciler o kayıtta kalırsa gerçek yayında görünürdü; onlar silinir. Sahte izleyici kimliği "deneme:ad"
// biçimindedir (TikTok adında iki nokta olamaz, gerçek biriyle karışmaz); eski sürümün sabit sekiz kimliği de silinir.
const ESKI_DENEME = ['deneme_ayse', 'deneme_memo', 'deneme_zeyno', 'deneme_bekir', 'deneme_elif', 'deneme_cano', 'deneme_sude', 'deneme_baran'];
const DENEME_ADLARINI_SIL = '<script>try{var E=' + JSON.stringify(ESKI_DENEME) + ';for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(!/-sira$/.test(k))continue;' +
  'var v=JSON.parse(localStorage.getItem(k));if(v&&Array.isArray(v.oyuncular)){v.oyuncular=v.oyuncular.filter(function(x){var id=String(x&&x.id);return !/^deneme:/.test(id)&&E.indexOf(id)<0;});' +
  'localStorage.setItem(k,JSON.stringify(v));}}}catch(e){}</script>\n';
// Ana sayfadaki kartın canlı önizlemesi: köprüye bağlanmaz (oyun kendi sahte kalabalığıyla oynar), ses çıkarmaz
// (ses aygıtı yok sayılır, hazır parçalar yüklenmez), ses ve panel düğmeleri gizli; kareler yarı hızda çizilir ki
// aynı anda dört önizleme zayıf bir bilgisayarı yormasın (hareketin hızı saatten gelir, değişmez).
const ONIZLEME_EK = '<script>window.OYUN_MUZIK_KAPALI=true;window.AudioContext=undefined;window.webkitAudioContext=undefined;' +
  '(function(){var r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(f){var t0=performance.now();' +
  'return r(function k(t){if(t-t0<24)return r(k);f(t);});};})();</script>\n<style>#ses-cagri,#cik-yayin{display:none!important}</style>';
// Ana sayfanın POST istekleri (başlat, durdur) için ortak kapı: yalnız köprünün kendi sayfasından, JSON gövdeyle,
// en çok 4 KB. Geçerse gövdeyi nesne olarak işleve verir; geçmezse yanıtı kendisi yazar.
function postAl(req, res, isle, kapi = r => yerelIstek(r, true)) {
  if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); req.resume(); return; }
  if (!kapi(req)) { jsonYaz(res, 403, { tamam: false, hata: 'Bu istek ana sayfadan gelmedi; geri çevrildi.' }); req.resume(); return; }
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) { jsonYaz(res, 415, { tamam: false, hata: 'İstek JSON değil.' }); req.resume(); return; }
  let govde = '', fazla = false;
  req.setEncoding('utf8');
  req.on('data', p => { govde += p; if (govde.length > 4096) { fazla = true; req.destroy(); } });
  req.on('end', () => {
    if (fazla) return;
    let g;
    try { g = JSON.parse(govde); } catch (e) { jsonYaz(res, 400, { tamam: false, hata: 'İstek okunamadı.' }); return; }
    if (!g || typeof g !== 'object') { jsonYaz(res, 400, { tamam: false, hata: 'İstek okunamadı.' }); return; }
    isle(g);
  });
}
// Ana sayfadaki "Durdur": çalışan oyunun sahte olay saatini ya da TikTok bağlantısını kapatır, motor boşta bekler.
function durdurIstegi(req, res) {
  postAl(req, res, () => { oyunDurdur(); jsonYaz(res, 200, { tamam: true, ...anaDurum() }); });
}
// "Motoru kapat" (ana sayfa) ve başka klasörün başlatıcısı: yanıt yazılır, sonra motor düzgün kapanır.
// Kapı öbür POST'lardan sıkıdır: Host bizim olmalı, ayrıca özel bir başlık (X-Fabrika: kapat) gerekir. Tarayıcı başka bir
// sitenin bu başlıklı isteği için önce izin sorar (CORS ön isteği); motor izin vermez, istek hiç gelmez. Origin varsa bizim
// olmalı, Sec-Fetch-Site varsa same-origin. Origin yoksa istek tarayıcıdan gelmemiştir (tarayıcı her POST'a Origin yazar):
// bu bilgisayardaki bir program, ör. başka klasörün başlatıcısı; böyle bir program motoru zaten kapatabilir.
function kapatKapisi(req) {
  if (!hostIyi(req) || String(req.headers['x-fabrika'] || '').toLowerCase() !== 'kapat') return false;
  const kaynak = req.headers.origin, site = req.headers['sec-fetch-site'];
  if (kaynak !== undefined && !IZINLI_HOST.some(h => String(kaynak).toLowerCase() === 'http://' + h)) return false;
  return !site || site === 'same-origin';
}
function kapatIstegi(req, res) {
  postAl(req, res, () => {
    res.on('finish', () => motoruKapat('kapat'));
    jsonYaz(res, 200, { tamam: true, ileti: KAPANDI });
  }, kapatKapisi);
}
function oyunDurdur(ileti) { // ileti: motor kapanırken sayfalara söylenen (yoksa ana sayfadaki Durdur)
  if (!calisan) return;
  const eski = calisan;
  calisan = null;
  try { if (eski.durdur) eski.durdur(); } catch (e) { }
  soketleriKapat(s => s.calistirma === eski.calistirma, ileti || 'Oyun ana sayfadan durduruldu. Yeniden başlatmak için ana sayfaya dön.');
  sonDurum = 'Oyun durduruldu.'; sonBaglanti = 'durdu';
  console.log('\n  Durduruldu: ' + eski.ad + '.' + (ileti ? '' : ' Motor açık, ana sayfadan yeni oyun seçilebilir.'));
}
function baslatIstegi(req, res) {
  postAl(req, res, g => {
    const o =typeof g.oyun === 'string' && OYUN_DESEN.test(g.oyun) ? vitrindekiler().find(x => x.id === g.oyun) : null;
    if (!o) { jsonYaz(res, 404, { tamam: false, hata: 'Bu oyun bulunamadı. Sayfayı yenileyip yeniden dene.' }); return; }
    if (g.kip !== 'deneme' && g.kip !== 'canli') { jsonYaz(res, 400, { tamam: false, hata: 'Kip "deneme" ya da "canli" olmalı.' }); return; }
    let ad = '';
    if (g.kip === 'canli' && kutuphane.durum !== 'hazir') {
      jsonYaz(res, 409, { tamam: false, alan: 'kutuphane', hata: kutuphane.durum === 'iniyor' ? 'TikTok kütüphanesi hâlâ iniyor. Bitince Yayın düğmesi kendiliğinden yanar; o zamana kadar Dene çalışır.' : 'TikTok kütüphanesi inmedi. Ana sayfada "Yeniden dene"ye bas; o zamana kadar Dene çalışır.' });
      return;
    }
    if (g.kip === 'canli') {
      ad = String(g.kullanici == null ? '' : g.kullanici).trim().replace(/^@/, '');
      if (!KULLANICI_DESEN.test(ad)) { jsonYaz(res, 400, { tamam: false, alan: 'kullanici', hata: 'Kullanıcı adı geçersiz: yalnız harf, rakam, alt çizgi ve nokta olur (2-24 karakter, noktayla bitmez).' }); return; }
    }
    oyunCalistir(o, g.kip, ad);
    jsonYaz(res, 200, { tamam: true, adres: '/oyun/' + o.id + '/', ...anaDurum() });
  });
}
// Çalışanı durdurur (sahte olay saati, TikTok bağlantısı, bekleyen yeniden deneme), seçilen oyunu seçilen kipte başlatır.
// Her başlatmanın yeni bir kimliği olur; eski başlatmanın soketleri kapatılır, bir daha kabul edilmez (eski sekmede kalan
// sayfa sahte ve gerçek izleyiciyi karıştırmasın; sayfadaki bekçi yenilenir ya da örtü gösterir).
// Aynı oyun aynı kipte ve aynı adla zaten çalışıyorsa bağlantıyı koparmaz; TikTok'a henüz bağlı değilse (yayın açık
// değildi, bekleme süresi işliyor) hemen yeniden dener ve bekleme süresini sıfırlar.
function oyunCalistir(o, kip, ad) {
  if (calisan && calisan.oyun === o.id && calisan.kip === kip && calisan.kullanici === ad) {
    if (calisan.durdur && calisan.durdur.simdiDene) calisan.durdur.simdiDene();
    return;
  }
  if (calisan && calisan.durdur) { try { calisan.durdur(); } catch (e) { } }
  for (const k of Object.keys(sayac)) sayac[k] = 0;
  oyunAta(o.klasor);
  calisan = { oyun: o.id, ad: o.ad, kip, kullanici: ad, calistirma: crypto.randomBytes(6).toString('hex'), durdur: null };
  soketleriKapat(s => s.calistirma !== calisan.calistirma, 'Bu sayfanın oyunu kapandı; motor yeni bir oyun başlattı.');
  console.log('\n  Açılan oyun: ' + o.ad + (kip === 'canli' ? '  (@' + ad + ' yayınına bağlanıyor)' : '  (deneme: sahte izleyiciler)'));
  if (kip === 'canli') { sonDurum = '@' + ad + ' yayınına bağlanılıyor…'; sonBaglanti = 'baglaniyor'; }
  calisan.durdur = kip === 'deneme' ? denemeBaslat() : tiktokBaslat(ad);
}
// Kapı doluysa: orada bizim motorumuz mu çalışıyor? Ana sayfa kipindeyse (iki kez çift tıklandı) sakin bir dille söyle;
// eski yoldan (tek oyunla) açılmışsa o pencereyi kapatmayı öner; başkasıysa öyle söyle. Yanıt hiç bitmezse (bayt bayt
// yollayan yabancı sunucu) toplam 3 saniye sonra vazgeçilir; motor asılı kalmaz.
function zatenAcik() {
  const adres = 'http://localhost:' + PORT + '/';
  let bitti = false;
  const son = (ileti, kod, ac) => {
    if (bitti) return; bitti = true; clearTimeout(sinir);
    console.log(ileti);
    if (ac && args.includes('--ac')) tarayicidaAc(adres);
    setTimeout(() => process.exit(kod), ac ? 600 : 0);
  };
  const yabanci = () => son('\n  ' + PORT + ' numaralı kapı başka bir program tarafından kullanılıyor (kapı dolu).\n  O programı kapatıp yeniden dene.\n', 1);
  const sor = (yol, sonra) => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: yol, headers: { host: '127.0.0.1:' + PORT } }, y => {
      let g = ''; y.setEncoding('utf8'); y.on('data', p => { g += p; if (g.length > 65536) r.destroy(); }); y.on('end', () => { let j = null; try { j = JSON.parse(g); } catch (e) { } sonra(j); });
    });
    r.on('error', yabanci);
    istekler.push(r);
  };
  const istekler = [];
  const sinir = setTimeout(() => { istekler.forEach(r => { try { r.destroy(); } catch (e) { } }); yabanci(); }, 3000);
  sor('/api/oyunlar', j => {
    if (j && j.anaSayfa === true) return son('\n  Oyun fabrikası zaten açık: ' + adres + '\n  O sayfayı kullanabilirsin. Bu pencereyi kapatabilirsin.\n', 0, true);
    sor('/durum', d => {
      if (d && d.sayac && typeof d.durum === 'string') return son('\n  Oyun motoru başka bir pencerede zaten açık (tek oyunla, eski yoldan başlatılmış).\n  O ' + METIN.pencereyi + ' kapat, sonra ' + METIN.yeniden + '.\n', 1);
      yabanci();
    });
  });
}

/* ------------------------------------------------------------------ TikTok olaylarını oyunun biçimine çevir */
const sayi = v => { const n = typeof v === 'bigint' ? Number(v) : +v; return Number.isFinite(n) ? n : 0; };
function kullanici(d) {
  const u = d && typeof d.user === 'object' && d.user ? d.user : (d || {});
  const id = u.uniqueId || u.displayId || d.uniqueId || u.userId || d.userId || u.nickname || d.nickname;
  if (id === undefined || id === null || id === '') return null;
  return { id: String(id), ad: String(u.nickname || d.nickname || u.uniqueId || d.uniqueId || id) };
}
function cevir(tur, d) {
  d = d || {}; const k = kullanici(d); if (!k) return null;
  if (tur === 'chat') return { tip: 'yorum', kullanici: k, metin: String(d.comment ?? d.content ?? '') };
  if (tur === 'like') return { tip: 'begeni', kullanici: k, adet: sayi(d.likeCount ?? d.count) || 1 };
  if (tur === 'follow') return { tip: 'takip', kullanici: k };
  if (tur === 'share') return { tip: 'paylasim', kullanici: k };
  if (tur === 'member') return { tip: 'katilim', kullanici: k };
  if (tur === 'gift') {
    const g = (d.giftDetails && typeof d.giftDetails === 'object' && d.giftDetails) || (d.gift && typeof d.gift === 'object' && d.gift) || {};
    const giftTuru = d.giftType ?? g.giftType ?? g.type, bitti = d.repeatEnd;
    // Seri hediyelerde (tür 1) her tıklamada olay gelir; yalnızca seri bitince sayarız, yoksa aynı hediye defalarca sayılır.
    if (sayi(giftTuru) === 1 && bitti !== undefined && !sayi(bitti === true ? 1 : bitti === false ? 0 : bitti)) return null;
    const o = { tip: 'hediye', kullanici: k, jeton: sayi(d.diamondCount ?? g.diamondCount ?? g.diamond_count) || 1, adet: sayi(d.repeatCount) || 1 };
    const hd = hediyeKimlik(d, g);
    if (hd) o.hediye = hd;
    return o;
  }
  return null;
}
// Hediyenin kimliği { id, ad } (docs/OLAYLAR.md); ikisi de yoksa null. Kütüphanenin biçimleri (alan adları kurulu
// kütüphaneden ve şemasından okundu, tiktok-live-proto):
//   1.x WebcastPushConnection: düz nesne, giftId (sayı) ve giftName (giftDetails üst düzeye açılır; gift = { gift_id, … })
//   2.0–2.4 TikTokLiveConnection: giftId (sayı), giftDetails = { id, giftName, giftType, diamondCount }
//   2.5 TikTokLiveConnection: giftId (metin), gift = { id, name, type, diamondCount }
// Boş metin ve 0 şemanın "yok" değeridir, atlanır. Ad yabancıdan gelen düz metindir: denetim karakterleri atılır, 40
// karaktere kısaltılır; köprü onu yalnız JSON olarak yollar, sayfa da hiçbir yerde HTML olarak yazmaz.
function hediyeKimlik(d, g) {
  const dolu = (...a) => a.find(v => (typeof v === 'string' && v.trim() !== '' && v.trim() !== '0') || ((typeof v === 'number' || typeof v === 'bigint') && v != 0));
  // Önce ANSI kaçışları (ESC [ … harf) ve Unicode biçim karakterleri (Cf: U+061C, U+2060, U+FEFF, yön işaretleri …; emoji
  // birleştiricisi U+200D yalnız iki emoji arasında kalır) ile görünmez dolgu ve birleşik harfler (U+034F, U+115F, U+1160,
  // U+17B4, U+17B5, U+180B–180D, U+3164, U+FFA0, U+2800) atılır; OSC / DCS kaçışları içindeki metinle birlikte gider.
    const duz = v => v === undefined ? '' : String(v).replace(/\x1b[\]P_^X][\s\S]*?(?:\x07|\x1b\\|$)|[\x9d\x90\x9e\x9f][\s\S]*?(?:\x07|\x9c|$)/g, '').replace(/(?:\x1b\[|\x9b)[0-9;?]*[ -\/]*[@-~]/g, '').replace(/\x1b[@-_]?/g, '').replace(/(?!\u200d)[\p{Cf}\u034f\u115f\u1160\u17b4\u17b5\u180b-\u180d\u3164\uffa0\u2800]/gu, '').replace(/(?<![\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F])\u200d|\u200d(?![\p{Extended_Pictographic}])/gu, '').replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  const id = Array.from(duz(dolu(d.giftId, g.id, g.gift_id))).slice(0, 32).join('');
  const tam = Array.from(duz(dolu(d.giftName, g.giftName, g.name))), ad = tam.length > 40 ? tam.slice(0, 39).join('') + '…' : tam.join('');
  if (!id && !ad) return null;
  const s = {};
  if (id) s.id = id;
  if (ad) s.ad = ad;
  return s;
}
function ilet(tur, d) {
  let o; try { o = cevir(tur, d); } catch (e) { return; }
  if (!o) return; sayac[o.tip] = (sayac[o.tip] || 0) + 1; yayinla(o);
}

/* ------------------------------------------------------------------ gerçek yayın */
// Bağlanma hatalarını yayıncının anlayacağı birkaç düz cümleye çevirir. Kaynak: kurulu tiktok-live-connector'ın kendi
// hata sınıfları ve iletileri. 2.x (dist/lib-*.js): UserOfflineError "The requested user isn't online :(",
// InvalidUniqueIdError, SignAPIError / SignatureRateLimitError ("[Rate Limited] … Too many connections started",
// "[Connect Error] Failed to connect to sign server.", "[Sign Error] Unexpected sign server status", "[Empty Cookies]"),
// SignatureMissingTokensError, PremiumFeatureError, InvalidResponseError ("…you might be blocked by TikTok.",
// "Are you captcha-blocked by TikTok?", "API Error <kod> (<ileti>)"), InvalidResponseCompositeError ("Failed to retrieve Room
// ID from all sources.", alt hatalar config.requestErrs içinde), ConnectTimeoutError. 1.x (dist/index.js, lib/tiktokUtils.js,
// lib/tiktokSignatureProvider.js): UserOfflineError "LIVE has ended" / "User might be offline." / "Your IP or country might
// be blocked by TikTok.", ExtractRoomIdError "Failed to retrieve room_id from page source. …", SignatureError "Failed to
// sign request", InitialFetchError, NoWSUpgradeError. Ağ hataları (got / axios): ENOTFOUND, EAI_AGAIN, ETIMEDOUT …
// Önce hata SINIFININ adına bakılır (kütüphanenin kendi sınıfları), sonra kütüphanenin gerçek iletilerine dar, başı
// sabitlenmiş kalıplarla. Emin olunamayan her durumda genel cümle verilir; yayıncının adını yanlış yazdığını ima eden
// cümle yalnız kütüphane bunu açıkça söylediğinde çıkar. Hiçbir erişim istisna fırlatamaz (getter'ı fırlatan, toString'i
// fırlatan, prototipsiz nesne, Proxy, döngülü hata): her okuma korunur, en kötü durumda sabit genel cümle döner.
const BH = {
  genel: 'TikTok\'a bağlanılamadı.',
  internet: 'TikTok\'a ulaşılamadı: internet bağlantısı yok ya da çok yavaş. İnterneti kontrol et; motor kendisi yeniden dener.',
  engel: 'TikTok bu bağlantıyı doğrulama (captcha) istedi ya da bu ağdan / bölgeden engelledi. Biraz sonra yeniden dene ya da başka bir ağdan (ör. telefonun interneti) bağlan.',
  imza: 'TikTok bağlantısı için gereken imza hizmeti şu an isteği geri çevirdi ya da yanıt vermiyor. Bu, kütüphanenin dayandığı başka bir şirketin hizmetidir; senin hatan değil. Birkaç dakika bekle, motor kendisi yeniden dener.',
  oda: 'Yayın odası bulunamadı. Kullanıcı adını kontrol et (profil linkindeki ad, @ olmadan); ad doğruysa yayını TikTok\'ta başlat, köprü kendiliğinden bağlanır.'
};
const NET_KOD = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'ENETDOWN', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT']);
const guvenliAl = (o, k) => { try { return o === null || o === undefined || (typeof o !== 'object' && typeof o !== 'function') ? undefined : o[k]; } catch (e) { return undefined; } };
const guvenliYazi = v => {
  try {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'symbol') return v.description ? 'Symbol(' + v.description + ')' : 'Symbol()';
    if (typeof v === 'object' || typeof v === 'function') { const m = guvenliAl(v, 'message'); return typeof m === 'string' ? m : ''; }
    return String(v);
  } catch (e) { return ''; }
};
const kisaYazi = (v, n) => guvenliYazi(v).slice(0, 4000).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// Bir hatanın sınıf adı, adı, kodu ve iletisi; hiçbiri istisna fırlatmaz.
function hataOzet(x) {
  const yapici = guvenliAl(x, 'constructor'), sinif = guvenliAl(yapici, 'name'), ad = guvenliAl(x, 'name'), kod = guvenliAl(x, 'code');
  return { sinif: typeof sinif === 'string' ? sinif : '', ad: typeof ad === 'string' ? ad : '', kod: typeof kod === 'string' ? kod : '', ileti: kisaYazi(x, 2000) };
}
const sinifMi = (o, ...adlar) => adlar.includes(o.sinif) || adlar.includes(o.ad);
// Hatanın kendisinde ya da nedenlerinde (cause, requestErr) bir ağ kodu var mı (en çok 4 kat; döngüye girmez).
function agKodu(x, gorulen = new Set(), d = 0) {
  if (!x || typeof x !== 'object' || d > 4 || gorulen.has(x)) return false;
  gorulen.add(x);
  const o = hataOzet(x);
  if (NET_KOD.has(o.kod) || /^getaddrinfo (ENOTFOUND|EAI_AGAIN) /.test(o.ileti)) return true;
  return agKodu(guvenliAl(x, 'cause'), gorulen, d + 1) || agKodu(guvenliAl(x, 'requestErr'), gorulen, d + 1);
}
function baglantiHatasi(e, kullaniciAdi) {
  try { return baglantiHatasiIc(e, String(kullaniciAdi || '')); }
  catch (x) { return { tur: 'diger', baglanti: 'hata', cumle: BH.genel, ek: '', ham: '(hata okunamadı)' }; }
}
function baglantiHatasiIc(e, kullaniciAdi) {
  const o = hataOzet(e), ad = '@' + kullaniciAdi, ham = [o.sinif, o.ad, o.kod, o.ileti].filter(Boolean).join(' ') || '(boş hata)';
  const sonuc = (tur, cumle, ekler = {}) => Object.assign({ tur, baglanti: 'hata', cumle, ek: '', ham }, ekler);
  const canliDegil = () => sonuc('canli-degil', ad + ' şu an canlı yayında değil.', { baglanti: 'bekliyor', kisa: true, ek: 'yayın açılınca kendiliğinden bağlanır' });
  // 2.x bileşik hata (fetchRoomIdComposite: HTML yolu, API yolu, son çare Euler Stream). İç hatalar kaynak kaynak konsola
  // yazılır; Euler'in "lack of permission" / sınır iletisi son çarenin kapalı olduğunu söyler, nedeni HTML / API yolu belirler.
  const ic = guvenliAl(guvenliAl(e, 'config'), 'requestErrs');
  if (sinifMi(o, 'InvalidResponseCompositeError') || (o.ileti === 'Failed to retrieve Room ID from all sources.' && Array.isArray(ic))) {
    const liste = Array.isArray(ic) ? ic.slice(0, 10).filter(x => x !== e) : [];
    const kaynak = t => /Euler/i.test(t) ? 'euler' : /Html/i.test(t) ? 'html' : /Api/i.test(t) ? 'api' : 'kaynak';
    const ozetler = liste.map(x => ({ x, o: hataOzet(x) }));
    const ayrinti = ozetler.map(({ o: a }) => '  ' + kaynak(a.ileti) + ': ' + (a.ileti || a.kod || '(boş)').slice(0, 300));
    const asil = ozetler.filter(({ o: a }) => kaynak(a.ileti) !== 'euler');
    const ek = { ayrinti, ham: o.ileti + ' | ' + ayrinti.join(' | ') };
    if (asil.length && asil.every(({ x }) => agKodu(x))) return sonuc('internet', BH.internet, ek);
    if (asil.some(({ o: a }) => /Are you captcha-blocked by TikTok\?|you might be blocked by TikTok\.|status code 403\b/.test(a.ileti))) return sonuc('engel', BH.engel, ek);
    return sonuc('oda-yok', BH.oda, { ...ek, kisa: true });
  }
  if (sinifMi(o, 'UserOfflineError')) return /^Your IP or country might be blocked by TikTok\.$/.test(o.ileti) ? sonuc('engel', BH.engel) : canliDegil();
  if (sinifMi(o, 'ConnectTimeoutError')) return sonuc('internet', BH.internet);
  if (sinifMi(o, 'SignAPIError', 'SignatureRateLimitError', 'SignatureMissingTokensError', 'PremiumFeatureError', 'AuthenticatedWebSocketConnectionError', 'SignatureError', 'InitialFetchError'))
    return agKodu(e) ? sonuc('internet', BH.internet) : sonuc('imza', BH.imza);
  if (sinifMi(o, 'NoWSUpgradeError')) return sonuc('engel', BH.engel);
  if (sinifMi(o, 'InvalidUniqueIdError')) return sonuc('kullanici-yok', ad + ' adı geçersiz görünüyor. Profil adresindeki adı @ olmadan yaz.');
  if (sinifMi(o, 'ExtractRoomIdError')) { // 1.x: "Failed to retrieve room_id from page source. <iç ileti>"
    const icI = o.ileti.replace(/^Failed to retrieve room_id from page source\. ?/, '');
    if (/^User might be offline\.$/.test(icI)) return canliDegil();
    if (/^Your IP or country might be blocked by TikTok\.$/.test(icI)) return sonuc('engel', BH.engel);
    if (/getaddrinfo (ENOTFOUND|EAI_AGAIN)|\b(ENOTFOUND|EAI_AGAIN|ETIMEDOUT)\b/.test(icI)) return sonuc('internet', BH.internet);
    return sonuc('oda-yok', BH.oda, { kisa: true });
  }
  if (agKodu(e)) return sonuc('internet', BH.internet);
  // Sınıf adı yoksa (düz Error, eski sürüm, sınıf adı silinmiş derleme): kütüphanenin kendi iletileri, tam ya da başından.
  if (/^(LIVE has ended|The requested user isn't online :\(|User might be offline\.)$/.test(o.ileti)) return canliDegil();
  if (/^Your IP or country might be blocked by TikTok\.$|Are you captcha-blocked by TikTok\?$|you might be blocked by TikTok\.$/.test(o.ileti)) return sonuc('engel', BH.engel);
  if (/^\[(Rate Limited|Sign Error|Empty Cookies|Empty Payload|Premium Feature)\]|^\[Connect Error\] Failed to connect to sign server\.|^Failed to sign request/.test(o.ileti)) return sonuc('imza', BH.imza);
  if (/^Timed out whilst connecting to WebSocket$/.test(o.ileti)) return sonuc('internet', BH.internet);
  if (o.ileti === 'Failed to retrieve Room ID from all sources.') return sonuc('oda-yok', BH.oda, { kisa: true });
  const kisa = kisaYazi(e, 140);
  return sonuc('diger', kisa ? 'TikTok\'a bağlanılamadı (' + kisa + ').' : BH.genel);
}
// Döndürdüğü işlev bağlantıyı ve bekleyen yeniden denemeyi durdurur (ana sayfadan başka oyuna geçilince).
// Durdurulduktan sonra eski bağlantıdan gelen olay, bağlanma yanıtı ya da kopma bildirimi yok sayılır.
function tiktokBaslat(kullaniciAdi = KULLANICI) {
  let Kutuphane;
  try { Kutuphane = require('tiktok-live-connector'); }
  catch (e) {
    console.log('  "tiktok-live-connector" kurulu değil. Bu klasörde bir kez şunu çalıştır:\n\n      npm install\n\n  Sonra köprüyü yeniden başlat. (İnternet olmadan denemek için: node kopru.js --deneme)\n');
    durumBildir('TikTok kütüphanesi kurulu değil. ' + METIN.baslatici + ' ile yeniden aç ya da klasörde "npm install" çalıştır.', 'hata');
    return () => {};
  }
  const Sinif = Kutuphane.TikTokLiveConnection || Kutuphane.WebcastPushConnection; // yeni ve eski sürüm adları
  const E = Kutuphane.WebcastEvent || {}, K = Kutuphane.ControlEvent || {};
  if (typeof Sinif !== 'function') { durumBildir('TikTok kütüphanesinin bu sürümü tanınmadı.', 'hata'); return () => {}; }
  let bekleme = 15, zamanlayici = null, baglanti = null, bagli = false, durdu = false, deneniyor = false; // deneniyor: bağlanma isteği yolda
  const KULLANICI = kullaniciAdi;

  // kisa: yayın yok / oda yok sınıfı. Yayıncı birazdan yayını açacaktır; bekleme en çok 30 sn'ye kadar uzar (öbürleri 120).
  const yenidenDene = (neden, baglantiDurumu = 'bekliyor', ek = '', kisa = false) => {
    if (durdu) return;
    bagli = false; clearTimeout(zamanlayici);
    durumBildir(neden + ' ' + bekleme + ' saniye sonra yeniden denenecek' + (ek ? '; ' + ek : '') + '.', baglantiDurumu);
    zamanlayici = setTimeout(baglan, bekleme * 1000); bekleme = Math.min(kisa ? 30 : 120, Math.round(bekleme * 1.6));
  };
  function baglan() {
    if (durdu) return;
    try { if (baglanti && baglanti.disconnect) baglanti.disconnect(); } catch (e) {}
    try { baglanti = new Sinif(KULLANICI, { enableExtendedGiftInfo: false, processInitialData: false }); }
    catch (e) { durumBildir('Bağlantı kurulamadı: ' + (kisaYazi(e, 140) || 'kütüphane açılamadı') + '.', 'hata'); return; }
    const bu = baglanti, gecerli = () => !durdu && bu === baglanti;
    deneniyor = true;
    const dinle = (sabit, ad, fn) => { try { bu.on(E[sabit] || K[sabit] || ad, (...a) => { if (gecerli()) fn(...a); }); } catch (e) {} };
    dinle('CHAT', 'chat', d => ilet('chat', d));
    dinle('GIFT', 'gift', d => ilet('gift', d));
    dinle('LIKE', 'like', d => ilet('like', d));
    dinle('FOLLOW', 'follow', d => ilet('follow', d));
    dinle('SHARE', 'share', d => ilet('share', d));
    dinle('MEMBER', 'member', d => ilet('member', d));
    dinle('STREAM_END', 'streamEnd', () => { bekleme = 30; yenidenDene('Yayın sona erdi.'); });
    dinle('DISCONNECTED', 'disconnected', () => { if (bagli) yenidenDene('TikTok bağlantısı koptu.'); });
    dinle('ERROR', 'error', e => { try { yaz('Uyarı:', kisaYazi(guvenliAl(e, 'info'), 500) || kisaYazi(e, 500) || '(okunamayan uyarı)'); } catch (x) { } });
    Promise.resolve().then(() => bu.connect()).then(durum => {
      if (!gecerli()) { try { bu.disconnect(); } catch (e) {} return; }
      deneniyor = false; bagli = true; bekleme = 15;
      durumBildir('@' + KULLANICI + ' yayınına bağlandı. Yorum ve hediyeler oyuna akıyor.' + (durum && durum.roomId ? ' (oda ' + durum.roomId + ')' : ''), 'bagli');
    }).catch(e => {
      if (!gecerli()) return;
      deneniyor = false;
      const h = baglantiHatasi(e, KULLANICI); // istisna fırlatmaz
      try { // konsol satırları ekran görüntüsünden tanı içindir; burada bir şey ters giderse yalnız yazılmaz
        yaz('TikTok bağlantı hatası (' + h.tur + '), kütüphanenin iletisi: ' + (kisaYazi(e, 600) || '(okunamadı)'));
        for (const satir of h.ayrinti || []) console.log(satir); // bileşik hatada kaynak başına bir satır: html / api / euler
        if (!h.ayrinti && h.ham && h.ham !== kisaYazi(e, 600)) console.log('  ayrıntı: ' + h.ham.slice(0, 1500));
      } catch (x) { }
      // Ana sayfa kipinde Yayın düğmesi beklemeden yeniden dener: uzun beklemede bunu söyle.
      const not = h.kisa && ANA ? 'hemen denemek için ana sayfada Yayın\'a yeniden bas' : '';
      yenidenDene(h.cumle, h.baglanti, [h.ek, not].filter(Boolean).join('; '), h.kisa);
    });
  }
  baglan();
  const durdur = () => {
    durdu = true; clearTimeout(zamanlayici);
    try { if (baglanti && baglanti.disconnect) baglanti.disconnect(); } catch (e) {}
    baglanti = null;
  };
  // Ana sayfadan aynı oyun için Yayın'a yeniden basıldı: bağlı değilsek beklemeden dene, bekleme süresini sıfırla.
  // Bağlanma isteği hâlâ yoldaysa basış yok sayılır: her basış yeni bir bağlantı açıp TikTok'un sınırına takılmasın.
  durdur.simdiDene = () => {
    if (durdu || bagli || deneniyor) return;
    clearTimeout(zamanlayici); bekleme = 15;
    durumBildir('@' + KULLANICI + ' yayınına yeniden bağlanılıyor…', 'baglaniyor');
    baglan();
  };
  return durdur;
}

/* ------------------------------------------------------------------ deneme kipi: TikTok yerine sahte olay */
function denemeBaslat() {
  // Kimlik "deneme:ad": TikTok adında iki nokta olamaz, canlıya geçerken temizlenen sahte izleyici gerçek biriyle karışmaz.
  const adlar = ['ayse', 'memo', 'zeyno', 'bekir', 'elif', 'cano', 'sude', 'baran'];
  const sozler = ['selam!', 'ben de geldim', 'haydi haydi', 'selamlar', 'buradayım'];
  const sec = a => a[Math.floor(Math.random() * a.length)];
  durumBildir('Deneme kipi: olaylar sahte, TikTok\'a bağlanılmadı.', 'deneme');
  // Sahte hediye kimlikleri "deneme-" öneklidir, gerçek bir TikTok numarasıyla karışmaz; sırayla gelir (paneldeki
  // Deneme düğmeleriyle aynı üçü). Oyun yazarı hediye türüne bakan kuralı TikTok'suz böyle dener.
  const hediyeler = [{ giftId: 'deneme-gul', giftName: 'Gül' }, { giftId: 'deneme-kalp', giftName: 'Kalp' }, { giftId: 'deneme-yildiz', giftName: 'Yıldız' }];
  let n = 0;
  const saat = setInterval(() => {
    const ad = sec(adlar), u = { uniqueId: 'deneme:' + ad, nickname: 'D. ' + ad }, r = n++ % 10, hd = hediyeler[Math.floor(n / 10) % hediyeler.length];
    if (r < 5) ilet('chat', { ...u, comment: sec(sozler) });
    else if (r < 7) ilet('like', { ...u, likeCount: 12 });
    else if (r === 7) ilet('gift', { ...u, ...hd, giftType: 1, repeatEnd: false, repeatCount: 2, diamondCount: 5 }); // seri sürüyor: sayılmamalı
    else if (r === 8) ilet('gift', { ...u, ...hd, giftType: 1, repeatEnd: true, repeatCount: 3, diamondCount: 5 }); // seri bitti: 15 jeton
    else ilet('follow', u);
  }, 400);
  return () => clearInterval(saat);
}

module.exports = { cevir, oyunSec, agacKes, kurulumNedeni, KURULUM_NEDEN, KURULUM_KOMUTU, baglantiHatasi }; // testler için
if (require.main === module) calistir();
