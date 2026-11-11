// Köprü testleri: ileti çevirisi, deneme kipi, kopma / yeniden bağlanma, sıralamayı saklama,
// kütüphanenin eski ve yeni sürümünün TAKLİTLERİYLE uçtan uca akış. Çalıştırma: npm run test:kopru
// Bu testler TikTok'a HİÇ bağlanmaz: gerçek kütüphane yerine geçici klasörlerdeki taklitler kullanılır.
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { KOK, CIKTI, tarayici, raporla, kontrolcu } = require('./ortak');
const { sonuc, kontrol } = kontrolcu();
const S = CIKTI, GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-kopru-')); // depo dışı: gerçek node_modules görünmesin
const OYUN_AD = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'halay', OYUN_HTML = path.join(KOK, 'oyunlar', OYUN_AD, 'oyun.html'); // köprü hangi oyunla sınanacak
// Kapılar: --port N ya da KOPRU_TEST_PORT=N (öntanım 8791); N, N+1 ve N+2…N+6 kullanılır. Açık bir köprü 8791'i tutuyorsa başka kapı ver.
const pi = process.argv.indexOf('--port'), P = parseInt(pi > 0 ? process.argv[pi + 1] : process.env.KOPRU_TEST_PORT, 10) || 8791;
const bekle = ms => new Promise(r => setTimeout(r, ms));
const al = url => new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ kod: r.statusCode, govde: d })); }).on('error', rej));
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
  const sayfaAc = async (ctx, url) => { const p = await ctx.newPage(); await p.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; }); p.on('pageerror', e => hatalar.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|WebSocket connection/.test(m.text())) hatalar.push(m.text()); }); await p.goto(url); return p; };

  // ---- 2. deneme kipi uçtan uca
  let k = baslat(KOK, ['--deneme', '--oyun', OYUN_AD, '--port', String(P)]); await bekle(900);
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const dr0 = await al('http://127.0.0.1:' + P + '/durum').then(r => ({ kod: r.kod }), e => ({ hata: e.code }));
  let p = await sayfaAc(ctx, 'http://127.0.0.1:' + P + '/'); await bekle(7000);
  let d = await p.evaluate(() => ({ ...CanliOyun.durum(), rozet: document.getElementById('bag-rozet').textContent, ileti: document.getElementById('bag-ileti').textContent, oto: document.getElementById('oto').textContent, not: document.getElementById('panel-not').textContent, adres: document.getElementById('bag-adres').value, serit: document.getElementById('d-bag').textContent, sekme: document.getElementById('bolum-yayin').hidden === false, uyari: document.getElementById('deneme-uyari').hidden === false }));
  kontrol('Köprü testi seçilen kapıda çalışır (' + P + ', KOPRU_TEST_PORT ya da --port)', dr0.kod === 200, dr0);
  kontrol('Köprüden açılan sayfa kendiliğinden bağlanır', d.bagli && d.rozet === 'Bağlı' && d.adres === 'ws://127.0.0.1:' + P + '/olay', { rozet: d.rozet, adres: d.adres, ileti: d.ileti });
  kontrol('Köprü kipinde masa: durum şeridi Canlı yazar, Yayın sekmesi açık, Deneme sekmesinde uyarı var', d.serit === 'Canlı' && d.sekme && d.uyari, { serit: d.serit, sekme: d.sekme, uyari: d.uyari });
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
  k.kill('SIGKILL'); await bekle(400); k = baslat(KOK, ['--deneme', '--oyun', OYUN_AD, '--port', String(P)]); await bekle(600);
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
  const k3 = baslat(bos, ['deneme_kullanici', '--port', String(P + 1)]); await bekle(1200);
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
    const kp = ++kapi, c = baslat(kl, ['@Test_Kullanici', '--port', String(kp)]); await bekle(700);
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
  kontrol('Köprü testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  fs.rmSync(GECICI, { recursive: true, force: true });
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
