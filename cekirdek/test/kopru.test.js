// Köprü testleri: ileti çevirisi, deneme kipi, kopma / yeniden bağlanma, sıralamayı saklama,
// kütüphanenin eski ve yeni sürümünün TAKLİTLERİYLE uçtan uca akış. Çalıştırma: npm run test:kopru
// Bu testler TikTok'a HİÇ bağlanmaz: gerçek kütüphane yerine geçici klasörlerdeki taklitler kullanılır.
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { KOK, CIKTI, tarayici, raporla, kontrolcu } = require('./ortak');
const { sonuc, kontrol } = kontrolcu();
const S = CIKTI, GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-kopru-')); // depo dışı: gerçek node_modules görünmesin
const OYUN_AD = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'halay', OYUN_HTML = path.join(KOK, 'oyunlar', OYUN_AD, 'oyun.html'); // köprü hangi oyunla sınanacak
// Kapılar: --port N ya da KOPRU_TEST_PORT=N (öntanım 8791); N, N+1 ve N+2…N+8 kullanılır. Açık bir köprü 8791'i tutuyorsa başka kapı ver.
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
    const ana = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await bekle(800);
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
    const ad1 = await ap.evaluate(() => ({ kart: [...document.querySelectorAll('.kart:not(.yap) h2')].map(h => h.textContent), yap: !!document.querySelector('.kart.yap'), etiket: document.querySelectorAll('.kart:not(.yap) img, .kart:not(.yap) .icerik b').length, xss: !!window.__xss, ifr: [...document.querySelectorAll('.ekran iframe')].map(f => f.getAttribute('src')) }));
    kontrol('Ana sayfa: her oyunun kartı, ad ve cümle düz metin (HTML olarak yazılmaz), "Kendi oyununu yap" kartı', JSON.stringify(ad1.kart) === JSON.stringify(['Birinci Oyun', 'İkinci Oyun', '<img src=x onerror="window.__xss=1">Üç']) && ad1.yap && ad1.etiket === 0 && !ad1.xss, ad1);
    kontrol('Ana sayfa: görünen kartlarda canlı önizleme (/onizleme/<ad>/#yayin)', ad1.ifr.length === 3 && ad1.ifr.every(s => /^\/onizleme\/[\w-]+\/#yayin$/.test(s)), ad1.ifr);
    const cerceve = ap.frames().find(f => /\/onizleme\/a-oyun\//.test(f.url()));
    const on = cerceve ? await cerceve.evaluate(() => ({ kopru: typeof window.OYUN_KOPRU, kisi: CanliOyun.durum().kisi, ses: CanliOyun.durum().ses, sesDugme: getComputedStyle(document.getElementById('ses-cagri')).display, yayin: document.body.classList.contains('yayin'), geri: !!document.querySelector('.ana-don') })).catch(e => ({ hata: e.message })) : { hata: 'önizleme çerçevesi yok' };
    kontrol('Önizleme köprüye bağlanmaz, kendi kalabalığıyla oynar, sessizdir, ses düğmesi gizli, yalnız sahne', on.kopru === 'undefined' && on.kisi >= 3 && on.ses === false && on.sesDugme === 'none' && on.yayin && !on.geri, on);
    // Kullanıcı adı boşken Yayına bağlan: sayfa geçmez, alanın yanında ne eksik olduğunu söyler, odak alana gider
    await ap.click('.kart[data-oyun="a-oyun"] .bagla'); await bekle(300);
    const bosAd = await ap.evaluate(() => ({ url: location.pathname, hata: document.getElementById('ad-hata').textContent, gorunur: !document.getElementById('ad-hata').hidden, odak: document.activeElement && document.activeElement.id }));
    kontrol('Ana sayfa: kullanıcı adı boşken Yayına bağlan geçmez, eksik olanı alanın yanında söyler, odak alana gider', bosAd.url === '/' && bosAd.gorunur && /kullanıcı adını yaz/.test(bosAd.hata) && bosAd.odak === 'kullanici' && kayit() === '', bosAd);
    await ap.fill('#kullanici', '@Test_Kullanici'); await ap.reload(); await bekle(800);
    const hatirla = await ap.inputValue('#kullanici');
    kontrol('Ana sayfa: kullanıcı adı bu tarayıcıda hatırlanır, baştaki @ atılır', hatirla === 'Test_Kullanici', hatirla);
    // Dene: API'ye sorar, oyunun sayfasına geçer; olaylar gelir; geri dönüş bağlantısı var
    await ap.click('.kart[data-oyun="a-oyun"] .dene'); await ap.waitForURL(/\/oyun\/a-oyun\/$/, { timeout: 8000 }).catch(() => { }); await bekle(4500);
    let od = await ap.evaluate(() => { const g = document.querySelector('.ana-don'); return { url: location.pathname, ...CanliOyun.durum(), geri: g && g.textContent, geriHref: g && g.getAttribute('href'), adres: document.getElementById('bag-adres').value }; });
    kontrol('Ana sayfadan Dene: oyunun sayfası açılır, köprüye bağlanır, sahte olaylar işlenir', od.url === '/oyun/a-oyun/' && od.bagli && od.alinan > 5 && od.sira.length > 0 && od.sira.every(x => x[0].startsWith('D. ')) && od.adres === 'ws://127.0.0.1:' + kp + '/olay/a-oyun', { url: od.url, bagli: od.bagli, alinan: od.alinan, adres: od.adres });
    const geriYayin = await ap.evaluate(() => { location.hash = '#yayin'; return new Promise(r => setTimeout(() => r(getComputedStyle(document.querySelector('.ana-don')).display), 300)); }).catch(e => e.message);
    kontrol('Ana sayfadan açılan oyunda "← Oyunlar" bağlantısı var, yalnız sahne görünümünde gizli', od.geri === '← Oyunlar' && od.geriHref === '/' && geriYayin === 'none', { geri: od.geri, yayinda: geriYayin });
    await ap.evaluate(() => { location.hash = ''; });
    // Olay hızı: oyun ve kip birkaç kez değişince sahte olay saati çoğalmamalı
    const toplam = s => Object.values(s.sayac).reduce((x, y) => x + y, 0);
    const hiz = async () => { const a = JSON.parse((await al(A + '/durum')).govde); await bekle(4000); return toplam(JSON.parse((await al(A + '/durum')).govde)) - toplam(a); };
    const hiz1 = await hiz();
    for (const o of ['b-oyun', 'a-oyun', 'b-oyun', 'c-oyun', 'b-oyun']) await api({ oyun: o, kip: 'deneme' });
    const hiz2 = await hiz();
    kontrol('Oyun değiştirip geri dönünce olay hızı katlanmaz (eski sahte olay saati durur)', hiz1 >= 6 && hiz2 >= 6 && hiz2 <= hiz1 * 1.4, { once: hiz1, sonra: hiz2 });
    od = await ap.evaluate(() => ({ alinan: CanliOyun.durum().alinan, ileti: document.getElementById('bag-ileti').textContent })); await bekle(2000);
    const od2 = await ap.evaluate(() => CanliOyun.durum().alinan);
    kontrol('Başka oyun başlayınca eski oyunun açık sayfası olay almaz ve bunu söyler', od2 === od.alinan && /çalışmıyor/.test(od.ileti), { once: od.alinan, sonra: od2, ileti: od.ileti });
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
    const pk = baslat(kl, ['--ana-sayfa', '--port', String(kp)]); await bekle(800);
    const l = JSON.parse((await al(A + '/api/oyunlar')).govde), baslik = /<title>([^<]*)<\/title>/.exec(fs.readFileSync(OYUN_HTML, 'utf8'))[1];
    kontrol('Paket düzeni, ana sayfa kipi: yalnız paketteki tek oyun (oyun.json yoksa adı sayfa başlığından)', l.paket === true && l.oyunlar.length === 1 && l.oyunlar[0].id === 'oyun' && l.oyunlar[0].ad === baslik && (await al(A + '/')).kod === 200, l.oyunlar);
    fs.writeFileSync(path.join(kl, 'oyun.json'), JSON.stringify({ ad: 'Paket Oyunu', paket: 'paket-oyunu', aciklama: 'Tek cümle.', vitrin: false }));
    const l2 = JSON.parse((await al(A + '/api/oyunlar')).govde);
    const pb = await gonder(kp, '/api/baslat', { oyun: 'paket-oyunu', kip: 'deneme' }); await bekle(300);
    const pg = await al(A + '/oyun/paket-oyunu/');
    kontrol('Paket düzeni: oyun.json\'daki ad, cümle ve paket adı kullanılır, vitrin ayarı yok sayılır; Dene ile açılır', JSON.stringify(l2.oyunlar) === JSON.stringify([{ id: 'paket-oyunu', ad: 'Paket Oyunu', aciklama: 'Tek cümle.' }]) && pb.kod === 200 && pg.kod === 200 && /\/olay\/paket-oyunu/.test(pg.govde), { liste: l2.oyunlar, kod: pb.kod, sayfa: pg.kod });
    pk.kill('SIGKILL');
  }
  kontrol('Köprü testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  fs.rmSync(GECICI, { recursive: true, force: true });
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
