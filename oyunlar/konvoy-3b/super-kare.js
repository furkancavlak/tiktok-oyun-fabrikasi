#!/usr/bin/env node
/* Süper araba kareleri: konvoyun içinde yakından, drone uzaklığından, değişim anı (önce / sonra) ve gelin arabası
 * süper araba olunca süslü hâli. Başsız Chrome, 1080×1920 yayın görünümü, 36 araba.
 *
 *   node oyunlar/konvoy-3b/super-kare.js [--araba kod|hazir]
 *
 * Yazdıkları (test/cikti/konvoy-3b/): super-vitrin.png, super-drone.png, super-an.png (önce | sonra), super-gelin.png
 */
'use strict';
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const kok = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(kok, 'node_modules', 'playwright'));
const OYUN = pathToFileURL(path.join(__dirname, 'oyun.html')).href;
const cikti = path.join(kok, 'test', 'cikti', 'konvoy-3b');
fs.mkdirSync(cikti, { recursive: true });
const ai = process.argv.indexOf('--araba'), gorunum = ai > 0 ? process.argv[ai + 1] : 'hazir';
const ADLAR = ['mert.can.21', 'nazlı_can', 'ozan_dayı', 'sibel_abla', 'baran.21', 'elif_naz', 'Hacı Salihoğlu', 'kübra__34', 'yusuf61', 'Emre Aksu', 'zeynep', 'babie.live', 'Osman', 'LazReiL', 'almira', 'atike.11', 'Gumbatte', 'RAHMİCAN', 'ssuuddeli', 'usge.29', 'merve', 'editciumut', 'Servet Cankurt', 'Enver Paşa', 'Halil', 'Zeki', 'Hayal', 'aziz__im', 'selinay', 'EY', 'Bey_38', 'yukaa', 'Nazan', 'User2110', 'ilginTR', 'Fatma'];

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const hatalar = [];
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; });
  p.on('pageerror', e => hatalar.push(String(e)));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort().catch(() => { }));
  await p.goto(OYUN + '?araba=' + gorunum + '#yayin');
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    document.getElementById('ses-cagri').hidden = true;
    if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click();
    document.getElementById('bosalt').click();
  });
  // 36 araba; önde 999'luk hediyelerle büyük jetonlu bir gelin arabası (süper araba değil), arkada sıradan konvoy
  await p.evaluate(adlar => {
    adlar.forEach((ad, i) => CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'kare:' + ad, ad }, metin: '' }));
    for (let i = 0; i < 4; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kare:' + adlar[0], ad: adlar[0] }, jeton: 999 });
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kare:' + adlar[1], ad: adlar[1] }, jeton: 300 });
  }, ADLAR);
  await p.waitForTimeout(5000);
  const kim = ADLAR[9], id = 'kare:' + kim;
  const yakin = async kimId => {
    await p.evaluate(() => { CanliOyun._test.D.reji.zorla = 'yakin'; });
    await p.waitForTimeout(300);
    await p.evaluate(i => { const D = CanliOyun._test.D, k = D.oy.get(i); D.reji.cekim.k = k; D.reji.konu = k; D.reji.cekim.yan = -1; D.reji.cekim.d = undefined; }, kimId);
  };
  const birlestir = async (a, c, cik) => {
    const s = await b.newPage({ viewport: { width: 1080, height: 960 } });
    const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(cikti, f)).toString('base64');
    await s.setContent('<body style="margin:0;display:flex;background:#111;font:700 28px sans-serif;color:#fff">' + [[a, 'hediyeden hemen önce'], [c, 'hediyeden 0,6 sn sonra']].map(([f, y]) => '<div style="position:relative"><img style="width:540px;height:960px;display:block" src="' + img(f) + '"><span style="position:absolute;left:10px;top:10px;background:#000c;padding:2px 10px">' + y + '</span></div>').join('') + '</body>');
    await s.waitForTimeout(200);
    fs.writeFileSync(path.join(cikti, cik), await s.screenshot());
    await s.close();
    fs.unlinkSync(path.join(cikti, a));
    fs.unlinkSync(path.join(cikti, c));
  };
  // değişim anı: aynı yakın çekimde hediyeden hemen önce ve 0,6 sn sonra
  await yakin(id);
  await p.waitForTimeout(1500);
  fs.writeFileSync(path.join(cikti, 'super-an-once.png'), await p.screenshot());
  await p.evaluate(([i, a]) => CanliOyun.olay({ tip: 'hediye', kullanici: { id: i, ad: a }, jeton: 1000 }), [id, kim]);
  await yakin(id);
  await p.waitForTimeout(600);
  fs.writeFileSync(path.join(cikti, 'super-an-sonra.png'), await p.screenshot());
  await birlestir('super-an-once.png', 'super-an-sonra.png', 'super-an.png');
  // güzellik karesi: konvoyun içinde, kart söndükten sonra
  await p.waitForTimeout(5000);
  await yakin(id);
  await p.waitForTimeout(1600);
  fs.writeFileSync(path.join(cikti, 'super-vitrin.png'), await p.screenshot());
  // drone: tam konvoy, tek süper araba
  await p.evaluate(() => { CanliOyun._test.D.reji.zorla = 'drone'; });
  await p.waitForTimeout(2000);
  fs.writeFileSync(path.join(cikti, 'super-drone.png'), await p.screenshot());
  // gelin arabası süper araba olunca: aynı kişi büyük hediyelerle öne geçer
  await p.evaluate(([i, a]) => { for (let j = 0; j < 4; j++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: i, ad: a }, jeton: 1000 }); }, [id, kim]);
  await p.waitForTimeout(6000);
  await yakin(id);
  await p.waitForTimeout(1800);
  fs.writeFileSync(path.join(cikti, 'super-gelin.png'), await p.screenshot());
  const d = await p.evaluate(() => { const d = CanliOyun.durum(); return { lider: d.lider, superAraba: d.superAraba, gelinSusu: d.gelinSusu, ornek: d.ornek }; });
  console.log(JSON.stringify(d));
  console.log(hatalar.length ? 'HATALAR:\n' + hatalar.join('\n') : 'sayfa hatası yok');
  await b.close();
})();
