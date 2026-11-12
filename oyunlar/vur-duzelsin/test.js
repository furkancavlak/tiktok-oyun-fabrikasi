// Vur Düzelsin'e özgü kontroller: anteni lider tutar, her kademe kendi vuruşunu başlatır ve görüntüyü düzeltir,
// değme anında televizyon ezilir, tekmede düğme fırlar, usta işi gol getirir, anten el değiştirir, görüntü
// kendiliğinden bozulur, ekranın pikselleri basamağı anlatır, selde sıra sınırlı kalır, vuran yerine döner.
// Çekirdek testleri ayrıca çalışır. Çalıştırma: node oyunlar/vur-duzelsin/test.js vur-duzelsin
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
  await p.evaluate(() => { if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click(); });
  const bosalt = () => p.evaluate(() => { document.getElementById('bosalt').click(); });
  const O = o => p.evaluate(o2 => CanliOyun.olay(o2), o);
  const durum = () => p.evaluate(() => CanliOyun.durum());
  const bekle = async (kosul, ms) => { for (let i = 0; i < ms / 50; i++) { if (await p.evaluate(kosul)) return true; await p.waitForTimeout(50); } return false; };

  // lider yığına çıkıp anteni tutar
  await bosalt();
  await O({ tip: 'yorum', kullanici: { id: 'a', ad: 'Ali' }, metin: 'selam' });
  for (const [id, ad] of [['b', 'Bora'], ['c', 'Cem'], ['e', 'Ece']]) await O({ tip: 'yorum', kullanici: { id, ad }, metin: 'x' });
  // Sabit kalır: koşulla beklenince (y0 > 0,9 olur olmaz) Ali tırmanırken ölçülüyor, kontrol yuvarlanmış y0'a (0,90)
  // takılıp kalıyordu. Kontrolün y0 > 0,9 sınırı tırmanışın sonuna (~0,91) çok yakın; 2,5 sn tırmanışın bittiği an.
  await p.waitForTimeout(2500);
  let d = await durum();
  const el = await p.evaluate(() => { const D = CanliOyun._test.D, k = D.lider, u = D.antenUc; return { y0: +k.y0.toFixed(2), el: u && Math.hypot(u[0] - k.j.haR[0], u[1] - k.j.haR[1], u[2] - k.j.haR[2]) }; });
  kontrol('Lider sandalye yığınına çıkar, sağ eli antenin ucunda', d.antenTutan === 'Ali' && el.y0 > 0.9 && el.el < 1e-6, { antenTutan: d.antenTutan, el });

  // anteni tutanın kendi hediyesi: yığından inmeden vurur (ayrıca Ali'yi kalıcı lider yapar)
  const t0 = (await durum()).temas;
  await O({ tip: 'hediye', kullanici: { id: 'a', ad: 'Ali' }, jeton: 999 });
  const kuleBasladi = await bekle(() => !!CanliOyun.durum().kuleVuran, 2000);
  await bekle(() => !CanliOyun.durum().kuleVuran, 5000);
  d = await durum();
  kontrol('Anteni tutanın hediyesi: yığından inmeden vurur, anten elinde kalır', kuleBasladi && d.temas > t0 && d.antenTutan === 'Ali' && !d.vuran, { kuleBasladi, temas: d.temas - t0, antenTutan: d.antenTutan });

  // her kademe kendi vuruşunu başlatır; değince görüntü düzelir, televizyon ezilir
  const kademe = [[1, 'tokat'], [10, 'yumruk'], [50, 'tekme'], [200, 'ucan']];
  for (const [j, tip] of kademe) {
    await p.evaluate(() => { const D = CanliOyun._test.D; D.netSabit = false; D.netlik = 0.1; D.dugme = null; });
    const once = await durum();
    await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: j });
    const basladi = await bekle(() => !!CanliOyun.durum().vuran, 1500), vuran = (await durum()).vuran;
    let enEzik = 0, deydi = false;
    for (let i = 0; i < 120 && !deydi; i++) {
      const s = await durum();
      if (s.temas > once.temas) { deydi = true; await p.waitForTimeout(60); }
      await p.waitForTimeout(40);
    }
    for (let i = 0; i < 6; i++) { enEzik = Math.max(enEzik, (await durum()).ezilme); await p.waitForTimeout(25); }
    const s = await p.evaluate(() => { const D = CanliOyun._test.D, e = D.efekt[D.efekt.length - 1]; return { netlik: D.netlik, efekt: e && e.tip, dugme: !!D.dugme, iz: D.izler.length, toz: D.toz.length }; });
    kontrol(j + ' jeton: gönderen istasyona yürür ve ' + tip + ' atar; değince görüntü düzelir, televizyon ezilir, efekt ve toz çıkar',
      basladi && vuran && vuran.ad === 'Bora' && vuran.tip === tip && deydi && s.netlik > 0.1 && s.efekt === tip && enEzik > 0.15 && s.toz > 0 && s.iz > 0,
      { vuran, deydi, netlik: +s.netlik.toFixed(3), efekt: s.efekt, enEzik, toz: s.toz });
    if (tip === 'tekme' || tip === 'ucan') kontrol(tip + ': düğme fırlar', s.dugme);
    if (tip === 'ucan') await p.locator('#sahne').screenshot({ path: CIKTI + '/v-ucan.png' });
    await bekle(() => !CanliOyun.durum().vuran, 4000);
  }
  // vuran kalabalıktaki yerine döner (eskiden sabit 1,5 sn)
  await durumBekle(p, 'Bora işini bitirip yerine döndü', () => { const k = CanliOyun._test.D.oy.get('b'); return !!k && !k.is && Math.abs(k.x - k.hedefX) < 0.1 && Math.abs(k.z - k.hedefZ) < 0.1; }, undefined, 6000);
  const don = await p.evaluate(() => { const k = CanliOyun._test.D.oy.get('b'); return { is: k.is, x: +(k.x - k.hedefX).toFixed(2), z: +(k.z - k.hedefZ).toFixed(2) }; });
  kontrol('Vuran işi bitince kalabalıktaki yerine döner', !don.is && Math.abs(don.x) < 0.1 && Math.abs(don.z) < 0.1, don);

  // anten el değiştirir
  await bosalt();
  for (const [id, ad] of [['a', 'Ali'], ['b', 'Bora'], ['c', 'Cem']]) await O({ tip: 'yorum', kullanici: { id, ad }, metin: 'x' });
  // Ali anteni tutana dek (eskiden sabit 2,2 sn)
  await durumBekle(p, 'Ali anteni tutuyor', () => CanliOyun.durum().antenTutan === 'Ali', undefined, 8000);
  await p.evaluate(() => { CanliOyun._test.D.netlik = 0.7; });
  await O({ tip: 'hediye', kullanici: { id: 'c', ad: 'Cem' }, jeton: 50 });
  const pk = await p.evaluate(() => ({ pankart: document.getElementById('pankart-yeri').textContent, netlik: CanliOyun._test.D.netlik }));
  kontrol('Anten el değiştirince pankart yeni tutanı yazar, görüntü bir an karlanır', /Anten el değiştirdi/.test(pk.pankart) && pk.pankart.includes('Cem') && pk.netlik < 0.7, pk);
  const vardi = await bekle(() => CanliOyun.durum().antenTutan === 'Cem', 9000);
  kontrol('Yeni lider önce vuruşunu yapar, sonra yığına çıkıp anteni alır', vardi, (await durum()).antenTutan);

  // görüntü kendiliğinden bozulur; anten tutan yoksa daha hızlı
  await p.evaluate(() => { CanliOyun._test.D.kuyruk.length = 0; });
  await bekle(() => !CanliOyun.durum().vuran && !CanliOyun.durum().kuleVuran, 6000);
  await p.evaluate(() => { const D = CanliOyun._test.D; D.netSabit = false; D.netlik = 0.9; });
  await p.waitForTimeout(3000);
  const tutuluyken = 0.9 - (await durum()).netlik;
  await bosalt();
  await p.evaluate(() => { CanliOyun._test.D.netlik = 0.9; });
  await p.waitForTimeout(3000);
  const bosken = 0.9 - (await durum()).netlik;
  kontrol('Görüntü zamanla bozulur; anteni tutan yokken daha hızlı', tutuluyken > 0.01 && bosken > tutuluyken * 2, { tutuluyken: +tutuluyken.toFixed(3), bosken: +bosken.toFixed(3) });

  // ekranın pikselleri basamağı anlatır: karlıda gri ve titrek, renklide yeşil saha
  await O({ tip: 'yorum', kullanici: { id: 'a', ad: 'Ali' }, metin: 'x' });
  await p.waitForTimeout(1500);
  const piksel = async n => {
    await p.evaluate(v => { const D = CanliOyun._test.D; D.netSabit = true; D.netlik = v; D.flas = 0; }, n);
    await p.waitForTimeout(600);
    return p.evaluate(() => {
      const t = document.getElementById('tuval'), g = t.getContext('2d'), o = CanliOyun.durum().ekranOrta, k = t.width / 720;
      const w = Math.round(o.s * 0.5 * k), h = Math.round(o.s * 0.35 * k), im = g.getImageData(Math.round(o.x * k - w / 2), Math.round(o.y * k - h / 2), w, h).data;
      let doy = 0, yesil = 0, ort = 0, kare = 0, n = 0;
      for (let i = 0; i < im.length; i += 4) { const r = im[i], gg = im[i + 1], bb = im[i + 2], l = (r + gg + bb) / 3; doy += Math.max(r, gg, bb) - Math.min(r, gg, bb); if (gg > r + 20 && gg > bb + 10) yesil++; ort += l; kare += l * l; n++; }
      ort /= n; return { doygunluk: +(doy / n).toFixed(1), yesil: +(yesil / n).toFixed(2), sapma: +Math.sqrt(kare / n - ort * ort).toFixed(1) };
    });
  };
  const px = [];
  for (const n of [0.1, 0.3, 0.5, 0.7, 0.9]) px.push(await piksel(n));
  await p.locator('#sahne').screenshot({ path: CIKTI + '/v-net.png' });
  kontrol('Karlı ekran gri ve titrek, renkli ekran yeşil saha; siyah beyaz basamak renksiz', px[0].doygunluk < 15 && px[0].sapma > 35 && px[4].yesil > 0.25 && px[3].doygunluk < 15 && px[4].doygunluk > 30, px);
  const asamalar = await p.evaluate(async () => { const a = []; for (const n of [0.1, 0.3, 0.5, 0.7, 0.9]) { CanliOyun._test.D.netlik = n; await new Promise(r => setTimeout(r, 120)); a.push(CanliOyun.durum().asamaAd); } return a; });
  kontrol('Beş basamak: karlı, kayıyor, çift görüntü, siyah beyaz, net renkli', asamalar.join('|') === 'Karlı|Kayıyor|Çift görüntü|Siyah beyaz|Net, renkli', asamalar);
  await p.evaluate(() => { CanliOyun._test.D.netSabit = false; });

  // usta işi: gönderen istasyona iner, dört vuruş, görüntü tam net, gol
  await bosalt();
  for (const [id, ad] of [['a', 'Ali'], ['b', 'Bora'], ['c', 'Cem']]) await O({ tip: 'yorum', kullanici: { id, ad }, metin: 'x' });
  // Ali anteni tutana dek (eskiden sabit 2 sn)
  await durumBekle(p, 'Ali anteni tutuyor', () => CanliOyun.durum().antenTutan === 'Ali', undefined, 8000);
  await p.evaluate(() => { CanliOyun._test.D.netlik = 0.1; });
  const g0 = (await durum()).gol;
  await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: 1000 });
  const ustaVar = await bekle(() => CanliOyun.durum().usta === 'Bora', 1500);
  const yildiz = await p.evaluate(() => CanliOyun._test.D.oy.get('b').yildiz);
  // usta gösteride büyür (eskiden sabit 1,2 sn)
  await durumBekle(p, 'Bora 1,3 katına büyüdü', () => { const k = CanliOyun._test.D.oy.get('b'); return !!k && !!k.g && k.g.boy / k.asilBoy >= 1.3; }, undefined, 5000);
  const iri = await p.evaluate(() => { const k = CanliOyun._test.D.oy.get('b'); return +(k.g.boy / k.asilBoy).toFixed(2); });
  kontrol('Usta gösteride iri: boyu en az 1,3 katına çıkar', iri >= 1.3, iri);
  const golOldu = await bekle(() => CanliOyun.durum().gol > 0, 15000);
  d = await durum();
  await p.locator('#sahne').screenshot({ path: CIKTI + '/v-usta-gol.png' });
  kontrol('Usta işi: gönderen yıldız olur, dört vuruştan sonra görüntü tam net ve gol', ustaVar && yildiz && golOldu && d.gol === g0 + 1 && d.netlik > 0.95 && d.asama === 4, { ustaVar, yildiz, golOldu, gol: d.gol, netlik: d.netlik });
  await bekle(() => !CanliOyun.durum().usta, 6000);
  kontrol('Usta işi bitince yıldızlık kalkar', !(await p.evaluate(() => CanliOyun._test.D.oy.get('b').yildiz)));

  // kadraj: tam kalabalıkta televizyon yarıdan geniş, ekranı baş örtmez, televizyon / anten / lider sahne
  // yazılarının altına girmez, kimse kadrajdan taşmaz, adlar yorum alanına (1006 sonrası) inmez
  const kadrajOlc = async (w, h) => {
    const q = await b.newPage({ viewport: { width: w, height: h } });
    q.on('pageerror', e => hatalar.push('SAYFA HATASI: ' + e.message));
    await q.goto(OYUN_URL + '#yayin');
    await hazirBekle(q);
    await q.evaluate(() => {
      if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click();
      document.getElementById('bosalt').click();
      for (let i = 0; i < 30; i++) CanliOyun.olay(i < 6 ? { tip: 'hediye', kullanici: { id: 'k' + i, ad: 'izleyici_adi_' + i }, jeton: 300 - i * 40 } : { tip: 'yorum', kullanici: { id: 'k' + i, ad: 'izleyici_adi_' + i }, metin: '' });
    });
    // Bekleme vuruşla ölçülür: kalabalık vuruşla salındığı için ölçüm hep aynı vuruş anına düşsün (eskiden 104
    // vuruş/dk'da 0,8 + 6,5 sn = 1,4 + 11,3 vuruş). Gerçek saniyeyle beklenince tempo değişince salınımın başka bir
    // anı ölçülüyordu. (Not: yan kenardaki bir kişi salınırken birkaç piksel kadrajdan taşıyor; bu ölçüm onu değil,
    // eski ölçümün aynısını sınar.)
    const vurusBekle = async db => { const b0 = await q.evaluate(() => CanliOyun.durum().vurus); for (let i = 0; i < 400; i++) { if (await q.evaluate(h => CanliOyun.durum().vurus >= h, b0 + db)) return; await q.waitForTimeout(25); } };
    await vurusBekle(0.8 * 104 / 60);
    await q.evaluate(() => { CanliOyun._test.D.kuyruk.length = 0; });
    await vurusBekle(6.5 * 104 / 60);
    const r = await q.evaluate(() => {
      const t = document.getElementById('tuval').getBoundingClientRect(), k = 720 / t.width;
      const kut = s => { const x = document.querySelector(s).getBoundingClientRect(); return { x0: (x.left - t.left) * k, x1: (x.right - t.left) * k, y1: (x.bottom - t.top) * k }; };
      const d = CanliOyun.durum(), kj = d.kadraj, sira = kut('.sira'), cosku = kut('.cosku');
      const altinda = (x0, x1, y) => [sira, cosku].some(b => x1 > b.x0 && x0 < b.x1 && y < b.y1 + 2);
      return { kisi: d.kisi, tvGen: Math.round(kj.tv.x1 - kj.tv.x0), orten: kj.orten,
        tvKutu: altinda(kj.tv.x0, kj.tv.x1, kj.tv.y0), antenKutu: kj.anten.noktalar.some(([x, y]) => altinda(x - 6, x + 6, y - 8)),
        liderKutu: !!kj.lider && (altinda(kj.lider.x0, kj.lider.x1, kj.lider.ust) || (kj.lider.etiket !== null && altinda(kj.lider.x0, kj.lider.x1, kj.lider.etiket))),
        tasan: kj.kisiler.filter(q => q.x0 < -4 || q.x1 > 724).map(q => q.ad),
        kutuAltinda: kj.kisiler.filter(q => altinda(q.x0, q.x1, q.ust) || (q.et && q.etiket !== null && altinda(q.x0, q.x1, q.etiket))).map(q => q.ad),
        altaInen: kj.kisiler.filter(q => q.ayak > 1006 || (q.et && q.etiket !== null && q.etiket + 30 > 1010)).map(q => q.ad) };
    });
    await q.screenshot({ path: CIKTI + '/v-kadraj-' + w + '.png' });
    await q.close();
    return r;
  };
  for (const [w, h] of [[540, 960], [1080, 1920]]) {
    const r = await kadrajOlc(w, h);
    kontrol(w + '×' + h + ', ' + r.kisi + ' kişi: televizyon kadrajın yarısından geniş, ekranını baş örtmüyor', r.kisi === 21 && r.tvGen >= 360 && r.orten.length === 0, { tvGenislik: r.tvGen + '/720', orten: r.orten });
    kontrol(w + '×' + h + ': televizyon, anten ve lider sıralama kutusunun / göstergenin altında kalmıyor', !r.tvKutu && !r.antenKutu && !r.liderKutu, r);
    kontrol(w + '×' + h + ': kimse kadrajdan taşmıyor, kimsenin başı ya da adı kutuların altında değil, adlar yorum alanına inmiyor', r.tasan.length === 0 && r.kutuAltinda.length === 0 && r.altaInen.length === 0, { tasan: r.tasan, kutuAltinda: r.kutuAltinda, altaInen: r.altaInen });
  }

  // selde vuruş sırası ve parçacıklar sınırlı
  await bosalt();
  const sel = await p.evaluate(async () => {
    for (let i = 0; i < 3000; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'f' + (i % 300), ad: 'f' + (i % 300) }, jeton: [1, 10, 50, 200, 1000][i % 5] });
    await new Promise(r => setTimeout(r, 1500));
    const D = CanliOyun._test.D; return { kuyruk: D.kuyruk.length, efekt: D.efekt.length, toz: D.toz.length, iz: D.izler.length, kare: +CanliOyun.durum().kareMs.toFixed(1) };
  });
  kontrol('Selde vuruş sırası en çok 10, efekt 8, toz 60, iz 6; oyun akar', sel.kuyruk <= 10 && sel.efekt <= 8 && sel.toz <= 60 && sel.iz <= 6 && sel.kare < 33, sel);

  // vuruş sırası insan gibi işler: sahneden çıkan kişinin bekleyen vuruşu silinir
  await bosalt();
  for (const [id, ad] of [['a', 'Ali'], ['b', 'Bora'], ['c', 'Cem']]) await O({ tip: 'yorum', kullanici: { id, ad }, metin: 'x' });
  await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: 1 });
  await O({ tip: 'hediye', kullanici: { id: 'c', ad: 'Cem' }, jeton: 1 });
  await p.evaluate(() => { const D = CanliOyun._test.D; const k = D.oy.get('c'); k.son = -1e6; });
  // sessiz kalan Cem sahneden çıkar (eskiden sabit 2,5 sn)
  await durumBekle(p, 'Cem sahneden çıktı', () => !CanliOyun.durum().sira.some(x => x[0] === 'Cem'), undefined, 8000);
  const cik = await p.evaluate(() => ({ kuyruk: CanliOyun._test.D.kuyruk.map(e => e.k.ad), sahnede: CanliOyun.durum().sira.map(x => x[0]) }));
  kontrol('Sessiz kalıp çıkanın bekleyen vuruşu sıradan düşer', !cik.kuyruk.includes('Cem'), cik);

  kontrol('Vur Düzelsin testlerinde sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 4).join(' | '));
  await b.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
