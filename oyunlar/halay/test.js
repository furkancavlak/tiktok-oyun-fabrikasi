// Halaya özgü kontroller: mendil el değiştirince pankart, her kademenin sahnedeki hareketi, solo kuyruğu.
// Çekirdek testleri ayrıca çalışır (cekirdek/test/cekirdek.test.js halay). Çalıştırma: node oyunlar/halay/test.js
'use strict';
const path = require('path');
const { OYUN_URL, CIKTI, tarayici, raporla, kontrolcu, bekle: durumBekle, hazirBekle } = require(path.join(__dirname, '..', '..', 'cekirdek', 'test', 'ortak'));
const { sonuc, kontrol } = kontrolcu();

(async () => {
  const b = await tarayici();
  const hatalar = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => hatalar.push('SAYFA HATASI: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await p.goto(OYUN_URL);
  await hazirBekle(p);
  const bosalt = () => p.evaluate(() => { document.getElementById('bosalt').click(); });
  const O = o => p.evaluate(o2 => CanliOyun.olay(o2), o);
  const durum = () => p.evaluate(() => CanliOyun.durum());

  // mendil el değiştirir
  await bosalt();
  await O({ tip: 'yorum', kullanici: { id: 'a', ad: 'Ali' }, metin: 'halay' });
  await O({ tip: 'yorum', kullanici: { id: 'b', ad: 'Bora' }, metin: 'selam' });
  let d = await durum();
  kontrol('Durumda halay başı adı da var', d.halayBasi === 'Ali' && d.lider === 'Ali', d.halayBasi);
  await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: 5 });
  const pk = await p.evaluate(() => ({ pankart: document.getElementById('pankart-yeri').textContent, ucus: !!CanliOyun._test.D.mendilUcus }));
  kontrol('Mendil el değiştirince pankart yeni halay başını yazar, mendil uçar', /Mendil el değiştirdi/.test(pk.pankart) && pk.pankart.includes('Bora') && pk.ucus, pk);
  await p.waitForTimeout(1300);
  kontrol('Uçan mendil bir saniyede yerine varır', await p.evaluate(() => !CanliOyun._test.D.mendilUcus));

  // her kademe kendi hareketini başlatır
  await bosalt();
  const kd = await p.evaluate(() => {
    const D = CanliOyun._test.D, cik = {};
    D.sovBit = -1; // önceki denemelerden kalan davul şovu ölçümü bozmasın
    for (const j of [1, 9, 10, 49, 50, 199, 200, 999, 1000, 50000]) {
      CanliOyun._test.zamanEkle(0.2);
      const soloOnce = D.soloKuyruk.length + (D.solo ? 1 : 0);
      CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kd' + j, ad: 'kd' + j }, jeton: j });
      const k = D.oy.get('kd' + j);
      cik[j] = { hareket: D.hareket && D.hareket.tip, sov: CanliOyun.durum().vurus < D.sovBit, solo: D.soloKuyruk.length + (D.solo ? 1 : 0) - soloOnce, zipla: k.zip1 > k.zip0 };
      D.hareket = null;
    }
    return cik;
  });
  const bekle = (j, h, sov, solo) => kd[j].hareket === h && kd[j].sov === sov && kd[j].solo === solo && kd[j].zipla;
  kontrol('1–9 jeton: yalnız gönderen zıplar', bekle(1, null, false, 0) && bekle(9, null, false, 0), [kd[1], kd[9]]);
  kontrol('10–49 jeton: herkes omuz titretir', bekle(10, 'omuz', false, 0) && bekle(49, 'omuz', false, 0), [kd[10], kd[49]]);
  kontrol('50–199 jeton: herkes çöker', bekle(50, 'cok', false, 0) && bekle(199, 'cok', false, 0), [kd[50], kd[199]]);
  kontrol('200–999 jeton: davul şovu başlar, omuz titrer', bekle(200, 'omuz', true, 0) && bekle(999, 'omuz', true, 0), [kd[200], kd[999]]);
  kontrol('1000+ jeton: gönderen solo kuyruğuna girer, davul şovu başlar', kd[1000].solo === 1 && kd[1000].sov && kd[50000].solo === 1, [kd[1000], kd[50000]]);
  // Solo bir sonraki vuruşta başlar (eskiden sabit 2,5 sn).
  await durumBekle(p, 'solo kd1000 ile başladı', () => CanliOyun.durum().solo === 'kd1000', undefined, 8000);
  d = await durum();
  kontrol('Solo sırası gelen ortaya çıkar', d.solo === 'kd1000', d.solo);
  await p.locator('#sahne').screenshot({ path: CIKTI + '/h-solo.png' });

  // solo kuyruğu selde de 4'te kalır
  await bosalt();
  const sel = await p.evaluate(() => {
    for (let i = 0; i < 3000; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'f' + (i % 300), ad: 'f' + (i % 300) }, jeton: [1, 10, 50, 200, 1000][i % 5] });
    return CanliOyun._test.D.soloKuyruk.length;
  });
  kontrol('Selde solo kuyruğu en çok 4 kişi', sel <= 4, sel);

  kontrol('Halay testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
