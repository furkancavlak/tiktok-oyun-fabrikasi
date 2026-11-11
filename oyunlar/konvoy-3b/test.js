// Gelin Konvoyu 3B'ye özgü kontroller: kurallar (Gelin Konvoyu'ndan aynen: gelin arabası el değiştirir, her kademe
// kendi etkisini başlatır, drift kuyruğu, diziliş, çıkan araba) ve 3B'ye özgü olanlar: WebGL tuvali çekirdeğin
// tuvalinin arkasında ve aynı boyda, kamera rejisi (sekiz çekim zorlanabilir, tuşlar, olay çekimleri), konunun ve
// adların 505–1006 şeridinde kalması, sahnenin akması.
// Çekirdek testleri ayrıca çalışır (cekirdek/test/cekirdek.test.js konvoy-3b). Çalıştırma: node oyunlar/konvoy-3b/test.js konvoy-3b
'use strict';
const path = require('path');
const { OYUN_URL, CIKTI, tarayici, raporla, kontrolcu } = require(path.join(__dirname, '..', '..', 'cekirdek', 'test', 'ortak'));
const { sonuc, kontrol } = kontrolcu();
const CEKIMLER = ['drone', 'yan', 'on', 'kus', 'tur', 'yakin', 'kenar', 'vinc'];

(async () => {
  const b = await tarayici();
  const hatalar = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => hatalar.push('SAYFA HATASI: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await p.goto(OYUN_URL);
  await p.waitForTimeout(800);
  await p.evaluate(() => { if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click(); });
  const bosalt = () => p.evaluate(() => { document.getElementById('bosalt').click(); });
  const O = o => p.evaluate(o2 => CanliOyun.olay(o2), o);
  const durum = () => p.evaluate(() => CanliOyun.durum());

  // 3B tuval: çekirdeğin tuvalinin önünde (DOM'da), yani arkasında görünür; aynı piksel boyu
  const tv = await p.evaluate(() => { const t = document.getElementById('tuval'), g = document.getElementById('tuval-3b'); return { var: !!g, once: !!g && g.nextElementSibling === t, w: g && g.width, h: g && g.height, tw: t.width, th: t.height, gpu: CanliOyun.durum().gpu }; });
  kontrol('WebGL tuvali #sahne içinde, çekirdeğin tuvalinin arkasında ve aynı boyda', tv.var && tv.once && tv.w === tv.tw && tv.h === tv.th, tv);

  // gelin arabası el değiştirir
  await bosalt();
  await O({ tip: 'yorum', kullanici: { id: 'a', ad: 'Ali' }, metin: 'düt' });
  await O({ tip: 'yorum', kullanici: { id: 'b', ad: 'Bora' }, metin: 'selam' });
  let d = await durum();
  kontrol('Durumda gelin arabasının sahibi de var', d.gelinArabasi === 'Ali' && d.lider === 'Ali', d.gelinArabasi);
  await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: 5 });
  const pk = await p.evaluate(() => ({ pankart: document.getElementById('pankart-yeri').textContent, ucus: !!CanliOyun._test.D.kurdeleUcus, ayniAraba: CanliOyun._test.D.kurdeleUcus && CanliOyun._test.D.kurdeleUcus.kime === CanliOyun._test.D.lider, olay: CanliOyun._test.D.reji.olay && CanliOyun._test.D.reji.olay.tur }));
  kontrol('Gelin arabası el değiştirince pankart yeni sahibini yazar, süs yeni arabaya geçer, reji lider çekimi ister', /Gelin arabası el değiştirdi/.test(pk.pankart) && pk.pankart.includes('Bora') && pk.ucus && pk.ayniAraba && pk.olay === 'lider', pk);
  for (let i = 0; i < 25 && (await durum()).cekim !== 'lider'; i++) await p.waitForTimeout(200);
  kontrol('Reji bir sonraki ölçüde yeni gelin arabasına keser (lider çekimi)', (await durum()).cekim === 'lider', (await durum()).cekim);
  await p.waitForTimeout(1500);
  kontrol('Süsün açılış geçişi iki vuruşta biter', await p.evaluate(() => !CanliOyun._test.D.kurdeleUcus));

  // diziliş
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 12; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'd' + i, ad: 'dizi' + i }, metin: 'x' }); });
  await p.waitForTimeout(3500);
  const diz = await p.evaluate(() => {
    const D = CanliOyun._test.D, L = D.lider, digerleri = D.sira.slice(1), once = D.oy.get('d11').hedefS;
    const r = { liderS: L.hedefS, liderL: L.hedefL, enOnde: digerleri.every(k => k.hedefS < L.hedefS - 5), kolon: D.kolon, once };
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'd11', ad: 'dizi11' }, jeton: 1 });
    r.sonra = D.oy.get('d11').hedefS;
    r.kisi = D.sira.length;
    r.ayni = new Set(D.sira.map(k => k.hedefL.toFixed(2) + ',' + k.hedefS.toFixed(2))).size;
    return r;
  });
  kontrol('Gelin arabası ortada, herkesin önünde; 12 arabada iki şerit', diz.liderS === 0 && diz.liderL === 0 && diz.enOnde && diz.kolon === 2, diz);
  kontrol('İki araba aynı yere konmaz', diz.ayni === diz.kisi, diz.ayni + '/' + diz.kisi);
  kontrol('Hediye atan arka sıradan öne geçer', diz.sonra > diz.once, [diz.once, diz.sonra]);

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
  let dr = null;
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(250);
    dr = await p.evaluate(() => { const D = CanliOyun._test.D; return D.drift && { ad: D.drift.k.ad, yildiz: D.drift.k.yildiz, gs: +D.drift.k.gs.toFixed(2), donus: D.drift.donus, cekim: CanliOyun.durum().cekim }; });
    if (dr && dr.donus !== null && dr.cekim === 'sov') break;
  }
  kontrol('Drift sırası gelen gelin arabasının önüne fırlar, yıldız olur, dönmeye başlar; reji ona keser (şov çekimi)', dr && dr.ad === 'kd1000' && dr.yildiz && dr.gs > 8 && dr.donus !== null && dr.cekim === 'sov', dr);
  await p.locator('#sahne').screenshot({ path: CIKTI + '/k-drift.png' });
  const bitti = await p.evaluate(async () => { CanliOyun._test.D.drift.donus -= 40; await new Promise(r => setTimeout(r, 400)); const D = CanliOyun._test.D, k = D.oy.get('kd1000'); return { simdiki: D.drift ? D.drift.k.ad : null, eskiYildiz: k.yildiz }; });
  kontrol('Drift bitince sıradaki geçer, öncekinin yıldızlığı kalkar', bitti.simdiki === 'kd50000' && !bitti.eskiYildiz, bitti);

  // selde drift kuyruğu ve fişekler sınırlı kalır
  await bosalt();
  const sel = await p.evaluate(() => {
    for (let i = 0; i < 3000; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'f' + (i % 300), ad: 'f' + (i % 300) }, jeton: [1, 10, 50, 200, 1000][i % 5] });
    const D = CanliOyun._test.D; return { kuyruk: D.driftKuyruk.length, fisek: D.fisekler.length };
  });
  kontrol('Selde drift kuyruğu en çok 4, gökte en çok 14 fişek', sel.kuyruk <= 4 && sel.fisek <= 14, sel);

  // reji: sekiz çekim zorlanır; her birinde konu şeritte, adlar şeritte; 0 tuşu otomatiğe döner
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 20; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'r' + i, ad: 'reji' + i }, metin: 'x' }); });
  await p.waitForTimeout(3500);
  const rj = {};
  for (const c of CEKIMLER) {
    await p.evaluate(a => { CanliOyun._test.D.reji.zorla = a; }, c);
    await p.waitForTimeout(c === 'vinc' ? 2500 : 1300);
    rj[c] = await p.evaluate(() => { const d = CanliOyun.durum(), o = CanliOyun._test.olcum(); return { cekim: d.cekim, konu: d.konuKadraj, adlar: o.kisiler.filter(k => k.etiket).map(k => [Math.round(k.etiket[1]), Math.round(k.etiket[1] + k.etiket[3])]) }; });
  }
  kontrol('Sekiz çekimin her biri zorlanabilir (D.reji.zorla) ve durumda adı yazar', CEKIMLER.every(c => rj[c].cekim === c), CEKIMLER.map(c => rj[c].cekim));
  const serit = CEKIMLER.filter(c => !(rj[c].konu && rj[c].konu[1] >= 505 && rj[c].konu[3] <= 1006 && rj[c].konu[4] === 0));
  kontrol('Her çekimde asıl konu 505–1006 satırlarında (üstte yazılar, altta TikTok yorumları)', serit.length === 0, serit.map(c => c + ' ' + JSON.stringify(rj[c].konu)).join(' | ') || CEKIMLER.map(c => c + ' ' + rj[c].konu[1] + '–' + rj[c].konu[3]).join(', '));
  const adDisari = CEKIMLER.filter(c => rj[c].adlar.some(([u, a]) => u < 505 || a > 1006));
  kontrol('Ad etiketleri hiçbir çekimde şeritten taşmaz', adDisari.length === 0, adDisari.join(', ') || CEKIMLER.map(c => c + ':' + rj[c].adlar.length).join(' '));
  await p.keyboard.press('2');
  await p.waitForTimeout(400);
  const t2 = await durum();
  await p.keyboard.press('0');
  await p.waitForTimeout(400);
  const t0 = await durum();
  kontrol('2 tuşu yan çekimi zorlar, 0 tuşu otomatiğe döner', t2.cekim === 'yan' && t2.cekimZorla === 'yan' && t0.cekimZorla === null, { t2: t2.cekim, t0: t0.cekimZorla });
  // otomatik reji: 30 saniyede en az dört farklı çekim, art arda aynı çekim yok, kesmeler ölçü çizgisinde
  const oto = await p.evaluate(async () => {
    const D = CanliOyun._test.D, iz = [];
    let son = null;
    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 100));
      const c = D.reji.cekim;
      if (c && c !== son) { iz.push([c.ad, +(c.b0 % 4).toFixed(2), c.taraf, c.yuk]); son = c; }
    }
    return iz;
  });
  const adlar = oto.map(x => x[0]), farkli = new Set(adlar).size, ardisik = adlar.some((a, i) => i && a === adlar[i - 1]);
  const ayniYan = oto.some((x, i) => i && x[2] === oto[i - 1][2] && x[3] === oto[i - 1][3]);
  kontrol('Otomatik reji 30 sn: en az dört farklı çekim, art arda aynı çekim ve aynı yan + yükseklik yok', farkli >= 4 && !ardisik && !ayniYan, adlar.join(' → '));
  kontrol('Kesmeler vuruş saatinin ölçü çizgilerinde (4 vuruş)', oto.slice(1).every(x => x[1] === 0), oto.map(x => x[0] + '@' + x[1]).join(', '));

  // hareket: yol akar, arabalar yaylanır, 3B tuvalin pikselleri değişir
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 9; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'h' + i, ad: 'hareket' + i }, metin: 'x' }); CanliOyun._test.D.reji.zorla = 'yan'; });
  await p.waitForTimeout(2500);
  await O({ tip: 'hediye', kullanici: { id: 'h8', ad: 'hareket8' }, jeton: 50 });
  await p.waitForTimeout(1000);
  const anlar = [];
  for (let i = 0; i < 3; i++) {
    if (i) await p.waitForTimeout(500);
    anlar.push(await p.evaluate(() => {
      const D = CanliOyun._test.D, t = document.getElementById('tuval-3b'), k = document.createElement('canvas');
      k.width = 180; k.height = 320;
      const g = k.getContext('2d');
      g.drawImage(t, 0, 0, 180, 320);
      return { yol: D.yol, oy: D.sira.map(k => +k.oy0.toFixed(4)), ox: D.sira.map(k => +k.ox.toFixed(4)), piksel: Array.from(g.getImageData(0, 0, 180, 320).data.filter((_, i) => i % 8 === 0)) };
    }));
  }
  const fark = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 12) n++; return +(n / a.length).toFixed(3); };
  const hr = [0, 1].map(i => ({ yol: +(anlar[i + 1].yol - anlar[i].yol).toFixed(2), piksel: fark(anlar[i].piksel, anlar[i + 1].piksel), zipla: anlar[i].oy.filter((v, j) => Math.abs(v - anlar[i + 1].oy[j]) > 0.002).length, kivril: anlar[i].ox.filter((v, j) => Math.abs(v - anlar[i + 1].ox[j]) > 0.02).length }));
  kontrol('Yarım saniyede konvoy yol alır, 3B sahnenin pikselleri değişir', hr.every(h => h.yol > 1 && h.piksel > 0.02), hr);
  kontrol('Yarım saniyede arabalar yaylanır ve zigzagda kıvrılır', hr.every(h => h.zipla >= 5 && h.kivril >= 5), hr);
  await p.evaluate(() => { CanliOyun._test.D.reji.zorla = null; });

  // çıkan araba yoldan çekilir ve silinir
  await bosalt();
  const cikis = await p.evaluate(async () => {
    for (let i = 0; i < 4; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'c' + i, ad: 'cik' + i }, metin: 'x' });
    await new Promise(r => setTimeout(r, 1500));
    const D = CanliOyun._test.D, k = D.oy.get('c3');
    k.son = -1e6;
    await new Promise(r => setTimeout(r, 2500));
    return { cikti: !D.sira.includes(k), silindi: !D.oy.has('c3') };
  });
  kontrol('Uzun süre sessiz kalan araba kenara çekip yoldan çıkar', cikis.cikti && cikis.silindi, cikis);

  kontrol('Konvoy 3B testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
