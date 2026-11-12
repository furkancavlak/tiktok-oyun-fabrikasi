// Gelin Konvoyu 3B'ye özgü kontroller: kurallar (Gelin Konvoyu'ndan aynen: gelin arabası el değiştirir, her kademe
// kendi etkisini başlatır, drift kuyruğu, diziliş, çıkan araba) ve 3B'ye özgü olanlar: WebGL tuvali çekirdeğin
// tuvalinin arkasında ve aynı boyda, kamera rejisi (sekiz çekim zorlanabilir, tuşlar, olay çekimleri), konunun ve
// adların 505–1006 şeridinde kalması, sahnenin akması.
// Çekirdek testleri ayrıca çalışır (cekirdek/test/cekirdek.test.js konvoy-3b). Çalıştırma: node oyunlar/konvoy-3b/test.js konvoy-3b
// ya da node araclar/test.js konvoy-3b --yalniz oyun [--hizli]. Kademe (TEST_KADEME, ortak.js): "hizli"da uzun reji
// koşuları (geniş çekim kuralları, çarpışma) kısa sürer, aynı kontrollerle; "tam" sürüm öncesi her şeyi tam sürer.
'use strict';
const path = require('path');
const { OYUN_URL, CIKTI, KADEME, tarayici, raporla, kontrolcu, bekle, hazirBekle, kareBekle } = require(path.join(__dirname, '..', '..', 'cekirdek', 'test', 'ortak'));
const { sonuc, kontrol } = kontrolcu();
const HIZLI = KADEME === 'hizli';
const CEKIMLER = ['drone', 'yan', 'on', 'kus', 'tur', 'yakin', 'kenar', 'vinc'];

(async () => {
  const b = await tarayici();
  const hatalar = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => hatalar.push('SAYFA HATASI: ' + e.message));
  // WebGL uyarıları da hata sayılır ("Vertex buffer is not big enough" gibi; taşma testi bunlara bakar)
  p.on('console', m => { if ((m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) || (m.type() === 'warning' && /WebGL|GL_|Vertex buffer/.test(m.text()))) hatalar.push(m.text()); });
  await p.goto(OYUN_URL);
  await hazirBekle(p);
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
  await bekle(p, 'reji lider çekimine kesti', () => CanliOyun.durum().cekim === 'lider', null, 5000);
  kontrol('Reji bir sonraki ölçüde yeni gelin arabasına keser (lider çekimi)', (await durum()).cekim === 'lider', (await durum()).cekim);
  await bekle(p, 'gelin süsünün geçişi bitti', () => !CanliOyun._test.D.kurdeleUcus, null, 1500);
  kontrol('Süsün açılış geçişi iki vuruşta biter', await p.evaluate(() => !CanliOyun._test.D.kurdeleUcus));

  // diziliş
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 12; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'd' + i, ad: 'dizi' + i }, metin: 'x' }); });
  // hedef yerler sıra değişince hemen kurulur (oyunYerlesim); birkaç kare akması yeter
  await kareBekle(p, 3);
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
    dr = await p.evaluate(() => { const D = CanliOyun._test.D; D.reji.sonOlay = null; return D.drift && { ad: D.drift.k.ad, yildiz: D.drift.k.yildiz, gs: +D.drift.k.gs.toFixed(2), donus: D.drift.donus, cekim: CanliOyun.durum().cekim }; });
    // dönüş, varınca ya da 12 vuruş dolunca başlar; araba ondan sonra da gelin arabasının önüne doğru sürer
    if (dr && dr.donus !== null && ['sov', 'super'].includes(dr.cekim) && dr.gs > 8) break;
  }
  // tek seferde 1000 jeton süper araba da verir: reji süper araba çekimine keser, o çekim driftin sonuna dek dönen arabayı çeker
  kontrol('Drift sırası gelen gelin arabasının önüne fırlar, yıldız olur, dönmeye başlar; reji ona keser (şov ya da süper araba çekimi)', dr && dr.ad === 'kd1000' && dr.yildiz && dr.gs > 8 && dr.donus !== null && ['sov', 'super'].includes(dr.cekim), dr);
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
  // Rejinin rastgeleliği açılıştaki tohuma döner: aşağıdaki 30 sn'lik otomatik reji ölçüsü önceki bölümlerdeki olay
  // çekimlerinin (şov, süper araba) rastgele sayı tüketimine bağlı kalmasın (yoksa 30 sn'de üç uzun çekim gelebiliyor).
  await p.evaluate(() => CanliOyun._test.D.reji.rndSifirla());
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
  const sonBildirim = () => p.evaluate(() => { const b = document.getElementById('bildirim').lastChild; return b ? b.textContent : ''; });
  await O({ tip: 'hediye', kullanici: { id: 's1', ad: 'super1' }, jeton: 999 });
  await O({ tip: 'hediye', kullanici: { id: 's2', ad: 'super2' }, jeton: 1, adet: 1000 });
  const seriYazi = await sonBildirim();
  for (let i = 0; i < 10; i++) await O({ tip: 'hediye', kullanici: { id: 's3', ad: 'super3' }, jeton: 100 });
  await O({ tip: 'hediye', kullanici: { id: 's6', ad: 'super6' }, jeton: 100, adet: 10 });
  const seriYazi2 = await sonBildirim();
  d = await durum();
  kontrol('999 jetonluk hediye, 1 jetonluk hediyeden 1000\'lik seri, 100 × 10 seri ve on tane 100\'lük hediye süper araba yapmaz', d.superAraba.length === 0 && d.superDegisim === 0 && (await tip('s2')) !== 'super' && (await tip('s3')) !== 'super' && (await tip('s6')) !== 'super', { super: d.superAraba, s3: d.sira.find(x => x[0] === 'super3') });
  // seri en üst kademeye (1000) toplamla gelir: bildirim ve olay günlüğü "Süper araba" değil "Drift şov" der
  await p.waitForTimeout(200);
  const gunlukSeri = await p.evaluate(() => [...document.querySelectorAll('#gunluk li')].map(li => li.textContent).filter(x => /super2|super6/.test(x) && /jeton/.test(x)));
  kontrol('Seriyle 1000 jetona gelen hediyenin bildirimi ve günlük satırı "Drift şov" yazar, "Süper araba" yazmaz', /Drift şov!/.test(seriYazi) && /Drift şov!/.test(seriYazi2) && !/Süper araba/.test(seriYazi + seriYazi2) && gunlukSeri.length >= 2 && gunlukSeri.every(x => /Drift şov/.test(x) && !/Süper araba/.test(x)), { seriYazi, seriYazi2, gunlukSeri });
  await O({ tip: 'hediye', kullanici: { id: 's4', ad: 'super4' }, jeton: 1000 });
  d = await durum();
  const s4Yazi = await sonBildirim();
  // an rejinin süper araba sırasına girer (ya da hemen çekime / geniş çekimin kartına geçer)
  const sKart = await p.evaluate(() => { const D = CanliOyun._test.D, R = D.reji, k = D.oy.get('s4'); return { an: D.superAn && D.superAn.k.id, b0: D.superAn && D.superAn.b0, olay: R.superSira.some(a => a.k === k) || !!(R.cekim && R.cekim.ad === 'super' && R.cekim.k === k) || !!(R.vurgu && R.vurgu.k === k && R.vurgu.ust === 'SÜPER ARABA') }; });
  kontrol('Tek seferde 1000 jetonluk hediye o anda kasayı süper arabaya çevirir; an onundur, rejiye süper araba anı olarak gider; bildirim "Süper araba!" der', (await tip('s4')) === 'super' && d.superAraba.join() === 'super4' && d.superDegisim === 1 && sKart.an === 's4' && sKart.olay && /1000 jeton Süper araba!/.test(s4Yazi), { d: d.superAraba, sKart, s4Yazi });
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

  // Süper araba anı ekranda: büyük kartın yazıları (CanliOyun.durum().kart: [üst, ad, alt], 60-cizim.js) ve reji.
  // (a) Yeni gelen izleyici tek 1000 jetonla hem süper arabayı hem gelin arabasını alır: tek an. Kart "SÜPER ARABA" + ad +
  //     "Gelin arabası da artık onda"; "Gelin arabası el değiştirdi" pankartı açılmaz, "YENİ GELİN ARABASI" kartı çıkmaz;
  //     kart 3 sn içinde çıkar, reji 8 sn içinde süper araba çekimine keser (kısa bir ara kesme sürüyorsa onu bekler). Panel düğmesi de "Süper araba" yazar.
  // (d) Aynı kişinin ikinci 1000'liği (an sürerken) kartta yeniden duyurulur ("Yine 1.000 jeton"); kasa bir kez değişir.
  // (b) Gelin arabası olmayan birinin 1000'liği: kart "SÜPER ARABA" + ad + "1.000 jetonluk hediye", gelin arabası aynı.
  const superAnIzle = (id, sure) => p.evaluate(async ([id, sure]) => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms));
    const iz = { ustler: [], altlar: [], cekim: false, liderKarti: false, pankart: '', kartIlk: null };
    const t0 = performance.now();
    while (performance.now() - t0 < sure) {
      const d = CanliOyun.durum(), k = D.oy.get(id), pk = document.getElementById('pankart-yeri').textContent;
      if (pk)
        iz.pankart = pk;
      if (k && d.kart && d.kart[1] === k.ad) {
        if (d.kart[0] === 'YENİ GELİN ARABASI')
          iz.liderKarti = true;
        if (/^SÜPER ARABA/.test(d.kart[0])) {
          if (iz.kartIlk === null)
            iz.kartIlk = Math.round(performance.now() - t0);
          if (!iz.ustler.includes(d.kart[0])) iz.ustler.push(d.kart[0]);
          if (!iz.altlar.includes(d.kart[2])) iz.altlar.push(d.kart[2]);
        }
      }
      if (k && D.reji.cekim && D.reji.cekim.ad === 'super' && D.reji.cekim.k === k)
        iz.cekim = true;
      await bekle(50);
    }
    return iz;
  }, [id, sure]);
  const dugme = await p.evaluate(() => { const b = document.getElementById('h-1000'); return b ? b.textContent : null; });
  kontrol('Paneldeki 1000 jetonluk hediye düğmesi "Süper araba" yazar', /Süper araba/.test(dugme || ''), dugme);
  await bosalt();
  await p.evaluate(() => { CanliOyun._test.D.reji.zorla = null; for (let i = 0; i < 9; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'm' + i, ad: 'misafir' + i }, metin: 'x' }); });
  await p.waitForTimeout(2500);
  await O({ tip: 'hediye', kullanici: { id: 'yeni', ad: 'yeni_gelen' }, jeton: 1000 });
  const anA = await p.evaluate(() => { const D = CanliOyun._test.D; return { lider: D.lider && D.lider.ad, pankart: document.getElementById('pankart-yeri').textContent, an: D.superAn && { lider: D.superAn.lider, yeni: D.superAn.yeni } }; });
  const izA = await superAnIzle('yeni', 8000);
  kontrol('(a) Yeni izleyici 1000 jetonla gelin arabası da olunca: tek an, kart "SÜPER ARABA" + ad + "Gelin arabası da artık onda", pankart ve "YENİ GELİN ARABASI" kartı yok, süper araba çekimi', anA.lider === 'yeni_gelen' && anA.an && anA.an.lider && anA.an.yeni && !/el değiştirdi/.test(anA.pankart + izA.pankart) && !izA.liderKarti && izA.cekim && izA.kartIlk !== null && izA.kartIlk < 3000 && izA.ustler.includes('SÜPER ARABA') && izA.altlar.includes('Gelin arabası da artık onda'), { anA, izA });
  await O({ tip: 'hediye', kullanici: { id: 'yeni', ad: 'yeni_gelen' }, jeton: 1000 });
  const izD = await superAnIzle('yeni', 3000);
  d = await durum();
  kontrol('(d) Aynı izleyicinin ikinci 1000\'liği yeniden duyurulur ("Yine 1.000 jeton"), kasa bir kez değişir', izD.altlar.includes('Yine 1.000 jeton') && d.superDegisim === 1 && d.superAraba.join() === 'yeni_gelen', { izD, degisim: d.superDegisim, super: d.superAraba });
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 9; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'n' + i, ad: 'ikinci' + i }, metin: 'x' }); for (let i = 0; i < 3; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'n0', ad: 'ikinci0' }, jeton: 999 }); });
  await p.waitForTimeout(3000);
  await O({ tip: 'hediye', kullanici: { id: 'n5', ad: 'ikinci5' }, jeton: 1000 });
  const izB = await superAnIzle('n5', 8000);
  d = await durum();
  kontrol('(b) Gelin arabası olmayan birinin 1000\'liği: kart "SÜPER ARABA" + ad + "1.000 jetonluk hediye", süper araba çekimi, gelin arabası aynı', d.lider === 'ikinci0' && d.superAraba.join() === 'ikinci5' && izB.cekim && izB.kartIlk !== null && izB.kartIlk < 3000 && izB.ustler.includes('SÜPER ARABA') && izB.altlar.includes('1.000 jetonluk hediye') && !izB.pankart, { lider: d.lider, izB });

  // Süper araba sırası (50-reji.js superIsle): her süper araba hediyesi kendi çekimini alır, kart üstünde kalmaz.
  // (1) Bekleme süresinde (başka bir olay çekimi az önce bitti): yine bir sonraki ölçü çizgisinde (en çok 5 vuruşta)
  // o arabanın süper araba çekimi. (2) Başka bir olay çekimi sürerken: o bittiğinde arada geniş çekim olmadan sıradaki
  // çekim süper araba. (3) Üç izleyiciden art arda üç süper araba: üç çekim, hediye sırasıyla, her birinde o izleyicinin
  // arabası kadrajın oyuncu şeridinde (505–1006, kenarlarda taşma yok) bütün çekim boyunca.
  const kuyrukIzle = (ms, durSart) => p.evaluate(async ([ms, durSart]) => {
    const R = CanliOyun._test.D.reji, iz = [], dur = durSart ? new Function('iz', 'return ' + durSart) : null;
    let son = null;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const c = R.cekim;
      if (c !== son) { iz.push({ ad: c.ad, k: c.k ? c.k.id : null, b: +CanliOyun.durum().vurus.toFixed(2), n: 0, bandda: 0 }); son = c; }
      const kd = R.kadraj, x = iz[iz.length - 1];
      if (kd) { x.n++; if (kd[1] >= 505 && kd[3] <= 1006 && kd[0] >= 0 && kd[2] <= 720 && kd[4] === 0) x.bandda++; }
      if (dur && dur(iz)) break;
      await new Promise(r => setTimeout(r, 50));
    }
    return iz;
  }, [ms, durSart || '']);
  const GENIS_AD = ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'];
  const kuyrukHazir = async () => {
    await bosalt();
    await p.evaluate(() => { CanliOyun._test.D.reji.zorla = null; for (let i = 0; i < 20; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'q' + i, ad: 'kuyruk' + i }, metin: 'x' }); });
    await bekle(p, 'konvoy yerinde, geniş çekimde', g => g.includes(CanliOyun.durum().cekim) && CanliOyun._test.D.sira.length === 20, GENIS_AD, 8000);
    await kareBekle(p, 10);
  };
  const GENIS_SART = "['arka','drone','ucsol','ucsag','kus','vinc'].includes(iz[iz.length - 1].ad)";
  // (1) bekleme süresinde
  await kuyrukHazir();
  await p.evaluate(() => { CanliOyun._test.D.reji.sonOlay = null; CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'q12', ad: 'kuyruk12' }, jeton: 10 }); });
  const k1once = await kuyrukIzle(15000, "iz.length >= 2 && iz.slice(0, -1).some(x => x.k === 'q12') && " + GENIS_SART);
  const k1 = await p.evaluate(() => {
    const R = CanliOyun._test.D.reji, b = CanliOyun.durum().vurus, so = R.sonOlay;
    const r = { b0: +b.toFixed(2), beklemede: !!so && so.bitis !== null && b - so.bitis < Math.max(16, so.bitis - so.b) };
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'q15', ad: 'kuyruk15' }, jeton: 1000 });
    return r;
  });
  const k1iz = await kuyrukIzle(8000, "iz.some(x => x.ad === 'super') && iz[iz.length - 1].n > 30");
  const k1s = k1iz.find(x => x.ad === 'super');
  kontrol('Süper araba sırası (1): başka bir olay çekiminin bekleme süresinde gelen 1000\'lik en çok 5 vuruşta kendi çekimini alır, araba şeritte', k1.beklemede && !!k1s && k1s.k === 'q15' && k1s.b - k1.b0 <= 5 && k1s.n > 10 && k1s.bandda === k1s.n, { once: k1once.map(x => x.ad + (x.k ? ':' + x.k : '')), k1, iz: k1iz });
  // (2) başka bir olay çekimi sürerken
  await kuyrukHazir();
  await p.evaluate(() => { CanliOyun._test.D.reji.sonOlay = null; CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'q12', ad: 'kuyruk12' }, jeton: 10 }); });
  await kuyrukIzle(8000, "iz.some(x => x.k === 'q12')");
  const k2 = await p.evaluate(() => {
    const c = CanliOyun._test.D.reji.cekim, r = { cekim: c.ad, k: c.k ? c.k.id : null };
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'q16', ad: 'kuyruk16' }, jeton: 1000 });
    return r;
  });
  const k2iz = await kuyrukIzle(12000, "iz.length >= 2 && iz[iz.length - 1].n > 30");
  kontrol('Süper araba sırası (2): başka bir olay çekimi sürerken gelen 1000\'lik, o çekim bitince arada geniş çekim olmadan sıradaki çekimi alır, araba şeritte', ['lider', 'yakin', 'sollama'].includes(k2.cekim) && k2.k === 'q12' && k2iz.length >= 2 && k2iz[1].ad === 'super' && k2iz[1].k === 'q16' && k2iz[1].n > 10 && k2iz[1].bandda === k2iz[1].n, { k2, iz: k2iz });
  // (3) üç izleyiciden art arda üç süper araba
  await kuyrukHazir();
  await p.evaluate(() => { for (const i of [5, 10, 18]) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'q' + i, ad: 'kuyruk' + i }, jeton: 1000 }); });
  const k3iz = await kuyrukIzle(30000, "iz.filter(x => x.ad === 'super').length >= 3 && iz[iz.length - 1].ad !== 'super'");
  const k3s = k3iz.filter(x => x.ad === 'super');
  kontrol('Süper araba sırası (3): art arda üç 1000\'lik üç süper araba çekimi alır, hediye sırasıyla, her birinde o arabanın kendisi bütün çekim boyunca şeritte', k3s.map(x => x.k).join() === 'q5,q10,q18' && k3s.every(x => x.n > 10 && x.bandda === x.n) && k3iz.filter(x => !GENIS_AD.includes(x.ad) && x.ad !== 'super').length === 0, k3iz);
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
  const kart = await p.evaluate(() => { const o = CanliOyun._test.olcum(), L = CanliOyun._test.D.lider; return { lider: (o.kisiler.find(k => k.lider) || {}).etiket || null, liderKucuk: !!L.etKutu, liderKart: !!(L.oyunAd && L.oyunAd.kutu), cekim: CanliOyun.durum().cekim }; });
  // Tek istisna: kadrajda başka hiçbir ad yoksa çekirdeğin "en az bir ad" kuralı için konunun küçük etiketi de yazılır.
  kontrol('Lider çekiminde gelin arabasının adı yalnız büyük kartta (küçük etiket yok; ölçümde kartın kutusu sayılır)', kart.cekim === 'lider' && kart.liderKart && kart.liderKucuk === false, kart);
  await p.evaluate(() => { CanliOyun._test.D.reji.zorla = null; });
  const kal = await durum();
  kontrol('Kalite kademesi ve gerçek kare aralığı durumda (ekran kartında en yüksek kademe)', kal.kalite === 0 && kal.kareAralik > 0 && kal.kareAralik < 26 && kal.webgl === true, { kalite: kal.kalite, kareAralik: kal.kareAralik });

  // Tekerlek gövdeye girmez: 36 arabada (beş kasa tipi de) iki tam yaylanma döngüsü ve herkesin hediye zıplaması,
  // zigzag ve korna; her karede her tekerleğin gövde eksenindeki yeri ölçülür. Lastiğin tepesi kemerin tepesinin altında
  // (kemer > 0), lastiğin altı gövdenin eşiğinin altında (esik > 0) kalır.
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'z' + i, ad: 'zipla' + i }, metin: 'x' }); });
  await p.waitForTimeout(2500);
  const tk = await p.evaluate(async () => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms));
    D.tekerOlc = {};
    const b0 = CanliOyun.durum().vurus;
    for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'z' + i, ad: 'zipla' + i }, jeton: i % 3 ? 1 : 50 });
    // iki süper araba da ölçülsün (kendi tekerlek havuzu): tek seferde 1000 jetonluk hediye
    for (const i of [7, 20]) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'z' + i, ad: 'zipla' + i }, jeton: 1000 });
    while (CanliOyun.durum().vurus < b0 + 4) await bekle(50);
    return Object.fromEntries(Object.entries(D.tekerOlc).map(([t, o]) => [t, { kemer: +o.kemer.toFixed(3), esik: +o.esik.toFixed(3), n: o.n }]));
  });
  // görünümün bütün kasa tipleri (hazır modellerde sedan, kombi, van, süper araba; ?araba=kod ile beş kodlu kasa + süper)
  const tipler = (await durum()).arabaTipleri;
  kontrol('Zıplarken, yaylanırken, yatarken tekerlek gövdeye girmez (her kasa tipi: lastik kemerin altında, eşiğin altında)', tipler.every(t => tk[t] && tk[t].kemer > 0.01 && tk[t].esik > 0.05), tk);

  // Çarpışma: akış ve hediyelerle (sollama, katılan, çıkan, drift, yeni gelin arabası, şerit sayısı değişimi) 3, 9, 17
  // ve 36 arabada; her karede kesişen çift sayısı ve en küçük aralık. Hiç kesişme olmaz.
  // hizli: her kalabalıkta 12 tur (8,4 sn), tam: 24 tur (17 sn); kontroller aynı, kare tabanı süreyle orantılı
  const CARP_TUR = HIZLI ? 12 : 24;
  for (const n of [3, 9, 17, 36]) {
    await bosalt();
    const cp = await p.evaluate(async ([n, tur]) => {
      const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < n; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'c' + i, ad: 'carp' + i }, metin: 'x' });
      await bekle(1500);
      D.carpisma = { cift: 0, enAz: Infinity, kare: 0 };
      // Denetçinin ölçüsü (denetim-3b-2/carpisma.js, gecis.js): çizilen kutular (gövde, ayna hariç) 5 cm'den çok
      // kesişiyor mu, bir arabanın kenarı yol çizgisinden (4,3 m) taşıyor mu. Kendi çözücünün ölçüsünden bağımsız.
      const DIM = { sedan: [-2.22, 2.24, 1.66], hatch: [-1.93, 1.94, 1.62], kombi: [-2.27, 2.26, 1.68], van: [-2.33, 2.34, 1.82], pikap: [-2.38, 2.38, 1.72], super: [-2.28, 2.13, 1.84] };
      const rect = k => { const d = DIM[k.ar.tip], e = k._M.elements, nn = Math.hypot(e[0], e[2]), fx = e[0] / nn, fz = e[2] / nn, mid = (d[0] + d[1]) / 2; return { c: [e[12] + fx * mid, e[14] + fz * mid], u: [fx, fz], hl: (d[1] - d[0]) / 2, hw: d[2] / 2 }; };
      const pen = (A, Bb) => { let m = 1e9; const ax = [A.u, [-A.u[1], A.u[0]], Bb.u, [-Bb.u[1], Bb.u[0]]], dc = [Bb.c[0] - A.c[0], Bb.c[1] - A.c[1]], prj = (R, v) => R.hl * Math.abs(R.u[0] * v[0] + R.u[1] * v[1]) + R.hw * Math.abs(-R.u[1] * v[0] + R.u[0] * v[1]); for (const v of ax) m = Math.min(m, prj(A, v) + prj(Bb, v) - Math.abs(dc[0] * v[0] + dc[1] * v[1])); return m; };
      const olc = { kare: 0, kesisenKare: 0, enDerin: 0, kaldirimKare: 0 };
      const kareOlc = () => {
        // yalnız bu karede çizilen arabalar (çizim sınırının dışında kalanın matrisi eskidir)
        const tum = [...D.oy.values()].filter(k => k.ar && k._M && D.oy.get(k.id) === k), sonKare = Math.max(0, ...tum.map(k => k._cizKare || 0));
        const cars = tum.filter(k => k._cizKare === sonKare);
        let kes = false, kal = false;
        for (const k of cars) if (Math.abs(k.gl + k.ox) + DIM[k.ar.tip][2] / 2 > 4.3) kal = true;
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
          if (Math.abs(cars[i].gs - cars[j].gs) > 7) continue;
          const m = pen(rect(cars[i]), rect(cars[j]));
          if (m > 0.05) { kes = true; olc.enDerin = Math.max(olc.enDerin, +m.toFixed(2)); }
        }
        olc.kare++;
        if (kes) olc.kesisenKare++;
        if (kal) olc.kaldirimKare++;
      };
      let calis = true;
      (async () => { while (calis) { kareOlc(); await new Promise(r => requestAnimationFrame(r)); } })();
      for (let i = 0; i < tur; i++) {
        const id = 'c' + Math.floor(Math.random() * (n + 4));
        CanliOyun.olay({ tip: 'yorum', kullanici: { id, ad: 'carp' + id.slice(1) }, metin: 'hey' });
        if (i % 3 === 0) CanliOyun.olay({ tip: 'hediye', kullanici: { id, ad: 'carp' + id.slice(1) }, jeton: [1, 10, 50, 200, 1000, 400][i % 6] });
        if (i === 10) for (let j = 0; j < 6; j++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'x' + n + j, ad: 'akin' + j }, metin: 'x' });
        await bekle(700);
      }
      calis = false;
      const o = D.carpisma;
      return { cift: o.cift, enAz: +o.enAz.toFixed(3), kare: o.kare, ornek: o.ornek || null, denetci: olc };
    }, [n, CARP_TUR]);
    kontrol(n + ' araba, akış ve her kademe hediyeyle ' + Math.round(CARP_TUR * 0.7) + ' sn: hiçbir karede iki arabanın kutusu kesişmez, hiçbir araba kaldırıma çıkmaz', cp.cift === 0 && cp.kare > CARP_TUR * 25 / 3 && cp.denetci.kesisenKare === 0 && cp.denetci.kaldirimKare === 0, cp);
  }
  // Denetçinin senaryoları tek tek (36 araba): katılan, arkadan 40 jetonla öne geçen, çıkan, arkadan yeni gelin arabası,
  // zigzag, havai fişek, drift; her biri 6 sn.
  await bosalt();
  const sen = await p.evaluate(async () => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 36; i++) CanliOyun.olay(i < 3 ? { tip: 'hediye', kullanici: { id: 'a' + i, ad: 'oto' + i }, jeton: [300, 60, 15][i] } : { tip: 'yorum', kullanici: { id: 'a' + i, ad: 'oto' + i }, metin: 'x' });
    await bekle(6000);
      // Denetçinin ölçüsü (denetim-3b-2/carpisma.js, gecis.js): çizilen kutular (gövde, ayna hariç) 5 cm'den çok
      // kesişiyor mu, bir arabanın kenarı yol çizgisinden (4,3 m) taşıyor mu. Kendi çözücünün ölçüsünden bağımsız.
      const DIM = { sedan: [-2.22, 2.24, 1.66], hatch: [-1.93, 1.94, 1.62], kombi: [-2.27, 2.26, 1.68], van: [-2.33, 2.34, 1.82], pikap: [-2.38, 2.38, 1.72], super: [-2.28, 2.13, 1.84] };
      const rect = k => { const d = DIM[k.ar.tip], e = k._M.elements, nn = Math.hypot(e[0], e[2]), fx = e[0] / nn, fz = e[2] / nn, mid = (d[0] + d[1]) / 2; return { c: [e[12] + fx * mid, e[14] + fz * mid], u: [fx, fz], hl: (d[1] - d[0]) / 2, hw: d[2] / 2 }; };
      const pen = (A, Bb) => { let m = 1e9; const ax = [A.u, [-A.u[1], A.u[0]], Bb.u, [-Bb.u[1], Bb.u[0]]], dc = [Bb.c[0] - A.c[0], Bb.c[1] - A.c[1]], prj = (R, v) => R.hl * Math.abs(R.u[0] * v[0] + R.u[1] * v[1]) + R.hw * Math.abs(-R.u[1] * v[0] + R.u[0] * v[1]); for (const v of ax) m = Math.min(m, prj(A, v) + prj(Bb, v) - Math.abs(dc[0] * v[0] + dc[1] * v[1])); return m; };
      const olc = { kare: 0, kesisenKare: 0, enDerin: 0, kaldirimKare: 0 };
      const kareOlc = () => {
        // yalnız bu karede çizilen arabalar (çizim sınırının dışında kalanın matrisi eskidir)
        const tum = [...D.oy.values()].filter(k => k.ar && k._M && D.oy.get(k.id) === k), sonKare = Math.max(0, ...tum.map(k => k._cizKare || 0));
        const cars = tum.filter(k => k._cizKare === sonKare);
        let kes = false, kal = false;
        for (const k of cars) if (Math.abs(k.gl + k.ox) + DIM[k.ar.tip][2] / 2 > 4.3) kal = true;
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
          if (Math.abs(cars[i].gs - cars[j].gs) > 7) continue;
          const m = pen(rect(cars[i]), rect(cars[j]));
          if (m > 0.05) { kes = true; olc.enDerin = Math.max(olc.enDerin, +m.toFixed(2)); }
        }
        olc.kare++;
        if (kes) olc.kesisenKare++;
        if (kal) olc.kaldirimKare++;
      };
      let calis = true;
      (async () => { while (calis) { kareOlc(); await new Promise(r => requestAnimationFrame(r)); } })();
    const sonuc = {};
    for (const ad of ['katilan', 'one_gecen', 'cikan', 'yeni_gelin', 'zigzag', 'fisek', 'drift']) {
      Object.assign(olc, { kare: 0, kesisenKare: 0, enDerin: 0, kaldirimKare: 0 });
      if (ad === 'katilan') CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'yeni1', ad: 'yeni1' }, metin: 'x' });
      if (ad === 'one_gecen') { const m = D.sira[D.sira.length - 1]; CanliOyun.olay({ tip: 'hediye', kullanici: { id: m.id, ad: m.ad }, jeton: 40 }); }
      if (ad === 'cikan') D.sira[8].son = -1e9;
      if (ad === 'yeni_gelin') { const m = D.sira[D.sira.length - 2]; CanliOyun.olay({ tip: 'hediye', kullanici: { id: m.id, ad: m.ad }, jeton: 5000 }); }
      if (ad === 'zigzag') CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'a20', ad: 'oto20' }, jeton: 50 });
      if (ad === 'fisek') CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'a21', ad: 'oto21' }, jeton: 200 });
      if (ad === 'drift') CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'a22', ad: 'oto22' }, jeton: 1000 });
      await bekle(6000);
      sonuc[ad] = { ...olc };
    }
    calis = false;
    return sonuc;
  });
  const senKotu = Object.entries(sen).filter(([, o]) => o.kesisenKare || o.kaldirimKare);
  kontrol('Denetçinin senaryoları (36 araba): katılan, öne geçen, çıkan, yeni gelin arabası, zigzag, fişek, drift; kesişme ve kaldırım yok', senKotu.length === 0, senKotu.length ? senKotu : Object.fromEntries(Object.entries(sen).map(([a, o]) => [a, o.kare])));


  // Reji: hediyesiz otomatik yayında süre çoğunlukla geniş çekimde, yakın çekim art arda gelmez; hediyeyle gelen
  // olay kendi yakın çekimini alır, ardından geniş çekim gelir.
  await bosalt();
  // Geniş çekim kuralları, dörder dakika hediyesiz otomatik yayın (9 ve 36 araba): her 150 ms'de geniş çekimdeyken
  // ölçülür (geçiş kareleri hariç): (1) yol ekranda dikeyden en çok 35°, (2) gelin arabasından gösterilen son arabaya
  // kadar konvoy bandın en az %60'ını kaplar ve ilk arabaların her biri en az 40 piksel boyunda, (3) bandın en az %30'u
  // yol ve kaldırım (denetçinin istediği %45 bu yol genişliği ve sıra aralığıyla ancak 3-4 araba gösterilince tutuyor;
  // rapora yazıldı). Karelerin en az %95'i tutmalı. Ayrıca geniş çekim payı ≥ %80 ve iki yakın çekim art arda yok.
  // Taban (her geniş karede, olaylı ya da olaysız): konvoy çizgisindeki ilk altı arabanın en kısası ≥ 40 piksel; geniş
  // çekim çizginin dışındaki arabaya (drift atan, öne geçen, yana çekilen gelin arabası) sığdırılmaz.
  // Olaylı koşu (36 araba, 150 sn): 1000 jeton (drift şovu + süper araba + gelin arabası), 5000 jeton (yeni gelin
  // arabası), 50 jeton (sollama), yine 1000 jeton; aynı ölçüler.
  const genisKosu = (n, sure, hediyeler) => p.evaluate(async ([n, sure, hediyeler]) => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms)), GENIS = ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'];
    D.reji.zorla = null;
    for (let i = 0; i < n; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'w' + i, ad: 'genis' + i }, metin: 'x' });
    await bekle(2500);
    const iz = [], olc = { n: 0, aci: 0, kaplama: 0, kisa: 0, yol: 0, ornek: null, kisaOrnek: null }, kalan = hediyeler.slice();
    let son = null;
    const t0 = performance.now();
    while (performance.now() - t0 < sure * 1000) {
      while (kalan.length && performance.now() - t0 >= kalan[0][0] * 1000) {
        const [, jeton, sira] = kalan.shift(), k = D.sira[Math.min(sira, D.sira.length - 1)];
        CanliOyun.olay({ tip: 'hediye', kullanici: { id: k.id, ad: k.ad }, jeton });
      }
      const c = D.reji.cekim;
      if (c !== son) { iz.push([c && c.ad, performance.now()]); son = c; }
      const o = D.reji.genisOlc();
      if (o && !o.gecis) {
        olc.n++;
        const kotu = [o.aci > 35, o.kaplama !== null && o.kaplama < 0.6, o.enKisa !== null && o.enKisa < 40, o.yol < 0.3];
        kotu.forEach((v, i) => { if (v) olc[['aci', 'kaplama', 'kisa', 'yol'][i]]++; });
        if (kotu.some(Boolean) && !olc.ornek) olc.ornek = o;
        if (kotu[2] && !olc.kisaOrnek) olc.kisaOrnek = o;
      }
      await bekle(150);
    }
    iz.push(['son', performance.now()]);
    let genis = 0, top = 0;
    for (let i = 0; i < iz.length - 1; i++) { const d = iz[i + 1][1] - iz[i][1]; top += d; if (GENIS.includes(iz[i][0])) genis += d; }
    const adlar = iz.slice(0, -1).map(x => x[0]);
    return { pay: +(genis / top).toFixed(3), ardisik: adlar.some((a, i) => i && !GENIS.includes(a) && !GENIS.includes(adlar[i - 1])), olc, cekimler: [...new Set(adlar)], olaySay: adlar.filter(a => ['sov', 'lider', 'super', 'sollama'].includes(a)).length };
  }, [n, sure, hediyeler]);
  // tam: 9 ve 36 araba dörder dakika, hediyeli 150 sn. hizli: bir dakika ve 75 sn, hediyeler aynı sırayla yarı aralıklarla;
  // kontroller aynı, kare tabanı süreyle orantılı (tam'da eskisi gibi 300 ve 150 kare).
  const GENIS_KOSU = HIZLI ? [[9, 60, []], [36, 60, []], [36, 75, [[3, 1000, 25], [23, 5000, 30], [43, 50, 28], [55, 1000, 20]]]]
    : [[9, 240, []], [36, 240, []], [36, 150, [[5, 1000, 25], [45, 5000, 30], [85, 50, 28], [110, 1000, 20]]]];
  for (const [n, sure, hediyeler] of GENIS_KOSU) {
    await bosalt();
    const gk = await genisKosu(n, sure, hediyeler), ad = n + ' araba, ' + sure + ' sn ' + (hediyeler.length ? 'hediyeli' : 'hediyesiz');
    const o = gk.olc, oran = x => +(o[x] / Math.max(1, o.n)).toFixed(3);
    if (!hediyeler.length)
      kontrol(ad + ': geniş çekim ≥ %80, yakın çekim art arda yok', gk.pay >= 0.8 && !gk.ardisik, { pay: gk.pay });
    else
      // 1000 ve 5000 jeton tek hediyedir: ikisi de süper araba anıdır (drift şovu ve gelin arabası değişimi o çekimin içinde)
      kontrol(ad + ': olay çekimleri geldi (en az iki; tek seferde 1000+ jeton süper araba çekimi alır)', gk.olaySay >= 2 && gk.cekimler.includes('super'), { cekimler: gk.cekimler, olaySay: gk.olaySay });
    kontrol(ad + ': geniş çekimde yol dikey, konvoy bandı doldurur, yol bandın ≥ %30\'u (karelerin ≥ %95\'inde)', o.n > sure * (hediyeler.length ? 1 : 1.25) && ['aci', 'kaplama', 'yol'].every(x => oran(x) <= 0.05), { kare: o.n, aci: oran('aci'), kaplama: oran('kaplama'), yol: oran('yol'), ornek: o.ornek });
    kontrol(ad + ': taban, her geniş karede çizgideki ilk altı arabanın en kısası ≥ 40 piksel', o.kisa === 0, { kare: o.n, kisa: o.kisa, ornek: o.kisaOrnek });
  }
  await bosalt();
  const rj2 = await p.evaluate(async () => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms)), GENIS = ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'];
    D.reji.zorla = null;
    for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'g' + i, ad: 'genis' + i }, metin: 'x' });
    const iz = [];
    let son = null;
    const t0 = performance.now();
    while (performance.now() - t0 < 30000) {
      const c = D.reji.cekim;
      if (c !== son) { iz.push([c && c.ad, performance.now()]); son = c; }
      await bekle(50);
    }
    iz.push(['son', performance.now()]);
    let genis = 0, top = 0;
    for (let i = 0; i < iz.length - 1; i++) { const t = iz[i + 1][1] - iz[i][1]; top += t; if (GENIS.includes(iz[i][0])) genis += t; }
    const adlar = iz.slice(0, -1).map(x => x[0]), ardisikYakin = adlar.some((a, i) => i && !GENIS.includes(a) && !GENIS.includes(adlar[i - 1]));
    // hediye: bir izleyici hediye atar; bir sonraki ölçüde onun yakın çekimi (ya da sollaması), sonra geniş çekim
    const k = D.sira[20];
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: k.id, ad: k.ad }, jeton: 10 });
    const olay = [];
    son = D.reji.cekim;
    const t1 = performance.now();
    while (performance.now() - t1 < 20000 && olay.length < 3) {
      const c = D.reji.cekim;
      if (c !== son) { olay.push([c.ad, c.k ? c.k.ad : null]); son = c; }
      await bekle(50);
    }
    return { pay: +(genis / top).toFixed(3), adlar: adlar.join(' '), ardisikYakin, olay, kimi: k.ad };
  });
  kontrol('Hediyesiz otomatik reji (36 araba, 30 sn): sürenin en az %80\'i geniş çekim, iki yakın çekim art arda gelmez', rj2.pay >= 0.8 && !rj2.ardisikYakin, { pay: rj2.pay, sira: rj2.adlar });
  const ilkOlay = rj2.olay[0] || [], sonraki = rj2.olay[1] || [];
  kontrol('Hediye atan izleyici kendi yakın çekimini alır (yakın, sollama ya da gelin arabası olduysa lider), ardından geniş çekim gelir', ['yakin', 'sollama', 'lider'].includes(ilkOlay[0]) && ilkOlay[1] === rj2.kimi && ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'].includes(sonraki[0]), rj2.olay);

  // Ad ile plaka aynı adı taşır; kayan ya da başka arabaya yakın duran ad kendi arabasına çizgiyle bağlanır
  // (36 arabalık otomatik yayında 3 sn boyunca her karede).
  const ae = await p.evaluate(async () => {
    const top = { ad: 0, bagli: 0, belirsiz: 0, adYanlis: 0 };
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      const o = CanliOyun.durum().ornek;
      top.adYanlis += o.adYanlis;
      if (o.etiket) { top.ad += o.etiket.ad; top.bagli += o.etiket.bagli; top.belirsiz += o.etiket.belirsiz; }
    }
    return top;
  });
  kontrol('Plaka ile ad aynı; başka arabaya daha yakın duran her ad kendi arabasına bağlıdır', ae.adYanlis === 0 && ae.ad > 0 && ae.belirsiz === 0, ae);

  // Hediye seli (her saniye bir hediye, her kademe): olay yakın çekimleri bekleme süresine tabi, geniş çekim sürenin en
  // az yarısı; iki olay / yakın çekim art arda gelmez. Ardından süper araba olayı (modeli başka dal ekler; burada elle):
  // kendi yakın çekimi ve "SÜPER ARABA" kartı, sonra geniş çekim. Son olarak yakın çekimin konusu çıkarsa kart düşer,
  // kamera hemen geniş çekime geçer.
  await bosalt();
  const sel2 = await p.evaluate(async () => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms)), GENIS = ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'];
    for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'f' + i, ad: 'sel' + i }, metin: 'x' });
    await bekle(2000);
    const iz = [];
    let son = null, genis = 0, top = 0, ust = 0, t = performance.now();
    for (let i = 0; i < 60; i++) {
      const k = D.sira[1 + Math.floor(Math.random() * 30)];
      if (k) CanliOyun.olay({ tip: 'hediye', kullanici: { id: k.id, ad: k.ad }, jeton: [1, 10, 50, 200, 1000, 40][i % 6] });
      for (let j = 0; j < 20; j++) {
        const c = D.reji.cekim, now = performance.now();
        if (son) { top += now - t; if (GENIS.includes(son.ad)) genis += now - t; if (son.ad === 'super') ust += now - t; }
        t = now;
        if (c !== son) { iz.push(c.ad); son = c; }
        await bekle(50);
      }
    }
    // süper araba çekimi istisnadır: başka bir olay çekiminin hemen ardından gelebilir (sırası beklemez)
    const ardisik = iz.some((a, i) => i && a !== 'super' && !GENIS.includes(a) && !GENIS.includes(iz[i - 1]));
    return { pay: +(genis / (top - ust)).toFixed(3), payTum: +(genis / top).toFixed(3), superPay: +(ust / top).toFixed(3), ardisik, sira: iz.join(' ') };
  });
  // Bu selde her altıncı hediye 1000 jeton (dakikada on süper araba): süper araba çekimleri kuralın istisnasıdır. Kural
  // onların dışındaki sürede aynı kalır: geniş çekim en az yarı (pay). Bütün süreye oranı (payTum) rapor için yazılır.
  kontrol('Hediye selinde (60 sn, saniyede bir hediye) süper araba çekimleri dışındaki sürenin en az yarısı geniş çekim, yakın çekimler art arda gelmez (süper araba çekimi hariç)', sel2.pay >= 0.5 && !sel2.ardisik, sel2);
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 20; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'u' + i, ad: 'ust' + i }, metin: 'x' }); });
  await p.waitForTimeout(2500);
  const sup = await p.evaluate(async () => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms)), GENIS = ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'];
    D.reji.sonOlay = null;
    const k = D.sira[12];
    D.reji.olayAt('super', k);
    let gordu = null, kart = false, sonra = null;
    for (let i = 0; i < 300; i++) {
      await bekle(50);
      const c = D.reji.cekim;
      if (!gordu && c.ad === 'super') gordu = c;
      if (gordu && c === gordu && k.oyunAd && k.oyunAd.kare > 0 && !k.etKutu) kart = true;
      if (gordu && c !== gordu) { sonra = c.ad; break; }
    }
    return { super: !!gordu && gordu.k === k, kart, sonra, genis: GENIS.includes(sonra) };
  });
  kontrol('Süper araba olayı: kendi yakın çekimi ve tek ad (büyük kart), ardından geniş çekim', sup.super && sup.kart && sup.genis, sup);
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 20; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'v' + i, ad: 'cik' + i }, metin: 'x' }); });
  await p.waitForTimeout(2500);
  const cik = await p.evaluate(async () => {
    const D = CanliOyun._test.D, bekle = ms => new Promise(r => setTimeout(r, ms)), GENIS = ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'];
    D.reji.sonOlay = null;
    const k = D.sira[14];
    D.reji.olayAt('hediye', k);
    for (let i = 0; i < 200 && !(D.reji.cekim.ad === 'yakin' && D.reji.cekim.k === k); i++) await bekle(50);
    const yakin = D.reji.cekim.ad === 'yakin';
    await bekle(600);
    k.son = -1e9;
    const t0 = performance.now();
    while (performance.now() - t0 < 3000 && !k.cikiyor) await bekle(20);
    const t1 = performance.now();
    while (performance.now() - t1 < 1500 && !GENIS.includes(D.reji.cekim.ad)) await bekle(20);
    return { yakin, cikti: k.cikiyor, gecis: Math.round(performance.now() - t1), cekim: D.reji.cekim.ad };
  });
  kontrol('Yakın çekimin konusu çıkınca kart düşer, kamera hemen geniş çekime geçer', cik.yakin && cik.cikti && ['arka', 'drone', 'ucsol', 'ucsag', 'kus', 'vinc'].includes(cik.cekim) && cik.gecis < 400, cik);

  // Kaldırımdaki insanlar ve sokak eşyası (hazır modeller, js/30-dunya.js SOKAK): yalnız kaldırımda, ağaç ve direk
  // yuvalarının üstünde değil; çizilen örnekler havuzu aşmaz; kalite kademesine göre azalır, en düşük ikide hiç yok.
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'sk' + i, ad: 'sokak' + i }, metin: 'x' }); CanliOyun._test.D.reji.zorla = 'drone'; });
  await p.waitForTimeout(2500);
  const SD = () => p.evaluate(() => CanliOyun._test.D.sokakTest.durum());
  // yük altında kalite kendiliğinden düşmüş olabilir: bu bölüm kademeyi kendisi kurar
  await p.evaluate(() => CanliOyun._test.D.sokakTest.kalite(0));
  // reji drone'a ölçü çizgisinde keser: geniş çekime geçip kalabalık kadraja girene kadar bekle (en çok 8 sn)
  let sk = await SD();
  for (let i = 0; i < 16 && !((await durum()).cekim === 'drone' && sk.cizilen > 20); i++) {
    await p.waitForTimeout(500);
    sk = await SD();
  }
  kontrol('Sokak: insanlar yalnız kaldırımda (çizilen örnek de aday da asfaltta ya da kaldırım dışında değil), ağaç ve direk yuvalarında değil', sk.hazir && sk.aday > 100 && sk.cizilen > 20 && sk.yolda === 0 && sk.disarida === 0 && sk.ornekYolda === 0 && sk.ornekDisarida === 0 && sk.agacta === 0, sk);
  kontrol('Sokak: çizilen örnek sayısı havuzu aşmaz (kademe 0: ' + sk.kap + ')', sk.ornek === sk.cizilen && sk.ornek <= sk.havuz && sk.havuz === sk.kap, { ornek: sk.ornek, havuz: sk.havuz });
  // Kademeler AYNI karede karşılaştırılır: müzik saati (B) dondurulur, konvoy ve kamera durur, kadrajdaki aday kalabalık
  // (kadrajAday) her kademede aynıdır. Eskiden kamera kayarken ölçülüyordu: ~65 kişilik kadrajda havuz (200, 130, 70) hiç
  // sınırlamıyor, sayılar kameranın o anki yerine göre bir artıp bir azalıyordu (4 koşunun 2'sinde kalırdı). Anlamı: her
  // kademede kadrajdaki adayların en yakın "havuz" kadarı ele alınır (çizilen + gizlenen = en çok havuz), havuz kademeyle
  // küçülür, çizilen hiç artmaz; en düşük iki kademede kimse çizilmez.
  await p.evaluate(() => CanliOyun._test.vurusDondur());
  const kad = [];
  for (let n = 0; n < 5; n++) {
    await p.evaluate(k => CanliOyun._test.D.sokakTest.kalite(k), n);
    await kareBekle(p, 3);
    const d = await SD();
    kad.push({ kademe: d.kademe, havuz: d.havuz, aday: d.kadrajAday, cizilen: d.cizilen, gizlenen: d.gizlenen, ornek: d.ornek, gorunen: d.gorunenMesh });
  }
  await p.evaluate(() => { CanliOyun._test.D.sokakTest.kalite(0); CanliOyun._test.vurusCoz(); });
  const kadN = kad[0].aday;
  kontrol('Sokak: kalabalık kalite kademesiyle azalır (havuz 200, 130, 70; aynı karede kadrajdaki adayların en çok havuz kadarı), en düşük iki kademede hiç kimse çizilmez', kadN > 20 && kad.every((x, n) => x.kademe === n && x.havuz === [200, 130, 70, 0, 0][n] && x.ornek <= x.havuz) && kad.slice(0, 3).every(x => x.aday === kadN && x.cizilen + x.gizlenen === Math.min(x.havuz, kadN) && x.ornek === x.cizilen) && kad[0].ornek >= kad[1].ornek && kad[1].ornek >= kad[2].ornek && kad[2].ornek > 0 && kad[3].ornek === 0 && kad[4].ornek === 0 && kad[4].gorunen === 0, kad);
  // alçak çekimlerde kameranın dibinde dev görünen kişi çizilmez (konuyu örten de; o kural sokakGuncelle'de)
  const ort = [];
  for (const ad of ['kenar', 'yan', 'yakin']) {
    await p.evaluate(a => { CanliOyun._test.D.reji.zorla = a; }, ad);
    await p.waitForTimeout(2500);
    const d = await SD();
    ort.push({ cekim: (await durum()).cekim, cizilen: d.cizilen, gizlenen: d.gizlenen, dev: d.dev, yolda: d.ornekYolda });
  }
  await p.evaluate(() => { CanliOyun._test.D.reji.zorla = null; });
  kontrol('Sokak: kenar, yan ve yakın çekimde ön planda dev kişi yok, kimse yolda değil', ort.every(x => x.dev === 0 && x.yolda === 0), ort);

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
  await hazirBekle(p3, 2, 20000);
  await p3.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 's' + i, ad: 'yazilim' + i }, metin: 'x' }); });
  // en çok 45 sn: önce kademeler iner, en düşükte bir ölçüm daha yavaşsa uyarı çıkar
  for (let i = 0; i < 15; i++) {
    await p3.waitForTimeout(3000);
    if (await p3.evaluate(() => CanliOyun.durum().kalite >= 3 && (CanliOyun.durum().kareAralik < 33 || [...document.querySelectorAll('#bu-oyunda #kalite-uyari')].some(e => /yetişmiyor/.test(e.textContent)))))
      break;
  }
  const sw = await p3.evaluate(() => { const d = CanliOyun.durum(); return { gpu: d.gpu, kalite: d.kalite, kareAralik: d.kareAralik, kareMs: +d.kareMs.toFixed(1), uyari: [...document.querySelectorAll('#bu-oyunda #kalite-uyari')].some(e => /ekran kartı 3B sahneye yetişmiyor/.test(e.textContent)) }; });
  kontrol('Yazılımla çizimde gerçek kare aralığı ölçülür, kalite düşer; en düşükte de yavaşsa panel uyarır', sw.kalite >= 3 && (sw.kareAralik < 33 || sw.uyari), sw);
  await b3.close();

  // Kalite kademeleri: 30 kare/sn'ye kilitli ekran yavaş sayılmaz; 3 sn'lik tek takılma kademeyi değiştirmez; yük gelince
  // kademe düşer, yük kalkınca geri çıkar. requestAnimationFrame sayfa açılmadan sarılır (ekranın temposunu taklit eder).
  const b4 = await tarayici();
  const kal2 = async (ad, fn) => {
    const q = await b4.newPage({ viewport: { width: 540, height: 960 } });
    await q.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__aralik = 0;
      window.requestAnimationFrame = f => { const t0 = performance.now(); const bekle = () => raf(t => (window.__aralik && t - t0 < window.__aralik - 2) ? bekle() : f(t)); return bekle(); };
    });
    await q.goto(OYUN_URL + '#yayin');
    await hazirBekle(q);
    await q.evaluate(() => { for (let i = 0; i < 36; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'q' + i, ad: 'kalite' + i }, metin: 'x' }); });
    const r = await fn(q);
    await q.close();
    return r;
  };
  const otuz = await kal2('30', async q => { await q.evaluate(() => { window.__aralik = 33.3; }); await q.waitForTimeout(16000); return q.evaluate(() => ({ kalite: CanliOyun.durum().kalite, aralik: CanliOyun.durum().kareAralik, temel: CanliOyun.durum().kaliteTemel })); });
  kontrol('30 kare/sn\'ye kilitli ekran (33 ms) en yüksek kademede kalır', otuz.kalite === 0 && otuz.aralik > 28, otuz);
  const takil = await kal2('takilma', async q => { await q.waitForTimeout(4000); await q.evaluate(() => { const t = performance.now(); while (performance.now() - t < 3000); }); await q.waitForTimeout(9000); return q.evaluate(() => ({ kalite: CanliOyun.durum().kalite, aralik: CanliOyun.durum().kareAralik })); });
  kontrol('3 sn\'lik tek takılma kademeyi değiştirmez', takil.kalite === 0, takil);
  const don = await kal2('toparlanma', async q => {
    await q.waitForTimeout(3000);
    await q.evaluate(() => { window.__aralik = 90; });
    let enDusuk = 0;
    for (let i = 0; i < 14; i++) { await q.waitForTimeout(1000); enDusuk = Math.max(enDusuk, await q.evaluate(() => CanliOyun.durum().kalite)); }
    await q.evaluate(() => { window.__aralik = 0; });
    let geri = null;
    for (let i = 0; i < 45; i++) { await q.waitForTimeout(1000); if ((await q.evaluate(() => CanliOyun.durum().kalite)) === 0) { geri = i + 1; break; } }
    return { enDusuk, geriSn: geri };
  });
  kontrol('Yük gelince kademe düşer, yük kalkınca geri çıkar (adım adım, gidip gelmeden)', don.enDusuk >= 1 && don.geriSn !== null, don);
  await b4.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
