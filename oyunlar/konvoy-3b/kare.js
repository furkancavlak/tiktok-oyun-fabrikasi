#!/usr/bin/env node
/* Gelin Konvoyu 3B'nin kare çekimi: her kamera çekiminin bir karesi, kalabalığa göre kareler, yakın "vitrin"
 * kareleri ve 40 saniyelik otomatik rejinin film şeridi. Hepsi başsız Chrome'da, 1080×1920 yayın görünümünde.
 *
 *   node oyunlar/konvoy-3b/kare.js [--yazilim] [--yalniz cekim,kalabalik,vitrin,serit]
 *
 * --yazilim: ekran kartı yerine yazılımla çizim (SwiftShader): zayıf bilgisayarı ölçmek için.
 * Yazdıkları (test/cikti/konvoy-3b/):
 *   cekim-<ad>.png            8 çekim + 2 olay çekimi (sov, lider), tam kalabalık (kapasite)
 *   cekim-hepsi.png           on çekim tek sayfada (küçültülmüş)
 *   kalabalik-<cekim>-<n>.png drone, yan, yakin; 1, 3, 9 araba · kalabalik-hepsi.png
 *   vitrin-araba.png, vitrin-gelin.png   sıradan bir araba ve gelin arabası, dörtte üç önden, büyük
 *   serit-1.png, serit-2.png  40 sn otomatik reji, saniyede bir kare (ortada hediye ve lider değişimi)
 *   olcum.json                her karede çekimin adı, kare süresi, adların yeri (şerit denetimi)
 * Kurulu Chrome: CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" (yoksa playwright'ınki).
 */
'use strict';
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const kok = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(kok, 'node_modules', 'playwright'));
const OYUN = pathToFileURL(path.join(__dirname, 'oyun.html')).href;
const cikti = path.join(kok, 'test', 'cikti', 'konvoy-3b');
fs.mkdirSync(cikti, { recursive: true });
const yazilim = process.argv.includes('--yazilim');
const yi = process.argv.indexOf('--yalniz'), yalniz = yi > 0 ? process.argv[yi + 1].split(',') : null;
const yap = ad => !yalniz || yalniz.includes(ad);
const ADLAR = ['mert.can.21', 'nazlı_can', 'ozan_dayı', 'sibel_abla', 'baran.21', 'elif_naz', 'Hacı Salihoğlu', 'kübra__34', 'yusuf61', 'Emre Aksu', 'zeynep', 'babie.live', 'Osman', 'LazReiL', 'almira', 'atike.11', 'Gumbatte', 'RAHMİCAN', 'ssuuddeli', 'usge.29', 'merve', 'editciumut', 'Servet Cankurt', 'Enver Paşa', 'Halil', 'Zeki', 'Hayal', 'aziz__im', 'selinay', 'EY', 'Bey_38', 'yukaa', 'Nazan', 'User2110', 'ilginTR', 'Fatma', 'bassy', 'mehmet', 'Sena', 'joker'];
const bekle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const args = ['--no-sandbox', ...(yazilim ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist'])];
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args });
  const hatalar = [], olcum = { gpu: null, kareler: [] };
  const ac = async () => {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await p.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; });
    p.on('pageerror', e => hatalar.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) hatalar.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, async r => {
      try { await r.fulfill({ response: await r.fetch({ timeout: 4000 }) }); }
      catch (e) { await r.abort().catch(() => { }); }
    });
    await p.goto(OYUN + '#yayin');
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      document.getElementById('ses-cagri').hidden = true;
      if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click();
      document.getElementById('bosalt').click();
    });
    if (!olcum.gpu) olcum.gpu = await p.evaluate(() => CanliOyun.durum().gpu);
    return p;
  };
  // İlk dört kişi hediye atmış olsun (sıralama kutusu ve gelin arabası dolu görünsün).
  const doldur = (p, n) => p.evaluate(([adlar, n]) => {
    const jeton = [300, 60, 15, 5];
    for (let i = 0; i < n; i++) {
      const ad = adlar[i % adlar.length] + (i >= adlar.length ? '_' + i : ''), kim = { id: 'kare:' + ad, ad };
      CanliOyun.olay(i < jeton.length ? { tip: 'hediye', kullanici: kim, jeton: jeton[i] } : { tip: 'yorum', kullanici: kim, metin: '' });
    }
  }, [ADLAR, n]);
  const zorla = (p, ad) => p.evaluate(a => { CanliOyun._test.D.reji.zorla = a; }, ad);
  // ölçüm: çekim, kare süresi, adların kutuları (şeritte mi), sürücü başlarının yeri
  const olc = async (p, etiket) => {
    const o = await p.evaluate(() => {
      const d = CanliOyun.durum(), m = CanliOyun._test.olcum();
      return { cekim: d.cekim, gecis: d.cekimGecis, konu: d.konuKadraj, kareMs: +d.kareMs.toFixed(1), kisi: d.kisi, adlar: m.kisiler.filter(k => k.etiket).map(k => [k.ad, k.etiket]), baslar: m.kisiler.filter(k => k.bas).map(k => [k.ad, k.bas.x, k.bas.y, k.bas.r]) };
    });
    o.etiket = etiket;
    o.konuDisari = !!(o.konu && (o.konu[1] < 505 || o.konu[3] > 1006 || o.konu[0] < 0 || o.konu[2] > 720 || o.konu[4] > 0));
    o.disari = o.adlar.filter(([, e]) => e[1] < 505 || e[1] + e[3] > 1006).map(x => x[0]);
    olcum.kareler.push(o);
    return o;
  };
  const cek = async (p, dosya, etiket) => {
    const png = await p.screenshot();
    try { fs.writeFileSync(path.join(cikti, dosya), png); }
    catch (e) { fs.writeFileSync(path.join(cikti, dosya.replace('.png', '-yeni.png')), png); }
    return olc(p, etiket || dosya);
  };
  const sayfa = async (dosyalar, sutun, w, h, cik, yazilar) => {
    const s = await b.newPage({ viewport: { width: w * sutun, height: h * Math.ceil(dosyalar.length / sutun) } });
    await s.setContent('<body style="margin:0;display:flex;flex-wrap:wrap;background:#111;font:700 15px sans-serif;color:#fff">' + dosyalar.map((d, i) => '<div style="position:relative;width:' + w + 'px;height:' + h + 'px"><img style="width:100%;height:100%;display:block" src="data:image/png;base64,' + fs.readFileSync(path.join(cikti, d)).toString('base64') + '"><span style="position:absolute;left:4px;top:4px;background:#000c;padding:1px 5px">' + (yazilar ? yazilar[i] : d.replace('.png', '')) + '</span><div style="position:absolute;left:0;right:0;top:' + (h * 505 / 1280) + 'px;height:' + (h * 501 / 1280) + 'px;border-top:1px dashed #0f08;border-bottom:1px dashed #0f08"></div></div>').join('') + '</body>');
    await s.waitForTimeout(300);
    // dosya başka bir programda açıksa (Windows kilidi) yanına -yeni ekiyle yazılır
    const png = await s.screenshot();
    try { fs.writeFileSync(path.join(cikti, cik), png); }
    catch (e) { fs.writeFileSync(path.join(cikti, cik.replace('.png', '-yeni.png')), png); console.log(cik + ' kilitli, ' + cik.replace('.png', '-yeni.png') + ' yazıldı'); }
    await s.close();
  };

  const CEKIMLER = ['drone', 'yan', 'on', 'kus', 'tur', 'yakin', 'kenar', 'vinc'];
  let kapasite = 36;
  if (yap('cekim')) {
    const p = await ac();
    kapasite = await p.evaluate(() => CanliOyun._test.OYUN.kapasite);
    await doldur(p, kapasite);
    await p.waitForTimeout(5000);
    const dosyalar = [];
    for (const c of CEKIMLER) {
      await zorla(p, c);
      await p.waitForTimeout(c === 'vinc' ? 3200 : 1800);
      dosyalar.push('cekim-' + c + '.png');
      console.log(c, JSON.stringify(await cek(p, 'cekim-' + c + '.png', 'cekim:' + c)).slice(0, 300));
    }
    // olay çekimleri: en büyük hediye (drift şov) ve gelin arabasının el değiştirmesi
    await zorla(p, null);
    await p.evaluate(a => CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kare:' + a, ad: a }, jeton: 1000 }), ADLAR[20]);
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(250);
      const d = await p.evaluate(() => ({ c: CanliOyun.durum().cekim, dn: CanliOyun._test.D.drift && CanliOyun._test.D.drift.donus }));
      if (d.c === 'sov' && d.dn !== null) break;
    }
    await p.waitForTimeout(1600);
    dosyalar.push('cekim-sov.png');
    console.log('sov', JSON.stringify(await cek(p, 'cekim-sov.png', 'cekim:sov')).slice(0, 300));
    await p.evaluate(() => { const D = CanliOyun._test.D; if (D.drift) D.drift.donus -= 40; });
    await p.waitForTimeout(800);
    await p.evaluate(a => CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kare:' + a, ad: a }, jeton: 5000 }), ADLAR[30]);
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(200);
      if ((await p.evaluate(() => CanliOyun.durum().cekim)) === 'lider') break;
    }
    // drift kuyruğuna da girdi (5000 jeton); lider çekimini görmek için şovu bekletmeden lider çekimini zorla
    await p.waitForTimeout(1500);
    await zorla(p, 'lider');
    await p.waitForTimeout(600);
    dosyalar.push('cekim-lider.png');
    console.log('lider', JSON.stringify(await cek(p, 'cekim-lider.png', 'cekim:lider')).slice(0, 300));
    await zorla(p, null);
    await p.close();
    await sayfa(dosyalar, 5, 432, 768, 'cekim-hepsi.png');
  }
  if (yap('kalabalik')) {
    const dosyalar = [];
    for (const n of [1, 3, 9]) {
      const p = await ac();
      await doldur(p, n);
      await p.waitForTimeout(4500);
      for (const c of ['drone', 'yan', 'yakin']) {
        if (c === 'yakin' && n === 1) continue;
        await zorla(p, c);
        await p.waitForTimeout(1600);
        const d = 'kalabalik-' + c + '-' + n + '.png';
        dosyalar.push(d);
        await cek(p, d, 'kalabalik:' + c + ':' + n);
      }
      await p.close();
    }
    await sayfa(dosyalar, 4, 432, 768, 'kalabalik-hepsi.png');
  }
  if (yap('vitrin')) {
    const p = await ac();
    await doldur(p, 9);
    await p.waitForTimeout(4000);
    // vitrin: kamerayı elle koy (reji dışı); konvoy yürürken sıradan bir araba ve gelin arabası
    for (const [dosya, kimi] of [['vitrin-araba.png', 3], ['vitrin-gelin.png', 0]]) {
      await zorla(p, 'yakin');
      await p.evaluate(i => { const D = CanliOyun._test.D; const k = D.sira[i]; D.reji.cekim.k = k; D.reji.konu = i ? k : null; D.reji.cekim.yan = -1; D.reji.cekim.d = undefined; }, kimi);
      await p.waitForTimeout(1500);
      await cek(p, dosya, 'vitrin:' + kimi);
    }
    await p.close();
  }
  if (yap('serit')) {
    const p = await ac();
    await doldur(p, kapasite);
    await p.waitForTimeout(3000);
    const dosyalar = [], yazilar = [];
    for (let i = 0; i < 40; i++) {
      const t0 = Date.now();
      if (i === 16) await p.evaluate(a => CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kare:' + a, ad: a }, jeton: 1000 }), ADLAR[25]);
      if (i === 30) await p.evaluate(a => CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kare:' + a, ad: a }, jeton: 2000 }), ADLAR[33]);
      const d = 'serit-kare-' + String(i).padStart(2, '0') + '.png';
      const o = await cek(p, d, 'serit:' + i);
      dosyalar.push(d);
      yazilar.push(i + ' sn · ' + o.cekim + (o.gecis ? ' (geçiş)' : '') + (o.konuDisari ? ' · KONU TAŞTI' : ''));
      await bekle(Math.max(0, 1000 - (Date.now() - t0)));
    }
    await p.close();
    await sayfa(dosyalar.slice(0, 20), 10, 216, 384, 'serit-1.png', yazilar.slice(0, 20));
    await sayfa(dosyalar.slice(20), 10, 216, 384, 'serit-2.png', yazilar.slice(20));
    for (const d of dosyalar) fs.unlinkSync(path.join(cikti, d));
  }
  // en kalabalık hâlde kare süresi (çekirdeğin D.kareMs'i: 3B çizim dahil)
  {
    const p = await ac();
    await doldur(p, kapasite);
    await p.waitForTimeout(6000);
    const ms = [];
    for (const c of CEKIMLER) {
      await zorla(p, c);
      await p.waitForTimeout(1500);
      // D.kareMs işlemcide geçen süredir (ekran kartı işini beklemez); kare aralığı (requestAnimationFrame) ekran
      // kartının gerçekten yetişip yetişmediğini gösterir: 16,7 ms = saniyede 60 kare
      const r = await p.evaluate(() => new Promise(res => { const t = []; let s = performance.now(); const f = n => { t.push(n - s); s = n; if (t.length < 90) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res([t[45], t[85]]); } }; requestAnimationFrame(f); }));
      ms.push([c, +(await p.evaluate(() => CanliOyun.durum().kareMs)).toFixed(1), +r[0].toFixed(1), +r[1].toFixed(1)]);
    }
    olcum.kareMs = ms;
    console.log('1080×1920, ' + kapasite + ' araba · [çekim, işlemci ms (D.kareMs), kare aralığı ortanca ms, kare aralığı %95 ms]: ' + JSON.stringify(ms) + ' · ' + olcum.gpu);
    await p.close();
  }
  await b.close();
  fs.writeFileSync(path.join(cikti, 'olcum' + (yazilim ? '-yazilim' : '') + '.json'), JSON.stringify(olcum, null, 1));
  const tasan = olcum.kareler.filter(k => k.konuDisari);
  console.log('Konusu 505–1006 şeridinden taşan kare: ' + tasan.length + '/' + olcum.kareler.length + (tasan.length ? ' → ' + tasan.map(k => k.etiket + ' ' + JSON.stringify(k.konu)).join(' | ') : ''));
  const disari = olcum.kareler.filter(k => k.disari.length);
  if (disari.length) console.log('ŞERİT DIŞI AD:', disari.map(k => k.etiket + ': ' + k.disari.join(',')).join(' | '));
  if (hatalar.length) { console.log('SAYFA HATALARI:\n  ' + [...new Set(hatalar)].slice(0, 8).join('\n  ')); process.exit(1); }
  console.log('Kareler: ' + cikti);
})().catch(e => { console.error(e); process.exit(1); });
