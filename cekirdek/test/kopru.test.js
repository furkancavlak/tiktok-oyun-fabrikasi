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
// Taklit yalnız komut satırı bayrağıyla verilir (--kurulum-betigi; motor ortam değişkeni okumaz): baslat() ana sayfa
// kipindeki her köprüye ekler.
delete process.env.KOPRU_KURULUM_BETIGI;
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
function baslat(klasor, args) { if (args.includes('--ana-sayfa') && !args.includes('--kurulum-betigi')) args = [...args, '--kurulum-betigi', TAKLIT]; const c = spawn(process.execPath, ['kopru.js', ...args], { cwd: klasor }); c.cikti = ''; c.stdout.on('data', d => c.cikti += d); c.stderr.on('data', d => c.cikti += d); return c; }

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
  kontrol('Köprüden açılan sayfa kendiliğinden bağlanır (deneme kipinde rozet "Deneme")', d.bagli && d.rozet === 'Deneme' && new RegExp('^ws://127[.]0[.]0[.]1:' + P + '/olay/[0-9a-f]{24}$').test(d.adres), { rozet: d.rozet, adres: d.adres, ileti: d.ileti });
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
  const OY = d.adres.replace(/^ws:\/\/[^/]+/, ''); // köprünün sayfaya yazdığı kimlikli yol (/olay/<kimlik>)
  const eskiWs = { kendi: await wsDene(P, OY, { Origin: 'http://127.0.0.1:' + P }), kaynaksiz: await wsDene(P, OY), nul: await wsDene(P, OY, { Origin: 'null' }), dosya: await wsDene(P, OY, { Origin: 'file://' }),
    yabanci: await wsDene(P, OY, { Origin: 'http://kotu.example' }), host: await wsDene(P, OY, { Host: 'kotu.example:' + P, Origin: 'http://kotu.example:' + P }) };
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
  // ==== HEDİYE KİMLİĞİ (hediye: { id, ad }) — başı ====
  // Kütüphanenin üç biçimi (alanlar kurulu tiktok-live-connector 2.5.0'dan ve tiktok-live-proto şemalarından):
  // 1.x düz (giftId, giftName; legacy gift = { gift_id, … }), 2.0–2.4 giftDetails.{ id, giftName }, 2.5 gift.{ id, name }.
  {
    const ku = { uniqueId: 'ayse', nickname: 'Ayşe' }, ic = { user: { uniqueId: 'memo', nickname: 'Memo' } };
    const h1 = cevir('gift', { ...ku, giftId: 5655, giftName: 'Rose', describe: 'Sent Rose', giftType: 1, repeatEnd: true, repeatCount: 3, diamondCount: 1, gift: { gift_id: 5655, repeat_count: 3, repeat_end: 1, gift_type: 1 } });
    const h2 = cevir('gift', { ...ic, giftId: 5655, giftDetails: { id: '5655', giftName: 'Rose', giftType: 1, diamondCount: 1 }, repeatCount: 3, repeatEnd: 1 });
    const h3 = cevir('gift', { ...ic, giftId: '5655', gift: { id: '5655', name: 'Rose', type: 1, diamondCount: 1 }, repeatCount: 3, repeatEnd: 1 });
    const ayni = o => o && JSON.stringify(o.hediye) === JSON.stringify({ id: '5655', ad: 'Rose' }) && o.jeton === 1 && o.adet === 3;
    kontrol('Hediye kimliği: köprü üç kütüphane biçiminden de { id, ad } çıkarır (1.x düz, 2.0 giftDetails, 2.5 gift)', ayni(h1) && ayni(h2) && ayni(h3), [h1, h2, h3]);
    const adsiz = cevir('gift', { ...ic, giftId: '7934', gift: { id: '7934', name: '', type: 2, diamondCount: 5 }, repeatCount: 1, repeatEnd: 1 });
    const kimliksiz = cevir('gift', { ...ku, giftName: '  Gül  ', giftType: 2, diamondCount: 1 });
    const bos = cevir('gift', { ...ic, giftId: '', gift: { id: '', name: '', type: 2, diamondCount: 5 }, repeatCount: 1, repeatEnd: 1 });
    const sifir = cevir('gift', { ...ku, giftId: 0, giftName: '', giftType: 2, diamondCount: 5 });
    const eskiAyni = cevir('gift', { ...ku, giftType: 2, repeatCount: 1, diamondCount: 29999 });
    kontrol('Hediye kimliği: ad yoksa yalnız id, id yoksa yalnız ad (kırpılmış); ikisi de yoksa (boş metin, 0) alan hiç olmaz', JSON.stringify(adsiz.hediye) === '{"id":"7934"}' && JSON.stringify(kimliksiz.hediye) === '{"ad":"Gül"}' && !('hediye' in bos) && !('hediye' in sifir) && JSON.stringify(eskiAyni) === JSON.stringify({ tip: 'hediye', kullanici: { id: 'ayse', ad: 'Ayşe' }, jeton: 29999, adet: 1 }), { adsiz, kimliksiz, bos, sifir, eskiAyni });
    const uzun = cevir('gift', { ...ic, giftId: 123456789012345678901234567890123456789n, gift: { name: 'Ç'.repeat(70) + '\u0007‮', type: 2, diamondCount: 1 } });
    const html = cevir('gift', { ...ku, giftId: 1, giftName: '<img src=x onerror=alert(1)><b>x</b>', giftType: 2, diamondCount: 1 });
    kontrol('Hediye kimliği: uzun ad 40 karaktere, id 32 karaktere kısalır (büyük sayı metne çevrilir); denetim karakteri atılır; HTML adı olduğu gibi düz metin kalır', Array.from(uzun.hediye.ad).length === 40 && uzun.hediye.ad.endsWith('…') && !/[\u0000-\u001f‮]/.test(uzun.hediye.ad) && uzun.hediye.id === '12345678901234567890123456789012' && html.hediye.ad === '<img src=x onerror=alert(1)><b>x</b>', { uzun: uzun.hediye, html: html.hediye });
    kontrol('Hediye kimliği: seri sürerken kimliğiyle birlikte yok sayılır, bitince bir kez kimliğiyle sayılır', cevir('gift', { ...ic, giftId: '5655', gift: { id: '5655', name: 'Rose', type: 1, diamondCount: 1 }, repeatCount: 2, repeatEnd: 0 }) === null && cevir('gift', { ...ku, giftId: 5655, giftName: 'Rose', giftType: 1, repeatEnd: false, repeatCount: 2, diamondCount: 1 }) === null && ayni(h3));
    // Uçtan uca, üç sahte kütüphaneyle: ad sayfaya ulaşır, olay akışında jetonun yanında düz metin olarak yazılır.
    const kp = P + 8, A = 'http://127.0.0.1:' + kp;
    const kutup = {
      v1: `const E=require('events');class WebcastPushConnection extends E{connect(){setTimeout(()=>{const u={uniqueId:'h_ayse',nickname:'H Ayşe',userId:'1'};this.emit('gift',{...u,giftId:5655,giftName:'Rose',giftType:1,repeatEnd:false,repeatCount:2,diamondCount:1,gift:{gift_id:5655,repeat_count:2,repeat_end:0,gift_type:1}});this.emit('gift',{...u,giftId:5655,giftName:'Rose',giftType:1,repeatEnd:true,repeatCount:5,diamondCount:1,gift:{gift_id:5655,repeat_count:5,repeat_end:1,gift_type:1}});this.emit('gift',{uniqueId:'h_cem',nickname:'H Cem',giftId:7934,giftName:'<img src=x onerror="window.__xss=1">',giftType:2,repeatCount:1,diamondCount:30});},6000);return Promise.resolve({roomId:'1'});}disconnect(){}}module.exports={WebcastPushConnection};`,
      v2: `const E=require('events');const WebcastEvent={GIFT:'giftX'};class TikTokLiveConnection extends E{async connect(){setTimeout(()=>{this.emit('giftX',{user:{uniqueId:'h_memo',nickname:'H Memo'},giftId:5655,giftDetails:{id:'5655',giftName:'<b>x</b>',giftType:1,diamondCount:1},repeatCount:4,repeatEnd:1});this.emit('giftX',{user:{uniqueId:'h_sude',nickname:'H Sude'},giftId:0,giftDetails:{giftName:'',giftType:2,diamondCount:30},repeatCount:1,repeatEnd:1});},6000);return {roomId:'2'};}disconnect(){}}module.exports={TikTokLiveConnection,WebcastEvent,ControlEvent:{}};`,
      v25: `const E=require('events');const WebcastEvent={GIFT:'giftX'};class TikTokLiveConnection extends E{async connect(){setTimeout(()=>{const user={uniqueId:'h_elif',nickname:'H Elif'};this.emit('giftX',{user,giftId:'5655',gift:{id:'5655',name:'Rose',type:1,diamondCount:1},repeatCount:2,repeatEnd:0});this.emit('giftX',{user,giftId:'5655',gift:{id:'5655',name:'Rose',type:1,diamondCount:1},repeatCount:3,repeatEnd:1});this.emit('giftX',{user:{uniqueId:'h_baran',nickname:'H Baran'},giftId:'1',gift:{id:'1',name:'${'Ş'.repeat(60)}',type:2,diamondCount:30},repeatCount:1,repeatEnd:1});},6000);return {roomId:'3'};}disconnect(){}}module.exports={TikTokLiveConnection,WebcastEvent,ControlEvent:{}};`
    };
    const uc = {};
    for (const [ad, kod] of Object.entries(kutup)) {
      const kl = path.join(GECICI, 'hediye-' + ad); fs.mkdirSync(path.join(kl, 'node_modules/tiktok-live-connector'), { recursive: true });
      fs.writeFileSync(path.join(kl, 'node_modules/tiktok-live-connector/index.js'), kod); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js')); fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyun.html'));
      const c = baslat(kl, ['@Test_Kullanici', '--port', String(kp)]); await bekle(700); await acik(kp);
      const hc = await b.newContext({ viewport: { width: 1280, height: 800 } }), hp = await sayfaAc(hc, A + '/');
      await hp.waitForFunction(() => CanliOyun.durum().sira.length >= 2, null, { timeout: 15000 }).catch(() => { }); await bekle(800);
      uc[ad] = await hp.evaluate(() => { const g = document.getElementById('gunluk'); return { sira: CanliOyun.durum().sira, satir: [...g.querySelectorAll('li.t-h .metin')].map(x => x.textContent), etiket: g.querySelectorAll('img, b, i, script').length + document.querySelectorAll('img[src="x"]').length, xss: !!window.__xss }; });
      await hc.close(); c.kill('SIGKILL'); await bekle(400);
    }
    const s = uc.v1 || {}, s2 = uc.v2 || {}, s3 = uc.v25 || {}, siz = x => !x || (x.etiket === 0 && !x.xss);
    kontrol('Hediye kimliği uçtan uca, 1.x kütüphane: seri bitince Rose 1×5 sayılır, ad akışta jetonun yanında; HTML ad düz metin (öğe yok, betik çalışmaz)', JSON.stringify(s.sira) === JSON.stringify([['H Cem', 30], ['H Ayşe', 5]]) && (s.satir || []).some(x => /^5 jeton · Rose → /.test(x)) && (s.satir || []).some(x => x.startsWith('30 jeton · <img src=x onerror="window.__xss=1"> → ')) && siz(s), s);
    kontrol('Hediye kimliği uçtan uca, 2.0 kütüphane (giftDetails): <b>x</b> düz metin; kimliği olmayan hediye eskisi gibi yazılır', JSON.stringify(s2.sira) === JSON.stringify([['H Sude', 30], ['H Memo', 4]]) && (s2.satir || []).some(x => x.startsWith('4 jeton · <b>x</b> → ')) && (s2.satir || []).some(x => /^30 jeton → /.test(x)) && siz(s2), s2);
    kontrol('Hediye kimliği uçtan uca, 2.5 kütüphane (gift.name): seri bitince bir kez; uzun ad kısaltılmış gelir', JSON.stringify(s3.sira) === JSON.stringify([['H Baran', 30], ['H Elif', 3]]) && (s3.satir || []).some(x => /^3 jeton · Rose → /.test(x)) && !(s3.satir || []).some(x => /^2 jeton/.test(x)) && (s3.satir || []).some(x => x.startsWith('30 jeton · ' + 'Ş'.repeat(39) + '… → ')) && siz(s3), s3);
    // Deneme kipi: sahte, "deneme-" önekli kimlikler sırayla gelir (soketten okunur)
    const dk = path.join(GECICI, 'hediye-deneme'); fs.mkdirSync(dk); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(dk, 'kopru.js')); fs.copyFileSync(OYUN_HTML, path.join(dk, 'oyun.html'));
    const dc = baslat(dk, ['--deneme', '--port', String(kp)]); await bekle(700); await acik(kp);
    const dYol = (/Olay adresi: +ws:\/\/[^/\s]+(\/olay\/[0-9a-f]{24})/.exec(dc.cikti) || [, '/olay'])[1]; // komut satırı kipinde kimlikli yol
    const akis = await new Promise(res => {
      const so = require('net').connect(kp, '127.0.0.1', () => so.write('GET ' + dYol + ' HTTP/1.1\r\nHost: 127.0.0.1:' + kp + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'));
      let v = Buffer.alloc(0); so.on('data', x => { v = Buffer.concat([v, x]); }); so.on('error', () => { });
      setTimeout(() => { so.destroy(); res(v.toString('utf8')); }, 14000); // hediye 4 sn'de bir (deneme saati): üç tur
    });
    dc.kill('SIGKILL'); await bekle(400);
    const DK = ['{"id":"deneme-gul","ad":"Gül"}', '{"id":"deneme-kalp","ad":"Kalp"}', '{"id":"deneme-yildiz","ad":"Yıldız"}'];
    const denemeKim = [...akis.matchAll(/"hediye":(\{[^}]*\})/g)].map(m => m[1]), denemeJeton = [...akis.matchAll(/"tip":"hediye","kullanici":\{[^}]*\},"jeton":(\d+),"adet":(\d+)/g)].map(m => +m[1] * +m[2]);
    kontrol('Hediye kimliği, köprünün deneme kipi: sahte kimlikler (deneme-gul / deneme-kalp / deneme-yildiz) sırayla gelir, seri kuralı aynı (hep 15 jeton)', denemeKim.length >= 3 && denemeKim.every((x, i) => i === 0 || DK.indexOf(x) === (DK.indexOf(denemeKim[i - 1]) + 1) % 3) && DK.every(x => denemeKim.includes(x)) && denemeJeton.length === denemeKim.length && denemeJeton.every(x => x === 15), { kimlik: denemeKim, jeton: denemeJeton });
    // Uyum: eski köprü (alanı yollamaz) + yeni sayfa, yeni köprü (alanı yollar) + eski sayfa — ikisi de bugünkü gibi sayar
    let eK = null, eS = null;
    try { eK = require('child_process').execFileSync('git', ['show', '2d6fd20:kopru.js'], { cwd: KOK, encoding: 'utf8' }); eS = require('child_process').execFileSync('git', ['show', '2d6fd20:oyunlar/' + OYUN_AD + '/oyun.html'], { cwd: KOK, encoding: 'utf8' }); } catch (e) { }
    if (eK && eS) {
      const uyum = async (kopruKod, sayfa, ad) => {
        const kl = path.join(GECICI, 'hediye-uyum-' + ad); fs.mkdirSync(kl); fs.writeFileSync(path.join(kl, 'kopru.js'), kopruKod); fs.writeFileSync(path.join(kl, 'oyun.html'), sayfa);
        const c = baslat(kl, ['--deneme', '--port', String(kp)]); await bekle(700); await acik(kp);
        const hc = await b.newContext({ viewport: { width: 1280, height: 800 } }), hp = await sayfaAc(hc, A + '/');
        await hp.waitForFunction(() => document.querySelectorAll('#gunluk li.t-h').length >= 1, null, { timeout: 15000 }).catch(() => { }); await bekle(500);
        const r = await hp.evaluate(() => ({ bagli: CanliOyun.durum().bagli, sira: CanliOyun.durum().sira.filter(x => x[1] > 0).map(x => x[1]), satir: [...document.querySelectorAll('#gunluk li.t-h .metin')].map(x => x.textContent) }));
        await hc.close(); c.kill('SIGKILL'); await bekle(400);
        return r;
      };
      const u1 = await uyum(eK, fs.readFileSync(OYUN_HTML, 'utf8'), 'eski-kopru'), u2 = await uyum(fs.readFileSync(path.join(KOK, 'kopru.js'), 'utf8'), eS, 'eski-sayfa');
      kontrol('Hediye kimliği uyumu: eski köprü + yeni sayfa: hediyeler eskisi gibi sayılır (15\'in katı), akışta ad yok', u1.bagli && u1.sira.length > 0 && u1.sira.every(x => x % 15 === 0) && u1.satir.length > 0 && u1.satir.every(x => /^15 jeton → /.test(x)), u1);
      kontrol('Hediye kimliği uyumu: yeni köprü + eski sayfa: fazladan alan yok sayılır, hediyeler eskisi gibi sayılır (15\'in katı)', u2.bagli && u2.sira.length > 0 && u2.sira.every(x => x % 15 === 0) && u2.satir.length > 0 && u2.satir.every(x => /^15 jeton → /.test(x)), u2);
    }
  }
  // ==== HEDİYE KİMLİĞİ — sonu ====
  // ==== DENETİM 2 (A–H) VE MAC / LINUX — başı ====
  {
    const kp = P + 8, A = 'http://127.0.0.1:' + kp, cp = require('child_process');
    const yasiyor = pid => { if (!pid) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
    const oku = (kl, ad) => { try { return fs.readFileSync(path.join(kl, ad), 'utf8'); } catch (e) { return ''; } };
    const durumA = async () => JSON.parse((await al(A + '/api/oyunlar')).govde);
    const bekleKosul = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await f()) return true; } catch (e) { } await bekle(150); } return false; };
    // Kurulum taklidi 2: kurulum-mod2.txt'ye göre asılı kalır (torun süreç açar), kütüphaneyi kurmadan 0 ile çıkar, izin
    // hatası ya da "npm yok" yazar, ya da ağ hatası verir. Her başlayışını kurulum-sayac2.txt'ye yazar.
    const T2 = path.join(GECICI, 'kurulum-taklit2.js');
    fs.writeFileSync(T2, `const fs=require('fs'),{spawn}=require('child_process');let mod='hata';try{mod=fs.readFileSync('kurulum-mod2.txt','utf8').trim();}catch(e){}
fs.appendFileSync('kurulum-sayac2.txt',mod[0]);fs.writeFileSync('cocuk.pid',String(process.pid));
if(mod==='asili'){const t=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync('torun.pid',String(t.pid));setInterval(()=>{},1000);}
else if(mod==='eksik'){process.exit(0);}
else if(mod==='izin'){console.error("npm ERR! code EACCES\\nnpm ERR! Error: EACCES: permission denied, mkdir 'node_modules'");process.exit(1);}
else if(mod==='npmyok'){console.error("'npm' is not recognized as an internal or external command,");process.exit(1);}
else{console.error('npm ERR! network (taklit)');process.exit(1);}`);
    // Motor kapanışı: Windows'ta sinyal yollanamadığı için motora önden yüklenen küçük betik "dur" satırında motorun
    // kendi SIGINT işleyicisini çalıştırır (Ctrl+C ya da pencere kapatılması gibi).
    const ON = path.join(GECICI, 'dur-onyukle.js');
    fs.writeFileSync(ON, `process.stdin.setEncoding('utf8');process.stdin.on('data',d=>{if(/dur/.test(d))process.emit('SIGINT');});`);
    const anaKur = (ad, oyunlar = ['a-oyun']) => {
      const kl = path.join(GECICI, ad);
      for (const o of oyunlar) { fs.mkdirSync(path.join(kl, 'oyunlar', o), { recursive: true }); fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyunlar', o, 'oyun.html')); fs.writeFileSync(path.join(kl, 'oyunlar', o, 'oyun.json'), JSON.stringify({ ad: o })); }
      fs.mkdirSync(path.join(kl, 'cekirdek'), { recursive: true });
      fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js')); fs.copyFileSync(path.join(KOK, 'cekirdek', 'ana-sayfa.html'), path.join(kl, 'cekirdek', 'ana-sayfa.html'));
      return kl;
    };
    const motor = (kl, ek = [], env) => { const c = spawn(process.execPath, ['--require', ON, 'kopru.js', '--ana-sayfa', '--port', String(kp), ...ek], { cwd: kl, env: env || process.env }); c.cikti = ''; c.stdout.on('data', d => c.cikti += d); c.stderr.on('data', d => c.cikti += d); return c; };

    // ---- birim: neden seçimi, Windows dışı ağaç öldürme yolu (sahte süreçle)
    const K = require(path.join(KOK, 'kopru.js')), N = K.KURULUM_NEDEN;
    kontrol('C: kurulum nedenleri ayrı cümleler: npm yok, izin, kütüphane eksik, internet (ham satır cümleye girmez)', K.kurulumNedeni(1, "'npm' is not recognized as an internal or external command", false) === N.npmYok && K.kurulumNedeni(1, "'npm' iç ya da dış komut olarak tanınmıyor", false) === N.npmYok && K.kurulumNedeni(127, '', false) === N.npmYok && K.kurulumNedeni(null, '', true) === N.npmYok && K.kurulumNedeni(1, 'npm ERR! code EACCES', false) === N.izin && K.kurulumNedeni(1, 'EROFS: read-only file system', false) === N.izin && K.kurulumNedeni(0, '', false) === N.eksik && K.kurulumNedeni(1, 'npm ERR! network', false) === N.internet && Object.values(N).every(x => !/npm ERR|EACCES/.test(x)), N);
    const EE = require('events'), sahteC = Object.assign(new EE(), { pid: 4242, exitCode: null, signalCode: null, kill() { } }), oldurulen = [];
    let agacBitti = false;
    K.agacKes(sahteC, () => { agacBitti = true; }, 'darwin', (pid, sinyal) => oldurulen.push([pid, sinyal]));
    const erken = agacBitti; sahteC.signalCode = 'SIGKILL'; sahteC.emit('exit', null, 'SIGKILL');
    kontrol('B / Mac: Windows dışında ağaç öldürme süreç grubuna (-pid) SIGKILL yollar, süreç gerçekten bitince sonra() çağrılır', JSON.stringify(oldurulen) === '[[-4242,"SIGKILL"]]' && !erken && agacBitti && /detached: process\.platform !== 'win32'/.test(fs.readFileSync(path.join(KOK, 'kopru.js'), 'utf8')), { oldurulen, erken, agacBitti });
    const kaynakK = fs.readFileSync(path.join(KOK, 'kopru.js'), 'utf8');
    kontrol('H: motor kurulum betiğini ortam değişkeninden okumaz; yalnız --kurulum-betigi bayrağı', !/process\.env\.KOPRU_KURULUM_BETIGI/.test(kaynakK) && /--kurulum-betigi/.test(kaynakK) && !/kurulum-betigi/.test(fs.readFileSync(path.join(KOK, 'BASLAT.bat'), 'latin1')));

    // ---- A: komut satırı kipinde olay akışı yalnız kimlikli adreste
    {
      const kl = path.join(GECICI, 'a-kimlik'); fs.mkdirSync(kl); fs.copyFileSync(path.join(KOK, 'kopru.js'), path.join(kl, 'kopru.js')); fs.copyFileSync(OYUN_HTML, path.join(kl, 'oyun.html'));
      const c = baslat(kl, ['--deneme', '--port', String(kp)]); await bekle(700); await acik(kp);
      const m = /Olay adresi: +(ws:\/\/127\.0\.0\.1:\d+(\/olay\/[0-9a-f]{24}))/.exec(c.cikti), yol = m ? m[2] : '/olay/yok';
      const html = (await al(A + '/')).govde;
      kontrol('A: köprü açılışta tam olay adresini yazar, kendi sayfasına aynı kimlikli yolu verir', !!m && html.includes('"' + yol + '"'), c.cikti.split('\n').filter(x => /Olay adresi/.test(x)));
      const kendi = { Origin: 'http://127.0.0.1:' + kp };
      const w = {
        dogruKendi: await wsDene(kp, yol, kendi), dogruNull: await wsDene(kp, yol, { Origin: 'null' }), dogruDosya: await wsDene(kp, yol, { Origin: 'file://' }), dogruKaynaksiz: await wsDene(kp, yol),
        kimliksiz: await wsDene(kp, '/olay', kendi), kimliksizNull: await wsDene(kp, '/olay', { Origin: 'null' }), yanlis: await wsDene(kp, '/olay/' + '0'.repeat(24), { Origin: 'null' }),
        kok: await wsDene(kp, '/', { Origin: 'null' }), sorgu: await wsDene(kp, '/olay?' + yol.slice(6), { Origin: 'null' }), yabanci: await wsDene(kp, yol, { Origin: 'http://kotu.example' })
      };
      const wd = Object.fromEntries(Object.entries(w).map(([a, v]) => [a, v.durum.slice(9, 12)]));
      kontrol('A: doğru kimlikle kendi kaynağı, null, file: ve kaynaksız kabul; kimliksiz, yanlış kimlik, başka yol ve başka site 403, hiç veri yok', ['dogruKendi', 'dogruNull', 'dogruDosya', 'dogruKaynaksiz'].every(a => wd[a] === '101') && /"tip":"kopru"/.test(w.dogruNull.veri) && ['kimliksiz', 'kimliksizNull', 'yanlis', 'kok', 'sorgu', 'yabanci'].every(a => wd[a] === '403' && !/"tip"/.test(w[a].veri)), wd);
      // Başka bir sitenin kum havuzlu iframe'i (Origin: null) olay akışını okuyamaz: gerçek başsız sayfada
      const yabanciSunucu = http.createServer((q, s) => { s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end('<!doctype html><title>kötü site</title><iframe sandbox="allow-scripts" srcdoc="' +
        "<script>var sonuc=[];['/olay','/olay/" + '0'.repeat(24) + "','/'].forEach(function(y){try{var w=new WebSocket('ws://127.0.0.1:" + kp + "'+y);w.onmessage=function(e){parent.postMessage({y:y,veri:String(e.data).slice(0,200)},'*');};w.onopen=function(){parent.postMessage({y:y,acik:true},'*');};}catch(e){}});</script>" +
        '"></iframe><script>window.__gelen=[];addEventListener("message",function(e){window.__gelen.push(e.data);});</script>'); });
      await new Promise(r => yabanciSunucu.listen(P + 11, '127.0.0.1', r));
      const ys = await b.newContext({ viewport: { width: 800, height: 600 } }), yp = await ys.newPage();
      await yp.goto('http://127.0.0.1:' + (P + 11) + '/'); await bekle(2500);
      const gelen = await yp.evaluate(() => window.__gelen);
      kontrol('A: başka bir sitedeki kum havuzlu iframe (Origin: null) köprüye bağlanamaz, hiçbir ileti ve yayıncı adı almaz', Array.isArray(gelen) && gelen.length === 0, gelen);
      await ys.close(); await new Promise(r => yabanciSunucu.close(r));
      // Diskten açılan oyun sayfası, siyah pencerede yazan adres elle girilince bağlanır
      const dc = await b.newContext({ viewport: { width: 1280, height: 800 } }), dp = await dc.newPage();
      dp.on('pageerror', e => hatalar.push(e.message + ' @ dosya'));
      await dp.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; });
      await dp.goto(require('url').pathToFileURL(path.join(kl, 'oyun.html')).href); await bekle(600);
      await dp.evaluate(a => { document.getElementById('bag-adres').value = a; document.getElementById('bag-dugme').click(); }, m ? m[1] : 'ws://yok');
      await dp.waitForFunction(() => CanliOyun.durum().alinan > 2, null, { timeout: 12000 }).catch(() => { });
      const dd = await dp.evaluate(() => ({ bagli: CanliOyun.durum().bagli, alinan: CanliOyun.durum().alinan }));
      // Düz eski adres artık bağlanmaz; panel ne yapılacağını söyler
      await dp.evaluate(a => { document.getElementById('bag-dugme').click(); document.getElementById('bag-adres').value = a; document.getElementById('bag-dugme').click(); }, 'ws://127.0.0.1:' + kp + '/olay'); // önce kes, sonra eski adresle bağlan
      await bekle(1500);
      const eski = await dp.evaluate(() => ({ bagli: CanliOyun.durum().bagli, ileti: document.getElementById('bag-ileti').textContent }));
      kontrol('A: diskten açılan oyun, yapıştırılan tam adresle bağlanır ve olay alır; düz /olay adresi bağlanmaz, panel tam adresi yazmayı söyler', dd.bagli && dd.alinan > 2 && !eski.bagli && /tam olay adresini/.test(eski.ileti), { dd, eski });
      await dc.close(); c.kill('SIGKILL'); await bekle(400);
    }

    // ---- B: asılı kurulum: süre dolunca ağacıyla ölür, bitmeden ikinci kurulum başlamaz; motor kapanınca ağaç kalmaz
    {
      const kl = anaKur('b-asili'); fs.writeFileSync(path.join(kl, 'kurulum-mod2.txt'), 'asili');
      let m = motor(kl, ['--kurulum-betigi', T2, '--kurulum-sinir', '3']); await acik(kp);
      await bekleKosul(() => oku(kl, 'torun.pid'), 4000);
      const torun1 = +oku(kl, 'torun.pid'), cocuk1 = +oku(kl, 'cocuk.pid');
      for (let i = 0; i < 3; i++) await gonder(kp, '/api/kutuphane', {});
      const surerken = await durumA();
      kontrol('B: kurulum sürerken "Yeniden dene" ikinci kurulum başlatmaz (tek kurulum yaşar)', oku(kl, 'kurulum-sayac2.txt') === 'a' && surerken.kutuphane.durum === 'iniyor' && yasiyor(torun1), { sayac: oku(kl, 'kurulum-sayac2.txt'), durum: surerken.kutuphane, torun: yasiyor(torun1) });
      await bekleKosul(async () => (await durumA()).kutuphane.durum === 'hata', 12000);
      const sonra = await durumA();
      kontrol('B: süre dolunca kurulum ağacı (torun süreç dahil) ölür, sonra durum "hata" ve süre cümlesi', sonra.kutuphane.durum === 'hata' && sonra.kutuphane.neden === N.sure && !yasiyor(torun1) && !yasiyor(cocuk1), { kutuphane: sonra.kutuphane, torun: yasiyor(torun1), cocuk: yasiyor(cocuk1) });
      fs.unlinkSync(path.join(kl, 'torun.pid'));
      await gonder(kp, '/api/kutuphane', {});
      await bekleKosul(() => oku(kl, 'torun.pid'), 4000);
      const torun2 = +oku(kl, 'torun.pid'), cocuk2 = +oku(kl, 'cocuk.pid');
      let cikis = null; m.on('exit', k => { cikis = k; }); m.stdin.write('dur\n');
      await bekleKosul(() => cikis !== null, 5000); await bekle(500);
      kontrol('B: motor kapanınca (Ctrl+C / pencere kapanması yolu) süren kurulumun ağacı da ölür', cikis === 0 && torun2 && torun2 !== torun1 && !yasiyor(torun2) && !yasiyor(cocuk2), { cikis, torun2, yasiyor: yasiyor(torun2), cocuk: yasiyor(cocuk2) });
      for (const pid of [torun1, cocuk1, torun2, cocuk2]) if (yasiyor(pid)) try { process.kill(pid); } catch (e) { } // yalnız bu testin açtıkları
      m.kill('SIGKILL'); await bekle(300);
    }

    // ---- C + H: her başarısızlığın kendi cümlesi; ham npm satırları yalnız konsolda
    {
      const sonuc = {};
      for (const mod of ['eksik', 'izin', 'npmyok', 'hata']) {
        const kl = anaKur('c-' + mod); fs.writeFileSync(path.join(kl, 'kurulum-mod2.txt'), mod);
        const m = motor(kl, ['--kurulum-betigi', T2]); await acik(kp);
        await bekleKosul(async () => (await durumA()).kutuphane.durum === 'hata', 6000);
        sonuc[mod] = { neden: (await durumA()).kutuphane.neden, konsol: m.cikti };
        if (mod === 'izin') {
          const pc = await b.newContext({ viewport: { width: 1366, height: 768 } }), pp = await sayfaAc(pc, A + '/'); await bekle(1800);
          sonuc.sayfa = await pp.evaluate(() => document.getElementById('a-kutu').textContent);
          await pc.close();
        }
        m.kill('SIGKILL'); await bekle(300);
      }
      kontrol('C: kütüphanesiz 0 çıkış, izin hatası, npm yok ve ağ hatası ayrı, düz cümleler; ham satır yalnız konsolda; sayfa nedeni yazar', sonuc.eksik.neden === N.eksik && sonuc.izin.neden === N.izin && sonuc.npmyok.neden === N.npmYok && sonuc.hata.neden === N.internet && /EACCES/.test(sonuc.izin.konsol) && !/EACCES/.test(sonuc.izin.neden) && /yazılamıyor/.test(sonuc.sayfa) && !/İnternet/.test(sonuc.sayfa), { ...Object.fromEntries(Object.entries(sonuc).filter(([a]) => a !== 'sayfa').map(([a, v]) => [a, v.neden])), sayfa: sonuc.sayfa });
      // H: ortamda eski değişken olsa da taklit çalışmaz; npm yolda yoksa kurulum hiç başlamaz, "Node.js kurulumu eksik" der
      const kl = anaKur('h-ortam'); fs.writeFileSync(path.join(kl, 'kurulum-mod2.txt'), 'eksik');
      const sys = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'), env = { ...process.env, KOPRU_KURULUM_BETIGI: T2 };
      for (const a of Object.keys(env)) if (a.toUpperCase() === 'PATH') delete env[a];
      env.PATH = process.platform === 'win32' ? sys : '/nonexistent-bin';
      const m = motor(kl, [], env); await acik(kp);
      await bekleKosul(async () => (await durumA()).kutuphane.durum === 'hata', 6000);
      const hd = await durumA();
      kontrol('H: KOPRU_KURULUM_BETIGI ortamda olsa da yok sayılır (taklit hiç çalışmaz); npm yolda yoksa kurulum başlamaz, düz "Node.js kurulumu eksik" der', oku(kl, 'kurulum-sayac2.txt') === '' && hd.kutuphane.neden === N.npmYok, { sayac: oku(kl, 'kurulum-sayac2.txt'), kutuphane: hd.kutuphane });
      m.kill('SIGKILL'); await bekle(300);
    }

    // ---- D: bağlanma isteği yoldayken Yayın'a 20 kez basmak yeni bağlantı açmaz
    {
      const kl = anaKur('d-bekleyen');
      fs.mkdirSync(path.join(kl, 'node_modules/tiktok-live-connector'), { recursive: true });
      fs.writeFileSync(path.join(kl, 'node_modules/tiktok-live-connector/index.js'), `const E=require('events'),fs=require('fs');class WebcastPushConnection extends E{connect(){fs.appendFileSync('baglan.txt','b');return new Promise(()=>{});}disconnect(){}}module.exports={WebcastPushConnection};`);
      const m = motor(kl, ['--kurulum-betigi', T2]); await acik(kp);
      await gonder(kp, '/api/baslat', { oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' }); await bekle(400);
      for (let i = 0; i < 20; i++) await gonder(kp, '/api/baslat', { oyun: 'a-oyun', kip: 'canli', kullanici: 'Test_Kullanici' });
      await bekle(500);
      const dd = await durumA();
      kontrol('D: TikTok\'a bağlanma isteği yoldayken Yayın\'a 20 kez basılınca tek bağlantı açılır (basışlar yok sayılır)', oku(kl, 'baglan.txt') === 'b' && dd.aktif && dd.aktif.baglanti === 'baglaniyor', { baglan: oku(kl, 'baglan.txt'), aktif: dd.aktif });
      m.kill('SIGKILL'); await bekle(300);
    }

    // ---- E: durdurulan / yerine başkası açılan oyun sayfası yeniden denemez, "Durdu" der; yeni başlatmada yine bağlanır
    {
      const kl = anaKur('e-durdu', ['a-oyun', 'b-oyun']);
      const m = motor(kl, ['--kurulum-betigi', T2]); await acik(kp);
      await gonder(kp, '/api/baslat', { oyun: 'a-oyun', kip: 'deneme' }); await bekle(300);
      const ec = await b.newContext({ viewport: { width: 1280, height: 800 } });
      await ec.addInitScript(() => { const W = window.WebSocket; window.__ws = 0; window.WebSocket = function (...a) { window.__ws++; return new W(...a); }; window.WebSocket.prototype = W.prototype; });
      const ep = await sayfaAc(ec, A + '/oyun/a-oyun/');
      await ep.waitForFunction(() => CanliOyun.durum().bagli, null, { timeout: 10000 }).catch(() => { });
      const bak = () => ep.evaluate(() => ({ ws: window.__ws, hucre: document.getElementById('d-bag').textContent, rozet: document.getElementById('bag-rozet').textContent, ortu: !!document.getElementById('calistirma-ortu'), bagli: CanliOyun.durum().bagli }));
      await gonder(kp, '/api/durdur', {}); await bekle(2800);
      const e1 = await bak(); await bekle(7000); const e2 = await bak();
      kontrol('E: oyun durdurulunca sayfa örtüyü gösterir, yeniden bağlanmayı bırakır (7 sn\'de yeni soket yok), hücre ve rozet "Durdu"', e1.ortu && e2.ws === e1.ws && e2.hucre === 'Durdu' && e2.rozet === 'Durdu' && !e2.bagli, { e1, e2 });
      await gonder(kp, '/api/baslat', { oyun: 'a-oyun', kip: 'deneme' });
      await ep.waitForFunction(() => window.CanliOyun && CanliOyun.durum().bagli && !document.getElementById('calistirma-ortu') && document.getElementById('d-bag').textContent === 'Deneme', null, { timeout: 12000 }).catch(() => { });
      const e3 = await bak();
      kontrol('E: aynı oyun yeniden başlatılınca bekçi sayfayı yeni başlatmaya yeniler, sayfa normal bağlanır ("Deneme")', e3.bagli && !e3.ortu && e3.hucre === 'Deneme', e3);
      await gonder(kp, '/api/baslat', { oyun: 'b-oyun', kip: 'deneme' }); await bekle(2800);
      const e4 = await bak(); await bekle(7000); const e5 = await bak();
      kontrol('E: yerine başka oyun açılınca eski sayfa da yeniden denemez, "Durdu" der', e4.ortu && e5.ws === e4.ws && e5.hucre === 'Durdu' && e5.rozet === 'Durdu', { e4, e5 });
      await ec.close(); m.kill('SIGKILL'); await bekle(300);
    }

    // ---- F: açılış sahnesinde odak sahnenin içinde; kapanınca salonda anlamlı bir yerde
    {
      const kl = anaKur('f-odak'); fs.writeFileSync(path.join(kl, 'kurulum-mod.txt'), 'tamam 6000');
      const m = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await acik(kp);
      const fc = await b.newContext({ viewport: { width: 1366, height: 768 } }), fp = await sayfaAc(fc, A + '/');
      await fp.waitForFunction(() => !document.getElementById('beklemeden').hidden, null, { timeout: 8000 }).catch(() => { });
      await bekle(1200);
      const f1 = await fp.evaluate(() => document.activeElement && document.activeElement.id);
      const tablar = []; for (const tus of ['Tab', 'Tab', 'Shift+Tab', 'Tab']) { await fp.keyboard.press(tus); tablar.push(await fp.evaluate(() => document.activeElement && document.activeElement.id)); }
      await fp.keyboard.press('Enter'); await bekle(800);
      const f2 = await fp.evaluate(() => ({ id: document.activeElement && document.activeElement.id, kalk: document.getElementById('acilis').classList.contains('kalk') }));
      kontrol('F: açılış sahnesi açıkken odak eylem düğmesinde, Tab sahnenin dışına çıkmaz; kapanınca ad kayıtlı değilse odak ad alanına geçer', f1 === 'beklemeden' && tablar.every(x => x === 'beklemeden') && f2.kalk && f2.id === 'kullanici', { f1, tablar, f2 });
      await bekleKosul(async () => (await durumA()).kutuphane.durum === 'hazir', 10000);
      const gc = await b.newContext({ viewport: { width: 1366, height: 768 } });
      await gc.addInitScript(() => { try { localStorage.setItem('fabrika-kullanici', 'Test_Kullanici'); } catch (e) { } });
      const gp = await sayfaAc(gc, A + '/');
      await gp.waitForFunction(() => document.getElementById('acilis').classList.contains('kalk'), null, { timeout: 8000 }).catch(() => { });
      await bekle(300);
      const f3 = await gp.evaluate(() => { const e = document.activeElement; return { sinif: e && e.className, oyun: e && e.closest && e.closest('.kart') && e.closest('.kart').dataset.oyun }; });
      kontrol('F: ad kayıtlıyken sahne kendiliğinden kapanınca odak ilk kabinin Dene düğmesine geçer', /dene/.test(f3.sinif || '') && f3.oyun === 'a-oyun', f3);
      // Mac / Linux: motor platformunu söyler; sayfanın yazıları ona göre (alan Mac dese Terminal penceresi yazar)
      const pl = await durumA();
      const mc = await b.newContext({ viewport: { width: 1366, height: 768 } }), mp = await mc.newPage();
      await mp.route(/\/api\/oyunlar$/, async r => { try { const y = await r.fetch(); const j = await y.json(); j.platform = 'mac'; await r.fulfill({ response: y, body: JSON.stringify(j) }); } catch (e) { } }); // sayfa kapanırken yoldaki istek düşebilir
      await mp.goto(A + '/'); await bekle(1800);
      const macYazi = await mp.evaluate(() => document.getElementById('yerel').textContent);
      kontrol('Mac / Linux: /api/oyunlar platformu söyler (bu bilgisayarda ' + process.platform + '); sayfa alanı okuyup Mac\'te "Terminal penceresi" yazar', pl.platform === (process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux') && /^Terminal penceresi oyunların motorudur/.test(macYazi), { platform: pl.platform, macYazi });
      await mp.unrouteAll({ behavior: 'ignoreErrors' }); await mc.close(); await gc.close(); await fc.close(); m.kill('SIGKILL'); await bekle(300);
      // Motor yokken (dosyadan): tarayıcının ipucu; odak sahnenin kendisinde (görünen düğme yok)
      const yazi = {};
      for (const [ad, ipucu] of [['win', 'Win32'], ['mac', 'MacIntel'], ['linux', 'Linux x86_64']]) {
        const zc = await b.newContext({ viewport: { width: 1366, height: 768 } }), zp = await zc.newPage();
        await zp.addInitScript(i => { window.FABRIKA_PLATFORM = i; window.OYUN_MUZIK_KAPALI = true; }, ipucu);
        await zp.goto(require('url').pathToFileURL(path.join(KOK, 'cekirdek', 'ana-sayfa.html')).href); await bekle(1300);
        yazi[ad] = await zp.evaluate(() => ({ motor: document.getElementById('a-motor').textContent, alt: document.getElementById('acilis-alt').textContent, odak: document.activeElement && document.activeElement.id }));
        await zp.goto(require('url').pathToFileURL(path.join(KOK, 'cekirdek', 'node-yok.html')).href); await bekle(300);
        yazi[ad].yardim = await zp.evaluate(() => document.getElementById('yeniden').textContent);
        await zc.close();
      }
      const zc = await b.newContext(), zp = await zc.newPage(); await zp.addInitScript(() => { window.FABRIKA_PLATFORM = 'Plan9'; });
      await zp.goto(require('url').pathToFileURL(path.join(KOK, 'cekirdek', 'node-yok.html')).href); await bekle(300);
      const belirsiz = await zp.evaluate(() => document.getElementById('yeniden').textContent); await zc.close();
      kontrol('F: motor yokken açılış sahnesinde görünen düğme yok, odak sahnenin kendisinde', ['win', 'mac', 'linux'].every(a => yazi[a].odak === 'acilis'), Object.fromEntries(Object.entries(yazi).map(([a, v]) => [a, v.odak])));
      kontrol('Mac / Linux: motor yokken ana sayfa ve Node.js yardım sayfası tarayıcının ipucuna göre başlatıcıyı söyler (Windows metni aynı kalır); emin değilse üç ad birden', /Motor çalışmıyor\. BASLAT\.bat dosyasına çift tıkla\./.test(yazi.win.motor) && yazi.win.alt === 'Siyah pencere kapalı görünüyor.' && /BASLAT\.command dosyasına çift tıkla/.test(yazi.mac.motor) && yazi.mac.alt === 'Terminal penceresi kapalı görünüyor.' && /BASLAT\.sh dosyasını çalıştır/.test(yazi.linux.motor) && /BASLAT\.bat dosyasına yeniden çift tıkla/.test(yazi.win.yardim) && /BASLAT\.command dosyasına yeniden çift tıkla/.test(yazi.mac.yardim) && /BASLAT\.sh dosyasını yeniden çalıştır/.test(yazi.linux.yardim) && /BASLAT\.bat.*BASLAT\.command.*BASLAT\.sh/.test(belirsiz), { yazi, belirsiz });
    }
    // Boş Host başlığı da yabancı Host gibi geri çevrilir (tarayıcı gönderemez ama başka bir program gönderebilir)
    {
      const kl = anaKur('host-bos'); const m = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await acik(kp);
      const ham = istek => new Promise(res => { const s = require('net').connect(kp, '127.0.0.1', () => s.write(istek)); let v = ''; s.on('data', d => { v += d; }); s.on('error', () => res('hata')); setTimeout(() => { s.destroy(); res(v.split('\r\n')[0]); }, 600); });
      const bos = [await ham('GET /api/oyunlar HTTP/1.1\r\nHost: \r\n\r\n'), await ham('GET /api/oyunlar HTTP/1.0\r\n\r\n'), await ham('GET /durum HTTP/1.0\r\nHost:\r\n\r\n')];
      kontrol('Boş ya da hiç olmayan Host başlığı 403 alır (/api/oyunlar, /durum)', bos.every(x => /^HTTP\/1\.1 403/.test(x)), bos);
      m.kill('SIGKILL'); await bekle(300);
    }
  }
  // ==== DENETİM 2 (A–H) VE MAC / LINUX — sonu ====
  kontrol('Köprü testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  fs.rmSync(GECICI, { recursive: true, force: true });
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
