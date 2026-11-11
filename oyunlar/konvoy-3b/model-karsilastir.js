#!/usr/bin/env node
/* Araba görünümü karşılaştırması: kodla kurulan kasalar (?araba=kod) ile hazır modeller (?araba=hazir, Kenney Car Kit)
 * aynı sahnede, aynı izleyicilerle, aynı çekimlerde. Başsız Chrome, 1080×1920 yayın görünümü.
 *
 *   node oyunlar/konvoy-3b/model-karsilastir.js [--yazilim] [--olc]
 *
 * Yazdıkları (test/cikti/konvoy-3b/):
 *   model-karsilastirma.png       satırlar yakin, tur, on, drone, yan; sütunlar kod | hazır (36 araba)
 *   model-gelin-kod.png, model-gelin-hazir.png   gelin arabasının yakın vitrini, iki görünümde
 *   model-olcum.json              kare aralığı ve kalite kademesi, iki görünümde (--olc)
 * --yazilim: ekran kartı yerine yazılımla çizim (SwiftShader).
 */
'use strict';
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const kok = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(kok, 'node_modules', 'playwright'));
const OYUN = pathToFileURL(path.join(__dirname, 'oyun.html')).href;
const cikti = path.join(kok, 'test', 'cikti', 'konvoy-3b');
fs.mkdirSync(cikti, { recursive: true });
const yazilim = process.argv.includes('--yazilim'), olc = process.argv.includes('--olc');
const ADLAR = ['mert.can.21', 'nazlı_can', 'ozan_dayı', 'sibel_abla', 'baran.21', 'elif_naz', 'Hacı Salihoğlu', 'kübra__34', 'yusuf61', 'Emre Aksu', 'zeynep', 'babie.live', 'Osman', 'LazReiL', 'almira', 'atike.11', 'Gumbatte', 'RAHMİCAN', 'ssuuddeli', 'usge.29', 'merve', 'editciumut', 'Servet Cankurt', 'Enver Paşa', 'Halil', 'Zeki', 'Hayal', 'aziz__im', 'selinay', 'EY', 'Bey_38', 'yukaa', 'Nazan', 'User2110', 'ilginTR', 'Fatma', 'bassy', 'mehmet', 'Sena', 'joker'];
const CEKIMLER = ['yakin', 'tur', 'on', 'drone', 'yan'];

(async () => {
  const args = ['--no-sandbox', ...(yazilim ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist'])];
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args });
  const hatalar = [], sonuc = {};
  const ac = async gorunum => {
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    // aynı tohum: Math.random iki görünümde aynı diziyi verir (rejinin seçimleri mümkün olduğunca aynı olsun)
    await p.addInitScript(() => {
      window.OYUN_MUZIK_KAPALI = true;
      let t = 20261111;
      Math.random = () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    });
    p.on('pageerror', e => hatalar.push(gorunum + ': ' + e));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) hatalar.push(gorunum + ': ' + m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort().catch(() => { }));
    await p.goto(OYUN + '?araba=' + gorunum + '#yayin');
    await p.waitForTimeout(700);
    await p.evaluate(() => {
      document.getElementById('ses-cagri').hidden = true;
      if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click();
      document.getElementById('bosalt').click();
    });
    return p;
  };
  const doldur = (p, n) => p.evaluate(([adlar, n]) => {
    const jeton = [300, 60, 15, 5];
    for (let i = 0; i < n; i++) {
      const ad = adlar[i % adlar.length] + (i >= adlar.length ? '_' + i : ''), kim = { id: 'kare:' + ad, ad };
      CanliOyun.olay(i < jeton.length ? { tip: 'hediye', kullanici: kim, jeton: jeton[i] } : { tip: 'yorum', kullanici: kim, metin: '' });
    }
  }, [ADLAR, n]);
  const zorla = (p, ad) => p.evaluate(a => { CanliOyun._test.D.reji.zorla = a; }, ad);
  for (const gorunum of ['kod', 'hazir']) {
    const p = await ac(gorunum);
    await doldur(p, 36);
    await p.waitForTimeout(5000);
    for (const c of CEKIMLER) {
      await zorla(p, c);
      await p.waitForTimeout(1800);
      fs.writeFileSync(path.join(cikti, 'model-' + c + '-' + gorunum + '.png'), await p.screenshot());
    }
    // gelin arabası vitrini (kare.js'in vitrin çekimi gibi: kamera elle, reji dışı)
    await zorla(p, 'yakin');
    // kesme bir sonraki karede olur (kur() konuyu kendi seçer): önce kesilsin, sonra konu gelin arabası olsun
    await p.waitForTimeout(300);
    await p.evaluate(() => { const D = CanliOyun._test.D; const k = D.lider; D.reji.cekim.k = k; D.reji.konu = k; D.reji.cekim.yan = -1; D.reji.cekim.d = undefined; });
    await p.waitForTimeout(1500);
    fs.writeFileSync(path.join(cikti, 'model-gelin-' + gorunum + '.png'), await p.screenshot());
    sonuc[gorunum] = { hazirMi: await p.evaluate(() => typeof ARABA_MODELLERI !== 'undefined' && new URLSearchParams(location.search).get('araba')) };
    if (olc) {
      // 36 arabada kare aralığı: rejiyi serbest bırak, kalite ölçümü otursun, sonra 90 kare
      await zorla(p, null);
      await p.waitForTimeout(8000);
      const r = await p.evaluate(() => new Promise(res => { const t = []; let s = performance.now(); const f = n => { t.push(n - s); s = n; if (t.length < 90) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res([t[45], t[85]]); } }; requestAnimationFrame(f); }));
      const d = await p.evaluate(() => { const d = CanliOyun.durum(); return { kareAralik: d.kareAralik, kalite: d.kalite, kareMs: +d.kareMs.toFixed(1), gpu: d.gpu, ornek: d.ornek }; });
      Object.assign(sonuc[gorunum], d, { rafOrtanca: +r[0].toFixed(1), raf95: +r[1].toFixed(1) });
      console.log(gorunum, JSON.stringify(sonuc[gorunum]));
    }
    await p.close();
  }
  // birleşik sayfa: satır çekim, sütun görünüm
  const s = await b.newPage({ viewport: { width: 2 * 360 + 90, height: 5 * 640 + 40 } });
  const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(cikti, f)).toString('base64');
  await s.setContent('<body style="margin:0;background:#111;font:700 18px sans-serif;color:#fff"><div style="display:grid;grid-template-columns:90px 360px 360px">' +
    '<div></div><div style="height:40px;line-height:40px;text-align:center">kod (bugünkü)</div><div style="height:40px;line-height:40px;text-align:center">hazır (Kenney)</div>' +
    CEKIMLER.map(c => '<div style="writing-mode:vertical-rl;text-align:center;line-height:90px">' + c + '</div>' + ['kod', 'hazir'].map(g => '<img style="width:360px;height:640px;display:block" src="' + img('model-' + c + '-' + g + '.png') + '">').join('')).join('') +
    '</div></body>');
  await s.waitForTimeout(300);
  fs.writeFileSync(path.join(cikti, 'model-karsilastirma.png'), await s.screenshot({ fullPage: true }));
  await s.close();
  for (const c of CEKIMLER)
    for (const g of ['kod', 'hazir'])
      fs.unlinkSync(path.join(cikti, 'model-' + c + '-' + g + '.png'));
  if (olc)
    fs.writeFileSync(path.join(cikti, 'model-olcum' + (yazilim ? '-yazilim' : '') + '.json'), JSON.stringify(sonuc, null, 2));
  console.log(hatalar.length ? 'HATALAR:\n' + hatalar.join('\n') : 'sayfa hatası yok');
  await b.close();
})();
