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
 *                                               (BASLAT.bat böyle çalıştırır)
 *
 * Hangi oyun: --oyun <ad> verilirse oyunlar/<ad>/oyun.html. Verilmezse önce bu dosyanın yanındaki oyun.html
 * (yayıncı paketi böyle gelir), o da yoksa depoda tek oyun varsa o açılır. Birden çok oyun varsa hangisinin
 * açılacağını sorar (komut satırında elle çalıştırılınca ya da --sor ile).
 *
 * Ana sayfa kipi (--ana-sayfa): köprü oyunsuz ve kullanıcı adsız açılır, / adresinde ana sayfayı
 * (cekirdek/ana-sayfa.html; pakette köprünün yanında) sunar. Sayfadaki düğmeler POST /api/baslat ile hangi oyunun
 * hangi kipte (deneme ya da canlı) çalışacağını söyler; köprü çalışanı durdurup yenisini başlatır. Oyunlar:
 * köprünün yanında oyun.html varsa yalnız o (paket), yoksa derlenmiş her oyunlar/<ad>/ ("vitrin": false olanlar hariç).
 */
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const ANA = args.includes('--ana-sayfa');
const DENEME = args.includes('--deneme');
const pi = args.indexOf('--port');
const PORT = pi >= 0 ? parseInt(args[pi + 1], 10) || 8787 : 8787;
const oi = args.indexOf('--oyun');
const KULLANICI = (args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port' && args[i - 1] !== '--oyun') || '').replace(/^@/, '').trim();
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

/* ------------------------------------------------------------------ oyun sayfası + WebSocket sunucusu */
const istemciler = new Set();
let sonDurum = ANA ? 'Henüz bir oyun açılmadı.' : DENEME ? 'Deneme kipi: olaylar sahte.' : 'TikTok yayınına bağlanılıyor…';
const sayac = { yorum: 0, hediye: 0, begeni: 0, takip: 0, paylasim: 0, katilim: 0 };
// Ana sayfa kipinde şu an çalışan: { oyun, ad, kip, kullanici, durdur }. Öbür kiplerde boş kalır.
let calisan = null;

function cerceve(metin) { // sunucudan istemciye tek parça metin çerçevesi
  const veri = Buffer.from(metin, 'utf8'), n = veri.length;
  let bas;
  if (n < 126) bas = Buffer.from([0x81, n]);
  else if (n < 65536) { bas = Buffer.alloc(4); bas[0] = 0x81; bas[1] = 126; bas.writeUInt16BE(n, 2); }
  else { bas = Buffer.alloc(10); bas[0] = 0x81; bas[1] = 127; bas.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([bas, veri]);
}
// Ana sayfa kipinde her oyun sayfası kendi oyununun adıyla bağlanır (/olay/<ad>); olaylar yalnız şu an çalışan
// oyunun sayfalarına gider. Başka sekmede açık kalmış eski oyun, yeni oyunun izleyicilerini görmez.
const alici = s => !s.oyun || (calisan && s.oyun === calisan.oyun);
function yayinla(nesne) {
  const c = cerceve(JSON.stringify(nesne));
  for (const s of istemciler) { if (!alici(s)) continue; try { s.write(c); } catch (e) { istemciler.delete(s); } }
}
function durumBildir(ileti) { sonDurum = ileti; yaz(ileti); yayinla({ tip: 'kopru', ileti }); }
const BEKLEYEN_OYUN = 'Bu oyun şu an çalışmıyor. Ana sayfaya dönüp Dene ya da Yayına bağlan düğmesine bas.';

const sunucu = http.createServer((req, res) => {
  const yol = (req.url || '/').split('?')[0];
  if (ANA) { anaSayfaIstegi(req, res, yol); return; }
  if (yol === '/' || yol === '/index.html') {
    fs.readFile(OYUN, 'utf8', (hata, html) => {
      if (hata) { res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }); res.end('oyun.html bulunamadı. Önce derle: node araclar/derle.js <ad>'); return; }
      // Oyuna "seni köprü açtı, şu adrese bağlan" bilgisini ver.
      const ek = '<script>window.OYUN_KOPRU = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/olay";</script>';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
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
  const anahtar = req.headers['sec-websocket-key'];
  if (!anahtar || String(req.headers.upgrade).toLowerCase() !== 'websocket') { soket.destroy(); return; }
  const kabul = crypto.createHash('sha1').update(anahtar + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  soket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + kabul + '\r\n\r\n');
  const etiket = /^\/olay\/([\w-]+)$/.exec((req.url || '').split('?')[0]);
  if (etiket) soket.oyun = etiket[1]; // ana sayfa kipindeki oyun sayfası: hangi oyunun olaylarını beklediği
  soket.setNoDelay(true); istemciler.add(soket);
  yaz('Oyun sayfası bağlandı (' + istemciler.size + ' sayfa).');
  soket.write(cerceve(JSON.stringify({ tip: 'kopru', ileti: alici(soket) ? sonDurum : BEKLEYEN_OYUN })));
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
  const birak = () => { if (istemciler.delete(soket)) yaz('Oyun sayfası ayrıldı (' + istemciler.size + ' sayfa).'); };
  soket.on('close', birak); soket.on('error', birak);
});
sunucu.on('error', e => {
  if (e.code === 'EADDRINUSE' && ANA) { zatenAcik(); return; }
  if (e.code === 'EADDRINUSE') console.log('\n' + PORT + ' numaralı kapı dolu. Köprü zaten açık olabilir; kapatıp yeniden dene ya da --port 9000 ekle.\n');
  else console.log('Sunucu hatası:', e.message);
  process.exit(1);
});
function calistir() {
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
      console.log('  Bu siyah pencere oyunların motorudur. Açık kalsın; kapatınca oyunlar durur.\n');
      if (args.includes('--ac')) tarayicidaAc('http://localhost:' + PORT + '/');
      return;
    }
    console.log('\n  Köprü çalışıyor. Oyun: ' + path.relative(__dirname, OYUN));
    console.log('  Oyun (panelli):      http://localhost:' + PORT + '/');
    console.log('  Yalnızca sahne:      http://localhost:' + PORT + '/#yayin');
    let parca = [];
    try { parca = fs.readdirSync(MUZIK_KLASOR).filter(a => /\.(mp3|ogg|wav|m4a)$/i.test(a)); } catch (e) { }
    const mk = path.relative(__dirname, MUZIK_KLASOR) || 'muzik';
    console.log('  Müzik:               ' + (parca.length && fs.existsSync(path.join(MUZIK_KLASOR, 'liste.js')) ? parca.length + ' hazır parça (' + mk + ')' : 'oyunun kendi üretilen müziği (' + mk + ' içinde hazır parça yok)'));
    console.log('  Kapatmak için bu pencerede Ctrl+C.\n');
    if (DENEME) denemeBaslat(); else tiktokBaslat();
    if (args.includes('--ac')) tarayicidaAc('http://localhost:' + PORT + '/'); // köprü dinlemeye başladıktan sonra
  });
  process.on('SIGINT', () => { console.log('\nKöprü kapatıldı.'); process.exit(0); });
}
function tarayicidaAc(adres) { // varsayılan tarayıcıda açar
  const { exec } = require('child_process');
  const komut = process.platform === 'win32' ? 'start "" "' + adres + '"' : process.platform === 'darwin' ? 'open "' + adres + '"' : 'xdg-open "' + adres + '"';
  try { exec(komut, () => {}); } catch (e) {}
}

/* ------------------------------------------------------------------ ana sayfa kipi */
// TikTok kullanıcı adı: harf, rakam, alt çizgi, nokta; 2-24 karakter. Başka her şey geri çevrilir.
const KULLANICI_DESEN = /^[A-Za-z0-9_.]{2,24}$/;
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
function anaDurum() {
  return {
    anaSayfa: true, paket: paketMi(),
    oyunlar: vitrindekiler().map(o => ({ id: o.id, ad: o.ad, aciklama: o.aciklama })),
    aktif: calisan ? { oyun: calisan.oyun, ad: calisan.ad, kip: calisan.kip, kullanici: calisan.kullanici } : null,
    durum: sonDurum
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
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'SAMEORIGIN' });
    fs.createReadStream(dosya).pipe(res);
    return;
  }
  if (yol === '/api/oyunlar') {
    if (!yerelIstek(req, false)) { jsonYaz(res, 403, { tamam: false, hata: 'Bu adres yalnız bu bilgisayardaki ana sayfaya açıktır.' }); return; }
    jsonYaz(res, 200, anaDurum());
    return;
  }
  if (yol === '/api/baslat') { baslatIstegi(req, res); return; }
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
    const ek = '<script>window.OYUN_KOPRU = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/olay/' + o.id + '";</script>\n' +
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
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'SAMEORIGIN' });
    res.end(html.replace('<body>', '<body>\n' + ek));
  });
}
// Ana sayfadan açılan oyun sayfasına eklenen: masanın başına "← Oyunlar" bağlantısı (yalnız sahne görünümünde gizli).
const GERI_DON_EK = '<style>.ana-don{display:inline-flex;align-items:center;gap:7px;align-self:flex-start;margin:0 0 6px;padding:6px 13px 6px 10px;' +
  'border-radius:99px;border:1px solid var(--cizgi);background:var(--zemin-2);color:var(--acik);font-size:13px;font-weight:500;text-decoration:none;line-height:1.2}' +
  '.ana-don:hover{border-color:var(--soluk)}.ana-don:focus-visible{outline:2px solid var(--vurgu);outline-offset:2px}body.yayin .ana-don{display:none}</style>\n' +
  '<script>addEventListener("DOMContentLoaded",function(){var y=document.querySelector(".masa-ad");if(!y)return;var a=document.createElement("a");' +
  'a.href="/";a.className="ana-don";a.textContent="\\u2190 Oyunlar";y.insertBefore(a,y.firstChild);});</script>';
// Canlı yayına geçerken: oyun, köprüden açılınca tarayıcıda sakladığı jeton sırasını geri yükler. Az önce Dene ile
// gelen sahte izleyiciler (köprünün deneme_ kimlikleri) o kayıtta kalırsa gerçek yayında görünürdü; onlar silinir.
const DENEME_ADLARINI_SIL = '<script>try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);if(!/-sira$/.test(k))continue;' +
  'var v=JSON.parse(localStorage.getItem(k));if(v&&Array.isArray(v.oyuncular)){v.oyuncular=v.oyuncular.filter(function(x){return !/^deneme_/.test(String(x&&x.id));});' +
  'localStorage.setItem(k,JSON.stringify(v));}}}catch(e){}</script>\n';
// Ana sayfadaki kartın canlı önizlemesi: köprüye bağlanmaz (oyun kendi sahte kalabalığıyla oynar), ses çıkarmaz
// (ses aygıtı yok sayılır, hazır parçalar yüklenmez), ses ve panel düğmeleri gizli; kareler yarı hızda çizilir ki
// aynı anda dört önizleme zayıf bir bilgisayarı yormasın (hareketin hızı saatten gelir, değişmez).
const ONIZLEME_EK = '<script>window.OYUN_MUZIK_KAPALI=true;window.AudioContext=undefined;window.webkitAudioContext=undefined;' +
  '(function(){var r=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=function(f){var t0=performance.now();' +
  'return r(function k(t){if(t-t0<24)return r(k);f(t);});};})();</script>\n<style>#ses-cagri,#cik-yayin{display:none!important}</style>';
function baslatIstegi(req, res) {
  if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }); res.end(); return; }
  if (!yerelIstek(req, true)) { jsonYaz(res, 403, { tamam: false, hata: 'Bu istek ana sayfadan gelmedi; geri çevrildi.' }); req.resume(); return; }
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) { jsonYaz(res, 415, { tamam: false, hata: 'İstek JSON değil.' }); req.resume(); return; }
  let govde = '', fazla = false;
  req.setEncoding('utf8');
  req.on('data', p => { govde += p; if (govde.length > 4096) { fazla = true; req.destroy(); } });
  req.on('end', () => {
    if (fazla) return;
    let g;
    try { g = JSON.parse(govde); } catch (e) { jsonYaz(res, 400, { tamam: false, hata: 'İstek okunamadı.' }); return; }
    if (!g || typeof g !== 'object') { jsonYaz(res, 400, { tamam: false, hata: 'İstek okunamadı.' }); return; }
    const o = typeof g.oyun === 'string' && OYUN_DESEN.test(g.oyun) ? vitrindekiler().find(x => x.id === g.oyun) : null;
    if (!o) { jsonYaz(res, 404, { tamam: false, hata: 'Bu oyun bulunamadı. Sayfayı yenileyip yeniden dene.' }); return; }
    if (g.kip !== 'deneme' && g.kip !== 'canli') { jsonYaz(res, 400, { tamam: false, hata: 'Kip "deneme" ya da "canli" olmalı.' }); return; }
    let ad = '';
    if (g.kip === 'canli') {
      ad = String(g.kullanici == null ? '' : g.kullanici).trim().replace(/^@/, '');
      if (!KULLANICI_DESEN.test(ad)) { jsonYaz(res, 400, { tamam: false, alan: 'kullanici', hata: 'Kullanıcı adı geçersiz: yalnız harf, rakam, alt çizgi ve nokta olur (2-24 karakter).' }); return; }
    }
    oyunCalistir(o, g.kip, ad);
    jsonYaz(res, 200, { tamam: true, adres: '/oyun/' + o.id + '/', ...anaDurum() });
  });
}
// Çalışanı durdurur (sahte olay saati, TikTok bağlantısı, bekleyen yeniden deneme), seçilen oyunu seçilen kipte başlatır.
// Aynı oyun aynı kipte ve aynı adla zaten çalışıyorsa dokunmaz: ana sayfaya dönüp yeniden basmak bağlantıyı koparmasın.
function oyunCalistir(o, kip, ad) {
  if (calisan && calisan.oyun === o.id && calisan.kip === kip && calisan.kullanici === ad) return;
  if (calisan && calisan.durdur) { try { calisan.durdur(); } catch (e) { } }
  for (const k of Object.keys(sayac)) sayac[k] = 0;
  oyunAta(o.klasor);
  calisan = { oyun: o.id, ad: o.ad, kip, kullanici: ad, durdur: null };
  console.log('\n  Açılan oyun: ' + o.ad + (kip === 'canli' ? '  (@' + ad + ' yayınına bağlanıyor)' : '  (deneme: sahte izleyiciler)'));
  if (kip === 'canli') sonDurum = '@' + ad + ' yayınına bağlanılıyor…';
  // Başka oyunun sayfası açık kaldıysa artık olay almadığını söyle.
  const c = cerceve(JSON.stringify({ tip: 'kopru', ileti: BEKLEYEN_OYUN }));
  for (const s of istemciler) if (s.oyun && s.oyun !== o.id) { try { s.write(c); } catch (e) { } }
  calisan.durdur = kip === 'deneme' ? denemeBaslat() : tiktokBaslat(ad);
}
// Kapı doluysa: orada zaten bizim ana sayfamız mı çalışıyor (iki kez çift tıklandı)? Öyleyse sakin bir dille söyle.
function zatenAcik() {
  const adres = 'http://localhost:' + PORT + '/';
  const r = http.get({ host: '127.0.0.1', port: PORT, path: '/api/oyunlar', headers: { host: '127.0.0.1:' + PORT }, timeout: 2000 }, y => {
    let g = ''; y.setEncoding('utf8'); y.on('data', p => { g += p; }); y.on('end', () => {
      let bizim = false; try { bizim = JSON.parse(g).anaSayfa === true; } catch (e) { }
      if (!bizim) return dolu();
      console.log('\n  Oyun fabrikası zaten açık: ' + adres + '\n  O sayfayı kullanabilirsin. Bu pencereyi kapatabilirsin.\n');
      if (args.includes('--ac')) tarayicidaAc(adres);
      setTimeout(() => process.exit(0), 600);
    });
  });
  const dolu = () => { console.log('\n  ' + PORT + ' numaralı kapı başka bir program tarafından kullanılıyor (kapı dolu).\n  O programı kapatıp yeniden dene.\n'); process.exit(1); };
  r.on('timeout', () => r.destroy()); r.on('error', dolu);
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
    return { tip: 'hediye', kullanici: k, jeton: sayi(d.diamondCount ?? g.diamondCount ?? g.diamond_count) || 1, adet: sayi(d.repeatCount) || 1 };
  }
  return null;
}
function ilet(tur, d) {
  let o; try { o = cevir(tur, d); } catch (e) { return; }
  if (!o) return; sayac[o.tip] = (sayac[o.tip] || 0) + 1; yayinla(o);
}

/* ------------------------------------------------------------------ gerçek yayın */
// Döndürdüğü işlev bağlantıyı ve bekleyen yeniden denemeyi durdurur (ana sayfadan başka oyuna geçilince).
// Durdurulduktan sonra eski bağlantıdan gelen olay, bağlanma yanıtı ya da kopma bildirimi yok sayılır.
function tiktokBaslat(kullaniciAdi = KULLANICI) {
  let Kutuphane;
  try { Kutuphane = require('tiktok-live-connector'); }
  catch (e) {
    console.log('  "tiktok-live-connector" kurulu değil. Bu klasörde bir kez şunu çalıştır:\n\n      npm install\n\n  Sonra köprüyü yeniden başlat. (İnternet olmadan denemek için: node kopru.js --deneme)\n');
    durumBildir('Köprü çalışıyor ama TikTok kütüphanesi kurulu değil. Klasörde "npm install" çalıştır.');
    return () => {};
  }
  const Sinif = Kutuphane.TikTokLiveConnection || Kutuphane.WebcastPushConnection; // yeni ve eski sürüm adları
  const E = Kutuphane.WebcastEvent || {}, K = Kutuphane.ControlEvent || {};
  if (typeof Sinif !== 'function') { durumBildir('TikTok kütüphanesinin bu sürümü tanınmadı.'); return () => {}; }
  let bekleme = 15, zamanlayici = null, baglanti = null, bagli = false, durdu = false;
  const KULLANICI = kullaniciAdi;

  const yenidenDene = neden => {
    if (durdu) return;
    bagli = false; clearTimeout(zamanlayici);
    durumBildir(neden + ' ' + bekleme + ' saniye sonra yeniden denenecek.');
    zamanlayici = setTimeout(baglan, bekleme * 1000); bekleme = Math.min(120, Math.round(bekleme * 1.6));
  };
  function baglan() {
    if (durdu) return;
    try { if (baglanti && baglanti.disconnect) baglanti.disconnect(); } catch (e) {}
    try { baglanti = new Sinif(KULLANICI, { enableExtendedGiftInfo: false, processInitialData: false }); }
    catch (e) { durumBildir('Bağlantı kurulamadı: ' + e.message); return; }
    const bu = baglanti, gecerli = () => !durdu && bu === baglanti;
    const dinle = (sabit, ad, fn) => { try { bu.on(E[sabit] || K[sabit] || ad, (...a) => { if (gecerli()) fn(...a); }); } catch (e) {} };
    dinle('CHAT', 'chat', d => ilet('chat', d));
    dinle('GIFT', 'gift', d => ilet('gift', d));
    dinle('LIKE', 'like', d => ilet('like', d));
    dinle('FOLLOW', 'follow', d => ilet('follow', d));
    dinle('SHARE', 'share', d => ilet('share', d));
    dinle('MEMBER', 'member', d => ilet('member', d));
    dinle('STREAM_END', 'streamEnd', () => { bekleme = 30; yenidenDene('Yayın sona erdi.'); });
    dinle('DISCONNECTED', 'disconnected', () => { if (bagli) yenidenDene('TikTok bağlantısı koptu.'); });
    dinle('ERROR', 'error', e => yaz('Uyarı:', (e && (e.info || e.message)) || e));
    Promise.resolve().then(() => bu.connect()).then(durum => {
      if (!gecerli()) { try { bu.disconnect(); } catch (e) {} return; }
      bagli = true; bekleme = 15;
      durumBildir('@' + KULLANICI + ' yayınına bağlandı. Yorum ve hediyeler oyuna akıyor.' + (durum && durum.roomId ? ' (oda ' + durum.roomId + ')' : ''));
    }).catch(e => {
      if (!gecerli()) return;
      const m = String((e && e.message) || e);
      yenidenDene(/offline|not.*live|isn.t online|LIVE has ended/i.test(m) ? '@' + KULLANICI + ' şu an canlı yayında değil.' : 'TikTok\'a bağlanılamadı (' + m.slice(0, 140) + ').');
    });
  }
  baglan();
  return () => {
    durdu = true; clearTimeout(zamanlayici);
    try { if (baglanti && baglanti.disconnect) baglanti.disconnect(); } catch (e) {}
    baglanti = null;
  };
}

/* ------------------------------------------------------------------ deneme kipi: TikTok yerine sahte olay */
function denemeBaslat() {
  const adlar = ['deneme_ayse', 'deneme_memo', 'deneme_zeyno', 'deneme_bekir', 'deneme_elif', 'deneme_cano', 'deneme_sude', 'deneme_baran'];
  const sozler = ['selam!', 'ben de geldim', 'haydi haydi', 'selamlar', 'buradayım'];
  const sec = a => a[Math.floor(Math.random() * a.length)];
  durumBildir('Deneme kipi: olaylar sahte, TikTok\'a bağlanılmadı.');
  let n = 0;
  const saat = setInterval(() => {
    const ad = sec(adlar), u = { uniqueId: ad, nickname: ad.replace('deneme_', 'D. ') }, r = n++ % 10;
    if (r < 5) ilet('chat', { ...u, comment: sec(sozler) });
    else if (r < 7) ilet('like', { ...u, likeCount: 12 });
    else if (r === 7) ilet('gift', { ...u, giftType: 1, repeatEnd: false, repeatCount: 2, diamondCount: 5 }); // seri sürüyor: sayılmamalı
    else if (r === 8) ilet('gift', { ...u, giftType: 1, repeatEnd: true, repeatCount: 3, diamondCount: 5 }); // seri bitti: 15 jeton
    else ilet('follow', u);
  }, 400);
  return () => clearInterval(saat);
}

module.exports = { cevir, oyunSec }; // testler için
if (require.main === module) calistir();
