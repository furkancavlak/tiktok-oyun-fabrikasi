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
  // WebGL uyarıları da hata sayılır ("Vertex buffer is not big enough" gibi; taşma testi bunlara bakar)
  p.on('console', m => { if ((m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) || (m.type() === 'warning' && /WebGL|GL_|Vertex buffer/.test(m.text()))) hatalar.push(m.text()); });
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

  // Süper araba: yalnız TEK bir hediyenin birim değeri (jeton) eşiğe (SUPER_ESIK = 1000) ulaşırsa; seri (adet), toplam
  // ve 999 saymaz. Kasa o anda bir kez değişir, ikinci büyük hediyede an yine kalkar ama kasa yeniden değişmez.
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 9; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 's' + i, ad: 'super' + i }, metin: 'x' }); });
  await p.waitForTimeout(600);
  const tip = id => p.evaluate(i => { const k = CanliOyun._test.D.oy.get(i); return k && k.ar && k.ar.tip; }, id);
  await O({ tip: 'hediye', kullanici: { id: 's1', ad: 'super1' }, jeton: 999 });
  await O({ tip: 'hediye', kullanici: { id: 's2', ad: 'super2' }, jeton: 1, adet: 1000 });
  for (let i = 0; i < 10; i++) await O({ tip: 'hediye', kullanici: { id: 's3', ad: 'super3' }, jeton: 100 });
  d = await durum();
  kontrol('999 jetonluk hediye, 1 jetonluk hediyeden 1000\'lik seri ve on tane 100\'lük hediye süper araba yapmaz', d.superAraba.length === 0 && d.superDegisim === 0 && (await tip('s2')) !== 'super' && (await tip('s3')) !== 'super', { super: d.superAraba, s3: d.sira.find(x => x[0] === 'super3') });
  await O({ tip: 'hediye', kullanici: { id: 's4', ad: 'super4' }, jeton: 1000 });
  d = await durum();
  const sKart = await p.evaluate(() => { const D = CanliOyun._test.D; return { an: D.superAn && D.superAn.k.id, b0: D.superAn && D.superAn.b0, pankart: document.getElementById('pankart-yeri').textContent }; });
  kontrol('Tek seferde 1000 jetonluk hediye o anda kasayı süper arabaya çevirir; an ve kart onundur, pankart yazar', (await tip('s4')) === 'super' && d.superAraba.join() === 'super4' && d.superDegisim === 1 && sKart.an === 's4' && /SÜPER ARABA/.test(sKart.pankart), { d: d.superAraba, sKart });
  await p.waitForTimeout(400);
  await O({ tip: 'hediye', kullanici: { id: 's4', ad: 'super4' }, jeton: 1000 });
  const sKart2 = await p.evaluate(() => CanliOyun._test.D.superAn.b0);
  d = await durum();
  kontrol('Aynı izleyicinin ikinci 1000 jetonluk hediyesi anı yeniden başlatır, kasayı ikinci kez değiştirmez', sKart2 > sKart.b0 && d.superDegisim === 1 && (await tip('s4')) === 'super', { b0: [sKart.b0, sKart2], degisim: d.superDegisim });
  await p.waitForTimeout(600);
  d = await durum();
  kontrol('Süper arabanın sahibi gelin arabasıysa gelin süsü süper arabanın üstündedir', d.lider === 'super4' && d.gelinSusu.join() === 'super', { lider: d.lider, sus: d.gelinSusu });
  // çıkıp geri gelen yine süper arabayla gelir (lider sahneden çıkmaz: lider olmayan bir süper araba sahibi denenir)
  await O({ tip: 'hediye', kullanici: { id: 's5', ad: 'super5' }, jeton: 1000 });
  await p.waitForTimeout(300);
  const geri = await p.evaluate(async () => {
    const D = CanliOyun._test.D, k = D.oy.get('s5');
    const lider = D.lider === k;
    k.son = -1e6;
    for (let i = 0; i < 40 && D.oy.has('s5'); i++) await new Promise(r => setTimeout(r, 200));
    const silindi = !D.oy.has('s5');
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 's5', ad: 'super5' }, metin: 'geldim' });
    await new Promise(r => setTimeout(r, 300));
    const y = D.oy.get('s5');
    return { lider, silindi, yeniKayit: y !== k, tip: y && y.ar && y.ar.tip };
  });
  kontrol('Süper araba kazanan çıkıp aynı yayında geri gelince yine süper arabayla gelir', !geri.lider && geri.silindi && geri.yeniKayit && geri.tip === 'super', geri);
  // havuzlar: 36 arabanın altısı süper arabayken her çizilen arabanın dört tekerleği, iki plakası durur, WebGL hata yazmaz
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'h' + i, ad: 'havuz' + i }, metin: 'x' }); });
  const glSuper = hatalar.length;
  await p.evaluate(() => { for (let i = 0; i < 6; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'h' + (i * 5), ad: 'havuz' + (i * 5) }, jeton: 1000 }); });
  await p.waitForTimeout(1500);
  const hv = await p.evaluate(() => CanliOyun.durum().ornek);
  kontrol('Altı süper arabayla 36 arabada örnek havuzları tam (tekerlek 4, plaka 2 araba başına), WebGL hata yazmaz', hv.super === 6 && hv.araba === 36 && hv.teker === hv.araba * 4 && hv.plaka === hv.araba * 2 && hatalar.length === glSuper, { hv, gl: hatalar.slice(glSuper, glSuper + 2) });

  // Taşma: 36 araba sahnedeyken 1,7 saniyede 30 kişi daha girer (çıkanlar birikir). Örnek havuzları taşmaz, WebGL
  // hata yazmaz, her çizilen arabanın dört tekerleği ve iki plakası durur (denetim: test/cikti/denetim-3b/tasma2.js).
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 't' + i, ad: 'dolu' + i }, metin: 'x' }); });
  await p.waitForTimeout(2500);
  const glOnce = hatalar.length;
  const tas = await p.evaluate(async () => {
    for (let i = 0; i < 60; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'u' + i, ad: 'yeni' + i }, metin: 'x' });
    const enCok = [];
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 120));
      const d = CanliOyun.durum();
      enCok.push({ oy: CanliOyun._test.D.oy.size, ...d.ornek });
    }
    return enCok;
  });
  const tasKotu = tas.filter(x => x.teker !== x.araba * 4 || x.plaka !== x.araba * 2 || x.araba > 64 || x.yuvaCakisma || x.adYanlis);
  kontrol('Bir anda 60 kişi girince (yaşayan kayıt 64 üstü) örnek havuzları taşmaz: tekerlek ve plakalar tam, WebGL hata yazmaz', tasKotu.length === 0 && hatalar.length === glOnce && tas.some(x => x.oy > 64), { enCok: tas.reduce((a, x) => x.oy > a.oy ? x : a, tas[0]), kotu: tasKotu.length, gl: hatalar.slice(glOnce, glOnce + 2) });

  // Plaka hücresi kayda bağlıdır: çıkmakta olan izleyici yeniden yazınca (aynı kimlik, yeni kayıt) eski hücre boşalır.
  // 90 tur sonra her çizilen arabanın kendi hücresi ve kendi adı var; "boşalt" atlası temizler (denetim: plaka.js).
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'a' + i, ad: 'ilk' + i }, metin: 'x' }); });
  await p.waitForTimeout(1500);
  const pl = await p.evaluate(async () => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms));
    let tur = 0;
    for (let i = 0; i < 90; i++) {
      const once = new Set(D.sira.map(k => k.id));
      CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'n' + i, ad: 'yeni' + i }, metin: 'x' });
      const cikan = [...once].find(id => !D.sira.some(k => k.id === id));
      await bekle(60);
      if (cikan) { CanliOyun.olay({ tip: 'yorum', kullanici: { id: cikan, ad: 'geri_' + cikan }, metin: 'geldim' }); tur++; }
      await bekle(60);
    }
    await bekle(2500);
    const o = CanliOyun.durum().ornek;
    document.getElementById('bosalt').click();
    await bekle(300);
    return { tur, o, bos: CanliOyun.durum().ornek.bosYuva };
  });
  kontrol('Plaka hücreleri sızmaz: 90 geri dönüşten sonra her araba kendi hücresinde kendi adıyla; boşaltınca bütün hücreler boşalır', pl.tur > 30 && pl.o.yuvaCakisma === 0 && pl.o.adYanlis === 0 && pl.o.yuva === pl.o.araba && pl.bos === 127, pl);

  // Tek ad: büyük kartın konusu (lider çekiminde yeni gelin arabası) küçük etiketle ikinci kez yazılmaz
  await p.evaluate(() => { for (let i = 0; i < 9; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'k' + i, ad: 'kart' + i }, metin: 'x' }); CanliOyun._test.D.reji.zorla = 'lider'; });
  await p.waitForTimeout(1500);
  await p.waitForTimeout(2500);
  const kart = await p.evaluate(() => { const o = CanliOyun._test.olcum(); return { lider: (o.kisiler.find(k => k.lider) || {}).etiket || null, oteki: o.kisiler.filter(k => !k.lider && k.etiket).length, cekim: CanliOyun.durum().cekim }; });
  // Tek istisna: kadrajda başka hiçbir ad yoksa çekirdeğin "en az bir ad" kuralı için konunun küçük etiketi de yazılır.
  kontrol('Lider çekiminde gelin arabasının adı yalnız büyük kartta (başka ad varken küçük etiket yok)', kart.cekim === 'lider' && (kart.lider === null || kart.oteki === 0), kart);
  await p.evaluate(() => { CanliOyun._test.D.reji.zorla = null; });
  const kal = await durum();
  kontrol('Kalite kademesi ve gerçek kare aralığı durumda (ekran kartında en yüksek kademe)', kal.kalite === 0 && kal.kareAralik > 0 && kal.kareAralik < 26 && kal.webgl === true, { kalite: kal.kalite, kareAralik: kal.kareAralik });

  kontrol('Konvoy 3B testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();

  // WebGL yok: sahnede düz Türkçe uyarı, konsolda hata yok, kurallar yine çalışır
  const b2 = await tarayici(['--disable-webgl', '--disable-3d-apis']);
  const p2 = await b2.newPage({ viewport: { width: 1280, height: 800 } }), h2 = [];
  p2.on('pageerror', e => h2.push('SAYFA HATASI: ' + e.message));
  p2.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_|Failed to load resource|AudioContext/.test(m.text())) h2.push(m.type() + ': ' + m.text()); });
  await p2.goto(OYUN_URL);
  await p2.waitForTimeout(1200);
  const ng = await p2.evaluate(() => {
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'w', ad: 'webglsiz' }, metin: 'x' });
    const t = document.getElementById('tuval'), g = t.getContext('2d'), px = g.getImageData(Math.round(t.width / 2), Math.round(t.height * 0.6), 1, 1).data;
    return { webgl: CanliOyun.durum().webgl, kisi: CanliOyun.durum().kisi, piksel: Array.from(px), tuval3b: !!document.getElementById('tuval-3b') };
  });
  await p2.locator('#sahne').screenshot({ path: CIKTI + '/k-webgl-yok.png' });
  kontrol('WebGL yokken sahnede koyu uyarı kartı çıkar, konsolda hata yok, oyun olayları işler', ng.webgl === false && !ng.tuval3b && ng.kisi >= 1 && ng.piksel[0] < 80 && h2.length === 0, { ...ng, hata: h2.slice(0, 3) });
  await b2.close();

  // Yazılımla çizim (ekran kartı yok gibi): gerçek kare aralığı ölçülür, kalite kademe kademe düşer; en düşükte de
  // yavaşsa panelde düz bir uyarı çıkar.
  const b3 = await tarayici(['--use-angle=swiftshader', '--enable-unsafe-swiftshader']);
  const p3 = await b3.newPage({ viewport: { width: 1080, height: 1920 } });
  await p3.goto(OYUN_URL + '#yayin');
  await p3.waitForTimeout(800);
  await p3.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 's' + i, ad: 'yazilim' + i }, metin: 'x' }); });
  // en çok 45 sn: önce kademeler iner, en düşükte bir ölçüm daha yavaşsa uyarı çıkar
  for (let i = 0; i < 15; i++) {
    await p3.waitForTimeout(3000);
    if (await p3.evaluate(() => CanliOyun.durum().kalite >= 3 && (CanliOyun.durum().kareAralik < 33 || [...document.querySelectorAll('#panel p.not')].some(e => /yetişmiyor/.test(e.textContent)))))
      break;
  }
  const sw = await p3.evaluate(() => { const d = CanliOyun.durum(); return { gpu: d.gpu, kalite: d.kalite, kareAralik: d.kareAralik, kareMs: +d.kareMs.toFixed(1), uyari: [...document.querySelectorAll('#panel p.not')].some(e => /ekran kartı 3B sahneye yetişmiyor/.test(e.textContent)) }; });
  kontrol('Yazılımla çizimde gerçek kare aralığı ölçülür, kalite düşer; en düşükte de yavaşsa panel uyarır', sw.kalite >= 3 && (sw.kareAralik < 33 || sw.uyari), sw);
  await b3.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
