// Konvoya özgü kontroller: gelin arabası el değiştirince pankart ve uçan kurdele, her kademenin sahnedeki
// etkisi, drift kuyruğu, diziliş (gelin arabası en önde, hediye atan öne geçer), çıkan arabanın yoldan gitmesi.
// Çekirdek testleri ayrıca çalışır (cekirdek/test/cekirdek.test.js konvoy). Çalıştırma: node oyunlar/konvoy/test.js konvoy
'use strict';
const path = require('path');
const { OYUN_URL, CIKTI, tarayici, raporla, kontrolcu, bekle: sayfaBekle, hazirBekle } = require(path.join(__dirname, '..', '..', 'cekirdek', 'test', 'ortak'));
const { sonuc, kontrol } = kontrolcu();

(async () => {
  const b = await tarayici();
  const hatalar = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => hatalar.push('SAYFA HATASI: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await p.goto(OYUN_URL);
  await hazirBekle(p);
  await p.evaluate(() => { if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click(); });
  const bosalt = () => p.evaluate(() => { document.getElementById('bosalt').click(); });
  const O = o => p.evaluate(o2 => CanliOyun.olay(o2), o);
  const durum = () => p.evaluate(() => CanliOyun.durum());

  // gelin arabası el değiştirir
  await bosalt();
  await O({ tip: 'yorum', kullanici: { id: 'a', ad: 'Ali' }, metin: 'düt' });
  await O({ tip: 'yorum', kullanici: { id: 'b', ad: 'Bora' }, metin: 'selam' });
  let d = await durum();
  kontrol('Durumda gelin arabasının sahibi de var', d.gelinArabasi === 'Ali' && d.lider === 'Ali', d.gelinArabasi);
  await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: 5 });
  const pk = await p.evaluate(() => ({ pankart: document.getElementById('pankart-yeri').textContent, ucus: !!CanliOyun._test.D.kurdeleUcus, ayniAraba: CanliOyun._test.D.kurdeleUcus && CanliOyun._test.D.kurdeleUcus.kime === CanliOyun._test.D.lider }));
  kontrol('Gelin arabası el değiştirince pankart yeni sahibini yazar, süs taçla aynı anda yeni arabaya geçer', /Gelin arabası el değiştirdi/.test(pk.pankart) && pk.pankart.includes('Bora') && pk.ucus && pk.ayniAraba, pk);
  await p.waitForTimeout(2200);
  kontrol('Süsün açılış geçişi iki vuruşta biter', await p.evaluate(() => !CanliOyun._test.D.kurdeleUcus));

  // diziliş: gelin arabası en önde ve ortada; hediye atan öne geçer; herkesin adı var
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 12; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'd' + i, ad: 'dizi' + i }, metin: 'x' }); });
  await p.waitForTimeout(3500);
  const diz = await p.evaluate(() => {
    const D = CanliOyun._test.D, L = D.lider, digerleri = D.sira.slice(1);
    const liderX = L.hedefX, liderZ = L.hedefZ, enOnde = digerleri.every(k => k.hedefZ > L.hedefZ), once = D.oy.get('d11').hedefZ;
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'd11', ad: 'dizi11' }, jeton: 1 });
    const sonra = D.oy.get('d11').hedefZ;
    return { liderX, liderZ, enOnde, once, sonra,
      etiket: D.sira.filter(k => k.et || (k._et && k._et.y < CanliOyun.durum().etiketUst)).length, ustte: D.sira.filter(k => k.et && k.et.y < CanliOyun.durum().etiketUst && k !== D.lider).length, kisi: D.sira.length, ayni: new Set(D.sira.map(k => k.hedefX.toFixed(2) + ',' + k.hedefZ.toFixed(2))).size };
  });
  kontrol('Gelin arabası ortada, herkesin önünde', diz.liderX === 0 && diz.enOnde, diz);
  kontrol('İki araba aynı yere konmaz', diz.ayni === diz.kisi, diz.ayni + '/' + diz.kisi);
  kontrol('Hediye atan arka sıradan öne geçer', diz.sonra < diz.once, [diz.once, diz.sonra]);
  kontrol('Her arabanın adı var; yalnız kadrajın üst kenarındakilerin adı sıralama kutusuna girmesin diye yazılmaz', diz.etiket === diz.kisi && diz.ustte === 0, diz.etiket + '/' + diz.kisi + ', üstte yazılan ' + diz.ustte);

  // her kademe kendi etkisini başlatır
  await bosalt();
  for (let i = 0; i < 6; i++) await O({ tip: 'yorum', kullanici: { id: 'e' + i, ad: 'eski' + i }, metin: 'x' });
  const kd = await p.evaluate(() => {
    const T = CanliOyun._test, D = T.D, cik = {};
    D.sovBit = -1; D.fisekBit = -1;
    for (const j of [1, 9, 10, 49, 50, 199, 200, 999, 1000, 50000]) {
      T.zamanEkle(0.2);
      for (const k of D.oy.values()) k.korna = -99;
      D.zigzag = null; D.fisekler.length = 0; D.sovBit = -1; D.fisekBit = -1;
      const driftOnce = D.driftKuyruk.length + (D.drift ? 1 : 0);
      CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kd' + j, ad: 'kd' + j }, jeton: j });
      const k = D.oy.get('kd' + j), du = CanliOyun.durum();
      cik[j] = { korna: du.korna, gonderenKorna: k.korna > -99, zigzag: du.zigzag, fisek: du.fisek > 0, sov: du.vurus < D.sovBit, drift: D.driftKuyruk.length + (D.drift ? 1 : 0) - driftOnce, zipla: k.zip1 > k.zip0 };
    }
    return cik;
  });
  const tek = x => x.gonderenKorna && x.korna === 1 && !x.zigzag && !x.fisek && !x.sov && x.drift === 0 && x.zipla;
  const hepsi = x => x.gonderenKorna && x.korna >= 7 && x.zipla;
  kontrol('1–9 jeton: yalnız gönderenin arabası korna çalıp zıplar', tek(kd[1]) && tek(kd[9]), [kd[1], kd[9]]);
  kontrol('10–49 jeton: bütün konvoy korna çalar', hepsi(kd[10]) && hepsi(kd[49]) && !kd[10].zigzag && !kd[49].fisek, [kd[10], kd[49]]);
  kontrol('50–199 jeton: konvoy zigzag yapar', hepsi(kd[50]) && kd[50].zigzag && kd[199].zigzag && !kd[199].fisek, [kd[50], kd[199]]);
  kontrol('200–999 jeton: havai fişek ve davul şovu başlar', kd[200].fisek && kd[200].sov && kd[999].fisek && kd[999].drift === 0, [kd[200], kd[999]]);
  kontrol('1000+ jeton: gönderen drift kuyruğuna girer, fişek de atılır', kd[1000].drift === 1 && kd[1000].fisek && kd[50000].drift === 1, [kd[1000], kd[50000]]);
  // Drift sırası gelen öne sürülür ve büyür (eskiden sabit 2,5 sn): beklenen durum kontrolün kendisidir.
  await sayfaBekle(p, 'drift kd1000: yıldız, öne çıktı (z < -3), büyüdü (> 1,3)', () => { const D = CanliOyun._test.D; return CanliOyun.durum().drift === 'kd1000' && !!D.drift && D.drift.k.yildiz && D.drift.k.z < -3 && (D.drift.k.olcek || 1) > 1.3; }, undefined, 8000);
  d = await durum();
  const dr = await p.evaluate(() => { const D = CanliOyun._test.D; return D.drift && { ad: D.drift.k.ad, yildiz: D.drift.k.yildiz, x: +D.drift.k.x.toFixed(2), z: +D.drift.k.z.toFixed(2), olcek: +(D.drift.k.olcek || 1).toFixed(2) }; });
  kontrol('Drift sırası gelen en öne çıkar, büyür ve yıldız olur', d.drift === 'kd1000' && dr && dr.yildiz && dr.z < -3 && dr.olcek > 1.3, dr);
  await p.locator('#sahne').screenshot({ path: CIKTI + '/k-drift.png' });
  const bitti = await p.evaluate(async () => { CanliOyun._test.D.drift.bas -= 40; await new Promise(r => setTimeout(r, 400)); const D = CanliOyun._test.D, k = D.oy.get('kd1000'); return { simdiki: D.drift ? D.drift.k.ad : null, eskiYildiz: k.yildiz }; });
  kontrol('Drift bitince sıradaki geçer, öncekinin yıldızlığı kalkar', bitti.simdiki === 'kd50000' && !bitti.eskiYildiz, bitti);

  // selde drift kuyruğu ve fişekler sınırlı kalır
  await bosalt();
  const sel = await p.evaluate(() => {
    for (let i = 0; i < 3000; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'f' + (i % 300), ad: 'f' + (i % 300) }, jeton: [1, 10, 50, 200, 1000][i % 5] });
    const D = CanliOyun._test.D; return { kuyruk: D.driftKuyruk.length, fisek: D.fisekler.length };
  });
  kontrol('Selde drift kuyruğu en çok 4, gökte en çok 14 fişek', sel.kuyruk <= 4 && sel.fisek <= 14, sel);

  // hareket: yarım saniye arayla üç kare; yol çizgileri akar, arabalar vuruşla yaylanır, zigzagda kıvrılır
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 9; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'h' + i, ad: 'hareket' + i }, metin: 'x' }); });
  await p.waitForTimeout(3000);
  await O({ tip: 'hediye', kullanici: { id: 'h8', ad: 'hareket8' }, jeton: 50 });
  await p.waitForTimeout(1200);
  const anlar = [];
  for (let i = 0; i < 3; i++) {
    if (i) await p.waitForTimeout(500);
    await p.locator('#sahne').screenshot({ path: CIKTI + '/hareket-' + (i + 1) + '.png' });
    anlar.push(await p.evaluate(() => {
      const D = CanliOyun._test.D, t = document.getElementById('tuval'), g = t.getContext('2d');
      // tuvalin alt kısmı (öndeki yol) ve orta şerit (arabalar): her karede ham pikseller
      const al = (y0, y1) => Array.from(g.getImageData(0, Math.round(t.height * y0), t.width, Math.round(t.height * (y1 - y0))).data.filter((_, i) => i % 16 === 0));
      return { vurus: CanliOyun.durum().vurus, kayma: D.kayma, oy: D.sira.map(k => +k.oy0.toFixed(4)), ox: D.sira.map(k => +k.ox.toFixed(4)), yol: al(0.82, 0.98), araba: al(0.45, 0.8) };
    }));
  }
  const fark = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 12) n++; return +(n / a.length).toFixed(3); };
  const hr = [0, 1].map(i => ({ vurus: +(anlar[i + 1].vurus - anlar[i].vurus).toFixed(2), kayma: +(anlar[i + 1].kayma - anlar[i].kayma).toFixed(2), yolPiksel: fark(anlar[i].yol, anlar[i + 1].yol), arabaPiksel: fark(anlar[i].araba, anlar[i + 1].araba), zipla: anlar[i].oy.filter((v, j) => Math.abs(v - anlar[i + 1].oy[j]) > 0.002).length, kivril: anlar[i].ox.filter((v, j) => Math.abs(v - anlar[i + 1].ox[j]) > 0.02).length }));
  kontrol('Yarım saniyede yol akar: çizgilerin pikselleri değişir', hr.every(h => h.kayma > 0.3 && h.yolPiksel > 0.01), hr.map(h => ({ kayma: h.kayma, yolPiksel: h.yolPiksel })));
  kontrol('Yarım saniyede arabalar yaylanır ve zigzagda kıvrılır', hr.every(h => h.zipla >= 5 && h.kivril >= 5 && h.arabaPiksel > 0.02), hr);

  // çıkan araba yoldan çekilir ve silinir
  await bosalt();
  const cikis = await p.evaluate(async () => {
    for (let i = 0; i < 4; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'c' + i, ad: 'cik' + i }, metin: 'x' });
    // durum beklemesi: kosul doğru olunca ya da sinir dolunca döner (kontrol durumu kendisi sınar)
    const durumBekle = (kosul, sinir) => new Promise(r => { const t0 = performance.now(); (function d() { if (kosul()) r(true); else if (performance.now() - t0 > sinir) r(false); else setTimeout(d, 25); })(); });
    const D = CanliOyun._test.D, k = D.oy.get('c3');
    // önce araba yerine varır (eskiden sabit 1,5 sn), sonra sessiz kalınca çekilip silinir (eskiden sabit 2,5 sn)
    await durumBekle(() => Math.hypot(k.x - k.hedefX, k.z - k.hedefZ) < 0.2, 6000);
    k.son = -1e6;
    await durumBekle(() => !D.sira.includes(k) && !D.oy.has('c3'), 8000);
    return { cikti: !D.sira.includes(k), silindi: !D.oy.has('c3'), gitti: !!k.gitti, x: +k.x.toFixed(2) };
  });
  kontrol('Uzun süre sessiz kalan araba kenara çekip yoldan çıkar', cikis.cikti && cikis.silindi, cikis);

  kontrol('Konvoy testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
