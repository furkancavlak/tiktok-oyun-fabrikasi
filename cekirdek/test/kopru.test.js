// Köprü testleri: ileti çevirisi, deneme kipi, kopma / yeniden bağlanma, sıralamayı saklama,
// kütüphanenin eski ve yeni sürümünün TAKLİTLERİYLE uçtan uca akış. Çalıştırma: npm run test:kopru
// Bu testler TikTok'a HİÇ bağlanmaz: gerçek kütüphane yerine geçici klasörlerdeki taklitler kullanılır.
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { KOK, CIKTI, tarayici, raporla, kontrolcu } = require('./ortak');
const { sonuc, kontrol } = kontrolcu();
const S = CIKTI, GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-kopru-')); // depo dışı: gerçek node_modules görünmesin
const OYUN_KIMLIK = (() => { const m = /const OYUN = \{\s*id:\s*'([^']+)'/.exec(fs.readFileSync(path.join(KOK, 'oyunlar', process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'halay', 'oyun.html'), 'utf8')); return m ? m[1] : 'canli-oyun'; })(), SIRA_ANAHTAR = OYUN_KIMLIK + '-sira'; // oyunun tarayıcıdaki sıra kaydı (50-yayin.js SAKLA)
const OYUN_AD = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'halay', OYUN_HTML = path.join(KOK, 'oyunlar', OYUN_AD, 'oyun.html'); // köprü hangi oyunla sınanacak
// Ana sayfa kipindeki köprü kütüphaneyi bulamazsa kendisi indirir. Testler ağa ve gerçek npm'e asla gitmesin: her köprü
// npm yerine bu taklidi çalıştırır. Taklit, köprünün klasöründeki kurulum-mod.txt'ye bakar ("tamam 2500" ya da
// "hata 300"; dosya yoksa hemen başarısız olur), her çalışmasını kurulum-sayac.txt'ye yazar (t / h).
const TAKLIT = path.join(GECICI, 'kurulum-taklit.js');
fs.writeFileSync(TAKLIT, `const fs=require('fs'),path=require('path');let mod='hata',ms=0;try{const a=fs.readFileSync('kurulum-mod.txt','utf8').trim().split(/\\s+/);mod=a[0];ms=+a[1]||0;}catch(e){}
fs.appendFileSync('kurulum-sayac.txt',mod[0]);setTimeout(()=>{if(mod!=='tamam'){console.error('npm ERR! network (taklit)');process.exit(1);}
const k=path.join('node_modules','tiktok-live-connector');fs.mkdirSync(k,{recursive:true});
fs.writeFileSync(path.join(k,'index.js'),"const E=require('events');class WebcastPushConnection extends E{connect(){return Promise.reject(new Error('LIVE has ended'));}disconnect(){}}module.exports={WebcastPushConnection};");process.exit(0);},ms);`);
process.env.KOPRU_KURULUM_BETIGI = TAKLIT;
// Kapılar: --port N ya da KOPRU_TEST_PORT=N (öntanım 8791); N, N+1 ve N+2…N+9 kullanılır. Açık bir köprü 8791'i tutuyorsa başka kapı ver.
const pi = process.argv.indexOf('--port'), P = parseInt(pi > 0 ? process.argv[pi + 1] : process.env.KOPRU_TEST_PORT, 10) || 8791;
const bekle = ms => new Promise(r => setTimeout(r, ms));
const al = url => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ kod: r.statusCode, govde: d })); }).on('error', rej));
// Köprü dinlemeye başlayana dek bekler (en çok 15 sn). Yük altında köprünün açılması 1 sn'yi geçebiliyor; sabit bekleme yetmez.
const acik = async kp => { for (let i = 0; i < 150; i++) { if (await al('http://127.0.0.1:' + kp + '/durum').then(x => x.kod > 0, () => false)) return true; await bekle(100); } return false; };
// Ham WebSocket el sıkışması: ilk yanıt satırını ve gelen veriyi döndürür (başlık değeri null ise o başlık yollanmaz).
const wsDene = (kp, yol, bas = {}) => new Promise(res => {
  const s = require('net').connect(kp, '127.0.0.1', () => {
    const h = Object.assign({ Host: '127.0.0.1:' + kp, Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' }, bas);
    s.write('GET ' + yol + ' HTTP/1.1\r\n' + Object.entries(h).filter(([, v]) => v !== null).map(([k, v]) => k + ': ' + v).join('\r\n') + '\r\n\r\n');
  });
  let veri = Buffer.alloc(0); s.on('data', d => { veri = Buffer.concat([veri, d]); }); s.on('error', () => { });
  setTimeout(() => { const t = veri.toString('utf8'); s.destroy(); res({ durum: (t.split('\r\n')[0] || '').trim(), veri: t }); }, 800);
});
const hostAl = (kp, yol, host) => new Promise(res => http.get({ host: '127.0.0.1', port: kp, path: yol, headers: { host } }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', () => res(0)));
function baslat(klasor, args) { const c = spawn(process.execPath, ['kopru.js', ...args], { cwd: klasor }); c.cikti = ''; c.stdout.on('data', d => c.cikti += d); c.stderr.on('data', d => c.cikti += d); return c; }

(async () => {
  // ---- 1. çeviri birim testleri
  const { cevir } = require(path.join(KOK, 'kopru.js'));
  const v1 = { uniqueId: 'ayse', nickname: 'Ayşe', userId: '6813181309701718022' };
  kontrol('Köprü: eski sürüm yorum', JSON.stringify(cevir('chat', { ...v1, comment: 'halay!' })) === JSON.stringify({ tip: 'yorum', kullanici: { id: 'ayse', ad: 'Ayşe' }, metin: 'halay!' }));
  kontrol('Köprü: eski sürüm seri hediye sürerken yok sayılır', cevir('gift', { ...v1, giftType: 1, repeatEnd: false, repeatCount: 2, diamondCount: 5 }) === null);
  const g1 = cevir('gift', { ...v1, giftType: 1, repeatEnd: true, repeatCount: 3, diamondCount: 5 });
  kontrol('Köprü: eski sürüm seri bitince 5×3 sayılır', g1.jeton === 5 && g1.adet === 3, g1);
  const g2 = cevir('gift', { ...v1, giftType: 2, repeatCount: 1, diamondCount: 29999 });
  kontrol('Köprü: tek seferlik büyük hediye', g2.jeton === 29999 && g2.adet === 1, g2);
  const v2u = { user: { uniqueId: 'memo', nickname: 'Memo', userId: 6813181309701718022n } };
  const c2 = cevir('chat', { ...v2u, comment: 'selam' });
  kontrol('Köprü: yeni sürüm iç içe kullanıcı, büyük sayılı kimlik', c2.kullanici.id === 'memo' && c2.metin === 'selam' && JSON.stringify(c2).length > 0, c2);
  kontrol('Köprü: yeni sürüm seri (sayı olarak 0/1)', cevir('gift', { ...v2u, giftDetails: { giftType: 1, diamondCount: 10 }, repeatCount: 4, repeatEnd: 0 }) === null && cevir('gift', { ...v2u, giftDetails: { giftType: 1, diamondCount: 10 }, repeatCount: 4, repeatEnd: 1 }).jeton === 10);
  kontrol('Köprü: beğeni sayısı ve büyük sayı', cevir('like', { ...v1, likeCount: 15 }).adet === 15 && cevir('like', { ...v2u, likeCount: 15n }).adet === 15);
  kontrol('Köprü: kimliksiz ya da bozuk veri yok sayılır', cevir('chat', {}) === null && cevir('gift', null) === null && cevir('bilinmeyen', v1) === null);
  kontrol('Köprü: yalnız takma adı olan kullanıcı', cevir('follow', { nickname: 'Sadece Ad' }).kullanici.id === 'Sadece Ad');
  // Oyun seçimi: depoda birden çok oyun varken "hangi oyun?" sorusunun yanıtı (sıra numarası ya da ad).
  const { oyunSec } = require(path.join(KOK, 'kopru.js')), uc = ['dolmus', 'halay', 'konvoy'];
  kontrol('Köprü: oyun seçimi numarayla ya da adla; boşluk ve büyük harf hoş görülür', typeof oyunSec === 'function' && oyunSec(uc, '2') === 'halay' && oyunSec(uc, ' Konvoy ') === 'konvoy');
  kontrol('Köprü: oyun seçiminde listede olmayan yanıt geri çevrilir', typeof oyunSec === 'function' && [undefined, '', '0', '4', 'yok', '2.5'].every(y => oyunSec(uc, y) === null));

  const b = await tarayici();
  const hatalar = [];
  const sayfaAc = async (ctx, url) => { const p = await ctx.newPage(); await p.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; }); p.on('pageerror', e => hatalar.push(e.message + ' @ ' + p.url() + ' ' + String(e.stack || '').split(/\r?\n/).slice(1, 3).join(' '))); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|WebSocket connection/.test(m.text())) hatalar.push(m.text()); }); await p.goto(url); return p; };

  // ---- 2. deneme kipi uçtan uca
  let k = baslat(KOK, ['--deneme', '--oyun', OYUN_AD, '--port', String(P)]); await bekle(900); await acik(P);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const dr0 = await al('http://127.0.0.1:' + P + '/durum').then(r => ({ kod: r.kod }), e => ({ hata: e.code }));
  let p = await sayfaAc(ctx, 'http://127.0.0.1:' + P + '/'); await bekle(7000);
  let d = await p.evaluate(() => ({ ...CanliOyun.durum(), rozet: document.getElementById('bag-rozet').textContent, ileti: document.getElementById('bag-ileti').textContent, oto: document.getElementById('oto').textContent, not: document.getElementById('panel-not').textContent, adres: document.getElementById('bag-adres').value, serit: document.getElementById('d-bag').textContent, sekme: document.getElementById('bolum-yayin').hidden === false, uyari: document.getElementById('deneme-uyari').hidden === false }));
  kontrol('Köprü testi seçilen kapıda çalışır (' + P + ', KOPRU_TEST_PORT ya da --port)', dr0.kod === 200, dr0);
  kontrol('Köprüden açılan sayfa kendiliğinden bağlanır (deneme kipinde rozet "Deneme")', d.bagli && d.rozet === 'Deneme' && d.adres === 'ws://127.0.0.1:' + P + '/olay', { rozet: d.rozet, adres: d.adres, ileti: d.ileti });
  kontrol('Köprü deneme kipinde masa: Bağlantı hücresi "Deneme" der ("Canlı" değil), Yayın sekmesi açık, Deneme sekmesinde uyarı var', d.serit === 'Deneme' && d.sekme && d.uyari, { serit: d.serit, sekme: d.sekme, uyari: d.uyari });
  kontrol('Köprüden gelen olaylar oyuna işlenir', d.alinan > 8 && d.kisi >= 3, { alinan: d.alinan, kisi: d.kisi });
  kontrol('Gerçek yayın kipinde sahte izleyici kapalı ve sahte ad yok', /kapalı/.test(d.oto) && d.sira.every(x => x[0].startsWith('D. ')), { oto: d.oto, adlar: d.sira.map(x => x[0]) });
  kontrol('Süren seri sayılmadı: jetonlar 15\'in katı', d.sira.every(x => x[1] % 15 === 0) && d.sira.some(x => x[1] >= 15), d.sira.map(x => x[1]));
  const dr = JSON.parse((await al('http://127.0.0.1:' + P + '/durum')).govde);
  kontrol('Köprü durum adresi çalışır', dr.bagliSayfa === 1 && dr.sayac.yorum > 0 && dr.sayac.hediye > 0, dr);
  kontrol('Köprü bilinmeyen adrese 404 döner', (await al('http://127.0.0.1:' + P + '/../../etc/passwd')).kod === 404 && (await al('http://127.0.0.1:' + P + '/kopru.js')).kod === 404);
  // isteğe bağlı müzik klasörü: yalnız düz adlı .js ve ses dosyaları, yalnız muzik/ içinden
  const muzikKlasor = path.join(KOK, 'oyunlar', OYUN_AD, 'muzik'), klasorVardi = fs.existsSync(muzikKlasor), denemeDosya = path.join(muzikKlasor, '_kopru-test.js');
  fs.mkdirSync(muzikKlasor, { recursive: true }); fs.writeFileSync(denemeDosya, '0123456789');
  const ham = (yol, baslik) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: P, path: yol, headers: baslik || {} }, r => { let g = ''; r.on('data', c => g += c); r.on('end', () => res({ kod: r.statusCode, govde: g, aralik: r.headers['content-range'] })); }).on('error', rej));
  const mz = { tam: await ham('/muzik/_kopru-test.js'), parca: await ham('/muzik/_kopru-test.js', { range: 'bytes=2-5' }), son: await ham('/muzik/_kopru-test.js', { range: 'bytes=-3' }), tasan: await ham('/muzik/_kopru-test.js', { range: 'bytes=50-60' }),
    disari: [await ham('/muzik/../kopru.js'), await ham('/muzik/..%2Fkopru.js'), await ham('/muzik/%2e%2e/kopru.js'), await ham('/muzik/..\\kopru.js'), await ham('/muzik/alt/_kopru-test.js'), await ham('/muzik/_kopru-test.html'), await ham('/muzik/yok.mp3'), await ham('/muzik/')] };
  fs.unlinkSync(denemeDosya); if (!klasorVardi) fs.rmdirSync(muzikKlasor);
  // Her oyunun müziği kendinedir: köprü başka oyunun muzik/ klasörünü de, depo kökünde bir muzik/ klasörünü de sunmaz.
  const baskaAd = fs.readdirSync(path.join(KOK, 'oyunlar')).find(a => a !== OYUN_AD && fs.existsSync(path.join(KOK, 'oyunlar', a, 'js'))), yabanci = [];
  for (const kl of [baskaAd && path.join(KOK, 'oyunlar', baskaAd, 'muzik'), path.join(KOK, 'muzik')].filter(Boolean)) {
    const vardi = fs.existsSync(kl), dosya = path.join(kl, '_kopru-yabanci.js');
    fs.mkdirSync(kl, { recursive: true }); fs.writeFileSync(dosya, 'yabanci');
    yabanci.push([path.relative(KOK, kl), (await ham('/muzik/_kopru-yabanci.js')).kod]);
    fs.unlinkSync(dosya); if (!vardi) fs.rmdirSync(kl);
  }
  kontrol('Köprü yalnız açtığı oyunun muzik/ klasörünü sunar (başka oyununkini ve depo kökündekini sunmaz)', yabanci.length === 2 && yabanci.every(x => x[1] === 404), yabanci);
  kontrol('Köprü müzik klasöründeki dosyayı sunar, aralık isteğini karşılar', mz.tam.kod === 200 && mz.tam.govde === '0123456789' && mz.parca.kod === 206 && mz.parca.govde === '2345' && mz.parca.aralik === 'bytes 2-5/10' && mz.son.govde === '789' && mz.tasan.kod === 416, { tam: mz.tam.kod, parca: mz.parca, son: mz.son.govde, tasan: mz.tasan.kod });
  kontrol('Köprü müzik adresinden klasör dışına ya da başka türde dosyaya çıkılmaz', mz.disari.every(x => x.kod === 404), mz.disari.map(x => x.kod));
  // Komut satırı kiplerinde de yalnız kendi adres; kaynak yok / null / file: kabul (diskten açılmış oyun.html elle bağlanabilir)
  const eskiWs = { kendi: await wsDene(P, '/olay', { Origin: 'http://127.0.0.1:' + P }), kaynaksiz: await wsDene(P, '/olay'), nul: await wsDene(P, '/olay', { Origin: 'null' }), dosya: await wsDene(P, '/olay', { Origin: 'file://' }),
    yabanci: await wsDene(P, '/olay', { Origin: 'http://kotu.example' }), host: await wsDene(P, '/olay', { Host: 'kotu.example:' + P, Origin: 'http://kotu.example:' + P }) };
  const eskiWsDurum = Object.fromEntries(Object.entries(eskiWs).map(([a, v]) => [a, v.durum.slice(9, 12)]));
  kontrol('Komut satırı kipinde soket: kendi adresi, kaynaksız, null ve file: kabul; başka site ve başka Host geri çevrilir', ['kendi', 'kaynaksiz', 'nul', 'dosya'].every(a => eskiWsDurum[a] === '101') && eskiWsDurum.yabanci === '403' && eskiWsDurum.host === '403' && !/"tip"/.test(eskiWs.yabanci.veri), eskiWsDurum);
  const eskiHost = [await hostAl(P, '/', 'kotu.example:' + P), await hostAl(P, '/durum', 'kotu.example:' + P), await hostAl(P, '/muzik/liste.js', 'kotu.example:' + P), await hostAl(P, '/durum', '127.0.0.1:' + P)];
  kontrol('Komut satırı kipinde de her HTTP adresi başka Host\'la gelirse 403 (DNS yeniden bağlama)', JSON.stringify(eskiHost) === JSON.stringify([403, 403, 403, 200]), eskiHost);
  const liste = await ham('/muzik/liste.js');
  kontrol('Hazır parçası olmayan oyunda muzik/liste.js boş bir betik döner (konsola 404 düşmez)', liste.kod === 200 && /hazır parçası yok/.test(liste.govde), liste);
  await p.locator('#sahne').screenshot({ path: S + '/k-deneme.png' });
  // ---- 3. köprü kapanıp açılınca
  k.kill('SIGKILL'); await bekle(2500);
  await bekle(300); d = await p.evaluate(() => ({ bagli: CanliOyun.durum().bagli, rozet: document.getElementById('bag-rozet').textContent, ileti: document.getElementById('bag-ileti').textContent, kisi: CanliOyun.durum().kisi, serit: document.getElementById('d-bag').textContent }));
  kontrol('Köprü kapanınca oyun durmaz, durumu bildirir (şeritte de)', !d.bagli && /koptu/.test(d.ileti) && d.kisi >= 3 && /Koptu|Bağlanıyor/.test(d.serit), d);
  const onceAlinan = await p.evaluate(() => CanliOyun.durum().alinan);
  k = baslat(KOK, ['--deneme', '--oyun', OYUN_AD, '--port', String(P)]); await bekle(7000);
  d = await p.evaluate(() => ({ bagli: CanliOyun.durum().bagli, alinan: CanliOyun.durum().alinan, rozet: document.getElementById('bag-rozet').textContent }));
  kontrol('Köprü yeniden açılınca oyun kendiliğinden yeniden bağlanır', d.bagli && d.alinan > onceAlinan + 3, { once: onceAlinan, sonra: d.alinan, rozet: d.rozet });
  // ---- 4. sayfa yenilenince sıralama geri gelir
  await bekle(5500); const sakli = await p.evaluate(() => CanliOyun.durum().sira.filter(x => x[1] > 0));
  k.kill('SIGKILL'); await bekle(400); k = baslat(KOK, ['--deneme', '--oyun', OYUN_AD, '--port', String(P)]); await bekle(600); await acik(P);
  await p.reload(); await bekle(350);
  const geri = await p.evaluate(() => CanliOyun.durum().sira.filter(x => x[1] > 0));
  kontrol('Sayfa yenilenince jeton sıralaması geri yüklenir', geri.length >= sakli.length - 1 && geri.length > 0 && geri[0][1] >= sakli[0][1] - 30, { once: sakli.slice(0, 3), sonra: geri.slice(0, 3) });
  await p.close();
  // yalnız sahne görünümü köprüden
  const y = await sayfaAc(await b.newContext({ viewport: { width: 540, height: 960 } }), 'http://127.0.0.1:' + P + '/#yayin'); await bekle(4000);
  const yd = await y.evaluate(() => ({ panel: getComputedStyle(document.getElementById('panel')).display, bagli: CanliOyun.durum().bagli, ses: CanliOyun.durum().ses, sesDugme: document.getElementById('ses-cagri').hidden }));
  kontrol('Köprüden #yayin: yalnız sahne, bağlı, ses kendiliğinden başlar (tarayıcı izin verirse)', yd.panel === 'none' && yd.bagli && yd.ses && yd.sesDugme, yd);
  await y.screenshot({ path: S + '/k-yayin.png' }); await y.close();
  // aynı kapı ikinci kez
  const k2 = baslat(KOK, ['--deneme', '--oyun', OYUN_AD, '--port', String(P)]); await bekle(900);
  kontrol('Kapı doluysa anlaşılır ileti verip kapanır', /kapı dolu/.test(k2.cikti) && k2.exitCode === 1, k2.cikti.trim().slice(0, 90));
  k.kill('SIGKILL');

  // ---- 5. kütüphane yokken
  const bos = path.join(GECICI, 'kutuphanesiz'); fs.mkdirSync(bos); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(bos, 'kopru.js')); fs.copyFileSync(OYUN_HTML, path.join(bos, 'oyun.html')); // yayıncı paketi düzeni: oyun.html köprünün yanında
  const k3 = baslat(bos, ['deneme_kullanici', '--port', String(P + 1)]); await bekle(1200); await acik(P + 1);
  const dr3 = JSON.parse((await al('http://127.0.0.1:' + (P + 1) + '/durum')).govde);
  kontrol('Kütüphane kurulu değilken ne yapılacağını söyler, oyun yine açılır', /npm install/.test(k3.cikti) && /npm install/.test(dr3.durum) && (await al('http://127.0.0.1:' + (P + 1) + '/')).kod === 200, dr3.durum);
  k3.kill('SIGKILL');
  const k4 = baslat(bos, []); await bekle(500);
  kontrol('Kullanıcı adı verilmezse kullanım bilgisini yazar', /Kullanım/.test(k4.cikti) && k4.exitCode === 1);

  // ---- 6. sahte kütüphanelerle: eski sürüm, yeni sürüm, yayın kapalı
  const sahte = {
    eski: `const E=require('events');class WebcastPushConnection extends E{constructor(u,o){super();this.u=u;global.__secenek=o;}connect(){setTimeout(()=>{const u={uniqueId:'eski_ayse',nickname:'Eski Ayşe',userId:'681318130970171802'};this.emit('chat',{...u,comment:'eski sürümden selam'});this.emit('like',{...u,likeCount:20});this.emit('gift',{...u,giftType:1,repeatEnd:false,repeatCount:1,diamondCount:1});this.emit('gift',{...u,giftType:1,repeatEnd:false,repeatCount:2,diamondCount:1});this.emit('gift',{...u,giftType:1,repeatEnd:true,repeatCount:7,diamondCount:1});this.emit('follow',{uniqueId:'eski_cem',nickname:'Eski Cem'});this.emit('gift',{uniqueId:'eski_cem',nickname:'Eski Cem',giftType:2,repeatCount:1,diamondCount:500});this.emit('roomUser',{viewerCount:3});this.emit('error',{info:'deneme uyarısı'});},6000);return Promise.resolve({roomId:'123'});}disconnect(){}}module.exports={WebcastPushConnection};`,
    yeni: `const E=require('events');const WebcastEvent={CHAT:'chatX',GIFT:'giftX',LIKE:'likeX',FOLLOW:'followX',SHARE:'shareX',MEMBER:'memberX',STREAM_END:'endX'};const ControlEvent={DISCONNECTED:'discX',ERROR:'errX'};class TikTokLiveConnection extends E{constructor(u){super();}async connect(){setTimeout(()=>{const user={uniqueId:'yeni_memo',nickname:'Yeni Memo',userId:6813181309701718022n};this.emit('chatX',{user,comment:'yeni sürümden selam'});this.emit('giftX',{user,giftDetails:{giftType:1,diamondCount:10},repeatCount:2,repeatEnd:0});this.emit('giftX',{user,giftDetails:{giftType:1,diamondCount:10},repeatCount:6,repeatEnd:1});this.emit('likeX',{user,likeCount:9});this.emit('followX',{user:{uniqueId:'yeni_sude',nickname:'Yeni Sude'}});this.emit('chat',{user,comment:'yanlış adlı olay, gelmemeli'});},6000);return {roomId:'456'};}disconnect(){}}module.exports={TikTokLiveConnection,WebcastEvent,ControlEvent};`,
    kapali: `const E=require('events');class WebcastPushConnection extends E{connect(){return Promise.reject(new Error('LIVE has ended'));}disconnect(){}}module.exports={WebcastPushConnection};`
  };
  let kapi = P + 2;
  for (const [ad, kod] of Object.entries(sahte)) {
    const kl = path.join(GECICI, 'sahte-' + ad); fs.mkdirSync(path.join(kl, 'node_modules/tiktok-live-connector'), { recursive: true });
    fs.writeFileSync(path.join(kl, 'node_modules/tiktok-live-connector/index.js'), kod); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js')); fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyun.html'));
    const kp = ++kapi, c = baslat(kl, ['@Test_Kullanici', '--port', String(kp)]); await bekle(700); await acik(kp);
    if (ad === 'kapali') { await bekle(600); const q = JSON.parse((await al('http://127.0.0.1:' + kp + '/durum')).govde); kontrol('Yayın kapalıyken: açık dille söyler ve kendiliğinden yeniden dener', /@Test_Kullanici şu an canlı yayında değil/.test(q.durum) && /saniye sonra yeniden/.test(q.durum), q.durum); c.kill('SIGKILL'); continue; }
    const pg = await sayfaAc(await b.newContext({ viewport: { width: 1280, height: 800 } }), 'http://127.0.0.1:' + kp + '/'); await bekle(600);
    // Sahte kütüphane olayları bağlandıktan 6 sn sonra yollar: sayfa yük altında geç açılsa da köprüye o
    // zamana dek bağlanmış olur. Olaylar oyuna işlenene kadar beklenir (sabit süre beklemek ara sıra kaçırıyordu).
    const c2 = c; await pg.waitForFunction(() => CanliOyun.durum().sira.length >= 2, null, { timeout: 15000 }).catch(() => { }); await bekle(500);
    const q = await pg.evaluate(() => ({ ...CanliOyun.durum(), ileti: document.getElementById('bag-ileti').textContent, gunluk: document.getElementById('gunluk').textContent }));
    if (ad === 'eski') kontrol('Eski sürüm kütüphaneyle uçtan uca: yorum, seri hediye (1×7), tek hediye (500), takip', q.bagli && JSON.stringify(q.sira) === JSON.stringify([['Eski Cem', 500], ['Eski Ayşe', 7]]) && /Test_Kullanici yayınına bağlandı/.test(q.ileti) && /oda 123/.test(q.ileti), { sira: q.sira, ileti: q.ileti });
    else kontrol('Yeni sürüm kütüphaneyle uçtan uca: sabit adları, iç içe veri, seri hediye (10×6)', q.bagli && JSON.stringify(q.sira) === JSON.stringify([['Yeni Memo', 60], ['Yeni Sude', 0]]) && !/gelmemeli/.test(q.gunluk), { sira: q.sira, ileti: q.ileti });
    c2.kill('SIGKILL'); await pg.close();
  }

  // ---- 5. birden çok oyunlu klasörde oyun adı verilmeden açılış (depo kökündeki BASLAT.bat böyle çalıştırır)
  // Depoda dört oyun varken BASLAT.bat çift tıklanınca köprü "hangi oyun?" deyip kapanıyor, tarayıcı açılmıyordu.
  {
    const kl = path.join(GECICI, 'cok-oyun'), kp = P + 6;
    for (const ad of ['a-oyun', 'b-oyun']) {
      fs.mkdirSync(path.join(kl, 'oyunlar', ad), { recursive: true });
      fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyunlar', ad, 'oyun.html'));
      fs.writeFileSync(path.join(kl, 'oyunlar', ad, 'oyun.json'), JSON.stringify({ ad: ad === 'a-oyun' ? 'Birinci Oyun' : 'İkinci Oyun' }));
    }
    fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js'));
    // Soru istenmediyse ve girdi klavye değilse (başka bir program çalıştırıyor) eskisi gibi söyleyip durur.
    const sessiz = baslat(kl, ['--deneme', '--port', String(kp)]); let sessizKod = null; sessiz.on('exit', k => sessizKod = k); await bekle(900);
    kontrol('Çok oyunlu klasör, soru istenmedi: hangi oyunların olduğunu yazıp durur', sessizKod === 1 && /--oyun <ad> ekle/.test(sessiz.cikti) && /a-oyun, b-oyun/.test(sessiz.cikti), { kod: sessizKod, cikti: sessiz.cikti }); sessiz.kill('SIGKILL');
    // --sor ile (BASLAT.bat böyle çağırır): listeyi gösterir, yanlış yanıtta yeniden sorar, seçilen oyunu açar.
    const sorulu = baslat(kl, ['--deneme', '--sor', '--port', String(kp)]); await bekle(700);
    sorulu.stdin.write('olmayan\n'); await bekle(300); sorulu.stdin.write('2\n'); await bekle(900);
    const yanit = await al('http://127.0.0.1:' + kp + '/').catch(() => ({ kod: 0, govde: '' }));
    kontrol('Çok oyunlu klasör, --sor: oyunları görünen adlarıyla listeler ve sorar', /1\) a-oyun/.test(sorulu.cikti) && /2\) b-oyun/.test(sorulu.cikti) && /İkinci Oyun/.test(sorulu.cikti), sorulu.cikti);
    kontrol('Çok oyunlu klasör, --sor: listede olmayan yanıtta yeniden sorar', /Listede yok: olmayan/.test(sorulu.cikti), sorulu.cikti);
    kontrol('Çok oyunlu klasör, --sor: seçilen oyunla açılır, sayfa gelir', /Oyun: oyunlar[\\/]b-oyun[\\/]oyun\.html/.test(sorulu.cikti) && yanit.kod === 200 && /CanliOyun/.test(yanit.govde), { kod: yanit.kod, cikti: sorulu.cikti });
    sorulu.kill('SIGKILL'); await bekle(300);
    // Yanıt gelmeden girdi biterse (pencere kapatıldı) asılı kalmaz.
    const yarim = baslat(kl, ['--deneme', '--sor', '--port', String(kp)]); let yarimKod = null; yarim.on('exit', k => yarimKod = k); await bekle(500); yarim.stdin.end(); await bekle(700);
    kontrol('Çok oyunlu klasör, --sor: yanıt verilmeden girdi kapanırsa durur', yarimKod === 1, { kod: yarimKod, cikti: yarim.cikti }); yarim.kill('SIGKILL');
  }
  // ---- 7. ana sayfa kipi (BASLAT.bat böyle çalıştırır): oyun ve kip sayfadan seçilir
  // JSON gövdeli POST; başlıklar öntanımda köprünün kendi sayfasından gelmiş gibidir, testler tek tek bozar.
  const gonder = (kp, yol, govde, baslik = {}) => new Promise(res => {
    const veri = typeof govde === 'string' ? govde : JSON.stringify(govde);
    const r = http.request({ host: '127.0.0.1', port: kp, path: yol, method: 'POST', headers: { host: '127.0.0.1:' + kp, origin: 'http://127.0.0.1:' + kp, 'content-type': 'application/json', 'content-length': Buffer.byteLength(veri), ...baslik } }, y => { let g = ''; y.on('data', c => g += c); y.on('end', () => { let j = null; try { j = JSON.parse(g); } catch (e) { } res({ kod: y.statusCode, j }); }); });
    r.on('error', e => res({ kod: 0, hata: e.code })); r.end(veri);
  });
  {
    const kl = path.join(GECICI, 'ana'), kp = P + 7, A = 'http://127.0.0.1:' + kp, api = (g, b) => gonder(kp, '/api/baslat', g, b);
    const oyunKur = (ad, bilgi, derli = true) => {
      fs.mkdirSync(path.join(kl, 'oyunlar', ad), { recursive: true });
      if (derli) fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyunlar', ad, 'oyun.html'));
      if (bilgi) fs.writeFileSync(path.join(kl, 'oyunlar', ad, 'oyun.json'), JSON.stringify(bilgi));
    };
    oyunKur('a-oyun', { ad: 'Birinci Oyun', aciklama: 'Yorum yazan girer.' });
    oyunKur('b-oyun', { ad: 'İkinci Oyun' });
    oyunKur('c-oyun', { ad: '<img src=x onerror="window.__xss=1">Üç', aciklama: '<b>kalın değil</b>' }); // ad HTML olarak yazılmamalı
    oyunKur('gizli', { ad: 'Gizli Oyun', vitrin: false });
    oyunKur('derlenmemis', { ad: 'Derlenmemiş' }, false);
    fs.mkdirSync(path.join(kl, 'cekirdek'), { recursive: true });
    fs.copyFileSync(path.join(KOK, 'cekirdek', 'ana-sayfa.html'), path.join(kl, 'cekirdek', 'ana-sayfa.html'));
    fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js'));
    // Sahte kütüphane: bağlanınca 300 ms'de bir yorum yollar; her bağlanma ve kopma kayit.txt'ye yazılır (b / k).
    fs.mkdirSync(path.join(kl, 'node_modules/tiktok-live-connector'), { recursive: true });
    fs.writeFileSync(path.join(kl, 'node_modules/tiktok-live-connector/index.js'), `const E=require('events'),fs=require('fs'),p=require('path');const kayit=h=>fs.appendFileSync(p.join(__dirname,'..','..','kayit.txt'),h);class WebcastPushConnection extends E{constructor(u){super();this.u=u;}connect(){kayit('b');let n=0;this.t=setInterval(()=>{n++;this.emit('chat',{uniqueId:'canli_'+(n%3),nickname:'Canlı '+(n%3),comment:'selam '+this.u});if(n%4===0)this.emit('gift',{uniqueId:'canli_0',nickname:'Canlı 0',giftType:2,repeatCount:1,diamondCount:7});},300);return Promise.resolve({roomId:'789'});}disconnect(){if(this.t){clearInterval(this.t);this.t=null;kayit('k');}}}module.exports={WebcastPushConnection};`);
    const kayit = () => { try { return fs.readFileSync(path.join(kl, 'kayit.txt'), 'utf8'); } catch (e) { return ''; } };
    const ana = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await bekle(800); await acik(kp);
    const liste = JSON.parse((await al(A + '/api/oyunlar')).govde), sayfa = await al(A + '/');
    kontrol('Ana sayfa kipi: köprü oyunsuz ve kullanıcı adsız açılır, adresi ve "pencere motordur" der', /Oyun Fabrikası açık: +http:\/\/localhost:\d+\//.test(ana.cikti) && /motorudur/.test(ana.cikti) && !/Kullanım/.test(ana.cikti) && ana.exitCode === null, ana.cikti.trim());
    kontrol('Ana sayfa kipi: / ana sayfayı sunar', sayfa.kod === 200 && /TikTok Oyun Fabrikası/.test(sayfa.govde) && /api\/baslat/.test(sayfa.govde), sayfa.kod);
    kontrol('Ana sayfa kipi: liste derlenmiş oyunlar, adlar oyun.json\'dan; vitrin:false ve derlenmemiş yok', JSON.stringify(liste.oyunlar.map(o => [o.id, o.ad])) === JSON.stringify([['a-oyun', 'Birinci Oyun'], ['b-oyun', 'İkinci Oyun'], ['c-oyun', '<img src=x onerror="window.__xss=1">Üç']]) && liste.oyunlar[0].aciklama === 'Yorum yazan girer.' && liste.aktif === null && liste.paket === false, liste.oyunlar);
    // POST /api/baslat: başka siteden, JSON olmayan, bilinmeyen oyun, gizli oyun, bozuk kullanıcı adı geri çevrilir
    const ret = {
      yabanci: await api({ oyun: 'a-oyun', kip: 'deneme' }, { origin: 'http://kotu.example' }),
      kaynaksiz: await api({ oyun: 'a-oyun', kip: 'deneme' }, { origin: '' }),
      baskaSite: await api({ oyun: 'a-oyun', kip: 'deneme' }, { 'sec-fetch-site': 'cross-site' }),
      host: await api({ oyun: 'a-oyun', kip: 'deneme' }, { host: 'kotu.example:' + kp, origin: 'http://kotu.example:' + kp }),
      duzMetin: await api({ oyun: 'a-oyun', kip: 'deneme' }, { 'content-type': 'text/plain' }),
      bilinmeyen: await api({ oyun: 'yok-boyle', kip: 'deneme' }),
      gizli: await api({ oyun: 'gizli', kip: 'deneme' }),
      derlenmemis: await api({ oyun: 'derlenmemis', kip: 'deneme' }),
      yol: await api({ oyun: '../a-oyun', kip: 'deneme' }),
      kip: await api({ oyun: 'a-oyun', kip: 'hepsi' }),
      adBos: await api({ oyun: 'a-oyun', kip: 'canli', kullanici: '' }),
      adBosluk: await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'ali veli' }),
      adHtml: await api({ oyun: 'a-oyun', kip: 'canli', kullanici: '<b>x</b>' }),
      adUzun: await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'a'.repeat(25) }),
      bozuk: await api('{oyun:')
    };
    const retKod = Object.fromEntries(Object.entries(ret).map(([a, r]) => [a, r.kod]));
    kontrol('POST /api/baslat başka siteden (Origin, Sec-Fetch-Site, Host) gelince ya da JSON değilse geri çevrilir', ret.yabanci.kod === 403 && ret.kaynaksiz.kod === 403 && ret.baskaSite.kod === 403 && ret.host.kod === 403 && ret.duzMetin.kod === 415, retKod);
    kontrol('POST /api/baslat bilinmeyen, gizli, derlenmemiş ya da yol içeren oyunu, bozuk kipi ve bozuk isteği geri çevirir', ret.bilinmeyen.kod === 404 && ret.gizli.kod === 404 && ret.derlenmemis.kod === 404 && ret.yol.kod === 404 && ret.kip.kod === 400 && ret.bozuk.kod === 400, retKod);
    kontrol('POST /api/baslat bozuk kullanıcı adını geri çevirir (boş, boşluklu, HTML, 24\'ten uzun)', ['adBos', 'adBosluk', 'adHtml', 'adUzun'].every(a => ret[a].kod === 400 && ret[a].j.alan === 'kullanici'), retKod);
    const sonra = JSON.parse((await al(A + '/api/oyunlar')).govde);
    kontrol('Geri çevrilen isteklerden sonra hiçbir oyun başlamamış, TikTok\'a bağlanılmamış', sonra.aktif === null && kayit() === '', { aktif: sonra.aktif, kayit: kayit() });
    kontrol('Ana sayfa kipi: çalışmayan oyunun sayfası ana sayfaya yönlenir; gizli ve bilinmeyen oyun 404', (await al(A + '/oyun/a-oyun/')).kod === 302 && (await al(A + '/oyun/a-oyun')).kod === 301 && (await al(A + '/onizleme/gizli/')).kod === 404 && (await al(A + '/oyun/yok/')).kod === 404);
    // Ana sayfa tarayıcıda: kartlar, metinler textContent ile, önizlemeler köprüsüz ve sessiz
    const actx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const ap = await sayfaAc(actx, A + '/'); await bekle(3500);
    const ad1 = await ap.evaluate(() => ({ kart: [...document.querySelectorAll('.kart h3')].map(h => h.textContent), yap: !document.getElementById('yap').hidden, etiket: document.querySelectorAll('.kart img, .kart h3 *, .kart .aciklama *').length, xss: !!window.__xss, ifr: [...document.querySelectorAll('.ekran iframe')].map(f => f.getAttribute('src')) }));
    kontrol('Ana sayfa: her oyunun kartı, ad ve cümle düz metin (HTML olarak yazılmaz), "Kendi oyununu yap" boş kabini', JSON.stringify(ad1.kart) === JSON.stringify(['Birinci Oyun', 'İkinci Oyun', '<img src=x onerror="window.__xss=1">Üç']) && ad1.yap && ad1.etiket === 0 && !ad1.xss, ad1);
    kontrol('Ana sayfa: görünen kartlarda canlı önizleme (/onizleme/<ad>/#yayin)', ad1.ifr.length === 3 && ad1.ifr.every(s => /^\/onizleme\/[\w-]+\/#yayin$/.test(s)), ad1.ifr);
    const cerceve = ap.frames().find(f => /\/onizleme\/a-oyun\//.test(f.url()));
    const on = cerceve ? await cerceve.evaluate(() => ({ kopru: typeof window.OYUN_KOPRU, kisi: CanliOyun.durum().kisi, ses: CanliOyun.durum().ses, sesDugme: getComputedStyle(document.getElementById('ses-cagri')).display, yayin: document.body.classList.contains('yayin'), geri: !!document.querySelector('.ana-don') })).catch(e => ({ hata: e.message })) : { hata: 'önizleme çerçevesi yok' };
    kontrol('Önizleme köprüye bağlanmaz, kendi kalabalığıyla oynar, sessizdir, ses düğmesi gizli, yalnız sahne', on.kopru === 'undefined' && on.kisi >= 3 && on.ses === false && on.sesDugme === 'none' && on.yayin && !on.geri, on);
    // Kullanıcı adı kayıtlı değilken: Dene öne çıkar; Yayına bağlan sayfayı geçirmez, kutuyu parlatır, ne yapılacağını söyler, odak alana gider
    const adsiz = await ap.evaluate(() => { const k = document.querySelector('.kart[data-oyun="a-oyun"]'), r = e => getComputedStyle(e.querySelector('i')).backgroundImage; return { kayitli: document.body.classList.contains('kayitli'), dene: r(k.querySelector('.dene')), bagla: r(k.querySelector('.bagla')), denePasif: k.querySelector('.dene').disabled, alt: k.querySelector('.bagla small').textContent }; });
    await ap.click('.kart[data-oyun="a-oyun"] .bagla'); await bekle(300);
    const bosAd = await ap.evaluate(() => ({ url: location.pathname, not: document.getElementById('ad-not').textContent, gorunur: !document.getElementById('ad-not').hidden, parlak: document.getElementById('hesap').classList.contains('uyar'), odak: document.activeElement && document.activeElement.id }));
    kontrol('Ana sayfa: ad kayıtlı değilken sarı Dene yanar ve çalışır, kırmızı Yayın sönüktür ve "önce adını kaydet" der', !adsiz.kayitli && !adsiz.denePasif && /255, 224, 122/.test(adsiz.dene) && !/255, 138, 112/.test(adsiz.bagla) && adsiz.alt === 'önce adını kaydet', adsiz);
    kontrol('Ana sayfa: adsız Yayına bağlan geçmez, kutuyu vurgular, ne yapılacağını söyler, odak alana gider', bosAd.url === '/' && bosAd.gorunur && bosAd.parlak && /adını yaz ve Kaydet/.test(bosAd.not) && bosAd.odak === 'kullanici' && kayit() === '', bosAd);
    // Yazmak tek başına kaydetmez; Kaydet (Enter) kaydeder, kutu "kayıtlı" hâline geçer, düğmeler yer değiştirir
    await ap.fill('#kullanici', 'ali veli'); await ap.press('#kullanici', 'Enter'); await bekle(200);
    const bozukAd = await ap.evaluate(() => ({ not: document.getElementById('ad-not').textContent, form: !document.getElementById('ad-form').hidden, kayitli: document.body.classList.contains('kayitli') }));
    kontrol('Ana sayfa: geçersiz ad kaydedilmez, alanın altında düz bir dille söylenir', bozukAd.form && !bozukAd.kayitli && /harf, rakam/.test(bozukAd.not), bozukAd);
    await ap.fill('#kullanici', '@Test_Kullanici'); await bekle(100);
    const yazinca = await ap.evaluate(() => document.body.classList.contains('kayitli') || (() => { try { return localStorage.getItem('fabrika-kullanici'); } catch (e) { return null; } })());
    await ap.press('#kullanici', 'Enter'); await bekle(300);
    const kay = await ap.evaluate(() => { const k = document.querySelector('.kart[data-oyun="a-oyun"]'), r = e => getComputedStyle(e.querySelector('i')).backgroundImage; return { gor: !document.getElementById('kayitli-gor').hidden, form: !document.getElementById('ad-form').hidden, ad: document.getElementById('kayitli-ad').textContent, etiket: document.querySelector('.kayit-etiket').textContent, dene: r(k.querySelector('.dene')), bagla: r(k.querySelector('.bagla')), alt: k.querySelector('.bagla small').textContent }; });
    kontrol('Ana sayfa: yazmak kaydetmez; Enter ile kaydedilir, "@ad Kayıtlı" görünür, kırmızı Yayın yanar ve "@ad" der', !yazinca && kay.gor && !kay.form && kay.ad === '@Test_Kullanici' && kay.etiket === 'Kayıtlı' && /255, 138, 112/.test(kay.bagla) && kay.alt === '@Test_Kullanici', { yazinca, ...kay });
    await ap.reload(); await bekle(800);
    const hatirla = await ap.evaluate(() => ({ ad: document.getElementById('kayitli-ad').textContent, gor: !document.getElementById('kayitli-gor').hidden }));
    kontrol('Ana sayfa: kayıtlı ad sayfa yeniden açılınca kayıtlı gelir', hatirla.gor && hatirla.ad === '@Test_Kullanici', hatirla);
    await ap.click('#degistir'); await bekle(150);
    const deg = await ap.evaluate(() => ({ form: !document.getElementById('ad-form').hidden, deger: document.getElementById('kullanici').value, kayitli: document.body.classList.contains('kayitli'), saklanan: localStorage.getItem('fabrika-kullanici'), vazgec: !document.getElementById('vazgec').hidden, odak: document.activeElement.id }));
    await ap.keyboard.press('Escape'); await bekle(150);
    const esc = await ap.evaluate(() => ({ gor: !document.getElementById('kayitli-gor').hidden, ad: document.getElementById('kayitli-ad').textContent }));
    await ap.click('#degistir'); await ap.fill('#kullanici', 'yarim_ad'); await ap.reload(); await bekle(800);
    const yenile = await ap.evaluate(() => document.getElementById('kayitli-ad').textContent);
    await ap.click('#degistir'); await ap.click('#vazgec'); await bekle(100);
    const vaz = await ap.evaluate(() => !document.getElementById('kayitli-gor').hidden);
    await ap.click('#degistir'); await ap.click('#kaydet'); await bekle(200);
    const degSonra = await ap.evaluate(() => document.getElementById('kayitli-ad').textContent);
    kontrol('Ana sayfa: değiştir kayıtlı adı silmez (düğmeler yanık kalır); Esc ve Vazgeç geri döner; kaydetmeden çıkınca eski ad durur; Kaydet yeniden kaydeder', deg.form && deg.deger === 'Test_Kullanici' && deg.kayitli && deg.saklanan === 'Test_Kullanici' && deg.vazgec && deg.odak === 'kullanici' && esc.gor && esc.ad === '@Test_Kullanici' && yenile === '@Test_Kullanici' && vaz && degSonra === '@Test_Kullanici', { ...deg, esc, yenile, vaz, sonra: degSonra });
    // Dene: API'ye sorar, oyunun sayfasına geçer; olaylar gelir; geri dönüş bağlantısı var
    await ap.click('.kart[data-oyun="a-oyun"] .dene'); await ap.waitForURL(/\/oyun\/a-oyun\/$/, { timeout: 8000 }).catch(() => { }); await bekle(4500);
    let od = await ap.evaluate(() => { const g = document.querySelector('.ana-don'); return { url: location.pathname, ...CanliOyun.durum(), geri: g && g.textContent, geriHref: g && g.getAttribute('href'), adres: document.getElementById('bag-adres').value, kimlikler: [...CanliOyun._test.D.oy.keys()].filter(x => !/^sahte:/.test(x)), hucre: document.getElementById('d-bag').textContent }; });
    kontrol('Ana sayfadan Dene: oyunun sayfası açılır, başlatmanın kimliğiyle bağlanır, sahte olaylar ("deneme:" kimlikli) işlenir, hücre "Deneme" der', od.url === '/oyun/a-oyun/' && od.bagli && od.alinan > 5 && od.sira.length > 0 && od.sira.every(x => x[0].startsWith('D. ')) && new RegExp('^ws://127[.]0[.]0[.]1:' + kp + '/olay/a-oyun/[0-9a-f]{12}$').test(od.adres) && od.kimlikler.length > 0 && od.kimlikler.every(x => /^deneme:/.test(x)) && od.hucre === 'Deneme', { url: od.url, bagli: od.bagli, alinan: od.alinan, adres: od.adres, kimlikler: od.kimlikler, hucre: od.hucre });
    const geriYayin = await ap.evaluate(() => { location.hash = '#yayin'; return new Promise(r => setTimeout(() => r(getComputedStyle(document.querySelector('.ana-don')).display), 300)); }).catch(e => e.message);
    kontrol('Ana sayfadan açılan oyunda "← Oyunlar" bağlantısı var, yalnız sahne görünümünde gizli', od.geri === '← Oyunlar' && od.geriHref === '/' && geriYayin === 'none', { geri: od.geri, yayinda: geriYayin });
    await ap.evaluate(() => { location.hash = ''; });
    // Güvenlik: olay akışını ve yayıncının adını başka bir site okuyamaz (ana sayfa kipi)
    const R = JSON.parse((await al(A + '/api/oyunlar')).govde).aktif.calistirma, dogru = '/olay/a-oyun/' + R, kendi = { Origin: 'http://127.0.0.1:' + kp };
    const gw = {
      dogru: await wsDene(kp, dogru, kendi), localhost: await wsDene(kp, dogru, { Host: 'localhost:' + kp, Origin: 'http://localhost:' + kp }),
      yabanciKaynak: await wsDene(kp, dogru, { Origin: 'http://kotu.example' }), kaynaksiz: await wsDene(kp, dogru), nul: await wsDene(kp, dogru, { Origin: 'null' }),
      yabanciHost: await wsDene(kp, dogru, { Host: 'kotu.example:' + kp, Origin: 'http://kotu.example:' + kp }),
      olay: await wsDene(kp, '/olay', kendi), herhangi: await wsDene(kp, '/herhangi', kendi), eskiBicim: await wsDene(kp, '/olay/a-oyun', kendi),
      yanlisKimlik: await wsDene(kp, '/olay/a-oyun/000000000000', kendi), baskaOyun: await wsDene(kp, '/olay/b-oyun/' + R, kendi)
    };
    const gwDurum = Object.fromEntries(Object.entries(gw).map(([a, v]) => [a, v.durum.slice(9, 12)]));
    kontrol('Ana sayfa kipinde soket yalnız kendi sayfasından ve çalışan başlatmanın adresinde (/olay/<oyun>/<kimlik>) açılır; başka kaynak, kaynaksız, null, başka Host, başka yol, eski biçim, yanlış kimlik geri çevrilir ve hiçbir olay almaz', gwDurum.dogru === '101' && gwDurum.localhost === '101' && /"tip":"kopru"/.test(gw.dogru.veri) && Object.entries(gwDurum).filter(([a]) => a !== 'dogru' && a !== 'localhost').every(([, v]) => v === '403') && Object.entries(gw).filter(([a]) => a !== 'dogru' && a !== 'localhost').every(([, v]) => !/"tip"/.test(v.veri)), gwDurum);
    const anaHost = await Promise.all(['/', '/durum', '/api/oyunlar', '/oyun/a-oyun/', '/onizleme/a-oyun/', '/oyun/a-oyun/muzik/liste.js'].map(y => hostAl(kp, y, 'kotu.example:' + kp)));
    kontrol('Ana sayfa kipinde her HTTP adresi başka Host\'la gelirse 403', anaHost.every(k => k === 403), anaHost);
    const bosListe = await al(A + '/oyun/a-oyun/muzik/liste.js');
    kontrol('Ana sayfa kipinde de hazır parçası olmayan oyunun muzik/liste.js isteği boş betikle karşılanır', bosListe.kod === 200 && /hazır parçası yok/.test(bosListe.govde), bosListe.kod);
    // Olay hızı: oyun ve kip birkaç kez değişince sahte olay saati çoğalmamalı
    const toplam = s => Object.values(s.sayac).reduce((x, y) => x + y, 0);
    const hiz = async () => { const a = JSON.parse((await al(A + '/durum')).govde); await bekle(4000); return toplam(JSON.parse((await al(A + '/durum')).govde)) - toplam(a); };
    const hiz1 = await hiz();
    for (const o of ['b-oyun', 'a-oyun', 'b-oyun', 'c-oyun', 'b-oyun']) await api({ oyun: o, kip: 'deneme' });
    const hiz2 = await hiz();
    kontrol('Oyun değiştirip geri dönünce olay hızı katlanmaz (eski sahte olay saati durur)', hiz1 >= 6 && hiz2 >= 6 && hiz2 <= hiz1 * 1.4, { once: hiz1, sonra: hiz2 });
    await bekle(2600); od = await ap.evaluate(() => ({ alinan: CanliOyun.durum().alinan, ortu: (document.getElementById('calistirma-ortu') || {}).textContent || '' })); await bekle(2000);
    const od2 = await ap.evaluate(() => CanliOyun.durum().alinan);
    kontrol('Başka oyun başlayınca eski oyunun açık sayfası olay almaz, sessizce ölü kalmaz: "Bu oyun artık çalışmıyor" örtüsü ve "Oyunlar\'a dön"', od2 === od.alinan && /artık çalışmıyor/.test(od.ortu) && /İkinci Oyun/.test(od.ortu) && /Oyunlar'a dön/.test(od.ortu), { once: od.alinan, sonra: od2, ortu: od.ortu });
    // Yayına bağlan (sahte kütüphane): bağlanır, olaylar oyuna akar
    await ap.goto(A + '/'); await bekle(800);
    await ap.click('.kart[data-oyun="a-oyun"] .bagla'); await ap.waitForURL(/\/oyun\/a-oyun\/$/, { timeout: 8000 }).catch(() => { });
    await ap.waitForFunction(() => CanliOyun.durum().sira.some(x => /^Canlı/.test(x[0])), null, { timeout: 10000 }).catch(() => { }); await bekle(1500);
    const cd = await ap.evaluate(() => ({ url: location.pathname, ...CanliOyun.durum(), ileti: document.getElementById('bag-ileti').textContent }));
    kontrol('Ana sayfadan Yayına bağlan: sahte kütüphaneyle bağlanır, olaylar oyuna akar; az önceki denemenin sahte adları yayına taşınmaz', cd.url === '/oyun/a-oyun/' && cd.bagli && cd.sira.some(x => x[0] === 'Canlı 0' && x[1] >= 7) && cd.sira.every(x => !x[0].startsWith('D. ')) && /@Test_Kullanici yayınına bağlandı/.test(cd.ileti) && kayit() === 'b', { sira: cd.sira.slice(0, 4), ileti: cd.ileti, kayit: kayit() });
    const ayni = await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' });
    kontrol('Aynı oyun aynı kipte yeniden istenince bağlantı koparılmaz', ayni.kod === 200 && kayit() === 'b', kayit());
    await api({ oyun: 'b-oyun', kip: 'canli', kullanici: 'baska.kisi' }); await bekle(300);
    await api({ oyun: 'b-oyun', kip: 'deneme' }); await bekle(1200);
    const durum2 = JSON.parse((await al(A + '/api/oyunlar')).govde);
    kontrol('Canlıdan canlıya ve canlıdan denemeye geçince eski TikTok bağlantısı kapanır (her bağlanmaya bir kopma)', kayit() === 'bkbk' && durum2.aktif.oyun === 'b-oyun' && durum2.aktif.kip === 'deneme', { kayit: kayit(), aktif: durum2.aktif });
    // "Şu an açık" şeridi ve Durdur (POST /api/durdur)
    const dur = (b2) => gonder(kp, '/api/durdur', {}, b2);
    const durRet = [await dur({ origin: 'http://kotu.example' }), await dur({ 'sec-fetch-site': 'cross-site' }), await dur({ 'content-type': 'text/plain' })].map(r => r.kod);
    kontrol('POST /api/durdur başka siteden ya da JSON olmadan gelince geri çevrilir, oyun sürer', JSON.stringify(durRet) === '[403,403,415]' && JSON.parse((await al(A + '/api/oyunlar')).govde).aktif.oyun === 'b-oyun', durRet);
    await ap.goto(A + '/'); await bekle(1200);
    const serit = await ap.evaluate(() => ({ gor: !document.getElementById('calisan').hidden, oyun: document.getElementById('cal-oyun').textContent, kip: document.getElementById('cal-kip').textContent, durum: document.getElementById('cal-durum').textContent, don: document.getElementById('cal-don').getAttribute('href') }));
    kontrol('Ana sayfa: bir oyun çalışırken "Şu an açık" şeridi oyunu, kipi, motorun durum cümlesini ve Oyuna dön bağlantısını gösterir', serit.gor && serit.oyun === 'İkinci Oyun' && serit.kip === 'deneme' && /Deneme kipi/.test(serit.durum) && serit.don === '/oyun/b-oyun/', serit);
    await ap.click('#cal-durdur'); await bekle(600);
    const durSonra = await ap.evaluate(() => ({ gor: !document.getElementById('calisan').hidden, rozet: [...document.querySelectorAll('.acik-rozet')].some(r => !r.hidden) }));
    const s1 = toplam(JSON.parse((await al(A + '/durum')).govde)); await bekle(1500); const s2 = toplam(JSON.parse((await al(A + '/durum')).govde));
    const bos2 = JSON.parse((await al(A + '/api/oyunlar')).govde);
    kontrol('Ana sayfadan Durdur: sahte olaylar durur, motor boşta kalır, şerit kaybolur', !durSonra.gor && !durSonra.rozet && s1 === s2 && bos2.aktif === null && (await al(A + '/oyun/b-oyun/')).kod === 302, { serit: durSonra, olay: [s1, s2], aktif: bos2.aktif });
    await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' }); await bekle(900);
    const seritCanli = await ap.evaluate(() => new Promise(r => setTimeout(() => r({ gor: !document.getElementById('calisan').hidden, kip: document.getElementById('cal-kip').textContent, canli: document.getElementById('calisan').classList.contains('canli'), yardim: document.getElementById('yardim-ac').classList.contains('parla'), durum: document.getElementById('cal-durum').textContent }), 2300)));
    const durCanli = await dur(); await bekle(400);
    kontrol('Canlı yayında şerit "@ad yayını" ve motorun cümlesini gösterir; Durdur TikTok bağlantısını kapatır', seritCanli.gor && seritCanli.canli && seritCanli.yardim && seritCanli.kip === '@Test_Kullanici yayını' && /@Test_Kullanici yayınına bağlandı/.test(seritCanli.durum) && durCanli.kod === 200 && durCanli.j.aktif === null && kayit() === 'bkbkbk', { serit: seritCanli, kayit: kayit() });
    const yeniden = await api({ oyun: 'a-oyun', kip: 'deneme' }); const y1 = toplam(JSON.parse((await al(A + '/durum')).govde)); await bekle(2000); const y2 = toplam(JSON.parse((await al(A + '/durum')).govde));
    kontrol('Durdurduktan sonra yeniden başlatmak çalışır (olaylar yine gelir)', yeniden.kod === 200 && y2 - y1 >= 3, { kod: yeniden.kod, olay: y2 - y1 });
    // İki sekme (denetçinin senaryosu): A sekmesi Dene ile açıldı, sonra aynı oyun canlı başlatıldı. A sekmesi yeni
    // başlatmaya kendiliğinden geçer: yalnız gerçek izleyiciler kalır, sahte adlar ve sahte olaylar karışmaz.
    await api({ oyun: 'a-oyun', kip: 'deneme' });
    const t2 = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const ta = await sayfaAc(t2, A + '/oyun/a-oyun/'); await bekle(3500);
    const taOnce = await ta.evaluate(() => CanliOyun.durum().sira.map(x => x[0]));
    await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' });
    let taSon = null;
    for (let i = 0; i < 40; i++) {
      await bekle(400);
      taSon = await ta.evaluate(() => ({ sira: CanliOyun.durum().sira.map(x => x[0]), hucre: document.getElementById('d-bag').textContent, adres: document.getElementById('bag-adres').value })).catch(() => null);
      if (taSon && taSon.sira.some(x => /^Canlı/.test(x)) && taSon.hucre === 'Canlı') break;
    }
    const yeniR = JSON.parse((await al(A + '/api/oyunlar')).govde).aktif.calistirma;
    await bekle(1500);
    const taKesin = await ta.evaluate(() => CanliOyun.durum().sira.map(x => x[0])).catch(() => []);
    kontrol('İki sekme: Dene ile açık kalan sekme, aynı oyun canlı başlatılınca kendiliğinden yeni başlatmaya geçer; yalnız gerçek izleyiciler, hücre "Canlı"', taOnce.some(x => x.startsWith('D. ')) && taSon && taSon.hucre === 'Canlı' && taSon.adres.endsWith('/' + yeniR) && taKesin.length > 0 && taKesin.every(x => !x.startsWith('D. ')), { once: taOnce.slice(0, 3), sonra: taKesin, hucre: taSon && taSon.hucre });
    await t2.close();
    // Canlıya geçerken temizlik: yalnız sahte kimlikler ("deneme:" ve eski sabit sekiz) silinir; "deneme_" ile başlayan
    // gerçek bir TikTok adı kalır.
    const t3 = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await t3.addInitScript(an => { try { if (!sessionStorage.getItem('tohum')) { sessionStorage.setItem('tohum', '1'); localStorage.setItem(an, JSON.stringify({ t: Date.now(), oyuncular: [{ id: 'deneme:ayse', ad: 'D. ayse', jeton: 90 }, { id: 'deneme_memo', ad: 'D. memo', jeton: 80 }, { id: 'deneme_gercek', ad: 'Gerçek Biri', jeton: 70 }] })); } } catch (e) { } }, SIRA_ANAHTAR);
    const tc = await sayfaAc(t3, A + '/oyun/a-oyun/');
    await tc.waitForFunction(() => window.CanliOyun && CanliOyun.durum().bagli, null, { timeout: 15000 }).catch(() => { });
    const temizlik = await tc.evaluate(an => ({ anahtar: an, kayit: JSON.parse(localStorage.getItem(an)).oyuncular.map(x => x.id), sahnede: [...CanliOyun._test.D.oy.keys()] }), SIRA_ANAHTAR);
    kontrol('Canlı sayfada saklı sıradan yalnız sahte izleyiciler silinir ("deneme:" ve eski sabit kimlikler); "deneme_gercek" gibi gerçek bir ad kalır', temizlik.sahnede.includes('deneme_gercek') && !temizlik.sahnede.includes('deneme:ayse') && !temizlik.sahnede.includes('deneme_memo'), temizlik);
    await t3.close();
    await gonder(kp, '/api/durdur', {});
    // Müzik: ana sayfa kipinde her oyunun kendi muzik/ klasörü kendi adresinden
    fs.mkdirSync(path.join(kl, 'oyunlar', 'a-oyun', 'muzik'), { recursive: true }); fs.writeFileSync(path.join(kl, 'oyunlar', 'a-oyun', 'muzik', '_t.js'), 'mz');
    const mz2 = [(await al(A + '/oyun/a-oyun/muzik/_t.js')).govde, (await al(A + '/oyun/b-oyun/muzik/_t.js')).kod, (await al(A + '/oyun/a-oyun/muzik/..%2F..%2Fkopru.js')).kod, (await al(A + '/onizleme/a-oyun/muzik/_t.js')).kod];
    kontrol('Ana sayfa kipi: oyunun hazır müziği kendi adresinden gelir; başka oyununki, klasör dışı ve önizlemeden gelmez', mz2[0] === 'mz' && mz2.slice(1).every(k => k === 404), mz2);
    // İkinci kez çift tıklanınca: aynı kapıda ana sayfa zaten açık
    const ikinci = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); let ikinciKod = null; ikinci.on('exit', k => ikinciKod = k); await bekle(1800);
    kontrol('Ana sayfa zaten açıkken ikinci kez açılınca düz bir dille söyleyip hatasız kapanır', ikinciKod === 0 && /zaten açık/.test(ikinci.cikti) && !/Error|hata/i.test(ikinci.cikti), { kod: ikinciKod, cikti: ikinci.cikti.trim() });
    ikinci.kill('SIGKILL'); await actx.close(); ana.kill('SIGKILL');
  }
  // ---- 8. yayıncı paketi düzeni ana sayfa kipinde: tek oyun
  {
    const kl = path.join(GECICI, 'paket-ana'), kp = P + 8, A = 'http://127.0.0.1:' + kp;
    fs.mkdirSync(kl); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js')); fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyun.html')); fs.copyFileSync(path.join(KOK, 'cekirdek', 'ana-sayfa.html'), path.join(kl, 'ana-sayfa.html'));
    fs.mkdirSync(path.join(kl, 'oyunlar', 'baska'), { recursive: true }); fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyunlar', 'baska', 'oyun.html')); // pakette olmaz; olsa da gösterilmez
    const pk = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await bekle(800); await acik(kp);
    const l = JSON.parse((await al(A + '/api/oyunlar')).govde), baslik = /<title>([^<]*)<\/title>/.exec(fs.readFileSync(OYUN_HTML, 'utf8'))[1];
    kontrol('Paket düzeni, ana sayfa kipi: yalnız paketteki tek oyun (oyun.json yoksa adı sayfa başlığından)', l.paket === true && l.oyunlar.length === 1 && l.oyunlar[0].id === 'oyun' && l.oyunlar[0].ad === baslik && (await al(A + '/')).kod === 200, l.oyunlar);
    fs.writeFileSync(path.join(kl, 'oyun.json'), JSON.stringify({ ad: 'Paket Oyunu', paket: 'paket-oyunu', aciklama: 'Tek cümle.', vitrin: false }));
    const l2 = JSON.parse((await al(A + '/api/oyunlar')).govde);
    const pb = await gonder(kp, '/api/baslat', { oyun: 'paket-oyunu', kip: 'deneme' }); await bekle(300);
    const pg = await al(A + '/oyun/paket-oyunu/');
    kontrol('Paket düzeni: oyun.json\'daki ad, cümle ve paket adı kullanılır, vitrin ayarı yok sayılır; Dene ile açılır', JSON.stringify(l2.oyunlar) === JSON.stringify([{ id: 'paket-oyunu', ad: 'Paket Oyunu', aciklama: 'Tek cümle.' }]) && pb.kod === 200 && pg.kod === 200 && /\/olay\/paket-oyunu/.test(pg.govde), { liste: l2.oyunlar, kod: pb.kod, sayfa: pg.kod });
    pk.kill('SIGKILL');
  }
  // ---- 9. açılış: kütüphaneyi motor indirir (taklitle), sayfa durumu gösterir; deneme indirme sürerken de çalışır
  {
    const kp = P + 9, A = 'http://127.0.0.1:' + kp;
    const kur = (ad, mod) => {
      const kl = path.join(GECICI, ad);
      fs.mkdirSync(path.join(kl, 'oyunlar', 'a-oyun'), { recursive: true }); fs.mkdirSync(path.join(kl, 'cekirdek'));
      fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyunlar', 'a-oyun', 'oyun.html'));
      fs.writeFileSync(path.join(kl, 'oyunlar', 'a-oyun', 'oyun.json'), JSON.stringify({ ad: 'Birinci Oyun' }));
      fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js'));
      fs.copyFileSync(path.join(KOK, 'cekirdek', 'ana-sayfa.html'), path.join(kl, 'cekirdek', 'ana-sayfa.html'));
      fs.writeFileSync(path.join(kl, 'kurulum-mod.txt'), mod);
      return kl;
    };
    const sayac = kl => { try { return fs.readFileSync(path.join(kl, 'kurulum-sayac.txt'), 'utf8'); } catch (e) { return ''; } };
    const durum = async () => JSON.parse((await al(A + '/api/oyunlar')).govde);
    const toplamOlay = async () => Object.values(JSON.parse((await al(A + '/durum')).govde).sayac).reduce((x, y) => x + y, 0);
    const api = (yol, g, b2) => gonder(kp, yol, g, b2);
    // 9a. indirme sürüyor → biter
    const kl = kur('kurulum-iyi', 'tamam 7000');
    let m = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await bekle(700); await acik(kp);
    const d1 = await durum();
    kontrol('Açılış: kütüphane yoksa motor hemen sunar ve kendisi indirmeye başlar (durum "iniyor", saniye sayılır)', d1.kutuphane && d1.kutuphane.durum === 'iniyor' && d1.kutuphane.sure >= 0 && /kütüphanesi iniyor/.test(m.cikti) && sayac(kl) === 't', { kutuphane: d1.kutuphane, sayac: sayac(kl) });
    const canliErken = await api('/api/baslat', { oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' });
    kontrol('Açılış: kütüphane inmeden canlı başlatma açık bir dille geri çevrilir', canliErken.kod === 409 && canliErken.j.alan === 'kutuphane' && /hâlâ iniyor/.test(canliErken.j.hata) && (await durum()).aktif === null, canliErken.j);
    const denemeErken = await api('/api/baslat', { oyun: 'a-oyun', kip: 'deneme' }); const o1 = await toplamOlay(); await bekle(1300); const o2 = await toplamOlay();
    kontrol('Açılış: indirme sürerken Dene çalışır, sahte olaylar akar', denemeErken.kod === 200 && o2 - o1 >= 2, { kod: denemeErken.kod, olay: o2 - o1 });
    await api('/api/durdur', {});
    // sayfa: açılış ekranı indirmeyi gösterir, "Beklemeden dene" salona sokar; kırmızı düğme sönük, basınca söyler
    const kctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await kctx.addInitScript(() => { try { localStorage.setItem('fabrika-kullanici', 'Test_Kullanici'); } catch (e) { } });
    const kpg = await sayfaAc(kctx, A + '/'); await bekle(1600);
    const ekr = await kpg.evaluate(() => ({ acik: !document.getElementById('acilis').hidden && !document.getElementById('acilis').classList.contains('kalk'), motor: document.getElementById('a-motor').dataset.d, kutu: document.getElementById('a-kutu').dataset.d, kutuYazi: document.getElementById('a-kutu').textContent, beklemeden: !document.getElementById('beklemeden').hidden, inert: document.getElementById('sayfa').hasAttribute('inert') }));
    kontrol('Açılış ekranı: motor çalışıyor, kütüphane iniyor (saniyeyle, uydurma yüzde yok), salon arkada kapalı, "Beklemeden dene" var', ekr.acik && ekr.motor === 'tamam' && ekr.kutu === 'suruyor' && /iniyor/.test(ekr.kutuYazi) && /\d+ sn/.test(ekr.kutuYazi) && !/%/.test(ekr.kutuYazi) && ekr.beklemeden && ekr.inert, ekr);
    await kpg.click('#beklemeden'); await bekle(700);
    const sln = await kpg.evaluate(() => ({ kalk: document.getElementById('acilis').classList.contains('kalk'), inert: document.getElementById('sayfa').hasAttribute('inert'), alt: document.querySelector('.kart .bagla small').textContent, yok: document.body.classList.contains('kutuphane-yok'), not: document.getElementById('kutu-not').hidden ? '' : document.getElementById('kutu-not').textContent }));
    await kpg.click('.kart .bagla'); await bekle(300);
    const kirmizi = await kpg.evaluate(() => ({ url: location.pathname, ileti: document.querySelector('.kart .kart-ileti').textContent }));
    kontrol('"Beklemeden dene": salon açılır; kırmızı düğme "kütüphane iniyor" der, sönüktür, basınca bekletmeden söyler; altta indirme notu', sln.kalk && !sln.inert && sln.alt === 'kütüphane iniyor' && sln.yok && /iniyor/.test(sln.not) && kirmizi.url === '/' && /hâlâ iniyor/.test(kirmizi.ileti), { ...sln, ...kirmizi });
    for (let i = 0; i < 60 && (await durum()).kutuphane.durum !== 'hazir'; i++) await bekle(200);
    await bekle(2600);
    const sonra = await kpg.evaluate(() => ({ alt: document.querySelector('.kart .bagla small').textContent, yok: document.body.classList.contains('kutuphane-yok'), ileti: document.querySelector('.kart .kart-ileti').textContent, not: document.getElementById('kutu-not').textContent }));
    const canliSonra = await api('/api/baslat', { oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' });
    kontrol('İndirme bitince kırmızı düğmeler kendiliğinden yanar ("@ad"), not "indi" der; canlı başlatma kabul edilir', (await durum()).kutuphane.durum === 'hazir' && sonra.alt === '@Test_Kullanici' && !sonra.yok && sonra.ileti === '' && /indi/.test(sonra.not) && canliSonra.kod === 200 && /kütüphanesi indi/.test(m.cikti), { ...sonra, canli: canliSonra.kod });
    await api('/api/durdur', {});
    // motor kapanırsa aynı açılış sahnesi "Motor çalışmıyor" der; motor yeniden açılınca sayfa kendiliğinden toparlanır
    m.kill('SIGKILL'); await bekle(5500);
    const kopuk = await kpg.evaluate(() => ({ acik: !document.getElementById('acilis').hidden && !document.getElementById('acilis').classList.contains('kalk'), motor: document.getElementById('a-motor').textContent }));
    m = baslat(kl, ['--ana-sayfa', '--port', String(kp)]);
    await kpg.waitForFunction(() => document.getElementById('acilis').classList.contains('kalk'), null, { timeout: 12000 }).catch(() => { });
    const toparlandi = await kpg.evaluate(() => ({ kalk: document.getElementById('acilis').classList.contains('kalk'), kart: document.querySelectorAll('.kart').length })).catch(e => ({ hata: e.message }));
    kontrol('Motor kapanınca açılış sahnesi "Motor çalışmıyor" der; motor geri gelince sayfa kendiliğinden salona döner', kopuk.acik && /Motor çalışmıyor\. BASLAT\.bat/.test(kopuk.motor) && toparlandi.kalk && toparlandi.kart === 1, { kopuk, toparlandi });
    await kctx.close(); m.kill('SIGKILL'); await bekle(400);
    // 9b. indirme başarısız → sayfadan yeniden dene → iner
    const kl2 = kur('kurulum-hata', 'hata 300');
    m = baslat(kl2, ['--ana-sayfa', '--port', String(kp)]); await acik(kp);
    for (let i = 0; i < 100 && (await durum()).kutuphane.durum !== 'hata'; i++) await bekle(100);
    const h1 = await durum();
    const hDeneme = await api('/api/baslat', { oyun: 'a-oyun', kip: 'deneme' }); await api('/api/durdur', {});
    const hCanli = await api('/api/baslat', { oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' });
    kontrol('İndirme başarısız: durum "hata" ve düz bir neden; Dene yine çalışır, canlı geri çevrilir', h1.kutuphane.durum === 'hata' && /İndirilemedi\. İnternet bağlantını kontrol et\./.test(h1.kutuphane.neden) && hDeneme.kod === 200 && hCanli.kod === 409 && /indirilemedi/.test(m.cikti), { kutuphane: h1.kutuphane, deneme: hDeneme.kod, canli: hCanli.kod });
    const hctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const hpg = await sayfaAc(hctx, A + '/'); await bekle(1600);
    const hEkr = await hpg.evaluate(() => ({ kutu: document.getElementById('a-kutu').dataset.d, yazi: document.getElementById('a-kutu').textContent, yeniden: !document.getElementById('yeniden').hidden, yalniz: !document.getElementById('yalniz-dene').hidden }));
    kontrol('Açılış ekranı başarısızlığı söyler: "İndirilemedi. İnternet bağlantını kontrol et.", "Yeniden dene" ve "Şimdilik yalnız dene"', hEkr.kutu === 'hata' && /İndirilemedi\. İnternet bağlantını kontrol et\./.test(hEkr.yazi) && hEkr.yeniden && hEkr.yalniz, hEkr);
    const yabanci = await api('/api/kutuphane', {}, { origin: 'http://kotu.example' });
    kontrol('Yeniden deneme isteği başka siteden gelirse geri çevrilir, indirme başlamaz', yabanci.kod === 403 && sayac(kl2) === 'h', { kod: yabanci.kod, sayac: sayac(kl2) });
    await hpg.click('#yalniz-dene'); await bekle(700);
    const hSalon = await hpg.evaluate(() => ({ kalk: document.getElementById('acilis').classList.contains('kalk'), not: document.getElementById('kutu-not').textContent, yeniden: !document.getElementById('kutu-yeniden').hidden, alt: document.querySelector('.kart .bagla small').textContent }));
    kontrol('"Şimdilik yalnız dene": salon açılır; altta sessiz bir not ve "Yeniden dene" kalır, kırmızı düğme "kütüphane inmedi" der', hSalon.kalk && /İndirilemedi/.test(hSalon.not) && hSalon.yeniden && hSalon.alt === 'kütüphane inmedi', hSalon);
    fs.writeFileSync(path.join(kl2, 'kurulum-mod.txt'), 'tamam 600');
    await hpg.click('#kutu-yeniden'); await bekle(300);
    const hIniyor = (await durum()).kutuphane.durum;
    for (let i = 0; i < 30 && (await durum()).kutuphane.durum !== 'hazir'; i++) await bekle(200);
    await bekle(2300);
    const hSon = await hpg.evaluate(() => ({ alt: document.querySelector('.kart .bagla small').textContent, yok: document.body.classList.contains('kutuphane-yok') }));
    kontrol('Sayfadan "Yeniden dene" indirmeyi yeniden başlatır; bitince düğmeler kendiliğinden hazır olur', hIniyor === 'iniyor' && sayac(kl2) === 'ht' && (await durum()).kutuphane.durum === 'hazir' && hSon.alt === 'önce adını kaydet' && !hSon.yok, { hIniyor, sayac: sayac(kl2), ...hSon });
    await hctx.close(); m.kill('SIGKILL');
    // 9c. kütüphane zaten kuruluysa açılış kısa sürer; sayfa hiç motor yokken açılırsa (dosyadan) bunu söyler
    m = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await bekle(600); await acik(kp);
    const rctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await rctx.addInitScript(() => { if (window === window.top) document.addEventListener('DOMContentLoaded', () => { window.__ilk = !document.getElementById('acilis').hidden; }); });
    const rp = await sayfaAc(rctx, A + '/');
    const rms = await rp.waitForFunction(() => document.getElementById('acilis').classList.contains('kalk') && Math.round(performance.now()), null, { timeout: 8000 }).then(h => h.jsonValue()).catch(() => -1);
    const rIlk = await rp.evaluate(() => window.__ilk);
    kontrol('Kütüphane kuruluyken: açılış sahnesi ilk karede vardır, salon kısa sürede (3 sn altında) tek geçişle açılır, indirme başlamaz', rIlk === true && rms > 0 && rms < 3000 && sayac(kl) === 't' && (await durum()).kutuphane.durum === 'hazir', { ilk: rIlk, ms: rms, sayac: sayac(kl) });
    await rctx.close(); m.kill('SIGKILL');
    const zctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const zp = await zctx.newPage(); await zp.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; });
    await zp.goto(require('url').pathToFileURL(path.join(KOK, 'cekirdek', 'ana-sayfa.html')).href); await bekle(1500);
    const yok = await zp.evaluate(() => ({ acik: !document.getElementById('acilis').hidden, motor: document.getElementById('a-motor').dataset.d, yazi: document.getElementById('a-motor').textContent, inert: document.getElementById('sayfa').hasAttribute('inert') }));
    kontrol('Motor hiç çalışmıyorken açılan sayfa: açılış sahnesi "Motor çalışmıyor. BASLAT.bat dosyasına çift tıkla." der, salon kapalı kalır', yok.acik && yok.motor === 'hata' && /Motor çalışmıyor\. BASLAT\.bat dosyasına çift tıkla\./.test(yok.yazi) && yok.inert, yok);
    await zctx.close();
  }
  // ---- 10. denetim düzeltmeleri: yeniden basınca hemen dene, Bağlantı hücresi, eski/yeni uyumu, kapı iletileri, ad kuralları
  {
    const kp = P + 9, A = 'http://127.0.0.1:' + kp, api = g => gonder(kp, '/api/baslat', g);
    const kl = path.join(GECICI, 'denetim');
    fs.mkdirSync(path.join(kl, 'oyunlar', 'a-oyun'), { recursive: true }); fs.mkdirSync(path.join(kl, 'cekirdek'));
    fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyunlar', 'a-oyun', 'oyun.html'));
    fs.writeFileSync(path.join(kl, 'oyunlar', 'a-oyun', 'oyun.json'), JSON.stringify({ ad: 'Birinci Oyun' }));
    fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js'));
    fs.copyFileSync(path.join(KOK, 'cekirdek', 'ana-sayfa.html'), path.join(kl, 'cekirdek', 'ana-sayfa.html'));
    // Sahte kütüphane: canli-mod.txt "kapali" ise yayın açık değil der, "acik" ise bağlanır ve yorum yollar.
    fs.mkdirSync(path.join(kl, 'node_modules/tiktok-live-connector'), { recursive: true });
    fs.writeFileSync(path.join(kl, 'node_modules/tiktok-live-connector/index.js'), `const E=require('events'),fs=require('fs');class WebcastPushConnection extends E{connect(){const m=fs.readFileSync('canli-mod.txt','utf8').trim();if(m!=='acik')return Promise.reject(new Error('LIVE has ended'));let n=0;this.t=setInterval(()=>{n++;this.emit('chat',{uniqueId:'gercek_'+(n%2),nickname:'Gerçek '+(n%2),comment:'selam'});},300);return Promise.resolve({roomId:'1'});}disconnect(){clearInterval(this.t);}}module.exports={WebcastPushConnection};`);
    fs.writeFileSync(path.join(kl, 'canli-mod.txt'), 'kapali');
    let m = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await bekle(700); await acik(kp);
    const durum = async () => JSON.parse((await al(A + '/api/oyunlar')).govde);
    await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' }); await bekle(700);
    const bek = await durum();
    const ctx10 = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const op = await sayfaAc(ctx10, A + '/oyun/a-oyun/'); await bekle(1500);
    const hucreBek = await op.evaluate(() => ({ hucre: document.getElementById('d-bag').textContent, alt: document.getElementById('d-bag-alt').textContent, rozet: document.getElementById('bag-rozet').textContent }));
    kontrol('Yayın açık değilken Bağlantı hücresi "Canlı" demez: "Yayın yok / yayın henüz açık değil", rozet "Yayın bekleniyor"', bek.aktif.baglanti === 'bekliyor' && /canlı yayında değil\. 15 saniye sonra/.test(bek.durum) && hucreBek.hucre === 'Yayın yok' && /henüz açık değil/.test(hucreBek.alt) && hucreBek.rozet === 'Yayın bekleniyor', { durum: bek.durum, ...hucreBek });
    fs.writeFileSync(path.join(kl, 'canli-mod.txt'), 'acik');
    const t0 = Date.now(); await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' });
    let bagli = null; for (let i = 0; i < 20; i++) { bagli = await durum(); if (bagli.aktif.baglanti === 'bagli') break; await bekle(150); }
    const sure = Date.now() - t0; await bekle(1200);
    const hucreBagli = await op.evaluate(() => ({ hucre: document.getElementById('d-bag').textContent, sira: CanliOyun.durum().sira.map(x => x[0]) }));
    kontrol('Bekleme sürerken Yayın\'a yeniden basmak hemen yeniden dener (15-120 sn beklemez); bağlanınca hücre "Canlı" der, sayfa aynı başlatmada kalır', bagli.aktif.baglanti === 'bagli' && sure < 2500 && bagli.aktif.calistirma === bek.aktif.calistirma && hucreBagli.hucre === 'Canlı' && hucreBagli.sira.some(x => /^Gerçek/.test(x)), { sure, ...hucreBagli });
    await gonder(kp, '/api/durdur', {}); await bekle(2600);
    const durdu = await op.evaluate(() => (document.getElementById('calistirma-ortu') || {}).textContent || '');
    kontrol('Durdur sonrası açık kalan oyun sayfası "Bu oyun artık çalışmıyor / durduruldu" örtüsü gösterir', /artık çalışmıyor/.test(durdu) && /durduruldu/.test(durdu), durdu);
    await ctx10.close();
    // ad kuralları, saklama, sekmeler arası, önizleme hatası, Durdur sonrası odak, yeniden kurulumda odak
    const sa = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const hp = await sayfaAc(sa, A + '/'); await bekle(2500);
    const adDene = async v => { await hp.fill('#kullanici', v); await hp.press('#kullanici', 'Enter'); await bekle(150); return hp.evaluate(() => ({ kayit: localStorage.getItem('fabrika-kullanici'), not: document.getElementById('ad-not').textContent, kayitli: document.body.classList.contains('kayitli') })); };
    const uzun = await adDene('@' + 'b'.repeat(25)), nokta = await adDene('ali.'), bosluklu = await adDene(' @' + 'c'.repeat(24) + ' ');
    kontrol('Ad önce temizlenir sonra denetlenir: 25 karakter "çok uzun" (kesilip kaydedilmez), noktayla biten ad geri çevrilir, " @" ile yapıştırılan 24 karakter tam kaydedilir', !uzun.kayit && /çok uzun/.test(uzun.not) && !nokta.kayit && /noktayla bitmez/.test(nokta.not) && bosluklu.kayit === 'c'.repeat(24), { uzun, nokta, bosluklu });
    const srvNokta = (await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'ali.' })).kod, srvIyi = (await api({ oyun: 'a-oyun', kip: 'canli', kullanici: 'a.b_c' })).kod;
    kontrol('Motor da noktayla biten adı geri çevirir, geçerli adı kabul eder', srvNokta === 400 && srvIyi === 200, { srvNokta, srvIyi });
    await gonder(kp, '/api/durdur', {});
    const hp2 = await sayfaAc(sa, A + '/'); await bekle(1500);
    await hp.click('#degistir'); await hp.fill('#kullanici', 'birinci_ad'); await hp.press('#kullanici', 'Enter'); await bekle(500);
    await hp2.waitForFunction(() => document.getElementById('kayitli-ad').textContent === '@birinci_ad', null, { timeout: 5000 }).catch(() => { });
    const ikinci = await hp2.evaluate(() => document.getElementById('kayitli-ad').textContent);
    kontrol('İkinci sekme ad değişikliğini kendiliğinden izler (storage olayı)', ikinci === '@birinci_ad', ikinci);
    await hp2.close();
    // Durdur sonrası odak durdurulan oyunun Dene düğmesine geçer
    await api({ oyun: 'a-oyun', kip: 'deneme' }); await bekle(2600);
    await hp.click('#cal-durdur'); await hp.waitForFunction(() => document.getElementById('calisan').hidden && document.activeElement && document.activeElement !== document.body, null, { timeout: 8000 }).catch(() => { });
    const odak = await hp.evaluate(() => { const e = document.activeElement; return { sinif: e && e.className, oyun: e && e.closest('.kart') && e.closest('.kart').dataset.oyun }; });
    kontrol('Durdur sonrası odak <body>\'ye düşmez: durdurulan oyunun Dene düğmesine geçer', /tus dene/.test(odak.sinif) && odak.oyun === 'a-oyun', odak);
    // liste yeniden kurulunca odak korunur, gözcüler sızmaz
    await hp.focus('.kart[data-oyun="a-oyun"] .dene');
    fs.writeFileSync(path.join(kl, 'oyunlar', 'a-oyun', 'oyun.json'), JSON.stringify({ ad: 'Yeni Adlı Oyun' }));
    await hp.waitForFunction(() => document.querySelector('.kart h3') && document.querySelector('.kart h3').textContent === 'Yeni Adlı Oyun', null, { timeout: 10000 }).catch(() => { }); await bekle(300);
    const yeniden = await hp.evaluate(() => ({ ad: document.querySelector('.kart h3').textContent, odak: document.activeElement && document.activeElement.className, iframe: document.querySelectorAll('.ekran iframe').length }));
    kontrol('Oyun listesi değişip salon yeniden kurulunca odak aynı düğmede kalır, önizleme sayısı kabin sayısını geçmez', yeniden.ad === 'Yeni Adlı Oyun' && /tus dene/.test(yeniden.odak) && yeniden.iframe <= 1, yeniden);
    await sa.close();
    const sd = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await sd.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('dolu', 'QuotaExceededError'); }; });
    const dp = await sayfaAc(sd, A + '/'); await bekle(2200);
    await dp.fill('#kullanici', 'dolu_depo'); await dp.press('#kullanici', 'Enter'); await dp.waitForFunction(() => document.body.classList.contains('kayitli'), null, { timeout: 5000 }).catch(() => { });
    const dolu = await dp.evaluate(() => ({ kayitli: document.body.classList.contains('kayitli'), uyari: !document.getElementById('kayit-uyari').hidden && document.getElementById('kayit-uyari').textContent }));
    kontrol('Tarayıcı adı saklayamıyorsa (dolu / kapalı) ad bu sayfa için kullanılır ve saklanamadığı söylenir', dolu.kayitli && /saklanamadı/.test(dolu.uyari), dolu);
    await sd.close();
    const so = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const opg = await so.newPage(); await opg.route(/\/onizleme\//, r => r.abort()); await opg.goto(A + '/'); await opg.waitForFunction(() => { const e = document.querySelector('.kart .bekle'); return e && e.textContent === 'Önizleme açılamadı'; }, null, { timeout: 15000 }).catch(() => { });
    const onz = await opg.evaluate(() => { const f = document.querySelector('.ekran iframe'); return { gorunur: f ? getComputedStyle(f).visibility : 'yok', yazi: document.querySelector('.kart .bekle').textContent }; });
    kontrol('Önizleme açılamazsa beyaz bir kutu görünmez: iframe gizli, kabinde "Önizleme açılamadı" yazar', onz.gorunur === 'hidden' && onz.yazi === 'Önizleme açılamadı', onz);
    await so.close();
    // Google Fonts hiç yanıt vermezse (güvenlik duvarı, takılan ağ) sayfa yine açılır: yazı tipi sayfayı bekletmez
    const sf = await b.newContext({ viewport: { width: 1366, height: 768 } });
    const fp = await sf.newPage(); await fp.route(/fonts\.(googleapis|gstatic)\.com/, () => { /* hiç yanıtlama */ });
    await fp.goto(A + '/', { waitUntil: 'commit' }); await fp.waitForFunction(() => document.getElementById('acilis') && document.getElementById('acilis').classList.contains('kalk'), null, { timeout: 15000 }).catch(() => { });
    const yaziTipi = await fp.evaluate(() => ({ motor: document.getElementById('a-motor').dataset.d, kabin: document.querySelectorAll('.kart').length, salon: document.getElementById('acilis').classList.contains('kalk') }));
    const np = await sf.newPage(); await np.route(/fonts\.(googleapis|gstatic)\.com/, () => { });
    await np.goto(require('url').pathToFileURL(path.join(KOK, 'cekirdek', 'node-yok.html')).href, { waitUntil: 'commit' }); await bekle(1500);
    const nodeYokYazi = await np.evaluate(() => !!document.body && document.body.innerText.includes('nodejs.org')).catch(() => false);
    kontrol('Yazı tipi sunucusu hiç yanıt vermese de ana sayfa (açılış sahnesi ve salon) ve Node.js yardım sayfası açılır', yaziTipi.motor === 'tamam' && yaziTipi.kabin === 1 && yaziTipi.salon && nodeYokYazi, { ...yaziTipi, nodeYok: nodeYokYazi });
    await sf.close();
    // Kapı dolu: eski yoldan açılmış kendi motorumuz ve bayt bayt yollayan yabancı sunucu
    m.kill('SIGKILL'); await bekle(400);
    const pk = path.join(GECICI, 'denetim-paket'); fs.mkdirSync(pk); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(pk, 'kopru.js')); fs.copyFileSync(OYUN_HTML, path.join(pk, 'oyun.html'));
    const eski = baslat(pk, ['--deneme', '--port', String(kp)]); await bekle(800); await acik(kp);
    const ikinciMotor = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); let ikinciKod = null; ikinciMotor.on('exit', k => ikinciKod = k); await bekle(2000);
    kontrol('Kapıyı eski yoldan açılmış kendi motorumuz tutuyorsa "başka bir pencerede zaten açık, o pencereyi kapat" der', ikinciKod === 1 && /başka bir pencerede zaten açık/.test(ikinciMotor.cikti) && /kapat/.test(ikinciMotor.cikti), { kod: ikinciKod, cikti: ikinciMotor.cikti.trim() });
    eski.kill('SIGKILL'); await bekle(400);
    const yavas = require('net').createServer(s => { s.write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n'); const t = setInterval(() => { try { s.write(' '); } catch (e) { clearInterval(t); } }, 200); s.on('close', () => clearInterval(t)); s.on('error', () => clearInterval(t)); });
    await new Promise(r => yavas.listen(kp, '127.0.0.1', r));
    const t1 = Date.now(), uc = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); let ucKod = null; uc.on('exit', k => { ucKod = k; });
    for (let i = 0; i < 40 && ucKod === null; i++) await bekle(200);
    kontrol('Kapıyı bayt bayt yollayan yabancı bir sunucu tutuyorsa motor asılı kalmaz: en çok birkaç saniyede "kapı dolu" deyip çıkar', ucKod === 1 && Date.now() - t1 < 6000 && /kapı dolu/.test(uc.cikti), { kod: ucKod, ms: Date.now() - t1 });
    uc.kill('SIGKILL'); await new Promise(r => yavas.close(r));
    // Eski köprü + yeni sayfa ve yeni köprü + eski sayfa (önceki sürüm git'ten; git yoksa bu iki kontrol atlanır)
    let eskiKopru = null, eskiSayfa = null;
    try { eskiKopru = require('child_process').execFileSync('git', ['show', '2d6fd20:kopru.js'], { cwd: KOK, encoding: 'utf8' }); eskiSayfa = require('child_process').execFileSync('git', ['show', '2d6fd20:oyunlar/' + OYUN_AD + '/oyun.html'], { cwd: KOK, encoding: 'utf8' }); } catch (e) { }
    if (eskiKopru && eskiSayfa) {
      const u1 = path.join(GECICI, 'uyum-eski-kopru'); fs.mkdirSync(u1); fs.writeFileSync(path.join(u1, 'kopru.js'), eskiKopru); fs.copyFileSync(OYUN_HTML, path.join(u1, 'oyun.html'));
      let k1 = baslat(u1, ['--deneme', '--port', String(kp)]); await bekle(800); await acik(kp);
      const uc1 = await b.newContext({ viewport: { width: 1280, height: 800 } }); const up1 = await sayfaAc(uc1, A + '/'); await bekle(3000);
      const uy1 = await up1.evaluate(() => ({ bagli: CanliOyun.durum().bagli, alinan: CanliOyun.durum().alinan, hucre: document.getElementById('d-bag').textContent }));
      kontrol('Uyum: durum alanı yollamayan eski köprüyle yeni sayfa çalışır (hücre eskisi gibi "Canlı", olaylar akar)', uy1.bagli && uy1.alinan > 3 && uy1.hucre === 'Canlı', uy1);
      await uc1.close(); k1.kill('SIGKILL'); await bekle(400);
      const u2 = path.join(GECICI, 'uyum-eski-sayfa'); fs.mkdirSync(u2); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(u2, 'kopru.js')); fs.writeFileSync(path.join(u2, 'oyun.html'), eskiSayfa);
      k1 = baslat(u2, ['--deneme', '--port', String(kp)]); await bekle(800); await acik(kp);
      const uc2 = await b.newContext({ viewport: { width: 1280, height: 800 } }); const up2 = await sayfaAc(uc2, A + '/'); await bekle(3000);
      const uy2 = await up2.evaluate(() => ({ bagli: CanliOyun.durum().bagli, alinan: CanliOyun.durum().alinan }));
      kontrol('Uyum: yeni köprüyle eski sayfa çalışır (fazladan durum alanı yok sayılır, olaylar akar)', uy2.bagli && uy2.alinan > 3, uy2);
      await uc2.close(); k1.kill('SIGKILL');
    }
  }
  kontrol('Köprü testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  fs.rmSync(GECICI, { recursive: true, force: true });
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
