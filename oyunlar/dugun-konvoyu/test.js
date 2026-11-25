// Düğün Konvoyu'na özgü kontroller: gelin arabası (izleyici değil, en önde), katılım (tek araba, plaka, sona
// eklenme), her hediye kademesinin gönderenin arabasındaki etkisi, adet × jeton, aynı hediyenin iki kez işlenmesi,
// süsün birikmesi, turbo, şov kuyruğu, liderlik devri, coşku, bozuk olay. Gelin Konvoyu testinden (oyunlar/konvoy/test.js)
// uyarlandı. Çekirdek testleri ayrıca çalışır. Çalıştırma: node oyunlar/dugun-konvoyu/test.js dugun-konvoyu
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
  const yorum = (id, ad) => O({ tip: 'yorum', kullanici: { id, ad: ad || id }, metin: 'x' });

  // gelin arabası: izleyici değil, sıralamada yok, adı var, hep en önde
  await bosalt();
  for (let i = 0; i < 5; i++) await yorum('g' + i);
  await p.waitForTimeout(800);
  const gl = await p.evaluate(() => {
    const D = CanliOyun._test.D, ek = CanliOyun._test.olcum().kisiler;
    return { oyda: [...D.oy.keys()].some(id => /npc/.test(id)), kisi: D.sira.length, onde: D.sira.every(k => k.hedefZ > -1.6 + 1), etiket: ek.some(k => k.ad === 'Gelin arabası' && k.etiket) };
  });
  kontrol('Gelin arabası izleyici değildir: sıralamaya girmez', !gl.oyda && gl.kisi === 5, gl);
  kontrol('Bütün izleyici arabaları gelin arabasının arkasındadır', gl.onde, gl);
  kontrol('Gelin arabasının adı sahnede yazar', gl.etiket, gl);

  // katılım: aynı kişi ikinci kez yazınca ikinci araba yok; yeni gelen sona eklenir; herkesin kendi plakası var
  await yorum('g0', 'g0');
  await yorum('yeni', 'yenigelen');
  const kt = await p.evaluate(() => {
    const D = CanliOyun._test.D, y = D.oy.get('yeni');
    const plakalar = D.sira.map(k => k.ar.plaka);
    return { kisi: D.sira.length, sonda: D.sira.every(k => k === y || k.hedefZ <= y.hedefZ), plaka: plakalar.every(s => /^\d\d [A-Z]{2} \d{3}$/.test(s)), farkli: new Set(plakalar).size === plakalar.length, ayniPlaka: D.oy.get('g1').ar.plaka };
  });
  kontrol('Aynı kişi ikinci kez yazınca ikinci araba oluşmaz', kt.kisi === 6, kt.kisi);
  kontrol('Yeni katılan konvoyun sonuna eklenir', kt.sonda, kt);
  kontrol('Her araba kendi plakasını taşır (il kodu, iki harf, üç rakam)', kt.plaka && kt.farkli, kt);
  await bosalt();
  await yorum('g1');
  const plaka2 = await p.evaluate(() => CanliOyun._test.D.oy.get('g1').ar.plaka);
  kontrol('Plaka kimlikten türer: aynı izleyici yeniden gelince aynı plakayla gelir', plaka2 === kt.ayniPlaka, [plaka2, kt.ayniPlaka]);

  // liderlik: en çok hediye atan lider; devirde pankart ve bayrak uçuşu
  await bosalt();
  await yorum('a', 'Ali');
  await yorum('b', 'Bora');
  let d = await durum();
  kontrol('Durumda konvoy lideri var', d.konvoyLideri === 'Ali', d.konvoyLideri);
  await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: 5 });
  const ld = await p.evaluate(() => { const D = CanliOyun._test.D; return { pankart: document.getElementById('pankart-yeri').textContent, ucus: !!D.bayrakUcus && D.bayrakUcus.kime === D.lider, lider: D.lider.ad, x: D.lider.hedefX, z: D.lider.hedefZ, digerZ: D.oy.get('a').hedefZ }; });
  kontrol('Lider değişince pankart yeni lideri yazar, bayrak yeni lidere uçar', /yeni lideri/.test(ld.pankart) && ld.pankart.includes('Bora') && ld.ucus && ld.lider === 'Bora', ld);
  kontrol('Lider gelin arabasının hemen arkasında, ötekilerin önünde', ld.z < ld.digerZ && ld.z < 3, ld);
  await p.waitForTimeout(2600);
  kontrol('Bayrak geçişi iki vuruşta biter', await p.evaluate(() => !CanliOyun._test.D.bayrakUcus));

  // her kademe gönderenin arabasında kendi etkisini başlatır
  await bosalt();
  for (let i = 0; i < 6; i++) await yorum('e' + i);
  const kd = await p.evaluate(() => {
    const T = CanliOyun._test, D = T.D, cik = {};
    for (const j of [1, 9, 10, 49, 50, 199, 200, 999, 1000]) {
      T.zamanEkle(1);
      for (const k of D.oy.values()) { k.korna = -99; k.turbo = -99; }
      D.kirpinti.length = 0; D.fisekler.length = 0;
      const sovOnce = D.sovKuyruk.length + (D.sov ? 1 : 0);
      CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kd' + j, ad: 'kd' + j }, jeton: j });
      const k = D.oy.get('kd' + j), du = CanliOyun.durum();
      cik[j] = { kendiKorna: k.korna > -99, korna: du.korna, kirpinti: D.kirpinti.filter(x => x.k === k).length, sus: k.sus, turbo: du.turbo > 0 && k.turbo > -99, fisek: D.fisekler.length > 0, sov: D.sovKuyruk.length + (D.sov ? 1 : 0) - sovOnce, zipla: k.zip1 > k.zip0 };
    }
    return cik;
  });
  const korna = x => x.kendiKorna && x.korna === 1 && x.kirpinti === 0 && !x.sus && !x.turbo && x.zipla;
  kontrol('1–9 jeton: yalnız gönderenin arabası korna çalıp zıplar', korna(kd[1]) && korna(kd[9]), [kd[1], kd[9]]);
  kontrol('10–49 jeton: gönderenin arabasının etrafında konfeti patlar', kd[10].kirpinti > 20 && !kd[10].sus && kd[49].kirpinti > 20 && !kd[49].turbo, [kd[10], kd[49]]);
  kontrol('50–199 jeton: gönderenin arabasına süs ve ışık gelir', kd[50].sus === 1 && kd[199].sus === 1 && !kd[199].turbo, [kd[50], kd[199]]);
  kontrol('200–999 jeton: gönderen turbo yapar, bütün konvoy korna çalar', kd[200].turbo && kd[200].korna >= 7 && kd[999].turbo && kd[999].sov === 0, [kd[200], kd[999]]);
  kontrol('1000+ jeton: gönderen şov kuyruğuna girer, gökte fişek', kd[1000].sov === 1 && kd[1000].fisek, kd[1000]);
  await sayfaBekle(p, 'şov kd1000: gelin arabasının önüne geçti, büyüdü', () => { const D = CanliOyun._test.D; return !!D.sov && D.sov.k.ad === 'kd1000' && D.sov.k.z < -4 && (D.sov.k.olcek || 1) > 1.5; }, undefined, 9000);
  const sv = await p.evaluate(() => { const D = CanliOyun._test.D; return D.sov && { z: +D.sov.k.z.toFixed(2), olcek: +(D.sov.k.olcek || 1).toFixed(2), gelinX: CanliOyun.durum().gelinX }; }).catch(() => null);
  kontrol('Şov yapan gelin arabasının önüne geçer ve büyür', sv && sv.z < -4 && sv.olcek > 1.5, sv);
  await sayfaBekle(p, 'gelin arabası şov arabası geçince ortaya döner', () => Math.abs(CanliOyun.durum().gelinX) < 0.3, undefined, 4000);
  kontrol('Gelin arabası şov arabasına yol verir, geçince ortaya döner', sv && sv.gelinX > 0.5 && Math.abs((await durum()).gelinX) < 0.3, sv);
  await p.locator('#sahne').screenshot({ path: CIKTI + '/k-sov.png' });

  // tek hediyenin değeri × adet: 100 jetonluk hediyeden 10 tane = 1000 → şov
  await bosalt();
  await yorum('s1');
  await O({ tip: 'hediye', kullanici: { id: 's1', ad: 's1' }, jeton: 100, adet: 10 });
  const sr = await p.evaluate(() => { const D = CanliOyun._test.D; return { jeton: D.oy.get('s1').jeton, sov: D.sovKuyruk.length + (D.sov ? 1 : 0) }; });
  kontrol('Adet × birim doğru sayılır: 10 × 100 jeton şov başlatır', sr.jeton === 1000 && sr.sov === 1, sr);

  // aynı hediye olayı kısa arayla iki kez gelirse etki bir kez işlenir; süs en çok üç kat birikir
  await bosalt();
  await yorum('t');
  const tk = await p.evaluate(() => {
    const T = CanliOyun._test, D = T.D, h = { tip: 'hediye', kullanici: { id: 't', ad: 't' }, jeton: 50, hediye: { id: 'deneme-x', ad: 'X' } };
    CanliOyun.olay(h); CanliOyun.olay(h);
    const ikiKez = D.oy.get('t').sus;
    for (let i = 0; i < 6; i++) { T.zamanEkle(1); CanliOyun.olay(h); }
    return { ikiKez, sonra: D.oy.get('t').sus };
  });
  kontrol('Aynı hediye olayı iki kez gelince süs bir kez eklenir', tk.ikiKez === 1, tk);
  kontrol('Süs ayrı hediyelerle birikir, en çok üç kat', tk.sonra === 3, tk);
  await p.waitForTimeout(600);
  await p.locator('#sahne').screenshot({ path: CIKTI + '/k-sus.png' });

  // turbo görüntüsü
  await O({ tip: 'hediye', kullanici: { id: 't', ad: 't' }, jeton: 200 });
  await p.waitForTimeout(900);
  await p.locator('#sahne').screenshot({ path: CIKTI + '/k-turbo.png' });
  kontrol('Turbo yapan araba ileri fırlar', await p.evaluate(() => CanliOyun._test.D.oy.get('t').oz < -0.1));

  // beğeniler coşkuyu doldurur, sonra coşku söner
  await bosalt();
  const c0 = (await durum()).cosku;
  await O({ tip: 'begeni', kullanici: { id: 'l', ad: 'l' }, adet: 200 });
  const c1 = (await durum()).cosku;
  await p.evaluate(() => CanliOyun._test.zamanEkle(20));
  await p.waitForTimeout(400);
  const c2 = (await durum()).cosku;
  kontrol('Beğeni coşku göstergesini doldurur, zamanla söner', c1 > c0 && c2 < c1, [c0, c1, c2]);

  // selde şov kuyruğu, fişek ve konfeti parçaları sınırlı kalır
  await bosalt();
  const sel = await p.evaluate(() => {
    for (let i = 0; i < 3000; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'f' + (i % 300), ad: 'f' + (i % 300) }, jeton: [1, 10, 50, 200, 1000][i % 5] });
    const D = CanliOyun._test.D; return { kuyruk: D.sovKuyruk.length, fisek: D.fisekler.length, kirpinti: D.kirpinti.length };
  });
  kontrol('Selde şov kuyruğu en çok 4, en çok 14 fişek, en çok 260 konfeti parçası', sel.kuyruk <= 4 && sel.fisek <= 14 && sel.kirpinti <= 260, sel);

  // bozuk ya da eksik olaylar oyunu durdurmaz
  await bosalt();
  await p.evaluate(() => {
    for (const o of [null, {}, { tip: 'hediye' }, { tip: 'hediye', kullanici: {} , jeton: 'çok' }, { tip: 'yorum', kullanici: { id: 5 } }, { tip: 'hediye', kullanici: { id: 'z', ad: 'z' }, jeton: -5, adet: 'x' }, { tip: 'begeni', adet: NaN }])
      try { CanliOyun.olay(o); } catch (e) { window.__bozukHata = String(e); }
  });
  await p.waitForTimeout(500);
  const bz = await p.evaluate(() => ({ hata: window.__bozukHata || null, kare: CanliOyun.durum().kareMs }));
  kontrol('Bozuk olaylar hata fırlatmaz, oyun çizmeye devam eder', !bz.hata && bz.kare > 0, bz);

  kontrol('Düğün Konvoyu testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
