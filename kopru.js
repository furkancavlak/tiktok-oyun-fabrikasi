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
 *
 * Hangi oyun: --oyun <ad> verilirse oyunlar/<ad>/oyun.html. Verilmezse önce bu dosyanın yanındaki oyun.html
 * (yayıncı paketi böyle gelir), o da yoksa depoda tek oyun varsa o açılır. Birden çok oyun varsa hangisinin
 * açılacağını sorar (komut satırında elle çalıştırılınca ya da --sor ile; BASLAT.bat --sor verir).
 */
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
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
oyunAta(oyunKlasoru());
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
let sonDurum = DENEME ? 'Deneme kipi: olaylar sahte.' : 'TikTok yayınına bağlanılıyor…';
const sayac = { yorum: 0, hediye: 0, begeni: 0, takip: 0, paylasim: 0, katilim: 0 };

function cerceve(metin) { // sunucudan istemciye tek parça metin çerçevesi
  const veri = Buffer.from(metin, 'utf8'), n = veri.length;
  let bas;
  if (n < 126) bas = Buffer.from([0x81, n]);
  else if (n < 65536) { bas = Buffer.alloc(4); bas[0] = 0x81; bas[1] = 126; bas.writeUInt16BE(n, 2); }
  else { bas = Buffer.alloc(10); bas[0] = 0x81; bas[1] = 127; bas.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([bas, veri]);
}
function yayinla(nesne) {
  const c = cerceve(JSON.stringify(nesne));
  for (const s of istemciler) { try { s.write(c); } catch (e) { istemciler.delete(s); } }
}
function durumBildir(ileti) { sonDurum = ileti; yaz(ileti); yayinla({ tip: 'kopru', ileti }); }

const sunucu = http.createServer((req, res) => {
  const yol = (req.url || '/').split('?')[0];
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
function muzikSun(ad, req, res) {
  const tur = MUZIK_TUR[path.extname(ad).toLowerCase()];
  if (!tur || !MUZIK_KLASOR || !/^[\w.-]+$/.test(ad) || ad.includes('..')) { res.writeHead(404); res.end(); return; }
  const dosya = path.join(MUZIK_KLASOR, ad);
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
  soket.setNoDelay(true); istemciler.add(soket);
  yaz('Oyun sayfası bağlandı (' + istemciler.size + ' sayfa).');
  soket.write(cerceve(JSON.stringify({ tip: 'kopru', ileti: sonDurum })));
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
  if (e.code === 'EADDRINUSE') console.log('\n' + PORT + ' numaralı kapı dolu. Köprü zaten açık olabilir; kapatıp yeniden dene ya da --port 9000 ekle.\n');
  else console.log('Sunucu hatası:', e.message);
  process.exit(1);
});
function calistir() {
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
    console.log('\n  Köprü çalışıyor. Oyun: ' + path.relative(__dirname, OYUN));
    console.log('  Oyun (panelli):      http://localhost:' + PORT + '/');
    console.log('  Yalnızca sahne:      http://localhost:' + PORT + '/#yayin');
    let parca = [];
    try { parca = fs.readdirSync(MUZIK_KLASOR).filter(a => /\.(mp3|ogg|wav|m4a)$/i.test(a)); } catch (e) { }
    const mk = path.relative(__dirname, MUZIK_KLASOR) || 'muzik';
    console.log('  Müzik:               ' + (parca.length && fs.existsSync(path.join(MUZIK_KLASOR, 'liste.js')) ? parca.length + ' hazır parça (' + mk + ')' : 'oyunun kendi üretilen müziği (' + mk + ' içinde hazır parça yok)'));
    console.log('  Kapatmak için bu pencerede Ctrl+C.\n');
    if (DENEME) denemeBaslat(); else tiktokBaslat();
    if (args.includes('--ac')) { // oyunu varsayılan tarayıcıda aç (köprü dinlemeye başladıktan sonra)
      const adres = 'http://localhost:' + PORT + '/', { exec } = require('child_process');
      const komut = process.platform === 'win32' ? 'start "" "' + adres + '"' : process.platform === 'darwin' ? 'open "' + adres + '"' : 'xdg-open "' + adres + '"';
      try { exec(komut, () => {}); } catch (e) {}
    }
  });
  process.on('SIGINT', () => { console.log('\nKöprü kapatıldı.'); process.exit(0); });
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
function tiktokBaslat() {
  let Kutuphane;
  try { Kutuphane = require('tiktok-live-connector'); }
  catch (e) {
    console.log('  "tiktok-live-connector" kurulu değil. Bu klasörde bir kez şunu çalıştır:\n\n      npm install\n\n  Sonra köprüyü yeniden başlat. (İnternet olmadan denemek için: node kopru.js --deneme)\n');
    durumBildir('Köprü çalışıyor ama TikTok kütüphanesi kurulu değil. Klasörde "npm install" çalıştır.');
    return;
  }
  const Sinif = Kutuphane.TikTokLiveConnection || Kutuphane.WebcastPushConnection; // yeni ve eski sürüm adları
  const E = Kutuphane.WebcastEvent || {}, K = Kutuphane.ControlEvent || {};
  if (typeof Sinif !== 'function') { durumBildir('TikTok kütüphanesinin bu sürümü tanınmadı.'); return; }
  let bekleme = 15, zamanlayici = null, baglanti = null, bagli = false;

  const yenidenDene = neden => {
    bagli = false; clearTimeout(zamanlayici);
    durumBildir(neden + ' ' + bekleme + ' saniye sonra yeniden denenecek.');
    zamanlayici = setTimeout(baglan, bekleme * 1000); bekleme = Math.min(120, Math.round(bekleme * 1.6));
  };
  function baglan() {
    try { if (baglanti && baglanti.disconnect) baglanti.disconnect(); } catch (e) {}
    try { baglanti = new Sinif(KULLANICI, { enableExtendedGiftInfo: false, processInitialData: false }); }
    catch (e) { durumBildir('Bağlantı kurulamadı: ' + e.message); return; }
    const dinle = (sabit, ad, fn) => { try { baglanti.on(E[sabit] || K[sabit] || ad, fn); } catch (e) {} };
    dinle('CHAT', 'chat', d => ilet('chat', d));
    dinle('GIFT', 'gift', d => ilet('gift', d));
    dinle('LIKE', 'like', d => ilet('like', d));
    dinle('FOLLOW', 'follow', d => ilet('follow', d));
    dinle('SHARE', 'share', d => ilet('share', d));
    dinle('MEMBER', 'member', d => ilet('member', d));
    dinle('STREAM_END', 'streamEnd', () => { bekleme = 30; yenidenDene('Yayın sona erdi.'); });
    dinle('DISCONNECTED', 'disconnected', () => { if (bagli) yenidenDene('TikTok bağlantısı koptu.'); });
    dinle('ERROR', 'error', e => yaz('Uyarı:', (e && (e.info || e.message)) || e));
    Promise.resolve().then(() => baglanti.connect()).then(durum => {
      bagli = true; bekleme = 15;
      durumBildir('@' + KULLANICI + ' yayınına bağlandı. Yorum ve hediyeler oyuna akıyor.' + (durum && durum.roomId ? ' (oda ' + durum.roomId + ')' : ''));
    }).catch(e => {
      const m = String((e && e.message) || e);
      yenidenDene(/offline|not.*live|isn.t online|LIVE has ended/i.test(m) ? '@' + KULLANICI + ' şu an canlı yayında değil.' : 'TikTok\'a bağlanılamadı (' + m.slice(0, 140) + ').');
    });
  }
  baglan();
}

/* ------------------------------------------------------------------ deneme kipi: TikTok yerine sahte olay */
function denemeBaslat() {
  const adlar = ['deneme_ayse', 'deneme_memo', 'deneme_zeyno', 'deneme_bekir', 'deneme_elif', 'deneme_cano', 'deneme_sude', 'deneme_baran'];
  const sozler = ['selam!', 'ben de geldim', 'haydi haydi', 'selamlar', 'buradayım'];
  const sec = a => a[Math.floor(Math.random() * a.length)];
  durumBildir('Deneme kipi: olaylar sahte, TikTok\'a bağlanılmadı.');
  let n = 0;
  setInterval(() => {
    const ad = sec(adlar), u = { uniqueId: ad, nickname: ad.replace('deneme_', 'D. ') }, r = n++ % 10;
    if (r < 5) ilet('chat', { ...u, comment: sec(sozler) });
    else if (r < 7) ilet('like', { ...u, likeCount: 12 });
    else if (r === 7) ilet('gift', { ...u, giftType: 1, repeatEnd: false, repeatCount: 2, diamondCount: 5 }); // seri sürüyor: sayılmamalı
    else if (r === 8) ilet('gift', { ...u, giftType: 1, repeatEnd: true, repeatCount: 3, diamondCount: 5 }); // seri bitti: 15 jeton
    else ilet('follow', u);
  }, 400);
}

module.exports = { cevir, oyunSec }; // testler için
if (require.main === module) calistir();
