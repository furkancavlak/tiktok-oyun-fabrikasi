// Çekirdek testleri: her oyuna uygulanır. Kurallar, bozuk girdi, olay seli, müzik saati, ses ölçümü,
// yayın görünümü, uzun süre çalışma. Oyunu başsız tarayıcıda açar ve window.CanliOyun arayüzü üzerinden sürer.
// Oyuna özgü sayılar (kapasite, kademeler, boş sahne yazısı) sayfadaki OYUN ayarından okunur.
// Çalıştırma: node cekirdek/test/cekirdek.test.js <ad>   (ad verilmezse halay)
'use strict';
const fs = require('fs');
const { OYUN_AD, OYUN_URL, CIKTI, KADEME, tarayici, raporla, kontrolcu, bekle, hazirBekle, kareBekle } = require('./ortak');
const { sonuc, kontrol } = kontrolcu();

(async () => {
  const b = await tarayici(['--enable-precise-memory-info']);
  const hatalar = [];
  const ac = async (w, h, hash) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
    p.on('pageerror', e => hatalar.push('SAYFA HATASI: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
    await p.goto(OYUN_URL + (hash || ''));
    await hazirBekle(p);
    return p;
  };
  const p = await ac(1280, 800);
  const bosalt = () => p.evaluate(() => { document.getElementById('bosalt').click(); });
  const O = (o) => p.evaluate(o2 => CanliOyun.olay(o2), o);
  const durum = () => p.evaluate(() => CanliOyun.durum());
  // oyunun ayarı: kapasite, kademeler (büyükten küçüğe), boş sahne yazısı
  const AYAR = await p.evaluate(() => { const T = CanliOyun._test; return { kapasite: T.OYUN.kapasite, bos: T.OYUN.yazi.bos, kademe: T.KADEME.map(x => ({ min: x.min, ad: x.ad })), birim: T.OYUN.yazi.birim, bosalt: T.OYUN.yazi.bosalt }; });
  const KAP = AYAR.kapasite, MINLER = AYAR.kademe.map(x => x.min);
  console.log('Oyun:', OYUN_AD, '· kapasite', KAP, '· kademeler', MINLER.join('/'));

  // ---------- KURALLAR ----------
  await bosalt();
  let d = await durum(); kontrol('Boşaltınca sahne boş', d.kisi === 0 && d.lider === null, d.kisi);
  await bekle(p, 'sıra kutusu boş yazısını gösteriyor', b2 => document.getElementById('sira-liste').textContent.includes(b2), AYAR.bos, 3000);
  kontrol('Boş sahnede sıra kutusu oyunun boş yazısını gösterir', (await p.textContent('#sira-liste')).includes(AYAR.bos), AYAR.bos);
  await O({ tip: 'begeni', kullanici: { id: 'a', ad: 'Ali' }, adet: 10 });
  d = await durum(); kontrol('Beğeni oyuna sokmaz, coşkuyu artırır', d.kisi === 0 && d.cosku > 0.05, d.cosku.toFixed(3));
  await O({ tip: 'yorum', kullanici: { id: 'a', ad: 'Ali' }, metin: 'selam' });
  await O({ tip: 'yorum', kullanici: { id: 'a', ad: 'Ali' }, metin: 'yine ben' });
  d = await durum(); kontrol('Yorum oyuna sokar, ikinci yorum çoğaltmaz', d.kisi === 1, d.kisi);
  kontrol('İlk gelen lider olur', d.lider === 'Ali', d.lider);
  await O({ tip: 'yorum', kullanici: { id: 'b', ad: 'Bora' }, metin: 'selam' });
  await O({ tip: 'takip', kullanici: { id: 'c', ad: 'Cem' } });
  d = await durum(); kontrol('Takip eden oyuna girer', d.kisi === 3, d.sira);
  await O({ tip: 'hediye', kullanici: { id: 'b', ad: 'Bora' }, jeton: 5 });
  d = await durum(); kontrol('Hediye atan öne geçip lider olur', d.lider === 'Bora' && d.sira[0][1] === 5, d.sira);
  await O({ tip: 'hediye', kullanici: { id: 'c', ad: 'Cem' }, jeton: 5 });
  d = await durum(); kontrol('Eşit jetonda önce gelen önde kalır', d.lider === 'Bora' && d.sira[1][0] === 'Cem', d.sira);
  await O({ tip: 'hediye', kullanici: { id: 'c', ad: 'Cem' }, jeton: 1, adet: 3 });
  d = await durum(); kontrol('Adetli hediye çarpılarak sayılır (1×3)', d.lider === 'Cem' && d.sira[0][1] === 8, d.sira);
  await O({ tip: 'hediye', kullanici: { id: 'yeni', ad: 'Yeni' }, jeton: 50 });
  d = await durum(); kontrol('Sahnede olmayan hediye atınca girer ve sıraya yerleşir', d.lider === 'Yeni' && d.kisi === 4, d.sira);
  kontrol('En çok hediye atan liderdir', d.sira.every(x => x[1] <= d.sira[0][1]) && d.sira[0][0] === d.lider, d.sira);
  // Her kademenin en küçük değeri o kademenin adını, bir eksiği bir alt kademenin adını bildirir; çok büyük hediye en üst kademedir.
  const kd = await p.evaluate(K => {
    const cik = [], dene = (j, i) => { CanliOyun._test.zamanEkle(0.2); CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'kd' + j + '_' + i, ad: 'kd' + j }, jeton: j }); return document.getElementById('bildirim').lastChild.textContent; };
    K.forEach((x, i) => { cik.push([x.min, dene(x.min, i), x.ad]); if (x.min > 1) cik.push([x.min - 1, dene(x.min - 1, i), K[i + 1].ad]); });
    cik.push([K[0].min * 50, dene(K[0].min * 50, 99), K[0].ad]);
    return cik;
  }, AYAR.kademe);
  kontrol('Hediye kademeleri doğru eşleşir (bildirimde kademe adı)', kd.every(([, yazi, ad]) => yazi.includes(' ' + ad + '!')), kd.map(([j, yazi, ad]) => j + ' → ' + yazi.split('·').pop().trim() + ' (beklenen ' + ad + ')'));

  // kapasite
  await bosalt();
  await p.evaluate(n => { for (let i = 0; i < n; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'k' + i, ad: 'kisi' + i }, metin: 'x' }); }, KAP * 2 + 8);
  d = await durum(); kontrol('Kalabalık kapasitede (' + KAP + ' kişi) sınırlanır', d.kisi === KAP, d.kisi);
  kontrol('Yer dolunca ilk gelen (lider) atılmaz', d.lider === 'kisi0', d.lider);
  await p.evaluate(n => { for (let i = 0; i < n; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'z' + i, ad: 'zengin' + i }, jeton: 10 + i }); }, KAP);
  d = await durum(); kontrol('Hediye atanlar dolu sahnede de yer bulur', d.kisi === KAP && d.sira.filter(x => x[1] > 0).length >= KAP - 1, d.sira.filter(x => x[1] > 0).length);
  await O({ tip: 'yorum', kullanici: { id: 'gec', ad: 'GecKalan' }, metin: 'x' });
  d = await durum(); kontrol('Herkes hediye atmışsa yorumcu kimseyi yerinden etmez', !d.sira.some(x => x[0] === 'GecKalan') || d.sira.filter(x => x[1] > 0).length >= KAP - 1, d.sira.some(x => x[0] === 'GecKalan'));

  // boşta kalan çıkar
  await bosalt();
  await p.evaluate(() => { for (let i = 0; i < 6; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'b' + i, ad: 'bos' + i }, metin: 'x' }); CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'b5', ad: 'bos5' }, jeton: 100 }); CanliOyun._test.zamanEkle(250); });
  // Kare döngüsü 45 karede bir en çok bir sessizi çıkarır: beş kişi ~4 sn (eskiden sabit 5,5 sn).
  await bekle(p, 'sessiz kalanlar çıktı (1 kişi, lider bos5)', () => { const d2 = CanliOyun.durum(); return d2.kisi === 1 && d2.lider === 'bos5'; }, undefined, 15000);
  d = await durum(); kontrol('4 dakika sessiz kalan çıkar, hediye atan ve lider kalır', d.kisi === 1 && d.lider === 'bos5', d.sira);

  // ---------- KÖTÜ NİYETLİ / BOZUK GİRDİ ----------
  await bosalt();
  const once = await p.evaluate(() => document.querySelectorAll('*').length);
  const zarar = await p.evaluate(() => {
    window.__xss = 0; const k = '<img src=x onerror="window.__xss=1"><script>window.__xss=1<\/script>';
    const girdi = [
      { tip: 'yorum', kullanici: { id: k, ad: k }, metin: k },
      { tip: 'hediye', kullanici: { id: 'x1', ad: '<b>kalın</b>' }, jeton: 5 },
      { tip: 'takip', kullanici: { id: 'x2', ad: '"><svg onload=window.__xss=1>' } },
      { tip: 'yorum', kullanici: { id: 'uzun', ad: 'A'.repeat(5000) }, metin: 'B'.repeat(50000) },
      { tip: 'yorum', kullanici: { id: 'emoji', ad: '😀👨‍👩‍👧‍👦🇹🇷' }, metin: '🔥'.repeat(100) },
      { tip: 'yorum', kullanici: { id: 'rtl', ad: '‮ters‬' }, metin: 'مرحبا' },
      { tip: 'yorum', kullanici: { id: 12345, ad: 67890 }, metin: 42 },
      { tip: 'yorum', kullanici: {}, metin: 'kimliksiz' }, { tip: 'yorum' }, { tip: 'bilinmeyen', kullanici: { id: 'q' } }, null, undefined, 5, 'metin', [],
      { tip: 'yorum', kullanici: { id: '   ', ad: '   ' }, metin: 'boşluk' },
      { tip: 'hediye', kullanici: { id: 'nan', ad: 'nan' }, jeton: NaN }, { tip: 'hediye', kullanici: { id: 'eksi', ad: 'eksi' }, jeton: -500 },
      { tip: 'hediye', kullanici: { id: 'dev', ad: 'dev' }, jeton: 1e300 }, { tip: 'hediye', kullanici: { id: 'sonsuz', ad: 'sonsuz' }, jeton: Infinity },
      { tip: 'hediye', kullanici: { id: 'yazi', ad: 'yazi' }, jeton: 'abc', adet: 'xyz' }, { tip: 'hediye', kullanici: { id: 'nesne', ad: 'nesne' }, jeton: {}, adet: [] },
      { tip: 'begeni', kullanici: { id: 'bg', ad: 'bg' }, adet: -5 }, { tip: 'begeni', kullanici: { id: 'bg', ad: 'bg' }, adet: 1e12 }, { tip: 'begeni', kullanici: { id: 'bg', ad: 'bg' }, adet: 'çok' },
      { tip: 'yorum', kullanici: { id: 'proto', ad: '__proto__' }, metin: 'constructor' }, { tip: 'yorum', kullanici: { id: '__proto__', ad: 'toString' }, metin: 'x' }
    ];
    let atilan = 0; for (const g of girdi) { try { CanliOyun.olay(g); } catch (e) { atilan++; console.error('olay hata attı: ' + e.message); } }
    return { atilan, d: CanliOyun.durum() };
  });
  await p.waitForTimeout(1200);
  const sonra = await p.evaluate(() => ({ xss: window.__xss, img: document.querySelectorAll('.sahne img, .sahne script, .panel img, .gunluk script, .gunluk b, .sira b, svg[onload]').length, sira: document.getElementById('sira-liste').textContent, d: CanliOyun.durum() }));
  kontrol('Bozuk girdilerin hiçbiri oyunu düşürmez', zarar.atilan === 0, zarar.atilan);
  kontrol('Ad ve yorumdaki HTML çalışmaz, yazı olarak gösterilir', sonra.xss === 0 && sonra.img === 0 && sonra.sira.includes('<b>kalın</b>'), { xss: sonra.xss, eklenenEtiket: sonra.img });
  kontrol('Jeton değerleri sayı olarak kalır (NaN / sonsuz yok)', sonra.d.sira.every(x => Number.isFinite(x[1]) && x[1] >= 0) && sonra.d.sira.find(x => x[0] === 'eksi')[1] === 1, sonra.d.sira.map(x => x[1]));
  kontrol('Çok uzun ad 18 karaktere kısaltılır', sonra.d.sira.every(x => Array.from(x[0]).length <= 18), Math.max(...sonra.d.sira.map(x => Array.from(x[0]).length)));
  kontrol('Coşku 0–1 aralığında kalır', sonra.d.cosku >= 0 && sonra.d.cosku <= 1, sonra.d.cosku);
  await p.locator('#sahne').screenshot({ path: CIKTI + '/t-bozuk-girdi.png' });

  // süzgeç
  await bosalt();
  const suz = await p.evaluate(() => {
    const T = CanliOyun._test, el = document.getElementById('yasak'); el.value = 'Çirkin, KÖTÜsöz'; el.dispatchEvent(new Event('input'));
    const dene = (id, ad, metin) => { CanliOyun.olay({ tip: 'yorum', kullanici: { id, ad }, metin }); const k = T.D.oy.get(id); return [k.ad, k.balon && k.balon.m]; };
    const r = { temiz: dene('s1', 'iyi', 'merhaba'), yasak: dene('s2', 'iyi2', 'bu çok ÇİRKİN bir söz'), ad: dene('s3', 'kötüsöz_44', 'selam'), link: dene('s4', 'iyi4', 'gel bak https://ornek.test/abc ve www.site.test'), tel: dene('s5', 'iyi5', 'ara 0555 123 45 67') };
    document.getElementById('balon-dugme').click(); r.kapali = dene('s6', 'iyi6', 'görünmemeli'); document.getElementById('balon-dugme').click();
    el.value = ''; el.dispatchEvent(new Event('input')); return r;
  });
  kontrol('Yasaklı kelime geçen yorum balon olmaz (büyük/küçük harf, Türkçe)', suz.temiz[1] === 'merhaba' && !suz.yasak[1], suz.yasak);
  kontrol('Yasaklı kelime geçen ad "misafir" olur', suz.ad[0] === 'misafir', suz.ad[0]);
  kontrol('Bağlantı adresi ve telefon balonda gizlenir', !/https|www|ornek|0555|123/.test(suz.link[1] + suz.tel[1]), [suz.link[1], suz.tel[1]]);
  kontrol('Balonlar kapatılınca yorum balonu çıkmaz ama kişi oyuna girer', suz.kapali[0] === 'iyi6' && !suz.kapali[1], suz.kapali);

  // ---------- YAYIN MASASI: durum şeridi, sahneden çıkar, adını gizle, balon kapatma ----------
  await bosalt();
  await p.evaluate(() => {
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'm1', ad: 'Mert' }, metin: 'selam' });
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'm2', ad: 'Lale' }, jeton: 40 });
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'm3', ad: 'kotu_ad' }, metin: 'yasak slogan' });
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'm1', ad: 'Mert' }, jeton: 5 });
  });
  // Yayın masası 250 ms'de bir yazılır (masaYaz).
  await bekle(p, 'yayın masası yazıldı (3 kişi, 45 jeton, 3 satır)', () => document.getElementById('d-kisi').textContent === '3' && document.getElementById('d-jeton').textContent === '45' && document.querySelectorAll('#kisi-liste li[data-id]').length === 3, undefined, 3000);
  const ms = await p.evaluate(() => { const t = id => document.getElementById(id).textContent; return { kisi: t('d-kisi'), jeton: t('d-jeton'), lider: t('d-lider'), bag: t('d-bag'), kare: t('d-kare'), satir: [...document.querySelectorAll('#kisi-liste li[data-id]')].map(li => li.dataset.id + ':' + li.querySelector('.ad').textContent), kapasite: t('d-kapasite'), birim: t('d-birim'), durum: document.getElementById('d-bag-hucre').dataset.durum, durumIkon: document.querySelector('#d-bag-hucre use').getAttribute('href'), kip: { panel: document.getElementById('panel').dataset.kip, deneme: !document.getElementById('deneme-kart').hidden && !!document.getElementById('s-yorum').offsetParent && !!document.getElementById('oto').offsetParent, kademeGizli: document.getElementById('kademe-kart').hidden, gelismisKapali: !document.getElementById('gelismis').open, buOyundaGizli: document.getElementById('bu-oyunda-kart').hidden === !document.getElementById('bu-oyunda').children.length } }; });
  kontrol('Özet satırı: sahnedeki kişi / kapasite ve birim, toplam jeton, lider; durum göstergesi "Deneme" (ikonuyla); kare süresi Gelişmiş\'te', ms.kisi === '3' && ms.kapasite === String(KAP) && ms.birim === AYAR.birim && ms.jeton === '45' && ms.lider === 'Lale' && ms.bag === 'Deneme' && ms.durum === 'deneme' && ms.durumIkon === '#i-deneme' && /\d/.test(ms.kare), ms);
  kontrol('Sahnedekiler listesi jetona göre sıralı', ms.satir.join(',') === 'm2:Lale,m1:Mert,m3:kotu_ad', ms.satir);
  const mod = await p.evaluate(async () => {
    const T = CanliOyun._test, bekle = ms2 => new Promise(r => setTimeout(r, ms2)), satir = id => [...document.querySelectorAll('#kisi-liste li')].find(li => li.dataset.id === id);
    // durum beklemesi: kosul doğru olunca ya da sinir dolunca döner (sonraki kontrol durumu kendisi sınar)
    const durumBekle = (kosul, sinir) => new Promise(r => { const t0 = performance.now(); (function d() { if (kosul()) r(true); else if (performance.now() - t0 > sinir) r(false); else setTimeout(d, 25); })(); });
    const r = {};
    // adını gizle: sıralamadaki düğmeyle
    r.balonVardi = !!T.D.oy.get('m3').balon;
    satir('m3').querySelector('.k-gizle').click();
    r.gizliAd = T.D.oy.get('m3').ad; r.gizliBalon = T.D.oy.get('m3').balon;
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'm3', ad: 'kotu_ad' }, metin: 'yine ben' });
    r.gizliKalir = T.D.oy.get('m3').ad;
    r.sakli = JSON.parse(localStorage.getItem(T.OYUN.id + '-ayar') || '{}');
    // sahneden çıkar: lider çıkınca lider değişir, çıkan hediye atsa da geri gelmez
    satir('m2').querySelector('.k-cikar').click();
    await bekle(30);
    r.cikinca = CanliOyun.durum();
    CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'm2', ad: 'Lale' }, jeton: 500 });
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'm2', ad: 'Lale' }, metin: 'geri geldim' });
    r.donmedi = CanliOyun.durum();
    // olay akışından çıkar (akış 6 karede bir yazılır; eskiden sabit 250 ms)
    await durumBekle(() => [...document.getElementById('gunluk').children].some(li => li.dataset.id === 'm1'), 3000);
    const akis = [...document.getElementById('gunluk').children].find(li => li.dataset.id === 'm1');
    r.akisSatir = !!akis;
    if (akis) akis.querySelector('.g-cikar').click();
    await bekle(30);
    r.akistanCikti = CanliOyun.durum();
    // çıkarılanlar listesi yayın masasıyla (250 ms'de bir) yazılır; eskiden sabit 300 ms
    await durumBekle(() => document.getElementById('mod-liste').querySelectorAll('li[data-id]').length === 3 && /2 çıkarılan · 1 gizli/.test(document.getElementById('mod-ozet').textContent), 3000);
    r.modListe = document.getElementById('mod-liste').querySelectorAll('li[data-id]').length;
    r.ozet = document.getElementById('mod-ozet').textContent;
    // geri al: Yayın sekmesindeki listeden
    const geri = id => [...document.getElementById('mod-liste').children].find(li => li.dataset.id === id).querySelector('button').click();
    geri('m2');
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'm2', ad: 'Lale' }, metin: 'döndüm' });
    r.geriGeldi = CanliOyun.durum().sira.some(x => x[0] === 'Lale');
    geri('m3');
    r.adGeri = T.D.oy.get('m3').ad;
    document.getElementById('mod-temizle').click();
    r.temiz = T.ayar.gizli.length + T.ayar.cikan.length;
    // balonu kapatınca ekrandaki balonlar da hemen gider; B tuşu aynı işi yapar
    CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'm4', ad: 'Balon' }, metin: 'görünür' });
    r.balonOnce = !!T.D.oy.get('m4').balon;
    document.getElementById('balon-dugme').click();
    r.balonSonra = T.D.oy.get('m4').balon; r.balonAyar = T.ayar.balon;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    r.tusla = T.ayar.balon;
    document.getElementById('yasak').dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
    r.yazarken = T.ayar.balon;
    return r;
  });
  kontrol('Adını gizle: ad hemen "misafir" olur, balonu silinir, sonraki yorumda da gizli kalır, saklanır', mod.balonVardi && mod.gizliAd === 'misafir' && !mod.gizliBalon && mod.gizliKalir === 'misafir' && (mod.sakli.gizli || []).some(x => x.id === 'm3' && x.ad === 'kotu_ad'), mod);
  kontrol('Sahneden çıkar: lider çıkar, yeni lider gelir; çıkanın hediyesi ve yorumu onu geri getirmez', !mod.cikinca.sira.some(x => x[0] === 'Lale') && mod.cikinca.lider === 'Mert' && !mod.donmedi.sira.some(x => x[0] === 'Lale') && mod.donmedi.kisi === 2, { cikinca: mod.cikinca.sira, sonra: mod.donmedi.sira });
  kontrol('Olay akışındaki satırdan da çıkarılır; çıkarılanlar listesi ve özeti güncellenir', mod.akisSatir && !mod.akistanCikti.sira.some(x => x[0] === 'Mert') && mod.modListe === 3 && /2 çıkarılan · 1 gizli/.test(mod.ozet), { akis: mod.akisSatir, sira: mod.akistanCikti.sira, liste: mod.modListe, ozet: mod.ozet });
  kontrol('Geri al: çıkarılan yeniden girebilir, gizlenenin adı döner, liste boşalır', mod.geriGeldi && mod.adGeri === 'kotu_ad' && mod.temiz === 0, { geri: mod.geriGeldi, ad: mod.adGeri, kalan: mod.temiz });
  kontrol('Balonlar kapatılınca ekrandaki balon hemen silinir; B tuşu aç/kapa, yazı alanında çalışmaz', mod.balonOnce && !mod.balonSonra && mod.balonAyar === false && mod.tusla === true && mod.yazarken === true, { once: mod.balonOnce, sonra: mod.balonSonra, tus: mod.tusla, yazarken: mod.yazarken });
  kontrol('Deneme kipi (diskten açılınca): deneme izleyicisi kartı görünür, "Bu oyunda hediyeler" gizli, Gelişmiş kapalı, boş "Bu oyunda" kartı gizli (oyunun denetimi varsa görünür)', ms.kip.panel === 'deneme' && ms.kip.deneme && ms.kip.kademeGizli && ms.kip.gelismisKapali && ms.kip.buOyundaGizli, ms.kip);

  // ---------- YAYIN MASASI: ada basınca açılan işlemler, akış (ikon, hediye satırı, süzgeç), boşaltma onayı, Gelişmiş, ikonlar ----------
  await bosalt();
  await p.evaluate(() => {
    const O = CanliOyun.olay;
    O({ tip: 'yorum', kullanici: { id: 'i1', ad: 'Ilgaz' }, metin: 'selam' });
    O({ tip: 'yorum', kullanici: { id: 'i2', ad: 'Irmak' }, metin: 'merhaba' });
    O({ tip: 'hediye', kullanici: { id: 'i3', ad: 'Işık' }, jeton: 50, hediye: { id: '5655', ad: 'Rose' } });
    O({ tip: 'begeni', kullanici: { id: 'i2', ad: 'Irmak' }, adet: 15 });
  });
  await bekle(p, 'masa ve akış yazıldı (3 satır, hediye ve yorum satırı)', () => document.querySelectorAll('#kisi-liste li[data-id]').length === 3 && !!document.querySelector('#gunluk li.t-h[data-id="i3"]') && !!document.querySelector('#gunluk li.t-y[data-id="i1"]') && !!document.querySelector('#gunluk li.t-b[data-id="i2"]'), undefined, 3000);
  // Ada basınca (klavyeyle) altında iki işlem açılır; Tab ile ulaşılır, Esc kapatır ve odak ada döner. Kapalıyken işlem
  // düğmeleri gizlidir: fare üstüne gelince beliren düğme yoktur.
  const kapaliOnce = await p.evaluate(() => [...document.querySelectorAll('#kisi-liste .eylem')].every(e => e.hidden && !e.offsetParent));
  await p.focus('#kisi-liste li[data-id="i1"] .kisi-dugme');
  await p.keyboard.press('Enter');
  const islem = await p.evaluate(() => { const li = document.querySelector('#kisi-liste li[data-id="i1"]'), e = li.querySelector('.eylem'); return { acik: li.querySelector('.kisi-dugme').getAttribute('aria-expanded'), gorunur: !!e.offsetParent, yazi: [...e.querySelectorAll('button')].map(x => x.textContent.trim()).join('|'), tek: document.querySelectorAll('#kisi-liste .eylem:not([hidden])').length }; });
  await p.keyboard.press('Tab');
  const sekmeyle = await p.evaluate(() => document.activeElement.classList.contains('k-gizle'));
  await p.keyboard.press('Escape');
  const kapandi = await p.evaluate(() => ({ gizli: document.querySelector('#kisi-liste li[data-id="i1"] .eylem').hidden, odak: document.activeElement.classList.contains('kisi-dugme') && document.activeElement.closest('li').dataset.id === 'i1' }));
  kontrol('Sahnedekiler: ada basınca (klavyeyle de) altında "Adını gizle" ve "Sahneden çıkar" açılır, Tab ile ulaşılır, Esc kapatır; kapalıyken işlem düğmesi görünmez (üstüne gelmeyle açılan yok)', kapaliOnce && islem.acik === 'true' && islem.gorunur && islem.yazi === 'Adını gizle|Sahneden çıkar' && islem.tek === 1 && sekmeyle && kapandi.gizli && kapandi.odak, { kapaliOnce, islem, sekmeyle, kapandi });
  const akis = await p.evaluate(async () => {
    const g = document.getElementById('gunluk'), r = {}, bk = ms2 => new Promise(z => setTimeout(z, ms2));
    if (document.activeElement) document.activeElement.blur();
    await bk(100);
    const hs = g.querySelector('li.t-h[data-id="i3"]');
    r.hediye = { ikon: hs.firstElementChild.querySelector('use').getAttribute('href'), metin: hs.querySelector('.metin').textContent, jt: (hs.querySelector('.h-jt') || {}).textContent };
    r.begeni = g.querySelector('li.t-b[data-id="i2"] .metin').textContent;
    r.ikonlu = [...g.children].every(li => { const u = li.firstElementChild && li.firstElementChild.querySelector('use'); return !!(u && document.querySelector(u.getAttribute('href'))); });
    // ada basınca işlemler satırın altında açılır (sahnedekilerle aynı); ikinci basış kapatır
    const ys = g.querySelector('li.t-y[data-id="i1"]'), ad = ys.querySelector('button.ad');
    ad.click();
    r.akisAcik = { acik: ad.getAttribute('aria-expanded'), gorunur: !!ys.querySelector('.eylem').offsetParent, yazi: [...ys.querySelectorAll('.eylem button')].map(x => x.textContent.trim()).join('|') };
    ad.click();
    r.akisKapandi = ys.querySelector('.eylem').hidden;
    // süzgeç: Hediyeler yalnız hediye, Yorumlar yalnız yorum satırı bırakır; Hepsi geri getirir
    const say = () => g.children.length, hepsi = say(), suz = s2 => document.querySelector('#akis-suz [data-suz="' + s2 + '"]').click();
    suz('hediye');
    r.hediyeler = { n: say(), hepsiHediye: [...g.children].every(li => li.classList.contains('t-h')), basili: document.querySelector('#akis-suz [data-suz="hediye"]').getAttribute('aria-pressed') };
    suz('yorum');
    r.yorumlar = { n: say(), hepsiYorum: [...g.children].every(li => li.classList.contains('t-y')) };
    suz('hepsi');
    r.hepsi = { once: hepsi, sonra: say(), karisik: !!g.querySelector('li.t-h') && !!g.querySelector('li.t-y') };
    // 60 yorumdan sonra hediye "Hepsi"nin 40 satırından düşer ama Hediyeler süzgecinde kalır
    for (let i = 0; i < 60; i++) CanliOyun.olay({ tip: 'yorum', kullanici: { id: 'sel' + (i % 5), ad: 'sel' + (i % 5) }, metin: 'yorum ' + i });
    await new Promise(z => { const t0 = Date.now(); (function k() { if (!g.querySelector('li.t-h[data-id="i3"]') || Date.now() - t0 > 3000) z(); else setTimeout(k, 50); })(); });
    r.dustu = !g.querySelector('li.t-h[data-id="i3"]') && g.children.length <= 40;
    suz('hediye');
    r.kaldi = !!g.querySelector('li.t-h[data-id="i3"]');
    suz('hepsi');
    return r;
  });
  kontrol('Akış: her satırın başında türünün ikonu; hediye satırı hediyenin adını, jetonunu ve oyunda tetiklediğini yazar; beğeni "15 beğeni"', akis.ikonlu && akis.hediye.ikon === '#i-hediye' && /^Rose · 50 jeton · \S/.test(akis.hediye.metin) && akis.hediye.jt === '50 jeton' && akis.begeni === '15 beğeni', { hediye: akis.hediye, begeni: akis.begeni, ikonlu: akis.ikonlu });
  kontrol('Akış: ada basınca altında aynı iki işlem açılır, ikinci basış kapatır', akis.akisAcik.acik === 'true' && akis.akisAcik.gorunur && akis.akisAcik.yazi === 'Adını gizle|Sahneden çıkar' && akis.akisKapandi, akis.akisAcik);
  kontrol('Akış süzgeci: Hediyeler yalnız hediye, Yorumlar yalnız yorum bırakır, Hepsi geri getirir; yorum seli hediyeyi Hediyeler süzgecinden düşürmez', akis.hediyeler.n >= 1 && akis.hediyeler.hepsiHediye && akis.hediyeler.basili === 'true' && akis.yorumlar.n >= 2 && akis.yorumlar.hepsiYorum && akis.hepsi.sonra === akis.hepsi.once && akis.hepsi.karisik && akis.dustu && akis.kaldi, { hediyeler: akis.hediyeler, yorumlar: akis.yorumlar, hepsi: akis.hepsi, dustu: akis.dustu, kaldi: akis.kaldi });
  const bo = await p.evaluate(() => {
    const $ = id => document.getElementById(id), r = {}, kisi = () => CanliOyun.durum().kisi, k0 = kisi();
    r.k0 = k0;
    r.etiket = $('bosalt-ad').textContent;
    $('bosalt-sor').click();
    r.soru = { onay: !$('bosalt-onay').hidden, sor: $('bosalt-sor').hidden, kisi: kisi() === k0, odak: document.activeElement.id };
    $('bosalt-vazgec').click();
    r.vazgec = { onay: $('bosalt-onay').hidden, sor: !$('bosalt-sor').hidden, kisi: kisi() === k0 };
    $('bosalt-sor').click();
    $('bosalt').click();
    r.evet = { kisi: kisi(), onay: $('bosalt-onay').hidden, sor: !$('bosalt-sor').hidden };
    if (document.activeElement) document.activeElement.blur();
    return r;
  });
  kontrol('Boşalt: önce sayfanın içinde onay sorar (Vazgeç hiçbir şeyi silmez, odak Vazgeç\'te); "Evet, boşalt" sahneyi boşaltır; düğmede oyunun kendi yazısı', bo.k0 > 0 && bo.etiket === AYAR.bosalt && bo.soru.onay && bo.soru.sor && bo.soru.kisi && bo.soru.odak === 'bosalt-vazgec' && bo.vazgec.onay && bo.vazgec.sor && bo.vazgec.kisi && bo.evet.kisi === 0 && bo.evet.onay && bo.evet.sor, bo);
  const gel = await p.evaluate(() => {
    const g = document.getElementById('gelismis'), r = { kapali: !g.open };
    r.disarida = ['bag-adres', 'bag-dugme', 'bag-ileti', 'bag-rozet', 'd-kare', 'd-bpm'].filter(id => !g.contains(document.getElementById(id)));
    r.bicim = !!g.querySelector('pre') && /"event":"gift"/.test(g.querySelector('pre').textContent);
    r.api = /resmî bir açık API/.test(g.textContent);
    r.kapaliyken = !document.getElementById('bag-adres').checkVisibility() && !document.getElementById('d-kare').checkVisibility();
    // Gelişmiş dışındaki masa yazılarında teknik söz yok (izleyici adı ve oyunun kendi yazıları sayılmaz)
    const disari = [...document.querySelectorAll('.masa-bas, .ozet, .kart-bas, .kart-ipucu, #deneme-kart .eylemler, #guvenlik-kart, #muzik-kart .kart-bas, .bosalt-kutu')].map(e => e.innerText).join(' ');
    r.teknik = disari.match(/\bAPI\b|köprü|ws:\/\/|\bms\b|WebSocket/gi) || [];
    g.open = true;
    r.acilinca = document.getElementById('bag-adres').checkVisibility() && document.getElementById('d-kare').checkVisibility();
    g.open = false;
    return r;
  });
  kontrol('Gelişmiş: kapalı gelir; köprü adresi ve bağlan düğmesi, ileti biçimi, kare süresi, vuruş sayısı ve API açıklaması onun içinde; masanın geri kalanında teknik söz yok', gel.kapali && !gel.disarida.length && gel.bicim && gel.api && gel.kapaliyken && gel.acilinca && !gel.teknik.length, gel);
  const ik = await p.evaluate(() => {
    const kullanim = [...document.querySelectorAll('.panel use')].map(u => u.getAttribute('href'));
    return {
      sembol: document.querySelectorAll('#ikonlar symbol').length,
      kirik: kullanim.filter(h => !/^#i-[a-z]+$/.test(h) || !document.querySelector(h)),
      gizlenmemis: [...document.querySelectorAll('.panel svg.ik')].filter(s => s.getAttribute('aria-hidden') !== 'true').length,
      yazisiz: [...document.querySelectorAll('.panel button, .panel summary, .panel a')].filter(x => !(x.getAttribute('aria-label') || x.textContent).trim()).map(x => x.id || x.className)
    };
  });
  kontrol('İkonlar: takım sayfanın içinde (' + ik.sembol + ' çizim); her kullanım var olan bir çizime gider, süs ikonlar ekran okuyucudan gizli, yazısız düğme yok', ik.sembol >= 23 && !ik.kirik.length && !ik.gizlenmemis && !ik.yazisiz.length, ik);
  {
    // Durum göstergesi, bağlanılamayınca: "Bağlanamadı" ve hatanın kendi cümlesi (ayrı sayfa: başarısız soketin konsol
    // satırı yukarıdaki "sayfada hata çıkmadı" sayımına girmesin).
    const hp2 = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await hp2.goto(OYUN_URL);
    await hazirBekle(hp2);
    await hp2.evaluate(() => CanliOyun.baglan('ws://127.0.0.1:9/olay'));
    await bekle(hp2, 'durum göstergesi "Bağlanamadı"', () => document.getElementById('d-bag').textContent === 'Bağlanamadı', undefined, 5000);
    const hd = await hp2.evaluate(() => ({ ad: document.getElementById('d-bag').textContent, durum: document.getElementById('d-bag-hucre').dataset.durum, ikon: document.querySelector('#d-bag-hucre use').getAttribute('href'), cumle: document.getElementById('durum-cumle').hidden ? '' : document.getElementById('durum-cumle').textContent, ileti: document.getElementById('bag-ileti').textContent, kip: document.getElementById('panel').dataset.kip }));
    kontrol('Durum göstergesi: bağlanılamayınca "Bağlanamadı" der, hatanın kendi cümlesi altında yazar; masa deneme kipinde kalır', hd.ad === 'Bağlanamadı' && hd.durum === 'hata' && hd.ikon === '#i-hata' && hd.cumle.length > 10 && hd.cumle === hd.ileti && hd.kip === 'deneme', hd);
    await hp2.close();
  }

  // köprü ileti çevirisi (sayfa tarafı)
  const cv = await p.evaluate(() => { const c = CanliOyun.cevir; return {
    v1chat: c({ event: 'chat', data: { uniqueId: 'a', nickname: 'A', comment: 'selam' } }),
    v2chat: c({ event: 'chat', data: { user: { uniqueId: 'a', nickname: 'A' }, comment: 'selam' } }),
    seri: c({ event: 'gift', data: { uniqueId: 'a', diamondCount: 5, repeatCount: 2, giftType: 1, repeatEnd: false } }),
    seriSon: c({ event: 'gift', data: { uniqueId: 'a', diamondCount: 5, repeatCount: 3, giftType: 1, repeatEnd: true } }),
    seriSayi: c({ event: 'gift', data: { user: { uniqueId: 'a' }, giftDetails: { diamondCount: 5, giftType: 1 }, repeatCount: 3, repeatEnd: 0 } }),
    seriSayiSon: c({ event: 'gift', data: { user: { uniqueId: 'a' }, giftDetails: { diamondCount: 5, giftType: 1 }, repeatCount: 3, repeatEnd: 1 } }),
    buyuk: c({ event: 'gift', data: { uniqueId: 'a', diamondCount: 29999, repeatCount: 1, giftType: 2 } }),
    cop: [c(null), c('x'), c({ event: 'gift' }), c({ event: 'roomUser', data: { viewerCount: 5 } })]
  }; });
  kontrol('Köprü iletisi: düz ve iç içe kullanıcı biçimi', cv.v1chat.metin === 'selam' && cv.v2chat.kullanici.id === 'a');
  kontrol('Seri hediye sürerken sayılmaz, bitince bir kez sayılır', cv.seri === null && cv.seriSon.jeton === 5 && cv.seriSon.adet === 3 && cv.seriSayi === null && cv.seriSayiSon.adet === 3, { surerken: cv.seri, bitince: cv.seriSon });
  kontrol('Tek seferlik büyük hediye hemen sayılır', cv.buyuk.jeton === 29999);
  kontrol('Tanınmayan iletiler yok sayılır', cv.cop.every(x => x === null));

  // ---------- SEL: çok hızlı olay ----------
  await bosalt();
  const sel = await p.evaluate(M => {
    const t0 = performance.now(); let n = 0;
    for (let i = 0; i < 20000; i++) { const id = 'f' + (i % 300), r = i % 10; n++;
      if (r < 5) CanliOyun.olay({ tip: 'yorum', kullanici: { id, ad: id }, metin: 'sel ' + i });
      else if (r < 8) CanliOyun.olay({ tip: 'begeni', kullanici: { id, ad: id }, adet: 15 });
      else CanliOyun.olay({ tip: 'hediye', kullanici: { id, ad: id }, jeton: M[i % M.length] }); }
    return { ms: performance.now() - t0, n, d: CanliOyun.durum(), gunluk: document.getElementById('gunluk').children.length, bildirim: document.getElementById('bildirim').children.length };
  }, MINLER);
  // Selden sonra kare döngüsü 90 kare daha çizmeli (eskiden sabit 3 sn ≈ 180 kare). kareMs 20 karelik kayan
  // ortalamadır: 90 karede oturur, selin parçacıkları da daha sönmediği için ölçüm eskisinden gevşek değildir.
  const selAkti = await kareBekle(p, 90, 10000);
  d = await durum();
  kontrol('20.000 olay tek seferde işlenir', sel.ms < 4000, Math.round(sel.ms) + ' ms');
  kontrol('Selde parçacık, günlük ve bildirim sınırlı kalır', sel.d.parca <= 460 && sel.gunluk <= 40 && sel.bildirim <= 3, { parca: sel.d.parca, gunluk: sel.gunluk, bildirim: sel.bildirim });
  kontrol('Selden sonra oyun akmaya devam eder', selAkti && d.kisi === KAP && d.kareMs < 40, { kareAkti: selAkti, kisi: d.kisi, kareMs: +d.kareMs.toFixed(1) });
  await p.locator('#sahne').screenshot({ path: CIKTI + '/t-sel.png' });

  // ---------- MÜZİK SAATİ ----------
  // Oyunun kendi havaları (OYUN.muzik): ikinci ve üçüncü havanın düğmesine basılır (iki havalı oyunda üçüncü = ilk).
  const HV = await p.evaluate(() => CanliOyun._test.HAVALAR.map(h => h.id));
  const saat = await p.evaluate(async HV => {
    const T = CanliOyun._test, ornek = []; let dur = false;
    const al = () => { ornek.push([performance.now(), CanliOyun.durum().vurus]); if (!dur) requestAnimationFrame(al); }; al();
    const bekle = ms => new Promise(r => setTimeout(r, ms));
    await bekle(1500); document.getElementById('ses-dugme').click(); await bekle(2500);
    document.getElementById('hava-' + HV[1 % HV.length]).click(); await bekle(4000);
    document.getElementById('ses-dugme').click(); await bekle(1500);
    document.getElementById('hava-' + HV[2 % HV.length]).click(); await bekle(3500);
    document.getElementById('ses-dugme').click(); await bekle(2500);
    for (let i = 0; i < 5; i++) { document.getElementById('ses-dugme').click(); await bekle(150); }
    await bekle(1500); dur = true;
    let geri = 0, sicrama = 0, enGeri = 0, enIleri = 0;
    for (let i = 1; i < ornek.length; i++) { const db = ornek[i][1] - ornek[i - 1][1], dtt = (ornek[i][0] - ornek[i - 1][0]) / 1000; if (db < -0.02) { geri++; enGeri = Math.min(enGeri, db); } if (db > dtt * 4.5 + 0.25) { sicrama++; enIleri = Math.max(enIleri, db); } }
    return { ornek: ornek.length, geri, sicrama, enGeri, enIleri, hava: CanliOyun.durum().hava, ses: CanliOyun.durum().ses, toplamVurus: ornek[ornek.length - 1][1] - ornek[0][1], sure: (ornek[ornek.length - 1][0] - ornek[0][0]) / 1000 };
  }, HV);
  kontrol('Ses aç/kapa ve hava değişiminde vuruş saati geri gitmez, sıçramaz', saat.geri === 0 && saat.sicrama === 0, saat);
  kontrol('Seçilen havaya geçilir', saat.hava === HV[2 % HV.length], saat.hava);
  const dongu = await p.evaluate(() => { const { Muzik, HAVALAR } = CanliOyun._test, m = new Muzik(); m.sonraki = 0; const gecis = [[0, m.hava.id]]; let son = m.hava.id; while (m.sonraki < 420) { m.adimCal(); if (m.hava.id !== son) { son = m.hava.id; gecis.push([Math.round(m.sonraki), son]); } } const bar = HAVALAR.map(h => [h.id, h.formAdim / h.bar, h.formAdim % h.bar]); return { gecis, bar }; });
  kontrol('Havalar kendiliğinden sırayla döner (7 dakikada)', dongu.gecis.length >= 4 && [1, 2, 3].every(k => dongu.gecis[k][1] === HV[k % HV.length]), dongu.gecis);
  kontrol('Her havanın bölümleri ölçüye tam oturur', dongu.bar.every(x => x[2] === 0), dongu.bar);

  // ---------- SES ÖLÇÜMÜ ----------
  const ses = await p.evaluate(async () => {
    const { Muzik, HAVALAR } = CanliOyun._test, SR = 44100, sonuc = [];
    const isle = async (hi, sn, ayar) => { const oc = new OfflineAudioContext(1, SR * sn, SR), m = new Muzik(); m.hava = HAVALAR[hi]; m.sirayla = false; m.sesKur(oc); m.acik = true; m.sonraki = 0.05; ayar && ayar(m); const olay = []; while (m.sonraki < sn - 0.6) { const t = m.sonraki, a = m.adim, bd = 60 / (m.hava.bpm * m.carpan) / m.hava.spb; m.adimCal(); const n = m.hava.harita[a]; if (n) olay.push({ t, uz: n.len * bd, n }); } const vur = m.olaylar.filter(o => o.tip === 'dum' || o.tip === 'tek').map(o => [o.t, o.tip]); const buf = await oc.startRendering(); return { d: buf.getChannelData(0), olay, vur, m }; };
    const rms = (d, a, b) => { let q = 0; a = Math.max(0, a | 0); b = Math.min(d.length, b | 0); for (let i = a; i < b; i++) q += d[i] * d[i]; return Math.sqrt(q / Math.max(1, b - a)); };
    const perde = (d, orta) => { const N = 2048, s0 = (orta * SR - N / 2) | 0; let enIyi = 0, enLag = 0; const kor = lag => { let q = 0; for (let i = 0; i < N; i++) q += d[s0 + i] * d[s0 + i + lag]; return q; }; for (let lag = Math.floor(SR / 1500); lag <= Math.ceil(SR / 230); lag++) { const q = kor(lag); if (q > enIyi * 1.02) { enIyi = q; enLag = lag; } } const a = kor(enLag - 1), b2 = kor(enLag), c = kor(enLag + 1), kay = (a - c) / (2 * (a - 2 * b2 + c) || 1); return SR / (enLag + kay); };
    const kapat = (m, ...k) => { for (const x of k) m.ses.kanal[x].value = 0; };
    for (let hi = 0; hi < HAVALAR.length; hi++) {
      const h = HAVALAR[hi], sn = 24;
      // yalnız ezgi: perde doğruluğu
      const z = await isle(hi, sn, m => kapat(m, 'davul', 'eslik', 'yanki'));
      const sapma = []; let olculen = 0;
      for (const o of z.olay) { if (o.n.sus || o.n.tril || o.uz < 0.14) continue; const beklenen = h.tonik * Math.pow(2, h.sent(o.n.deg) / 1200), f = perde(z.d, o.t + Math.min(0.1, o.uz * 0.62)); let c = 1200 * Math.log2(f / beklenen); if (Math.abs(c - 1200) < 60) c -= 1200; if (Math.abs(c + 1200) < 60) c += 1200; sapma.push(c); olculen++; }
      const mutlak = sapma.map(Math.abs).sort((a, b) => a - b);
      // yalnız davul: vuruş zamanlaması
      const dv = await isle(hi, sn, m => kapat(m, 'ezgi', 'eslik', 'yanki'));
      // Sıkıştırıcı tüm sese sabit ~6 ms gecikme ekler; önemli olan vuruşların kendi içinde tutarlı olması.
      let gec = 0, enGec = 0, sessiz = 0; const baslar = { dum: [], tek: [] };
      for (let vi = 0; vi < dv.vur.length; vi++) { const [t, tip] = dv.vur[vi], i0 = (t * SR) | 0; let tepe = 0; for (let i = i0; i < i0 + SR * 0.03; i++) tepe = Math.max(tepe, Math.abs(dv.d[i])); if (tepe < 0.02) { sessiz++; continue; }
        if (vi && t - dv.vur[vi - 1][0] < 0.5 && dv.vur[vi - 1][1] === 'dum') continue; // önceki dümün kuyruğu ölçümü bozar
        let bas = -1; for (let i = i0; i < i0 + SR * 0.03; i++) if (Math.abs(dv.d[i]) > tepe * 0.25) { bas = i; break; } const ms = (bas - i0) / SR * 1000; baslar[tip].push(ms); if (ms > 13) gec++; enGec = Math.max(enGec, ms); }
      const yayilim = Math.max(Math.max(...baslar.dum) - Math.min(...baslar.dum), Math.max(...baslar.tek) - Math.min(...baslar.tek)); if (yayilim > 3) gec++;
      const dm = await isle(hi, sn, m => kapat(m, 'ezgi', 'davul', 'yanki'));
      const tam = await isle(hi, sn);
      let tepe = 0, kirpik = 0; for (const v of tam.d) { const a = Math.abs(v); if (a > tepe) tepe = a; if (a >= 0.999) kirpik++; }
      // solo bölümünde ezgi gerçekten susuyor mu
      const soloBol = h.bolumBas.find(b => b.ad === 'D'), adimSn = 60 / h.bpm / h.spb, sB = soloBol ? 0.05 + soloBol.bas * adimSn : sn, sS = soloBol ? sB + soloBol.uz * adimSn : sn;
      const soloZ = sS < sn - 0.7 ? rms(z.d, (sB + 0.4) * SR, (sS - 0.05) * SR) : null;
      // spektrum: ezginin parlaklığı (1–3,5 kHz bandının payı)
      const goertzel = (d, s0, N, f) => { const w = 2 * Math.PI * f / SR, cw = 2 * Math.cos(w); let a = 0, b = 0; for (let i = 0; i < N; i++) { const x = d[s0 + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)) + cw * a - b; b = a; a = x; } return Math.sqrt(a * a + b * b - cw * a * b); };
      let alt = 0, orta = 0, ust = 0; for (let f = 200; f < 8000; f += 50) { const g = goertzel(z.d, SR * 3, 16384, f); if (f < 1000) alt += g * g; else if (f < 3500) orta += g * g; else ust += g * g; }
      sonuc.push({ hava: h.id, olculenNota: olculen, ortancaSapma: +mutlak[mutlak.length >> 1].toFixed(1), yuzde90: +mutlak[Math.floor(mutlak.length * 0.9)].toFixed(1), enBuyuk: +mutlak[mutlak.length - 1].toFixed(1), vurus: dv.vur.length, gecVurus: gec, sessizVurus: sessiz, enGecMs: +enGec.toFixed(2), yayilimMs: +yayilim.toFixed(2), olculenVurus: baslar.dum.length + baslar.tek.length, rmsEzgi: +rms(z.d, SR, SR * 12).toFixed(3), rmsDavul: +rms(dv.d, SR, SR * 12).toFixed(3), rmsEslik: +rms(dm.d, SR, SR * 12).toFixed(3), tepe: +tepe.toFixed(3), kirpilan: kirpik, soloEzgiRms: soloZ === null ? null : +soloZ.toFixed(4), bant: { alt: +(alt / (alt + orta + ust)).toFixed(2), orta: +(orta / (alt + orta + ust)).toFixed(2), ust: +(ust / (alt + orta + ust)).toFixed(2) } });
      if (hi === 0) { window.__wavAd = h.id; const kisa = tam.d.subarray(0, SR * 14), i16 = new Int16Array(kisa.length); for (let i = 0; i < kisa.length; i++) i16[i] = Math.max(-1, Math.min(1, kisa[i])) * 32767; let ikili = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 8192) ikili += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); window.__wav = btoa(ikili); }
    }
    return sonuc;
  });
  for (const s of ses) {
    kontrol('Ses [' + s.hava + ']: ezgi notaları doğru perdede', s.olculenNota > 20 && s.ortancaSapma < 12 && s.yuzde90 < 30, { nota: s.olculenNota, ortancaSent: s.ortancaSapma, yuzde90Sent: s.yuzde90, enBuyukSent: s.enBuyuk });
    kontrol('Ses [' + s.hava + ']: davul vuruşları zamanında', s.vurus > 30 && s.gecVurus === 0 && s.sessizVurus === 0, { vurus: s.vurus, olculen: s.olculenVurus, sessiz: s.sessizVurus, enGecMs: s.enGecMs, yayilimMs: s.yayilimMs });
    kontrol('Ses [' + s.hava + ']: kırpılma yok, tepe güvenli', s.kirpilan === 0 && s.tepe < 0.95, { tepe: s.tepe });
    // Denge burada kaba ölçülür (ham RMS: ezgi duyulur, davul var); algılanan ses yüksekliğiyle ayrıntılı denge ve
    // oyunlar arası fark cekirdek/test/muzik.test.js'te.
    kontrol('Ses [' + s.hava + ']: ezgi duyulur, davul da var', s.rmsEzgi > 0.04 && s.rmsDavul > s.rmsEzgi * 0.4, { ezgi: s.rmsEzgi, davul: s.rmsDavul, eslik: s.rmsEslik, bant: s.bant });
    if (s.soloEzgiRms !== null) kontrol('Ses [' + s.hava + ']: davul solosunda ezgi susar', s.soloEzgiRms < 0.01, s.soloEzgiRms);
  }
  const enYuksek = await p.evaluate(async () => { const { Muzik, HAVALAR } = CanliOyun._test, SR = 44100, cik = []; for (let hi = 0; hi < HAVALAR.length; hi++) { const oc = new OfflineAudioContext(1, SR * 16, SR), m = new Muzik(); m.hava = HAVALAR[hi]; m.sirayla = false; m.duzey = 0.7; m.sesKur(oc); m.acik = true; m.sonraki = 0.05; m.sov = true; m.cosku = 1; m.carpan = 1.38; while (m.sonraki < 15.4) m.adimCal(); const d = (await oc.startRendering()).getChannelData(0); let tepe = 0; for (const v of d) tepe = Math.max(tepe, Math.abs(v)); cik.push(+tepe.toFixed(3)); } return cik; });
  kontrol('Ses en yüksek düzeyde, en hızlı tempoda ve davul şovunda da kırpılmaz', enYuksek.every(x => x < 0.99), enYuksek);
  const wav = Buffer.from(await p.evaluate(() => window.__wav), 'base64'), wavAd = await p.evaluate(() => window.__wavAd), bas = Buffer.alloc(44);
  bas.write('RIFF', 0); bas.writeUInt32LE(36 + wav.length, 4); bas.write('WAVEfmt ', 8); bas.writeUInt32LE(16, 16); bas.writeUInt16LE(1, 20); bas.writeUInt16LE(1, 22); bas.writeUInt32LE(44100, 24); bas.writeUInt32LE(88200, 28); bas.writeUInt16LE(2, 32); bas.writeUInt16LE(16, 34); bas.write('data', 36); bas.writeUInt32LE(wav.length, 40);
  fs.writeFileSync(CIKTI + '/' + wavAd + '.wav', Buffer.concat([bas, wav])); // oyunun ilk havası, 14 sn (dinleme önizlemesi muzik.test.js'te)

  // ---------- HAZIR PARÇALAR (isteğe bağlı müzik klasörü) ----------
  // Depoda ses dosyası yoktur; test, sayfanın içinde 120 vuruş/dk'lık 4 saniyelik bir tık sesi üretip onu çaldırır.
  const hp = await ac(1280, 800);
  const hz = await hp.evaluate(async () => {
    const m = CanliOyun._test.muzik, bekle = ms => new Promise(r => setTimeout(r, ms));
    const SR = 22050, sn = 4, n = SR * sn, pcm = new Int16Array(n);
    for (let b = 0; b < sn * 2; b++) for (let i = 0; i < 600; i++) pcm[Math.floor((0.25 + b * 0.5) * SR) + i] = Math.sin(i * 0.3) * 20000 * (1 - i / 600);
    const bas = new DataView(new ArrayBuffer(44)), yaz = (o, s) => [...s].forEach((ch, i) => bas.setUint8(o + i, ch.charCodeAt(0)));
    yaz(0, 'RIFF'); bas.setUint32(4, 36 + n * 2, true); yaz(8, 'WAVEfmt '); bas.setUint32(16, 16, true); bas.setUint16(20, 1, true); bas.setUint16(22, 1, true);
    bas.setUint32(24, SR, true); bas.setUint32(28, SR * 2, true); bas.setUint16(32, 2, true); bas.setUint16(34, 16, true); yaz(36, 'data'); bas.setUint32(40, n * 2, true);
    const url = URL.createObjectURL(new Blob([bas, pcm], { type: 'audio/wav' }));
    const on = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const kotu = m.hazirKur([{ ad: 'x', dosya: '../kopru.js', vurus: on }, { ad: 'y', dosya: 'a.mp3', vurus: 'yok' }, { ad: 'z', dosya: 'http://kotu.test/a.mp3', vurus: on }, null, 5, { dosya: 'b.mp3', vurus: [0, 1, NaN, 3, 4, 5, 6, 7, 8, 9] }, { dosya: 'c.mp3', vurus: [0, 1] }]);
    const iyi = m.hazirKur([{ ad: '<b>deneme</b> ' + 'A'.repeat(200), dosya: 'deneme.wav', bpm: 120, kayma: 1, vurus: Array.from({ length: 10 }, (_, i) => 0.25 + i * 0.5) }]);
    const ad = m.parcalar[0].ad;
    m.muzikKok = ''; m.parcalar[0].dosya = url; // dosya yerine bellekteki ses
    const ornek = []; let dur = false;
    const al = () => { ornek.push([performance.now(), CanliOyun.durum().vurus, m.hazirCal]); if (!dur) requestAnimationFrame(al); }; al();
    await bekle(800); document.getElementById('ses-dugme').click(); await bekle(900);
    m.kaynakSec('hazir'); await bekle(2500);
    const calarken = { hazirCal: m.hazirCal, ad: m.calanAd(), bpm: Math.round(m.calanBpm()), bilgi: document.getElementById('cosku-bilgi').textContent };
    await bekle(3500); // parça biter, baştan başlar
    const dongu = m.hazirCal;
    m.kaynakSec('sentez'); await bekle(2500);
    const sentez = { hazirCal: m.hazirCal, durdu: m.calar.paused };
    m.kaynakSec('hazir'); await bekle(1500);
    const yeniden = m.hazirCal;
    document.getElementById('ses-dugme').click(); await bekle(1500); // ses kapanır: parça durur, saat yürümeye devam eder
    const kapali = { hazirCal: m.hazirCal, durdu: m.calar.paused, ses: m.acik };
    dur = true;
    let geri = 0, enDonma = 0, donmaBas = ornek[0][0], enSicrama = 0, hv = 0, hs = 0;
    for (let i = 1; i < ornek.length; i++) {
      const db = ornek[i][1] - ornek[i - 1][1], dt = (ornek[i][0] - ornek[i - 1][0]) / 1000;
      if (db < -0.02) geri++;
      if (db > 1e-4) donmaBas = ornek[i][0]; else enDonma = Math.max(enDonma, (ornek[i][0] - donmaBas) / 1000);
      enSicrama = Math.max(enSicrama, db - dt * 4.5);
      if (ornek[i][2] && ornek[i - 1][2] && db < 0.5) { hv += db; hs += dt; }
    }
    return { kotu, iyi, ad, calarken, dongu, sentez, yeniden, kapali, geri, enDonma: +enDonma.toFixed(2), enSicrama: +enSicrama.toFixed(2), hazirHiz: +(hv / hs).toFixed(2), ornek: ornek.length };
  });
  kontrol('Hazır parça listesi: bozuk, klasör dışı ya da adres içeren kayıtlar alınmaz', hz.kotu === 0 && hz.iyi === 1, { kotu: hz.kotu, iyi: hz.iyi });
  kontrol('Hazır parça adı temizlenir ve kısaltılır', Array.from(hz.ad).length <= 28, hz.ad);
  kontrol('Hazır parça seçilince o parça çalar, sahnede adı ve temposu yazar', hz.calarken.hazirCal && hz.calarken.bilgi.startsWith(hz.ad) && hz.calarken.bpm >= 118 && hz.calarken.bpm <= 152, hz.calarken);
  kontrol('Hazır parçada dans parçanın vuruşuyla yürür (saniyede 2–2,5 vuruş)', hz.hazirHiz > 1.85 && hz.hazirHiz < 2.7, hz.hazirHiz);
  kontrol('Hazır parça bitince çalmaya devam eder', hz.dongu === true);
  kontrol('Üretilen müziğe dönünce parça durur; yeniden seçilince çalar', !hz.sentez.hazirCal && hz.sentez.durdu && hz.yeniden, { sentez: hz.sentez, yeniden: hz.yeniden });
  kontrol('Ses kapatılınca hazır parça da durur', !hz.kapali.hazirCal && hz.kapali.durdu && !hz.kapali.ses, hz.kapali);
  kontrol('Müzik kaynağı değişirken vuruş saati geri gitmez, donmaz, ileri en çok iki ölçü atlar', hz.geri === 0 && hz.enDonma < 0.6 && hz.enSicrama < 8.5, { geri: hz.geri, enDonmaSn: hz.enDonma, enSicrama: hz.enSicrama, ornek: hz.ornek });
  await hp.close();

  // ---------- YAYIN GÖRÜNÜMÜ, 1080×1920, BAŞARIM ----------
  const y = await ac(1080, 1920, '#yayin');
  await y.evaluate(n => { for (let i = 0; i < n; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'y' + i, ad: 'izleyici_' + i }, jeton: 5 + i }); }, KAP);
  // Tam kalabalıkla 180 kare (eskiden sabit 6 sn): kareMs'nin 20 karelik ortalaması dolu sahnede oturur.
  const yAkti = await kareBekle(y, 180, 20000);
  const yd = await y.evaluate(() => ({ w: document.getElementById('tuval').width, h: document.getElementById('tuval').height, panel: getComputedStyle(document.getElementById('panel')).display, sahne: document.getElementById('sahne').getBoundingClientRect().toJSON(), d: CanliOyun.durum() }));
  kontrol('Yayın görünümü: tuval 1080×1920, panel gizli', yd.w === 1080 && yd.h === 1920 && yd.panel === 'none' && Math.round(yd.sahne.width) === 1080, { tuval: yd.w + '×' + yd.h, panel: yd.panel });
  kontrol('1080×1920, ' + yd.d.kisi + ' kişi: kare başına işlem süresi (yazılımsal çizimde)', yAkti && yd.d.kisi === KAP && yd.d.kareMs < 33, +yd.d.kareMs.toFixed(1) + ' ms' + (yAkti ? '' : ' (kare döngüsü 180 kare çizmedi)'));
  await y.screenshot({ path: CIKTI + '/t-yayin-1080.png' });
  await y.close();
  for (const [w, h] of [[1920, 1080], [1366, 768], [1210, 1280], [900, 1600], [360, 640], [820, 700], [2560, 1440]]) {
    const q = await ac(w, h); const r = await q.evaluate(() => { const s = document.getElementById('sahne').getBoundingClientRect(); return { tasma: document.documentElement.scrollWidth - innerWidth, oran: s.width / s.height, sag: s.right, gen: innerWidth, alt: s.bottom, yuk: innerHeight }; });
    kontrol('Pencere ' + w + '×' + h + ': yatay taşma yok, sahne 9:16', r.tasma <= 0 && Math.abs(r.oran - 9 / 16) < 0.005 && r.sag <= r.gen + 0.5, { oran: +r.oran.toFixed(4), tasma: r.tasma });
    if (w > 900) {
      // Masa: sahne solda, masa sağda ve pencereye sığar; sayfa dikeyde kaymaz; hiçbir kart ve satır yana taşmaz.
      const m = await q.evaluate(() => { const pr = document.getElementById('panel').getBoundingClientRect(), sr = document.getElementById('sahne').getBoundingClientRect(); return { dikey: document.documentElement.scrollHeight - innerHeight, solda: sr.right <= pr.left, sag: Math.round(pr.right), alt: Math.round(pr.bottom), gen: innerWidth, yuk: innerHeight, tasan: [...document.querySelectorAll('.panel .kart, .panel .kart li, .masa-bas, .ozet')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.id || e.className).slice(0, 5) }; });
      kontrol('Pencere ' + w + '×' + h + ': masa sahnenin sağında, pencereye sığar (sayfa dikeyde de kaymaz), kartlar yana taşmaz', m.dikey <= 0 && m.solda && m.sag <= m.gen && m.alt <= m.yuk && !m.tasan.length, m);
      if (w === 1366) {
        // En yaygın dizüstü boyunda deneme kipinde: kartlar sütunu kaydırılmadan Yayın güvenliğinin başlığı ve balon anahtarı görünür.
        const g = await q.evaluate(() => { const y = document.getElementById('masa-yan').getBoundingClientRect(), b = document.querySelector('#guvenlik-kart h2').getBoundingClientRect(), t = document.getElementById('balon-dugme').getBoundingClientRect(); return { kaydirma: document.getElementById('masa-yan').scrollTop, deneme: !document.getElementById('deneme-kart').hidden, baslik: Math.round(b.top), anahtar: Math.round(t.bottom), sutunAlt: Math.round(y.bottom), kesik: [...document.querySelectorAll('#hediyeler .h-esik')].filter(e => e.scrollWidth > e.clientWidth).map(e => e.textContent) }; });
        kontrol('1366×768, deneme kipi: kartlar sütunu kaydırılmadan Yayın güvenliğinin başlığı ve balon anahtarı görünür; hediye düğmelerinin jetonu kesilmez', g.deneme && g.kaydirma === 0 && g.anahtar <= g.sutunAlt && !g.kesik.length, g);
      }
    }
    await q.close();
  }

  // ---------- UZUN SÜRE ÇALIŞMA ----------
  // Zamanla şişme ve yavaşlama sürüm öncesi aranır: "tam" kademede 9 × 10 sn, karşılaştırma 30. saniyeden sonuna.
  // "hizli" kademede (düzenleme döngüsü) aynı kod yolu ve aynı kontroller 4 × 10 sn çalışır, karşılaştırma 30. ile 40.
  // saniye arası. Isınma kısaltılmaz: sayfa öğeleri ilk saniyelerde dolar (halayda 8. saniyede 533, 16.'da 685,
  // 30.'dan sonra ~683), daha erken bir ilk ölçüm dolmayı şişme sanır. Sınırlar aynı kalır: +25 MB ve +30 öğe büyüme
  // hızı değil gürültü payıdır, kısa pencerede büyüme ancak daha az olur. Kısa sürüm yalnız hızlı sızıntıyı yakalar;
  // yavaş sızıntı için tam kademe gerekir.
  const UZUN = KADEME === 'tam' ? { tur: 9, ara: 10000, ilk: 2 } : { tur: 4, ara: 10000, ilk: 2 }, UZUN_SN = UZUN.tur * UZUN.ara / 1000;
  if (KADEME !== 'tam')
    console.log('HIZLI KADEME: uzun dayanıklılık testi (9 × 10 sn) atlandı, yerine kısa sürümü (' + UZUN.tur + ' × ' + UZUN.ara / 1000 + ' sn) çalışıyor.\n' +
      '  Uzun hâli (sürümden önce): TEST_KADEME=tam node cekirdek/test/cekirdek.test.js ' + OYUN_AD + '  ya da --hizli olmadan node araclar/test.js');
  const u = await ac(1280, 800);
  await u.evaluate(() => { document.getElementById('hiz-2').click(); });
  const bellek = [];
  for (let i = 0; i < UZUN.tur; i++) {
    await u.waitForTimeout(UZUN.ara);
    await u.evaluate(([i2, M]) => { CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'uz' + (i2 % 3), ad: 'uzun_' + (i2 % 3) }, jeton: M[i2 % Math.min(3, M.length)] }); }, [i, MINLER]);
    bellek.push(await u.evaluate(() => ({ mb: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), dom: document.querySelectorAll('*').length, d: CanliOyun.durum(), oy: CanliOyun._test.D.oy.size })));
  }
  const ilk = bellek[UZUN.ilk], son = bellek[bellek.length - 1];
  kontrol(UZUN_SN + ' sn çılgın kalabalık: bellek ve sayfa öğeleri şişmez', son.mb < ilk.mb + 25 && son.dom < ilk.dom + 30 && son.oy <= KAP + 24, { bellekMB: bellek.map(x => x.mb), oge: [ilk.dom, son.dom], karakter: son.oy });
  kontrol(UZUN_SN + ' sn çılgın kalabalık: akıcılık korunur', bellek.every(x => x.d.kareMs < 33), bellek.map(x => +x.d.kareMs.toFixed(1)));
  await u.locator('#sahne').screenshot({ path: CIKTI + '/t-uzun.png' });
  // sekme arkaya gidip gelince
  const gizli = await u.evaluate(async () => { const v0 = CanliOyun.durum().vurus; Object.defineProperty(document, 'hidden', { value: true, configurable: true }); await new Promise(r => setTimeout(r, 2500)); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); await new Promise(r => setTimeout(r, 800)); const v1 = CanliOyun.durum().vurus; return { v0, v1 }; });
  kontrol('Sekme arkaya gidip gelince saat ilerlemeye devam eder', gizli.v1 > gizli.v0 + 3 && gizli.v1 < gizli.v0 + 14, gizli);

  // ---------- ÇEKİRDEK YARDIMCILARI: kamera, ad etiketleri, insan takımı, çizim, sahne yazıları, tema, saat ----------
  // Ayrı sayfada, oyunun kendi sahnesine dokunmadan: işlevler CanliOyun._test.cekirdek üzerinden çağrılır, sonuç aynı
  // evaluate içinde okunur (kare döngüsü araya giremez). Değiştirilen ayarlar sonunda geri konur.
  const e = await ac(540, 960, '#yayin');
  await e.evaluate(() => { document.getElementById('bosalt').click(); if (document.getElementById('oto').getAttribute('aria-pressed') === 'true') document.getElementById('oto').click(); });
  const kmr = await e.evaluate(() => {
    const T = CanliOyun._test, K = T.cekirdek, kam = K.kam, r = {};
    T.D.sarsinti = 0;
    const al = () => ({ D: kam.D, tx: kam.tx, tz: kam.tz, cy: kam.cy });
    const pts = [[-2, 0], [2, 0], [0, 2.5], [1.2, -1]];
    K.kameraSigdir(pts, 1); const eski = al();
    K.kameraSigdir({ noktalar: pts }, 1); const yeni = al();
    r.ayni = JSON.stringify(eski) === JSON.stringify(yeni);
    // yana bakış: sahne x = 3…5 arasında; eskisi x = 0'a bakıp uzaklaşırdı
    const yan = [[3, 0], [5, 0], [4, 2]];
    K.kameraSigdir(yan, 1); const dOrta0 = kam.D;
    K.kameraSigdir({ noktalar: yan, x: 'orta' }, 1);
    const m = K.pr([4, 0, kam.tz]);
    r.yan = { tx: +kam.tx.toFixed(3), D0: +dOrta0.toFixed(2), D: +kam.D.toFixed(2), ekranX: +m.x.toFixed(1), icinde: yan.every(n => { const p = K.pr([n[0], 0, n[1]]); return p.x > 0 && p.x < 720; }) };
    // nokta başına pay
    K.kameraSigdir([[0, 0], [1, 0]], 1); const p0 = kam.D;
    K.kameraSigdir([[0, 0], [1, 0, 2.5]], 1); r.pay = { varsayilan: +p0.toFixed(2), genis: +kam.D.toFixed(2) };
    // odak: ortadaki büyük nesne kalabalık yüzünden küçülmez
    const odak = [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]], kalabalik = [];
    for (let i = 0; i < 30; i++) kalabalik.push([-7 + i * 0.5, 2 + (i % 3)]);
    K.kameraSigdir({ noktalar: odak }, 1); const dOdak = kam.D;
    K.kameraSigdir({ noktalar: kalabalik.concat(odak) }, 1); const dHepsi = kam.D;
    K.kameraSigdir({ noktalar: kalabalik, odak, odakEn: 1.25 }, 1);
    r.odak = { odak: +dOdak.toFixed(2), hepsi: +dHepsi.toFixed(2), odakli: +kam.D.toFixed(2), odakIcinde: odak.every(n => { const p = K.pr([n[0], 0, n[1]]); return p.x > 0 && p.x < 720 && p.y > K.ALAN_UST && p.y < K.ALAN_ALT; }) };
    // ön sığdırma: konvoy gibi 30 m'lik kuyruk; öndeki 4 m sığar, kuyruk üstten taşar
    const kuyruk = []; for (let z = 0; z <= 30; z += 1.5) kuyruk.push([0.9, z]);
    K.kameraSigdir(kuyruk, 1); const dKuyruk = kam.D;
    K.kameraSigdir({ noktalar: kuyruk, on: 4 }, 1);
    const on = K.pr([0.9, 0, 0]), uc = K.pr([0, 0, 30]);
    r.on = { tum: +dKuyruk.toFixed(2), on: +kam.D.toFixed(2), onY: +on.y.toFixed(1), kuyrukY: +uc.y.toFixed(1) };
    // piksel payı: en arkadakinin adının üstü (ustPay) şeridin ustPx altında kalır
    const iki = [[0, 0], [0, 3]];
    K.kameraSigdir({ noktalar: iki }, 1);
    const ust0 = K.pr([0, kam.ustPay, 3]).y, on0 = K.pr([0, 0, 0]).y;
    K.kameraSigdir({ noktalar: iki, ustPx: 60 }, 1);
    const ust1 = K.pr([0, kam.ustPay, 3]).y, on1 = K.pr([0, 0, 0]).y;
    r.ustPx = { ust0: +ust0.toFixed(1), ust60: +ust1.toFixed(1), on0: +on0.toFixed(1), on60: +on1.toFixed(1), etiketPay: K.ETIKET_PAY };
    return r;
  });
  kontrol('Kamera: seçeneksiz nesne biçimi eski dizi biçimiyle aynı kadrajı verir', kmr.ayni, kmr.ayni);
  kontrol('Kamera: x hedefi ("orta") yana kaymış sahneye bakar, daha yakından sığdırır', Math.abs(kmr.yan.tx - 4) < 1e-6 && Math.abs(kmr.yan.ekranX - 360) < 2 && kmr.yan.D < kmr.yan.D0 * 0.8 && kmr.yan.icinde, kmr.yan);
  kontrol('Kamera: nokta başına pay ([x, z, pay]) kadrajı genişletir', kmr.pay.genis > kmr.pay.varsayilan * 1.3, kmr.pay);
  kontrol('Kamera: odak, kalabalık ne kadar yayılırsa yayılsın en çok odakEn kat uzaklaşır ve kadrajda kalır', kmr.odak.odakli <= kmr.odak.odak * 1.25 + 1e-6 && kmr.odak.hepsi > kmr.odak.odakli * 1.2 && kmr.odak.odakIcinde, kmr.odak);
  kontrol('Kamera: "on" öndekileri sığdırır, kuyruk kadrajın üstünden taşar', kmr.on.on < kmr.on.tum * 0.6 && kmr.on.onY < 1006 && kmr.on.onY > 505 && kmr.on.kuyrukY < 505, kmr.on);
  kontrol('Kamera: ustPx en arkadakinin üstüne piksel payı bırakır (üst kenar ~ustPx aşağı iner, öndeki şeritte kalır)', kmr.ustPx.ust60 - kmr.ustPx.ust0 > 45 && kmr.ustPx.on60 <= 1006, kmr.ustPx);

  const etk = await e.evaluate(() => {
    const T = CanliOyun._test, K = T.cekirdek, ET = K.ETIKET, eski = { ...ET }, r = {};
    const kisi = (ad, x, y, ek) => Object.assign({ ad, et: Object.assign({ x, y, s: 90, d: 10 }, ek || {}), son: -99, sn: 9, yeni: -99, katilim: 0 }, ek && ek.k || {});
    const ciz = (ayar, ekler) => { Object.assign(ET, { ustSinir: null, altSinir: null, disari: 'kenar', balonSira: 'ekleme' }, ayar); K.etiketCiz(ekler); return ekler.map(k => k.etKutu ? k.etKutu.map(Math.round) : null); };
    r.serbest = ciz({}, [kisi('kutuya', 200, 330)])[0];
    r.sinirli = ciz({ ustSinir: K.ALAN_UST }, [kisi('kutuya', 200, 520)])[0];
    r.cokUstte = ciz({ ustSinir: K.ALAN_UST }, [kisi('cokUstte', 200, 120)])[0];
    r.asagi = ciz({}, [kisi('asagi', 300, 600, { asagi: true, alt: 640 })])[0];
    r.kenar = ciz({}, [kisi('disarda', -80, 700)])[0];
    r.gizli = ciz({ disari: 'gizle' }, [kisi('disarda', -80, 700)])[0];
    r.altSinir = ciz({ altSinir: K.ALAN_ALT }, [kisi('dipte', 300, 1040)])[0];
    // üst üste iki ad: sınıra dayalıyken ikincisi aşağı kayar, kutuya girmez
    r.ikiAd = ciz({ ustSinir: K.ALAN_UST }, [kisi('bir', 300, 515), kisi('iki', 305, 515)]);
    // balon: ucunun yeri ve çizim sırası (sonra çizilen üstte)
    const c = K.c, yazilan = [], asil = c.fillText;
    c.fillText = function (m, ...a) { yazilan.push(m); return asil.call(this, m, ...a); };
    const z = T.zaman(), b1 = kisi('yakin', 300, 700, { d: 5 }), b2 = kisi('uzak', 330, 700, { d: 20 });
    b1.balon = { m: 'ÖNDEKİ', t0: z - 1 }; b2.balon = { m: 'ARKADAKİ', t0: z - 1 };
    ciz({ balonSira: 'derinlik' }, [b1, b2]);
    r.derinlik = yazilan.filter(m => m === 'ÖNDEKİ' || m === 'ARKADAKİ');
    yazilan.length = 0;
    const b3 = kisi('yer', 300, 700, { bx: 500, by: 900 }); b3.balon = { m: 'BURADA', t0: z - 1 };
    c.fillStyle = '#000000'; c.fillRect(0, 0, 720, 1280);
    ciz({}, [b3]);
    const px = c.getImageData(Math.round(500 * c.canvas.width / 720), Math.round(867 * c.canvas.height / 1280), 1, 1).data;
    r.balonYer = { px: [...px.slice(0, 3)], vurgu: K.RENK.vurgu };
    c.fillText = asil;
    Object.assign(ET, eski);
    return r;
  });
  const UST = 505;
  kontrol('Ad etiketi: üst sınır yokken ad sıralama kutusunun alanına çıkabilir (eski davranış)', etk.serbest && etk.serbest[1] < UST, etk.serbest);
  kontrol('Ad etiketi: ustSinir ile ad ALAN_UST\'un altında kalır; sınırın çok üstündeki (öncelikli olmayan) ad yazılmaz', etk.sinirli && etk.sinirli[1] >= UST && etk.cokUstte === null, { sinirli: etk.sinirli, cokUstte: etk.cokUstte });
  kontrol('Ad etiketi: üst üste iki ad sınırdayken ikincisi aşağı kayar, ikisi de sınırın altında', etk.ikiAd.every(k => k && k[1] >= UST) && etk.ikiAd[1][1] > etk.ikiAd[0][1], etk.ikiAd);
  kontrol('Ad etiketi: asagi ile ad bağlantı noktasının (et.alt) altına asılır', etk.asagi && etk.asagi[1] >= 645, etk.asagi);
  kontrol('Ad etiketi: ekran dışındaki ad öntanımda kenara itilir, disari: "gizle" ile çizilmez', etk.kenar && etk.kenar[0] <= 5 && etk.gizli === null, { kenar: etk.kenar, gizli: etk.gizli });
  kontrol('Ad etiketi: altSinir ile ad yorum alanına inmez', etk.altSinir && etk.altSinir[1] + etk.altSinir[3] <= 1006, etk.altSinir);
  kontrol('Konuşma balonu: balonSira "derinlik" öndekini en son (üstte) çizer; et.bx / et.by balonun yerini seçer', etk.derinlik.join() === 'ARKADAKİ,ÖNDEKİ' && Math.abs(etk.balonYer.px[0] - parseInt(etk.balonYer.vurgu.slice(1, 3), 16)) < 8, etk);

  const ins = await e.evaluate(() => {
    const T = CanliOyun._test, K = T.cekirdek, c = K.c, r = {};
    // Chrome birkaç okumadan sonra tuvali GPU'dan yazılım çizimine geçirir, kenar yumuşatması değişir: karşılaştırmadan önce geçsin.
    for (let i = 0; i < 4; i++) c.getImageData(0, 0, 4, 4);
    K.kameraSigdir([[-1, -1], [1, 1]], 1);
    const kur = (id, f) => { const k = K.karakterYap(id, id); k.x = 0; k.z = 0; k.yon = Math.PI; k.g.boy = 1; f && f(k); return k; };
    const govdeCiz = (k, poz) => { const W = K.iskeletKur(k, poz || K.pozBekle(k)); k.j.haR = k.j.haR || W(-0.2, 0.33, 0.05); k.j.haL = k.j.haL || W(0.2, 0.33, 0.05); K.kolKur(k); return W; };
    const resim = fn => { c.setTransform(c.canvas.width / 720, 0, 0, c.canvas.height / 1280, 0, 0); c.fillStyle = '#336699'; c.fillRect(0, 0, 720, 1280); K.liste.length = 0; fn(); K.listeCiz(); return c.getImageData(0, 0, c.canvas.width, c.canvas.height).data; };
    const fark = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
    // baş yönü
    const k1 = kur('test:bas'); govdeCiz(k1);
    const duz = resim(() => K.insanEkle(k1));
    k1.basYon = Math.PI; const ayni = resim(() => K.insanEkle(k1));
    k1.basYon = Math.PI + 0.9; const donuk = resim(() => K.insanEkle(k1));
    r.bas = { ayni: fark(duz, ayni), donuk: fark(duz, donuk), govdeYon: +k1.yon.toFixed(3) };
    delete k1.basYon;
    // baş ölçeği
    resim(() => K.insanEkle(k1)); const r1 = k1.basEkran.r;
    k1.basOlcek = 1.5; resim(() => K.insanEkle(k1)); r.olcek = { r1: +r1.toFixed(2), r15: +k1.basEkran.r.toFixed(2), etiketY: +k1.et.y.toFixed(1) };
    delete k1.basOlcek;
    // oturma: yüksek oturakta ayaklar sarkar, alçak oturakta yerde; dizler önde
    const k2 = kur('test:otur'), pY = K.pozOtur(k2, 0.45); govdeCiz(k2, pY);
    r.yuksek = { kalca: +k2.j.hip[1].toFixed(3), ayak: +k2.j.ayR[1].toFixed(3), dizOnde: (k2.j.dzR[2] - k2.j.hip[2]) * k2.f[2] + (k2.j.dzR[0] - k2.j.hip[0]) * k2.f[0] };
    const pA = K.pozOtur(k2, 0.16); govdeCiz(k2, pA);
    r.alcak = { kalca: +k2.j.hip[1].toFixed(3), ayak: +k2.j.ayR[1].toFixed(3), dizUstte: k2.j.dzR[1] > k2.j.ayR[1] + 0.05, dizOnde: (k2.j.dzR[2] - k2.j.hip[2]) * k2.f[2] > 0.05 };
    // el biçimleri
    const k3 = kur('test:el'); const W3 = K.iskeletKur(k3, K.pozBekle(k3)); k3.j.haR = W3(-0.3, 0.75, 0.1); k3.j.haL = W3(0.3, 0.75, 0.1); K.kolKur(k3);
    const yuvarlak = resim(() => K.insanEkle(k3));
    k3.elSekil = { R: 'avuc', L: 'avuc' }; const avuc = resim(() => K.insanEkle(k3));
    k3.elSekil = { R: 'yumruk', L: 'yumruk' }; const yumruk = resim(() => K.insanEkle(k3));
    r.el = { avuc: fark(yuvarlak, avuc), yumruk: fark(yuvarlak, yumruk), birbirinden: fark(avuc, yumruk) };
    // uzun kol: omuzdan 0,48 boy uzaktaki el, öntanımda kol düz (dirsek doğrunun üstünde), kolBoy 1,8 ile dirsek bükülü
    const k4 = kur('test:kol'); const W4 = K.iskeletKur(k4, K.pozBekle(k4));
    const om = k4.j.omR, el = [om[0] - 0.48, om[1] + 0.05, om[2]];
    const bukum = () => { const a = k4.j.omR, d = k4.j.drR, h = el; const ad = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]), dh = Math.hypot(h[0] - d[0], h[1] - d[1], h[2] - d[2]), ah = Math.hypot(h[0] - a[0], h[1] - a[1], h[2] - a[2]); return +(ad + dh - ah).toFixed(3); };
    k4.j.haR = el; k4.j.haL = W4(0.2, 0.3, 0.05); K.kolKur(k4); const b0 = bukum(), u0 = Math.hypot(...[0, 1, 2].map(i => k4.j.drR[i] - om[i]));
    k4.kolBoy = 1.8; K.kolKur(k4); const b1 = bukum(), u1 = Math.hypot(...[0, 1, 2].map(i => k4.j.drR[i] - om[i]));
    r.kol = { duzBukum: b0, uzunBukum: b1, ustKol0: +u0.toFixed(3), ustKol1: +u1.toFixed(3) };
    return r;
  });
  kontrol('İnsan: k.basYon başı gövdeden bağımsız döndürür; gövdeyle aynı yönde değer verilince görüntü değişmez', ins.bas.ayni === 0 && ins.bas.donuk > 50 && ins.bas.govdeYon === 3.142, ins.bas);
  kontrol('İnsan: kafaCiz ölçeği (k.basOlcek) başı büyütür, ad etiketi büyüyen başın üstüne kayar', Math.abs(ins.olcek.r15 / ins.olcek.r1 - 1.5) < 0.01, ins.olcek);
  kontrol('İnsan: pozOtur yüksek oturakta kalça oturakta, ayaklar yerden yukarıda sarkar, dizler önde', Math.abs(ins.yuksek.kalca - 0.51) < 0.02 && ins.yuksek.ayak > 0.06 && ins.yuksek.dizOnde > 0.05, ins.yuksek);
  kontrol('İnsan: pozOtur alçak oturakta ayaklar yerde, dizler kalkık ve önde', ins.alcak.ayak < 0.05 && ins.alcak.dizUstte && ins.alcak.dizOnde, ins.alcak);
  kontrol('İnsan: k.elSekil açık avuç ve yumruk çizer (ikisi de yuvarlak elden ve birbirinden farklı)', ins.el.avuc > 30 && ins.el.yumruk > 30 && ins.el.birbirinden > 30, ins.el);
  kontrol('İnsan: k.kolBoy kolu uzatır, uzaktaki ele dirsek bükülü yetişir', ins.kol.duzBukum < 0.01 && ins.kol.uzunBukum > 0.02 && ins.kol.ustKol1 > ins.kol.ustKol0 * 1.5, ins.kol);

  const czm = await e.evaluate(() => {
    const T = CanliOyun._test, K = T.cekirdek, c = K.c, r = {};
    c.setTransform(c.canvas.width / 720, 0, 0, c.canvas.height / 1280, 0, 0);
    const px = (x, y) => [...c.getImageData(Math.round(x * c.canvas.width / 720), Math.round(y * c.canvas.height / 1280), 1, 1).data.slice(0, 3)];
    r.renk = [K.renkKat('#000000', '#ffffff', 0.5), K.renkKat('#f00', '#00f', 0.25), K.renkKat('#102030', '#102030', 0.7)];
    K.kameraSigdir([[-1.5, -1.5], [1.5, 1.5]], 1);
    const Tk = K.donusum(0, 0, 0, Math.PI, 1);
    c.fillStyle = '#000000'; c.fillRect(0, 0, 720, 1280);
    const g = K.kutuCiz(Tk, -0.6, 0.6, 0, 0.8, -0.4, 0.4, '#c0392b', 2);
    const on = K.pr(K.yerelNokta(Tk, 0, 0.3, 0.4)), ust = K.pr(K.yerelNokta(Tk, 0, 0.8, 0));
    r.kutu = { gorunen: g, onPx: px(on.x, on.y), ustPx: px(ust.x, ust.y), ustRenk: K.renkKat('#c0392b', '#fff4dc', 0.22) };
    c.fillStyle = '#000000'; c.fillRect(0, 0, 720, 1280);
    const u = K.gokCiz({ gok: ['#2050a0', '#80c0ff'], zemin: ['#40a040', '#206020'], ufuk: 420, gunes: { x: 0.7, r: 40, renk: '#ffee00' } });
    r.gok = { u, gokPx: px(100, 100), zeminPx: px(100, 900), gunesPx: px(504, 404), ufukY: +K.ufukY().toFixed(1), beklenen: +(K.kam.cy - K.kam.F * Math.tan(K.kam.egim)).toFixed(1) };
    return r;
  });
  kontrol('Çizim: renkKat iki rengi karıştırır (#rgb kısa biçim de)', czm.renk[0] === 'rgb(128,128,128)' && czm.renk[1] === 'rgb(191,0,64)' && czm.renk[2] === 'rgb(16,32,48)', czm.renk);
  kontrol('Çizim: kutuCiz yalnız kameraya bakan yüzleri çizer (ön ve üst; arka değil), üst yüz açık tonda', czm.kutu.gorunen.on && czm.kutu.gorunen.ust && !czm.kutu.gorunen.arka && czm.kutu.onPx.join() === '192,57,43' && 'rgb(' + czm.kutu.ustPx.join(',') + ')' === czm.kutu.ustRenk, czm.kutu);
  kontrol('Çizim: gokCiz ufkun üstüne gök, altına zemin, ufukta güneş çizer; ufukY kameradan hesaplanır', czm.gok.u === 420 && czm.gok.gokPx[2] > 150 && czm.gok.zeminPx[1] > czm.gok.zeminPx[0] + 20 && czm.gok.gunesPx[0] > 200 && czm.gok.gunesPx[2] < 80 && czm.gok.ufukY === czm.gok.beklenen, czm.gok);

  // sahne yazıları: sıralama kutusu dolu, üç bildirim, pankart (öntanım ve "alt")
  const yzi = await e.evaluate(async () => {
    const T = CanliOyun._test, K = T.cekirdek, bekle = ms => new Promise(r => setTimeout(r, ms)), r = {};
    for (let i = 0; i < 6; i++) CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'yz' + i, ad: 'çok_uzun_bir_ad_' + i }, jeton: 10 + i });
    const kesis = (a, b) => !!(a && b && a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]);
    for (let i = 0; i < 3; i++) { T.zamanEkle(1); K.bildir('çok_uzun_bir_izleyici_adı_' + i, '29999 jeton', 'Meydan senin!'); }
    const eski = K.SAHNE_YAZI.pankart;
    K.pankart('Yeni lider', 'çok_uzun_bir_ad_5'); await bekle(450);
    let o = T.olcum(); r.ust = { sira: o.kutular.sira, pankart: o.kutular.pankart, bildirim: o.kutular.bildirim };
    r.ustKesisir = kesis(o.kutular.pankart, o.kutular.sira);
    r.bildirimKesisir = o.kutular.bildirim.some(b => kesis(b, o.kutular.sira));
    K.SAHNE_YAZI.pankart = 'alt';
    K.pankart('Yeni lider', 'çok_uzun_bir_ad_5'); await bekle(450);
    o = T.olcum(); r.alt = { pankart: o.kutular.pankart, sira: o.kutular.sira };
    r.altKesisir = kesis(o.kutular.pankart, o.kutular.sira);
    r.altAlanda = o.kutular.pankart && o.kutular.pankart[1] + o.kutular.pankart[3] < K.ALAN_ALT;
    K.SAHNE_YAZI.pankart = eski;
    // ölçüm: sahnedeki herkesin yüzü ve (yazıldıysa) ad kutusu
    r.kisiler = o.kisiler.length; r.yuzlu = o.kisiler.filter(k => k.bas && k.bas.r > 0).length; r.adli = o.kisiler.filter(k => k.etiket).length;
    return r;
  });
  kontrol('Sahne yazıları: bildirimler sıralama kutusunun üstüne binmez', !yzi.bildirimKesisir, yzi.ust);
  kontrol('Sahne yazıları: sahneYazi.pankart "alt" ile pankart sıralama kutusunun altından, oyuncu şeridinden geçer', !yzi.altKesisir && yzi.altAlanda, { alt: yzi.alt, oncekiYerKesisir: yzi.ustKesisir });
  kontrol('Ölçüm (_test.olcum, kare-cek JSON): sahne yazılarının kutuları ve oyuncuların yüzü ölçülür', yzi.ust.sira && yzi.ust.bildirim.length === 3 && yzi.kisiler >= 6 && yzi.adli >= 1, { kisi: yzi.kisiler, yuzlu: yzi.yuzlu, adli: yzi.adli });

  // tema: sahne ve panel ayrı renk
  const tema = await e.evaluate(() => {
    const K = CanliOyun._test.cekirdek, oku = (el, ad) => getComputedStyle(el).getPropertyValue(ad).trim();
    K.renkUygula(Object.assign({}, K.RENK, { zemin: '#87c5ea', acik: '#1d2a3a' }), K.RENK_OTO);
    const r = { kokZemin: oku(document.documentElement, '--zemin'), panelZemin: oku(document.getElementById('panel'), '--zemin'), panelYazi: getComputedStyle(document.getElementById('panel')).color, sayfa: getComputedStyle(document.body).backgroundColor, sahneYazi: oku(document.querySelector('.hud'), '--acik') };
    K.renkUygula(K.RENK, K.PANEL_RENK);
    r.geri = { kok: oku(document.documentElement, '--zemin'), panel: oku(document.getElementById('panel'), '--zemin'), sayfaDegisken: oku(document.documentElement, '--sayfa-zemin') };
    r.oyunRenk = K.RENK.zemin;
    return r;
  });
  kontrol('Tema: panelRenk verilince sahne renkleri sahnede, panel ve sayfa arka planı panelin renginde; verilmezse eski hâl', tema.kokZemin === '#87c5ea' && tema.panelZemin === '#0e1230' && tema.sahneYazi === '#1d2a3a' && tema.panelYazi === 'rgb(246, 236, 217)' && tema.geri.kok === tema.oyunRenk && tema.geri.panel === tema.oyunRenk && tema.geri.sayfaDegisken === '', tema);

  // vuruş saatini dondurma (test kancası)
  const dnd = await e.evaluate(async () => {
    const T = CanliOyun._test, bekle = ms => new Promise(r => setTimeout(r, ms)), r = {};
    T.vurusDondur(5.25); await bekle(250); r.dondu = CanliOyun.durum().vurus;
    T.vurusIlerle(0.5); await bekle(120); r.ilerledi = CanliOyun.durum().vurus;
    T.vurusCoz(); await bekle(300); const a = CanliOyun.durum().vurus; await bekle(500); r.cozuldu = [a, CanliOyun.durum().vurus];
    return r;
  });
  kontrol('Test kancası: vurusDondur B\'yi sabitler, vurusIlerle ilerletir, vurusCoz müziğe bırakır', dnd.dondu === 5.25 && dnd.ilerledi === 5.75 && dnd.cozuldu[1] > dnd.cozuldu[0] + 0.3, dnd);

  // ana iş parçacığı uzun kilitlenince (olay seli, ağır kare) vuruş saati donmamalı
  const kilit = await e.evaluate(async () => {
    const ornek = []; let dur = false;
    const al = () => { ornek.push([performance.now(), CanliOyun.durum().vurus]); if (!dur) requestAnimationFrame(al); }; al();
    await new Promise(r => setTimeout(r, 700));
    const t0 = performance.now(); while (performance.now() - t0 < 900); const tk = performance.now();
    await new Promise(r => setTimeout(r, 1500)); dur = true;
    const sonra = ornek.filter(o => o[0] > tk), once = ornek.filter(o => o[0] < t0);
    let enDurma = 0, bas = sonra[0][0];
    for (let i = 1; i < sonra.length; i++) { if (sonra[i][1] - sonra[i - 1][1] > 1e-4) bas = sonra[i][0]; else enDurma = Math.max(enDurma, (sonra[i][0] - bas) / 1000); }
    const ilk = sonra.filter(o => o[0] < tk + 1000), hiz = (once[once.length - 1][1] - once[0][1]) / ((once[once.length - 1][0] - once[0][0]) / 1000);
    return { onceHiz: +hiz.toFixed(2), kilittenSonra1sn: +(ilk[ilk.length - 1][1] - ilk[0][1]).toFixed(2), enDurmaSn: +enDurma.toFixed(2), geri: sonra.some((o, i) => i && o[1] < sonra[i - 1][1]) };
  });
  kontrol('Müzik saati: 0,9 sn kilitten sonra vuruş saati donmaz, hemen eski hızında yürür', kilit.enDurmaSn < 0.2 && kilit.kilittenSonra1sn > kilit.onceHiz * 0.7 && !kilit.geri, kilit);
  await e.close();

  // ==== HEDİYE KİMLİĞİ (hediye: { id, ad }) — başı ====
  // Oyunun oyunHediye kancası sarılır (derlenmiş sayfanın geçici kopyasında): kancanın dördüncü bilgisi kaydedilir,
  // oyunun kendi kancası değişmeden çalışır. Ayrı sayfa; oyunun kendisine dokunulmaz.
  {
    const os = require('os'), path = require('path'), { pathToFileURL } = require('url');
    const asil = fs.readFileSync(require('./ortak').OYUN_HTML, 'utf8'), kac = asil.split('function oyunHediye(').length - 1;
    const sarili = asil.replace('function oyunHediye(', 'function oyunHediye(...__h) { (window.__kanca = window.__kanca || []).push({ n: __h.length, jeton: __h[1], hediye: __h[3] === undefined ? \'yok\' : __h[3], sayi: __h[4] }); return __oyunHediyeAsil(...__h); }\nfunction __oyunHediyeAsil(');
    const gk = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-hediye-')), gy = path.join(gk, 'oyun.html');
    fs.writeFileSync(gy, sarili);
    const hp = await b.newPage({ viewport: { width: 1280, height: 800 } });
    hp.on('pageerror', e => hatalar.push('SAYFA HATASI (hediye): ' + e.message));
    await hp.goto(pathToFileURL(gy).href); await hazirBekle(hp);
    const hk = await hp.evaluate(async () => {
      const O = CanliOyun.olay, T = CanliOyun._test, son = () => (window.__kanca || []).slice(-1)[0];
      document.getElementById('bosalt').click(); window.__kanca = [];
      const r = {};
      O({ tip: 'hediye', kullanici: { id: 'h1', ad: 'Gülsüm' }, jeton: 1, adet: 3, hediye: { id: '5655', ad: 'Rose' } }); r.tam = son();
      O({ tip: 'hediye', kullanici: { id: 'h2', ad: 'Hasan' }, jeton: 1, adet: 3 }); r.yok = son();
      r.jetonAyni = T.D.oy.get('h1').jeton === 3 && T.D.oy.get('h2').jeton === 3;
      O({ tip: 'hediye', kullanici: { id: 'h3', ad: 'Halil' }, jeton: 1, hediye: { id: 5655 } }); r.sayi = son();
      O({ tip: 'hediye', kullanici: { id: 'h3', ad: 'Halil' }, jeton: 1, hediye: { ad: '  Gül\u0007  ' } }); r.adOnly = son();
      O({ tip: 'hediye', kullanici: { id: 'h3', ad: 'Halil' }, jeton: 1, hediye: { id: '', ad: '   ' } }); r.bos = son();
      O({ tip: 'hediye', kullanici: { id: 'h3', ad: 'Halil' }, jeton: 1, hediye: { id: { x: 1 }, ad: ['a'] } }); r.bozuk = son();
      O({ tip: 'hediye', kullanici: { id: 'h3', ad: 'Halil' }, jeton: 1, hediye: '5655' }); r.metin = son();
      O({ tip: 'hediye', kullanici: { id: 'h4', ad: 'Hüma' }, jeton: 2, hediye: { id: '9'.repeat(50), ad: '<img src=x onerror="window.__xss=1">' + 'ş'.repeat(60) } }); r.uzun = son();
      O({ tip: 'hediye', kullanici: { id: 'h5', ad: 'Hilmi' }, jeton: 2, hediye: { id: '1', ad: '<b>x</b>' } });
      await new Promise(z => setTimeout(z, 400)); await new Promise(z => { const t0 = Date.now(); (function k() { if (document.querySelectorAll('#gunluk li.t-h').length >= 6 || Date.now() - t0 > 4000) z(); else setTimeout(k, 100); })(); });
      const g = document.getElementById('gunluk');
      r.satir = [...g.querySelectorAll('li.t-h .metin')].map(x => x.textContent);
      r.etiket = g.querySelectorAll('img, b, script').length + document.querySelectorAll('img[src="x"]').length;
      r.xss = !!window.__xss;
      // sayfa tarafındaki çeviri (köprü iletisi → olay)
      const c = CanliOyun.cevir;
      r.cv = {
        kendi: c({ tip: 'hediye', kullanici: { id: 'a' }, jeton: 1, hediye: { id: '5655', ad: '  Rose  ', fazla: 'x' } }),
        kendiBozuk: c({ tip: 'hediye', kullanici: { id: 'a' }, jeton: 1, hediye: { id: '' } }),
        kendiYok: c({ tip: 'hediye', kullanici: { id: 'a' }, jeton: 1 }),
        duz: c({ event: 'gift', data: { uniqueId: 'a', id: 'kullanici-no', name: 'kullanici-adi', giftId: 5655, giftName: 'Rose', diamondCount: 1, repeatCount: 3, giftType: 1, repeatEnd: true } }),
        duzKimliksiz: c({ event: 'gift', data: { uniqueId: 'a', id: 'kullanici-no', name: 'kullanici-adi', diamondCount: 1, giftType: 2 } }),
        ayrinti: c({ event: 'gift', data: { user: { uniqueId: 'a' }, giftId: 5655, giftDetails: { id: '5655', giftName: 'Rose', diamondCount: 1, giftType: 1 }, repeatCount: 3, repeatEnd: 1 } }),
        yeni: c({ event: 'gift', data: { user: { uniqueId: 'a' }, giftId: '5655', gift: { id: '5655', name: 'Rose', diamondCount: 1, type: 1 }, repeatCount: 3, repeatEnd: 1 } }),
        seri: c({ event: 'gift', data: { user: { uniqueId: 'a' }, giftId: '5655', gift: { id: '5655', name: 'Rose', diamondCount: 1, type: 1 }, repeatCount: 2, repeatEnd: 0 } })
      };
      // paneldeki Deneme düğmeleri sahte, "deneme-" önekli kimlik yollar: en küçük kademe Gül, sonraki Kalp
      const dug = [...document.getElementById('hediyeler').children];
      dug[0].click(); r.dugme0 = son();
      if (dug[1]) { dug[1].click(); r.dugme1 = son(); }
      r.dugmeSayi = dug.length; r.dugmeBaslik = dug[0].title;
      return r;
    });
    await hp.close(); fs.rmSync(gk, { recursive: true, force: true });
    const J = x => JSON.stringify(x);
    kontrol('Hediye kimliği: oyunun kancası dördüncü bilgi olarak { id, ad } alır; kimliksiz hediyede null; jeton aynı sayılır', kac === 1 && hk.tam && hk.tam.n === 5 && J(hk.tam.hediye) === '{"id":"5655","ad":"Rose"}' && hk.tam.jeton === 3 && hk.yok && hk.yok.hediye === null && hk.jetonAyni, { kac, tam: hk.tam, yok: hk.yok, jetonAyni: hk.jetonAyni });
    // beşinci bilgi: tek hediyenin değeri ve adedi (Gelin Konvoyu 3B'nin "tek seferde 1000 jeton" kuralı buna bakar)
    kontrol('Hediye: oyunun kancası beşinci bilgi olarak tek hediyenin değerini ve adedini alır ({ birim, adet }; adetsiz olayda adet 1)', hk.tam && J(hk.tam.sayi) === '{"birim":1,"adet":3}' && hk.dugme0 && hk.dugme0.sayi && hk.dugme0.sayi.adet === 1 && hk.dugme0.sayi.birim === hk.dugme0.jeton, { tam: hk.tam && hk.tam.sayi, dugme0: hk.dugme0 && hk.dugme0.sayi });
    kontrol('Hediye kimliği: sayı id metne çevrilir, yalnız ad kırpılıp geçer; boş, bozuk türde ve nesne olmayan kimlik null olur', J(hk.sayi.hediye) === '{"id":"5655"}' && J(hk.adOnly.hediye) === '{"ad":"Gül"}' && hk.bos.hediye === null && hk.bozuk.hediye === null && hk.metin.hediye === null, { sayi: hk.sayi, ad: hk.adOnly, bos: hk.bos, bozuk: hk.bozuk, metin: hk.metin });
    kontrol('Hediye kimliği: uzun ad 40, uzun id 32 karaktere kısalır; HTML ad düz metindir, akışta öğe olmaz, betik çalışmaz', hk.uzun && Array.from(hk.uzun.hediye.ad).length === 40 && hk.uzun.hediye.ad.startsWith('<img src=x') && hk.uzun.hediye.id.length === 32 && hk.etiket === 0 && !hk.xss && hk.satir.some(x => x.startsWith('<b>x</b> · 2 jeton · ')), { uzun: hk.uzun, etiket: hk.etiket, xss: hk.xss });
    kontrol('Hediye kimliği: masanın akışında hediyenin adı ve olayın adedi jetonun yanında yazılır (Rose ×3 · 3 jeton · kademe); kimliksiz hediyede adet uydurulmaz, yalnız jeton ve kademe', hk.satir.some(x => /^Rose ×3 · 3 jeton · \S/.test(x)) && hk.satir.some(x => /^3 jeton · \S/.test(x)), hk.satir.slice(0, 8));
    const cv2 = hk.cv, rose = o => o && J(o.hediye) === '{"id":"5655","ad":"Rose"}';
    kontrol('Hediye kimliği, sayfa çevirisi: kendi biçim denetlenip geçer (bozuk alan düşer), düz / giftDetails / gift biçimleri okunur, düz veride kullanıcının id ve name alanı hediye sayılmaz, seri sürerken yok', rose(cv2.kendi) && J(Object.keys(cv2.kendi.hediye)) === '["id","ad"]' && cv2.kendiBozuk && !('hediye' in cv2.kendiBozuk) && cv2.kendiBozuk.jeton === 1 && !('hediye' in cv2.kendiYok) && rose(cv2.duz) && cv2.duzKimliksiz && !('hediye' in cv2.duzKimliksiz) && rose(cv2.ayrinti) && rose(cv2.yeni) && cv2.yeni.adet === 3 && cv2.seri === null, cv2);
    kontrol('Hediye kimliği: Deneme düğmeleri sahte kimlik yollar (deneme-gul, sonra deneme-kalp), düğmenin açıklaması söyler', hk.dugme0 && J(hk.dugme0.hediye) === '{"id":"deneme-gul","ad":"Gül"}' && (hk.dugmeSayi < 2 || J(hk.dugme1.hediye) === '{"id":"deneme-kalp","ad":"Kalp"}') && /deneme hediyesi: Gül/.test(hk.dugmeBaslik), { d0: hk.dugme0, d1: hk.dugme1, baslik: hk.dugmeBaslik });
    // N5 (denetim 3): görünmez / biçim karakterleri ve ANSI kaçışları sayfa tarafında da atılır; boş kalan ad düşer
    const n5 = await p.evaluate(() => { const c = CanliOyun.cevir, h = ad => (c({ tip: 'hediye', kullanici: { id: 'n5' }, jeton: 1, hediye: { id: '7', ad } }) || {}).hediye;
      return { arap: h('Ro\u061Cse\u2060'), dolgu: h('\u3164\u3164 \u115F\uFFA0'), ansi: h('\u001b[31mKırmızı\u001b[0m'), bom: h('\uFEFFGül\u2800'), izleyici: (() => { /* hediye: sahne doluyken de girer (yorumcu dolu sahneye giremez) */ CanliOyun.olay({ tip: 'hediye', jeton: 1, adet: 1, kullanici: { id: 'n5-ad', ad: '\u3164Ay\u2060şe' }, metin: 'x' }); const k = CanliOyun._test.D.oy.get('n5-ad'); return k && k.ad; })() }; });
    kontrol('N5: sayfa da hediye adından ve izleyici adından U+061C, U+2060, U+FEFF, dolgu harflerini ve ANSI kaçışlarını atar; boş kalan hediye adı düşer', n5.arap.ad === 'Rose' && JSON.stringify(n5.dolgu) === '{"id":"7"}' && n5.ansi.ad === 'Kırmızı' && n5.bom.ad === 'Gül' && n5.izleyici === 'Ayşe', n5);
    // Denetim 4 (7): emoji arasındaki U+200D kalır (izleyici adında da), başka yerdeki gider; OSC kaçışı metniyle; U+034F / U+17B4 / U+17B5 gider
    const t7 = await p.evaluate(() => { const c = CanliOyun.cevir, h = ad => ((c({ tip: 'hediye', kullanici: { id: 't7' }, jeton: 1, hediye: { id: '7', ad } }) || {}).hediye || {}).ad;
      CanliOyun.olay({ tip: 'hediye', kullanici: { id: 't7-ad', ad: 'Aile 👨\u200d👩\u200d👧' }, jeton: 1 }); /* hediye: sahne dolu olsa da girer */ const k = CanliOyun._test.D.oy.get('t7-ad');
      return { aile: h('Aile 👨\u200d👩\u200d👧'), kodcu: h('👩\u200d💻'), yalniz: h('a\u200db'), osc: h('\u001b]0;title x\u0007Gül'), birlesik: h('x\u034fy\u17b4z\u17b5'), izleyici: k && k.ad }; });
    kontrol('Denetim 4: sayfa temizleyicisi emoji birleşimlerini bölmez (hediye ve izleyici adında), harf arasındaki U+200D, OSC kaçışı (metniyle) ve U+034F / U+17B4 / U+17B5 atılır', t7.aile === 'Aile 👨\u200d👩\u200d👧' && t7.kodcu === '👩\u200d💻' && t7.yalniz === 'ab' && t7.osc === 'Gül' && t7.birlesik === 'xyz' && t7.izleyici === 'Aile 👨\u200d👩\u200d👧', t7);
  }
  // ==== HEDİYE KİMLİĞİ — sonu ====

  // ==== YOUTUBE MÜZİĞİ (cekirdek/js/12-youtube.js) — başı ====
  // Testler ağa çıkmaz (değişmez 10). Sayfa sahte bir http kökeninden (http://oyun.test/) sunulur; YouTube'a giden her
  // istek kaydedilir ve kesilir. API betiği istendiğinde (ve sahteVer doğruyken) yerine aşağıdaki sahte YT verilir:
  // gerçek API'nin kullandığımız parçaları (Player, onReady, onStateChange, onError, playVideo, stopVideo, setVolume,
  // destroy). Gerçek YouTube oynatması burada sınanamaz. Kareler test/cikti/<ad>/t-youtube-*.png.
  {
    const asilHtml = fs.readFileSync(require('./ortak').OYUN_HTML, 'utf8');
    const API = 'https://www.youtube.com/iframe_api';
    const YT_ADRES = /^[a-z]+:\/\/([^/?#]*\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|ytimg\.com|googlevideo\.com|ggpht\.com)(:\d+)?([/?#]|$)/i;
    const SAHTE_YT = `(function () {
  var S = window.__ytSahte = { oyuncular: [], cagri: [], ayar: null };
  function Player(yer, o) {
    var self = this; S.oyuncular.push(this);
    S.ayar = JSON.parse(JSON.stringify(o, function (k, v) { return typeof v === 'function' ? undefined : v; }));
    this.o = o; this.durum = -1; this.yok = false;
    var d = document.createElement('div');
    d.className = 'sahte-yt';
    d.textContent = 'Burada YouTube videosu görünür (testte sahte oynatıcı)';
    d.style.cssText = 'display:grid;place-items:center;text-align:center;padding:12px;background:#000;color:#ddd;font:500 13px Rubik,sans-serif';
    yer.replaceWith(d); this.d = d;
    setTimeout(function () { o.events.onReady({ target: self }); }, 30);
  }
  Player.prototype.durumYap = function (s) { this.durum = s; this.o.events.onStateChange({ target: this, data: s }); };
  Player.prototype.hataYap = function (k) { this.o.events.onError({ target: this, data: k }); };
  Player.prototype.playVideo = function () { var s = this; S.cagri.push('play'); setTimeout(function () { s.durumYap(3); setTimeout(function () { s.durumYap(1); }, 40); }, 30); };
  Player.prototype.stopVideo = function () { S.cagri.push('stop'); this.durumYap(5); };
  Player.prototype.setVolume = function (v) { S.cagri.push('ses:' + v); };
  Player.prototype.mute = function () { S.cagri.push('mute'); };
  Player.prototype.unMute = function () { S.cagri.push('unmute'); };
  Player.prototype.getVideoData = function () { return { video_id: this.o.videoId, title: window.__ytBaslik === undefined ? '' : window.__ytBaslik }; };
  Player.prototype.destroy = function () { S.cagri.push('yok'); this.yok = true; this.d.remove(); };
  window.YT = { Player: Player };
  setTimeout(function () { window.onYouTubeIframeAPIReady(); }, 10);
})();`;
    // Tarayıcının kendisi için: başka kökenden bir çerçevede çalan ses, çerçevenin atası display:none olunca sürüyor mu?
    const CERCEVE = `<!doctype html><audio id="a"></audio><script>
const SR = 8000, n = SR * 20, pcm = new Int16Array(n); for (let i = 0; i < n; i++) pcm[i] = Math.sin(i * 0.2) * 6000;
const bas = new DataView(new ArrayBuffer(44)), y = (o, s) => [...s].forEach((c, i) => bas.setUint8(o + i, c.charCodeAt(0)));
y(0, 'RIFF'); bas.setUint32(4, 36 + n * 2, true); y(8, 'WAVEfmt '); bas.setUint32(16, 16, true); bas.setUint16(20, 1, true); bas.setUint16(22, 1, true);
bas.setUint32(24, SR, true); bas.setUint32(28, SR * 2, true); bas.setUint16(32, 2, true); bas.setUint16(34, 16, true); y(36, 'data'); bas.setUint32(40, n * 2, true);
const a = document.getElementById('a'); a.src = URL.createObjectURL(new Blob([bas, pcm], { type: 'audio/wav' })); a.play();
addEventListener('message', e => { if (e.data === 'soru') parent.postMessage({ t: a.currentTime, durdu: a.paused }, '*'); });
</script>`;
    const ytHata = [], ytIstek = [];
    let sahteVer = false;
    const ytAc = async html => {
      const q = await b.newPage({ viewport: { width: 1366, height: 768 } });
      q.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) ytHata.push(m.text()); });
      q.on('pageerror', e => ytHata.push('SAYFA HATASI (youtube): ' + e.message));
      await q.route('**/*', r => {
        const u = r.request().url();
        if (YT_ADRES.test(u)) {
          ytIstek.push(u);
          return u === API && sahteVer ? r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: SAHTE_YT }) : r.abort();
        }
        if (u.startsWith('http://oyun.test/'))
          return new URL(u).pathname === '/' ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html || asilHtml }) : r.fulfill({ status: 404, body: '' });
        if (u.startsWith('http://oynatici.test/'))
          return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: CERCEVE });
        return u.startsWith('file:') ? r.continue() : r.abort();
      });
      return q;
    };
    const ileti = q => q.evaluate(() => document.getElementById('yt-ileti').textContent);
    const LINK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=3&feature=share';
    const YAZI = {
      degil: 'Bu bir YouTube linki değil.',
      disk: 'YouTube müziği yalnız BASLAT ile açılan oyunda çalışır.',
      yok: 'Bu video bulunamadı: silinmiş, gizli ya da link eksik olabilir. Başka bir link dene.',
      gomme: 'Bu video burada çalınamıyor, sahibi başka sitelerde oynatmayı kapatmış. Başka bir link dene.'
    };

    const yq = await ytAc();
    await yq.goto('http://oyun.test/');
    await hazirBekle(yq);
    await yq.waitForTimeout(800);
    // 1. Link çözümleme tablosu
    const tablo = await yq.evaluate(() => {
      const c = CanliOyun.youtube.linkCoz, V = 'dQw4w9WgXcQ', S = 'aBcDeFgHiJk', L = 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG';
      const kabul = [
        ['https://www.youtube.com/watch?v=' + V, V, null], ['https://youtube.com/watch?v=' + V + '&t=42s&feature=share', V, null],
        ['youtube.com/watch?v=' + V, V, null], ['http://m.youtube.com/watch?feature=x&v=' + V, V, null], ['  https://www.youtube.com/watch?v=' + V + '  ', V, null],
        ['HTTPS://WWW.YOUTUBE.COM/watch?v=' + V, V, null], ['https://youtu.be/' + V, V, null], ['https://youtu.be/' + V + '?si=AbCdEf123&t=10', V, null],
        ['youtu.be/' + V, V, null], ['https://www.youtube.com/shorts/' + S, S, null], ['https://youtube.com/shorts/' + S + '?feature=share', S, null],
        ['https://www.youtube.com/live/' + S + '?si=xyz', S, null], ['https://music.youtube.com/watch?v=' + V + '&list=RDAMVM' + V, V, 'RDAMVM' + V],
        ['https://www.youtube.com/watch?v=' + V + '&list=' + L + '&index=3', V, L], ['https://youtu.be/' + V + '?list=' + L, V, L],
        ['https://www.youtube.com/watch?v=' + V + '&list=ab', V, null]
      ];
      const ret = ['', '   ', null, undefined, 42, {}, 'https://www.youtube.com.evil.example/watch?v=' + V, 'https://evil.example/watch?v=' + V,
        'https://youtube.com@evil.example/watch?v=' + V, 'https://evil.example/?u=https://youtu.be/' + V, 'https://notyoutube.com/watch?v=' + V,
        'https://youtu.be.evil.example/' + V, 'https://xn--youtube-6ya.com/watch?v=' + V, 'https://youtube.com./watch?v=' + V,
        'javascript:alert(1)//youtu.be/' + V, 'javascript://www.youtube.com/watch?v=' + V, 'data:text/html,<script>alert(1)<\/script>',
        'ftp://youtube.com/watch?v=' + V, 'https://www.youtube.com:8080/watch?v=' + V, 'https://www.youtube.com/watch?v=' + V.slice(0, 10),
        'https://www.youtube.com/watch?v=' + V + 'Q', 'https://youtu.be/' + V.slice(0, 10), 'https://youtu.be/' + V + 'Q', 'https://youtu.be/' + V + '/x',
        'https://www.youtube.com/watch?v=dQw4w9WgX$Q', 'https://www.youtube.com/playlist?list=' + L, 'https://www.youtube.com/embed/' + V,
        'https://music.youtube.com/shorts/' + S, 'https://www.youtube.com/shorts/' + S + 'x', V, 'https://youtu.be/"><img src=x onerror=window.__xss=1>',
        'https://www.youtube.com/watch?v=' + V + '"><img src=x onerror=window.__xss=1>', 'https://www.youtube.com/watch?v=' + V + ' x',
        'https://www.youtube.com\\@evil.example/watch?v=' + V, 'https://www.youtube.com/watch?v=' + V + '&' + 'a'.repeat(500)];
      const yanlisK = kabul.filter(([s, v, l]) => { const r = c(s); return !r || r.video !== v || r.liste !== l; }).map(x => x[0]);
      const yanlisR = ret.filter(s => c(s) !== null).map(s => String(s));
      return { kabul: kabul.length, ret: ret.length, yanlisK, yanlisR };
    });
    kontrol('YouTube linki: kabul edilen her biçimden (watch, youtu.be, shorts, live, music, listeli) 11 karakterlik kimlik çıkar', tablo.yanlisK.length === 0 && tablo.kabul >= 16, { kabul: tablo.kabul, yanlis: tablo.yanlisK });
    kontrol('YouTube linki: başka site, benzer ad (youtube.com.evil.example), javascript:/data:, yanlış uzunlukta kimlik, boş girdi reddedilir', tablo.yanlisR.length === 0 && tablo.ret >= 30, { ret: tablo.ret, gecen: tablo.yanlisR });
    // 2. Açılışta hiçbir şey istenmez; kutu yerinde, uyarı görünür
    const ilk = await yq.evaluate(() => {
      document.getElementById('yt-kutu').scrollIntoView({ block: 'nearest' }); // masada sekme yok: Müzik kartı hep yerinde
      const k = document.getElementById('yt-kutu'), u = document.getElementById('yt-uyari');
      return { ogeler: ['yt-link', 'yt-cal', 'yt-durdur', 'yt-don', 'yt-ileti', 'yt-uyari', 'yt-oynatici-yer'].filter(id => k.contains(document.getElementById(id))).length,
        uyari: u.textContent, gorunur: !!u.offsetParent && u.getBoundingClientRect().height > 0, betik: [...document.scripts].filter(s => s.src).map(s => s.src), cerceve: document.querySelectorAll('iframe').length,
        oynatici: document.getElementById('yt-oynatici-yer').hidden, link: document.getElementById('yt-link').value };
    });
    await yq.evaluate(() => document.getElementById('yt-kutu').scrollIntoView({ block: 'end' }));
    await yq.screenshot({ path: CIKTI + '/t-youtube-bos.png' });
    kontrol('YouTube: kutu #yt-kutu içinde kurulur, telif uyarısı görünür; açılışta YouTube\'a hiç istek gitmez, çerçeve yok', ilk.ogeler === 7 && /^Telifli şarkı/.test(ilk.uyari) && ilk.gorunur && ilk.cerceve === 0 && ilk.oynatici && !ilk.betik.some(s => YT_ADRES.test(s)) && ytIstek.length === 0, Object.assign(ilk, { istek: ytIstek.slice() }));
    // 3. Yapıştırılan HTML yorumlanmaz, YouTube linki değilse istek gitmez
    const xss = await yq.evaluate(async () => {
      const r = [], l = document.getElementById('yt-link');
      for (const s of ['"><img src=x onerror=window.__xss=1>', 'https://youtu.be/"><img src=x onerror=window.__xss=1>', '<script>window.__xss=1<\/script>', 'https://evil.example/watch?v=dQw4w9WgXcQ']) {
        l.value = s;
        document.getElementById('yt-cal').click();
        await new Promise(z => setTimeout(z, 80));
        r.push(document.getElementById('yt-ileti').textContent);
      }
      return { r, xss: window.__xss, etiket: document.getElementById('yt-kutu').querySelectorAll('img, script, svg').length + document.querySelectorAll('img[src="x"]').length, tur: document.getElementById('yt-ileti').dataset.tur };
    });
    kontrol('YouTube: yapıştırılan HTML çalışmaz; YouTube linki olmayan her girdi "Bu bir YouTube linki değil." yazar, istek gitmez', xss.r.every(x => x === YAZI.degil) && xss.xss === undefined && xss.etiket === 0 && xss.tur === 'hata' && ytIstek.length === 0, Object.assign(xss, { istek: ytIstek.slice() }));
    // 4. Vuruş saati örnekleri: buradan sonuna kadar her karede (geri gitmez, donmaz)
    await yq.evaluate(() => {
      window.__ornek = [];
      (function al() { window.__ornek.push([performance.now(), CanliOyun.durum().vurus]); requestAnimationFrame(al); })();
      document.getElementById('ses-dugme').click(); // oyunun sesi açık: YouTube çalınca gerçekten kısılmalı
    });
    await bekle(yq, 'oyunun sesi açıldı', () => CanliOyun._test.muzik.acik, undefined, 5000);
    // 5. API yüklenemedi (internet yok / engelli)
    sahteVer = false;
    await yq.fill('#yt-link', LINK);
    await yq.click('#yt-cal');
    await bekle(yq, 'API yüklenemedi yazısı', () => /YouTube açılamadı/.test(document.getElementById('yt-ileti').textContent), undefined, 8000);
    const apiYok = await yq.evaluate(() => ({ ileti: document.getElementById('yt-ileti').textContent, sus: CanliOyun._test.muzik.disSessiz, durum: CanliOyun.youtube.durum() }));
    kontrol('YouTube: API yüklenemezse (internet yok) düz bir cümle yazar, oyunun müziği sürer; istenen tek şey API betiği', /^YouTube açılamadı: internet yok/.test(apiYok.ileti) && !apiYok.sus && !apiYok.durum.oynatici && ytIstek.length === 1 && ytIstek[0] === API, Object.assign(apiYok, { istek: ytIstek.slice() }));
    // 6. Sahte YT ile çalma (önce kartın tek düzeyi 64: oynatıcı ilk açılışında bu düzeyle başlamalı)
    sahteVer = true;
    await yq.evaluate(() => { const d = document.getElementById('ses-duzey'); d.value = '64'; d.dispatchEvent(new Event('input')); });
    await yq.click('#yt-cal');
    await bekle(yq, 'YouTube çalıyor (sahte YT)', () => CanliOyun.youtube.durum().caliyor, undefined, 8000);
    await yq.waitForTimeout(500);
    const cal = await yq.evaluate(async () => {
      const m = CanliOyun._test.muzik, y = document.getElementById('yt-oynatici-yer').getBoundingClientRect(), b0 = CanliOyun.durum().vurus, t0 = performance.now();
      await new Promise(z => setTimeout(z, 1500));
      let sakli = null;
      try { sakli = JSON.parse(localStorage.getItem(CanliOyun._test.OYUN.id + '-youtube')); } catch (e) { }
      return { sus: m.disSessiz, kazanc: +m.ses.muzikYol.gain.value.toFixed(4), ana: +m.ses.son.gain.value.toFixed(3), duzey: m.duzey, acik: m.acik, satir: document.getElementById('cosku-bilgi').textContent, ileti: document.getElementById('yt-ileti').textContent, yer: [Math.round(y.width), Math.round(y.height)],
        hiz: +((CanliOyun.durum().vurus - b0) / ((performance.now() - t0) / 1000)).toFixed(2), beklenen: +(m.calanBpm() / 60).toFixed(2), ayar: window.__ytSahte.ayar, cagri: window.__ytSahte.cagri.slice(), sakli,
        cerceveYeri: document.getElementById('yt-kutu').contains(document.querySelector('.sahte-yt')) };
    });
    await yq.evaluate(() => document.getElementById('yt-kutu').scrollIntoView({ block: 'end' }));
    await yq.screenshot({ path: CIKTI + '/t-youtube-caliyor.png' });
    const ay = cal.ayar || {}, pv = ay.playerVars || {};
    kontrol('YouTube: "Çal"dan sonra istenen tek şey API betiği (iki deneme, iki istek); oynatıcı youtube-nocookie.com, yalnız doğrulanmış kimlikler', ytIstek.length === 2 && ytIstek.every(u => u === API) && ay.host === 'https://www.youtube-nocookie.com' && ay.videoId === 'dQw4w9WgXcQ' && pv.list === 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG' && pv.listType === 'playlist' && pv.origin === 'http://oyun.test' && !/index|feature|share/.test(JSON.stringify(ay)), { istek: ytIstek.slice(), ayar: ay });
    kontrol('YouTube çalarken oyunun müzik yolu susar (ana düzey yerinde), vuruş saati oyunun kendi temposunda yürür', cal.sus && cal.acik && cal.kazanc < 0.02 && cal.ana > cal.duzey * 0.9 && cal.hiz > cal.beklenen * 0.7 && cal.hiz < cal.beklenen * 1.4 && cal.cagri.includes('play') && /^YouTube'dan çalıyor/.test(cal.ileti), { sus: cal.sus, kazanc: cal.kazanc, ana: cal.ana, vurusHizi: cal.hiz, beklenen: cal.beklenen, ileti: cal.ileti });
    kontrol('Tek düzey: oynatıcı ilk açılışında kartın düzeyiyle (64) ve sesli başlar', cal.cagri.indexOf('ses:64') >= 0 && cal.cagri.indexOf('ses:64') < cal.cagri.indexOf('play') && cal.cagri.includes('unmute') && !cal.cagri.includes('mute'), cal.cagri);
    kontrol('YouTube: oynatıcı kutunun içinde, en az 200 × 200 px; çalışan link doğrulanmış biçimiyle saklanır', cal.cerceveYeri && cal.yer[0] >= 200 && cal.yer[1] >= 200 && cal.sakli && cal.sakli.link === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG', { yer: cal.yer, sakli: cal.sakli });
    // 7. Yalnız sahne görünümü (#yayin): panel gizlenir, oynatıcı yerinde kalır, çalma sürer
    const yayin = await yq.evaluate(async () => {
      const T = window.__ytSahte, o = T.oyuncular[T.oyuncular.length - 1], b0 = CanliOyun.durum().vurus;
      location.hash = '#yayin';
      await new Promise(z => setTimeout(z, 1500));
      const r = { panel: getComputedStyle(document.getElementById('panel')).display, yerinde: o.d.isConnected && !o.yok, caliyor: CanliOyun.youtube.durum().caliyor, sus: CanliOyun._test.muzik.disSessiz, ilerledi: +(CanliOyun.durum().vurus - b0).toFixed(2), cagri: T.cagri.slice() };
      location.hash = '';
      await new Promise(z => setTimeout(z, 300));
      r.geri = getComputedStyle(document.getElementById('panel')).display;
      return r;
    });
    kontrol('YouTube: yalnız sahne görünümünde (#yayin) oynatıcı yerinde kalır, şarkı sürer, oyunun müziği sessiz, saat yürür', yayin.panel === 'none' && yayin.yerinde && yayin.caliyor && yayin.sus && yayin.ilerledi > 1 && !yayin.cagri.includes('stop') && yayin.geri !== 'none', yayin);
    // Tarayıcının davranışı (oynatıcı kodumuzdan bağımsız): başka kökenden bir çerçevedeki ses, çerçevenin atası
    // (#yt-kutu → panel) display:none olunca da çalmaya devam ediyor mu? Gerçek YouTube çerçevesi de böyle bir çerçevedir.
    const tar = await yq.evaluate(async () => {
      const f = document.createElement('iframe'), soru = () => new Promise(z => { const h = e => { if (e.source === f.contentWindow) { removeEventListener('message', h); z(e.data); } }; addEventListener('message', h); f.contentWindow.postMessage('soru', '*'); setTimeout(() => z(null), 2000); });
      f.src = 'http://oynatici.test/';
      f.allow = 'autoplay';
      f.style.cssText = 'width:200px;height:200px;border:0';
      document.getElementById('yt-kutu').append(f);
      const t0 = performance.now();
      let a = null;
      while (performance.now() - t0 < 6000) { await new Promise(z => setTimeout(z, 200)); a = await soru(); if (a && a.t > 0.3) break; }
      location.hash = '#yayin';
      await new Promise(z => setTimeout(z, 2000));
      const g = await soru(), gizli = getComputedStyle(document.getElementById('panel')).display;
      location.hash = '';
      f.remove();
      return { once: a, gizliyken: g, panel: gizli };
    });
    kontrol('Tarayıcı: başka kökenden çerçevedeki ses, panel display:none iken de çalmayı sürdürür (sahne görünümünün dayandığı davranış)', tar.once && tar.gizliyken && tar.panel === 'none' && !tar.gizliyken.durdu && tar.gizliyken.t - tar.once.t > 1.5, tar);
    // İki yol: YouTube çalarken (müzik yolu 0) hediye zili ana çıkışa ulaşır. Ölçüm ana düzeyin (son) çıkışında.
    const canli = await yq.evaluate(async () => {
      const m = CanliOyun._test.muzik, a = m.ctx.createAnalyser(), buf = new Float32Array(2048);
      a.fftSize = 2048;
      // Otomatik izleyici kapatılır: sahte hediyelerin zili "sessiz" ölçümüne karışmasın; çalan zil sönsün.
      const oto = document.getElementById('oto');
      if (oto.getAttribute('aria-pressed') === 'true')
        oto.click();
      await new Promise(z => setTimeout(z, 1200));
      m.ses.son.connect(a);
      const tepe = async ms => { let t = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { a.getFloatTimeDomainData(buf); for (const v of buf) t = Math.max(t, Math.abs(v)); await new Promise(z => setTimeout(z, 15)); } return +t.toFixed(4); };
      const sessiz = await tepe(700);
      CanliOyun.olay({ tip: 'hediye', kullanici: { id: 'ytzil', ad: 'Zil' }, jeton: 150 });
      const zil = await tepe(450);
      m.ses.son.disconnect(a);
      return { sessiz, zil, muzikYol: +m.ses.muzikYol.gain.value.toFixed(4), efektYol: m.ses.efektYol.gain.value, sus: m.disSessiz, caliyor: CanliOyun.youtube.durum().caliyor };
    });
    kontrol('İki yol: YouTube çalarken müzik yolu 0, çıkış sessiz; hediye zili efekt yolundan çıkışa ulaşır', canli.caliyor && canli.sus && canli.muzikYol < 0.01 && canli.sessiz < 0.003 && canli.zil > 0.02, canli);
    // 8. YouTube sesi, Durdur, YouTube'da duraklatma, Oyunun müziğine dön
    const dur = await yq.evaluate(async () => {
      const m = CanliOyun._test.muzik, T = window.__ytSahte, bekle = ms => new Promise(z => setTimeout(z, ms)), r = {};
      const s = document.getElementById('ses-duzey'); s.value = '30'; s.dispatchEvent(new Event('input'));
      await bekle(400);
      r.ses = { oynatici: T.cagri[T.cagri.length - 1], duzey: +m.duzey.toFixed(3), ana: +m.ses.son.gain.value.toFixed(3) };
      document.getElementById('yt-durdur').click();
      r.hemen = m.disSessiz;
      await bekle(400);
      r.durdur = { kazanc: +m.ses.muzikYol.gain.value.toFixed(3), duzey: m.duzey, stop: T.cagri.includes('stop'), ileti: document.getElementById('yt-ileti').textContent, caliyor: CanliOyun.youtube.durum().caliyor };
      // YouTube'un kendi düğmesiyle duraklatma: kısa beklemeden sonra oyunun müziği döner
      document.getElementById('yt-cal').click();
      const t0 = performance.now(); while (!CanliOyun.youtube.durum().caliyor && performance.now() - t0 < 4000) await bekle(50);
      r.yeniden = CanliOyun.youtube.durum().caliyor && m.disSessiz;
      T.oyuncular[T.oyuncular.length - 1].durumYap(2);
      await bekle(300); r.duraklatHemen = m.disSessiz;
      await bekle(1300); r.duraklat = { sus: m.disSessiz, ileti: document.getElementById('yt-ileti').textContent };
      // Oyunun müziğine dön
      T.oyuncular[T.oyuncular.length - 1].durumYap(1);
      await bekle(100); r.tekrarCaliyor = m.disSessiz;
      document.getElementById('yt-don').click();
      await bekle(400);
      r.don = { sus: m.disSessiz, yok: T.cagri[T.cagri.length - 1] === 'yok', gizli: document.getElementById('yt-oynatici-yer').hidden, kazanc: +m.ses.muzikYol.gain.value.toFixed(3), oynatici: CanliOyun.youtube.durum().oynatici, ileti: document.getElementById('yt-ileti').textContent };
      return r;
    });
    kontrol('Tek düzey: YouTube çalarken kartın düzeyi oynatıcının sesini ve oyunun ana düzeyini birlikte ayarlar', dur.ses.oynatici === 'ses:30' && Math.abs(dur.ses.duzey - 0.21) < 1e-3 && Math.abs(dur.ses.ana - 0.21) < 0.01, dur.ses);
    kontrol('YouTube: Durdur oyunun müziğini hemen geri getirir (kaldığı düzeyde)', !dur.hemen && dur.durdur.stop && dur.durdur.kazanc > 0.9 && !dur.durdur.caliyor && /^Durdu/.test(dur.durdur.ileti), { hemen: dur.hemen, durdur: dur.durdur });
    kontrol('YouTube: oynatıcıda duraklatınca oyunun müziği kısa beklemeyle döner (listede şarkı geçişinde araya girmez)', dur.yeniden && dur.duraklatHemen && !dur.duraklat.sus && /^Durdu/.test(dur.duraklat.ileti), { yeniden: dur.yeniden, hemen: dur.duraklatHemen, sonra: dur.duraklat });
    kontrol('YouTube: "Oyunun müziğine dön" oynatıcıyı kaldırır, oyunun müziği geri gelir', dur.tekrarCaliyor && !dur.don.sus && dur.don.yok && dur.don.gizli && !dur.don.oynatici && dur.don.kazanc > 0.9, dur.don);
    // 9. Hata kodları: düz cümle, metin olarak; oyunun müziği geri gelir
    const hk2 = await yq.evaluate(async Y => {
      const m = CanliOyun._test.muzik, T = window.__ytSahte, bekle = ms => new Promise(z => setTimeout(z, ms)), r = [];
      for (const kod of [2, 100, 101, 150]) {
        document.getElementById('yt-cal').click();
        const t0 = performance.now(); while (!CanliOyun.youtube.durum().caliyor && performance.now() - t0 < 4000) await bekle(50);
        const once = m.disSessiz;
        T.oyuncular[T.oyuncular.length - 1].hataYap(kod);
        await bekle(50);
        const il = document.getElementById('yt-ileti');
        r.push({ kod, once, sus: m.disSessiz, metin: il.textContent, beklenen: kod >= 101 ? Y.gomme : Y.yok, tur: il.dataset.tur, cocuk: il.childElementCount, oynatici: CanliOyun.youtube.durum().oynatici, gizli: document.getElementById('yt-oynatici-yer').hidden });
      }
      return r;
    }, YAZI);
    await yq.evaluate(() => document.getElementById('yt-kutu').scrollIntoView({ block: 'end' }));
    await yq.screenshot({ path: CIKTI + '/t-youtube-hata-150.png' });
    kontrol('YouTube hataları 2, 100, 101, 150: düz cümle (metin olarak), oynatıcı kalkar, oyunun müziği geri gelir', hk2.every(x => x.once && !x.sus && x.metin === x.beklenen && x.tur === 'hata' && x.cocuk === 0 && !x.oynatici && x.gizli), hk2);
    // Vuruş saati bütün bu adımlar boyunca (ses aç, YouTube çal / dur / sahne görünümü / hata)
    const ytSaat = await yq.evaluate(() => {
      const o = window.__ornek; let geri = 0, enDurma = 0, bas = o[0][0];
      for (let i = 1; i < o.length; i++) { if (o[i][1] < o[i - 1][1] - 1e-9) geri++; if (o[i][1] - o[i - 1][1] > 1e-4) bas = o[i][0]; else enDurma = Math.max(enDurma, (o[i][0] - bas) / 1000); }
      return { ornek: o.length, geri, enDurmaSn: +enDurma.toFixed(2), sure: +((o[o.length - 1][0] - o[0][0]) / 1000).toFixed(1) };
    });
    kontrol('YouTube çalıp dururken vuruş saati hiç geri gitmez, donmaz', ytSaat.ornek > 100 && ytSaat.geri === 0 && ytSaat.enDurmaSn < 0.6, ytSaat);
    // Tek düzey, tek düğme: kartta tek kaydırıcı; Sesi kapat / aç oynatıcıyı da kapsar; düzey Çal ve dönüşte taşınır;
    // oyunun sesi kapalıyken Çal sesi açar (düğme doğru yazar).
    const tek = await yq.evaluate(async () => {
      const m = CanliOyun._test.muzik, T = window.__ytSahte, bekle = ms => new Promise(z => setTimeout(z, ms)), r = {};
      const kaydir = v => { const d = document.getElementById('ses-duzey'); d.value = String(v); d.dispatchEvent(new Event('input')); };
      const cal = async () => { const n = T.cagri.length; document.getElementById('yt-cal').click(); const t0 = performance.now(); while (!CanliOyun.youtube.durum().caliyor && performance.now() - t0 < 4000) await bekle(50); await bekle(300); return T.cagri.slice(n); };
      const dugme = () => document.getElementById('ses-yazi').textContent;
      r.kaydirici = document.getElementById('muzik-kart').querySelectorAll('input[type=range]').length;
      r.ytSes = !!document.getElementById('yt-ses');
      kaydir(55);
      r.cal = await cal();
      r.calDuzey = +m.duzey.toFixed(3);
      kaydir(40);
      await bekle(400);
      r.kaydir = { son: T.cagri[T.cagri.length - 1], duzey: +m.duzey.toFixed(3), ana: +m.ses.son.gain.value.toFixed(3) };
      let n = T.cagri.length;
      document.getElementById('ses-dugme').click();
      await bekle(400);
      r.kapat = { cagri: T.cagri.slice(n), dugme: dugme(), acik: m.acik, caliyor: CanliOyun.youtube.durum().caliyor };
      n = T.cagri.length;
      document.getElementById('ses-dugme').click();
      await bekle(400);
      r.ac = { cagri: T.cagri.slice(n), dugme: dugme(), acik: m.acik };
      document.getElementById('yt-don').click();
      await bekle(400);
      r.don = { duzey: +m.duzey.toFixed(3), ana: +m.ses.son.gain.value.toFixed(3), kaydirici: document.getElementById('ses-duzey').value };
      // oyunun sesi kapalıyken Çal
      document.getElementById('ses-dugme').click();
      await bekle(400);
      r.kapaliyken = { dugme: dugme(), acik: m.acik };
      r.kapaliCal = await cal();
      await bekle(300);
      r.kapaliSonra = { dugme: dugme(), acik: m.acik, caliyor: CanliOyun.youtube.durum().caliyor, sonSes: T.cagri.filter(x => x === 'mute' || x === 'unmute').pop(), cagri: T.cagri.slice(-4) };
      document.getElementById('yt-don').click();
      await bekle(300);
      return r;
    });
    kontrol('Tek düzey: Müzik kartında tek ses kaydırıcısı var (YouTube kutusunda ayrı kaydırıcı yok)', tek.kaydirici === 1 && !tek.ytSes, { kaydirici: tek.kaydirici, ytSes: tek.ytSes });
    kontrol('Tek düzey: Çal o anki düzeyle (55) başlar; kaydırıcı oynatıcıyı ve ana düzeyi birlikte değiştirir; dönünce oyun aynı düzeyde', tek.cal.includes('ses:55') && Math.abs(tek.calDuzey - 0.385) < 2e-3 && tek.kaydir.son === 'ses:40' && Math.abs(tek.kaydir.duzey - 0.28) < 2e-3 && Math.abs(tek.kaydir.ana - 0.28) < 0.01 && Math.abs(tek.don.duzey - 0.28) < 2e-3 && Math.abs(tek.don.ana - 0.28) < 0.01 && tek.don.kaydirici === '40', { cal: tek.cal, calDuzey: tek.calDuzey, kaydir: tek.kaydir, don: tek.don });
    kontrol('Tek düğme: Sesi kapat YouTube şarkısını da susturur, Sesi aç geri açar (aynı düzeyle); düğmenin yazısı doğru', tek.kapat.cagri.includes('mute') && tek.kapat.dugme === 'Sesi aç' && !tek.kapat.acik && tek.kapat.caliyor && tek.ac.cagri.includes('unmute') && tek.ac.cagri.includes('ses:40') && tek.ac.dugme === 'Sesi kapat' && tek.ac.acik, { kapat: tek.kapat, ac: tek.ac });
    kontrol('Tek düğme: oyunun sesi kapalıyken Çal sesi açar; şarkı sesli çalar, düğme "Sesi kapat" yazar', tek.kapaliyken.dugme === 'Sesi aç' && !tek.kapaliyken.acik && tek.kapaliSonra.acik && tek.kapaliSonra.caliyor && tek.kapaliSonra.dugme === 'Sesi kapat' && tek.kapaliSonra.sonSes === 'unmute', { once: tek.kapaliyken, sonra: tek.kapaliSonra });
    // İki yol, sesi dosyaya yazan bağlamda (kesin): müzik yolu 0 iken müzik hiç duyulmaz, zil duyulur; zil yalnız efekt
    // yolundan geçer (efekt yolu 0 iken zil de duyulmaz).
    const yollar = await yq.evaluate(async () => {
      const { Muzik } = CanliOyun._test, SR = 44100;
      const isle = async (muzikli, zilli, ayar) => {
        const oc = new OfflineAudioContext(1, SR * 2, SR), m = new Muzik();
        m.sirayla = false; m.sesKur(oc); m.acik = true; m.sonraki = 0.05; ayar(m);
        if (muzikli) while (m.sonraki < 1.9) m.adimCal();
        if (zilli) m.zil(1);
        const d = (await oc.startRendering()).getChannelData(0); let t = 0;
        for (const v of d) t = Math.max(t, Math.abs(v));
        return +t.toFixed(5);
      };
      return {
        muzik: await isle(true, false, () => { }),
        muzikSifir: await isle(true, false, m => { m.ses.muzikYol.gain.value = 0; }),
        muzikSifirZil: await isle(true, true, m => { m.ses.muzikYol.gain.value = 0; }),
        zil: await isle(false, true, () => { }),
        efektSifirZil: await isle(false, true, m => { m.ses.efektYol.gain.value = 0; }),
        muzikSifirKendiZil: await isle(false, true, m => { m.ses.muzikYol.gain.value = 0; })
      };
    });
    kontrol('İki yol (dosyaya yazılan ses): müzik yolu 0 → müzik sessiz, zil duyulur; zil yalnız efekt yolundan geçer', yollar.muzik > 0.05 && yollar.muzikSifir < 1e-4 && yollar.muzikSifirZil > 0.02 && yollar.zil > 0.02 && yollar.efektSifirZil < 1e-4 && Math.abs(yollar.muzikSifirKendiZil - yollar.zil) < 1e-4, yollar);
    // Sahnedeki çalan satırı: önce hava + vuruş/dk, YouTube çalarken şarkının adı (düz metin, temiz, kısaltılmış),
    // ad yokken "YouTube'dan şarkı", dönünce yine hava + vuruş/dk.
    const sah = await yq.evaluate(async () => {
      const m = CanliOyun._test.muzik, bekle = ms => new Promise(z => setTimeout(z, ms)), satir = () => document.getElementById('cosku-bilgi').textContent, r = {};
      const cal = async () => { document.getElementById('yt-cal').click(); const t0 = performance.now(); while (!CanliOyun.youtube.durum().caliyor && performance.now() - t0 < 4000) await bekle(50); await bekle(300); };
      const masa = () => document.getElementById('d-bpm').textContent + ' | ' + document.getElementById('d-hava').textContent;
      r.hava = m.calanAd();
      r.once = satir();
      r.masaOnce = masa();
      window.__ytBaslik = '';
      await cal();
      r.bos = satir();
      document.getElementById('yt-don').click();
      await bekle(300);
      window.__ytBaslik = '<b>Halay</b> <img src=x onerror="window.__xss=1"> Şarkısı\u0007‮ ' + 'çok uzun bir ad '.repeat(8);
      await cal();
      r.baslik = satir();
      r.disAd = m.disAd;
      await bekle(300); // masa 250 ms'de bir yazılır
      r.masa = masa();
      r.cocuk = document.getElementById('cosku-bilgi').childElementCount;
      r.img = document.querySelectorAll('img[src="x"]').length;
      r.xss = window.__xss;
      return r;
    });
    await yq.screenshot({ path: CIKTI + '/t-youtube-sahne-baslik.png' });
    await yq.locator('.cosku').screenshot({ path: CIKTI + '/t-youtube-sahne-satir.png' });
    sah.sonra = await yq.evaluate(async () => { document.getElementById('yt-don').click(); await new Promise(z => setTimeout(z, 300)); await new Promise(z => setTimeout(z, 200)); return { satir: document.getElementById('cosku-bilgi').textContent, disAd: CanliOyun._test.muzik.disAd, masa: document.getElementById('d-bpm').textContent + ' | ' + document.getElementById('d-hava').textContent }; });
    // Gösterim karesi: sıradan bir şarkı adıyla sahne satırı (kontrol değil, göz için)
    await yq.evaluate(async () => {
      window.__ytBaslik = 'Örnek Sanatçı - Örnek Şarkı (Resmî Video)';
      document.getElementById('yt-cal').click();
      const t0 = performance.now(); while (!CanliOyun.youtube.durum().caliyor && performance.now() - t0 < 4000) await new Promise(z => setTimeout(z, 50));
      await new Promise(z => setTimeout(z, 300));
    });
    await yq.locator('#sahne').screenshot({ path: CIKTI + '/t-youtube-sahne-ornek.png' });
    await yq.evaluate(async () => { document.getElementById('yt-don').click(); await new Promise(z => setTimeout(z, 200)); });
    const ilkSatir = s => s.split('\n')[0];
    kontrol('Masa (Gelişmiş, Vuruş / dk): YouTube çalarken şarkının adı, vuruş/dk yerine "-"; önce ve sonra havanın adı ve vuruş/dk', /^\d+ \| /.test(sah.masaOnce) && sah.masaOnce.endsWith(' | ' + sah.hava) && sah.masa === '- | ' + sah.disAd && /^\d+ \| /.test(sah.sonra.masa) && !sah.sonra.masa.includes('Halay'), { once: sah.masaOnce, calarken: sah.masa, sonra: sah.sonra.masa });
    kontrol('Sahne satırı: YouTube çalmıyorken hava ve vuruş/dk; ad yokken "YouTube\'dan şarkı" (vuruş/dk yok); dönünce eski satır', ilkSatir(sah.once) === sah.hava && /vuruş\/dk/.test(sah.once) && ilkSatir(sah.bos) === 'YouTube\'dan şarkı' && !/vuruş\/dk/.test(sah.bos) && ilkSatir(sah.sonra.satir) === sah.hava && /vuruş\/dk/.test(sah.sonra.satir) && sah.sonra.disAd === null, { once: sah.once, bos: sah.bos, sonra: sah.sonra });
    kontrol('Sahne satırı: şarkının adı düz metin (HTML çalışmaz), görünmez karakterler atılır, 36 karaktere kısalır; vuruş/dk yazmaz', ilkSatir(sah.baslik) === sah.disAd && sah.disAd.startsWith('<b>Halay</b> <img src=x') && Array.from(sah.disAd).length === 36 && sah.disAd.endsWith('…') && !/[\u0007‮]/.test(sah.disAd) && !/vuruş\/dk/.test(sah.baslik) && sah.cocuk === 0 && sah.img === 0 && sah.xss === undefined, { baslik: sah.baslik, disAd: sah.disAd, cocuk: sah.cocuk, img: sah.img });
    // 10. Yeniden açılış: link hatırlanır, hiçbir şey çalmaz, istek gitmez
    const istekOnce = ytIstek.length;
    await yq.reload();
    await hazirBekle(yq);
    await yq.waitForTimeout(800);
    const yeniden = await yq.evaluate(() => ({ link: document.getElementById('yt-link').value, durum: CanliOyun.youtube.durum(), sus: CanliOyun._test.muzik.disSessiz, cerceve: document.querySelectorAll('iframe, .sahte-yt').length, yt: typeof window.YT }));
    kontrol('YouTube: yeniden açılışta son çalışan link kutuda, kendiliğinden çalmaz, YouTube\'a istek gitmez', yeniden.link === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG' && !yeniden.durum.oynatici && !yeniden.durum.caliyor && !yeniden.sus && yeniden.cerceve === 0 && yeniden.yt === 'undefined' && ytIstek.length === istekOnce, Object.assign(yeniden, { yeniIstek: ytIstek.length - istekOnce }));
    await yq.close();
    // 11. #yt-kutu yok: hata yok, hiçbir şey yapılmaz
    const kutusuz = asilHtml.replace('<div id="yt-kutu"></div>', '');
    const kq = await ytAc(kutusuz);
    const hataOnce = ytHata.length;
    await kq.goto('http://oyun.test/');
    await hazirBekle(kq);
    const yok = await kq.evaluate(async () => ({ kur: CanliOyun.youtube.kur(), cal: await CanliOyun.youtube.cal('https://youtu.be/dQw4w9WgXcQ'), durdur: (CanliOyun.youtube.durdur(), CanliOyun.youtube.don(), 'tamam'), durum: CanliOyun.youtube.durum(), oge: document.querySelectorAll('[id^="yt-"]').length }));
    await kq.waitForTimeout(300);
    kontrol('YouTube: sayfada #yt-kutu yoksa hata vermez, hiçbir şey kurmaz, istek göndermez', kutusuz !== asilHtml && yok.kur === false && yok.cal === false && !yok.durum.kutu && yok.oge === 0 && ytHata.length === hataOnce && ytIstek.length === istekOnce, Object.assign(yok, { hata: ytHata.slice(hataOnce) }));
    await kq.close();
    // 12. Diskten açılan sayfa (file://): YouTube çalmaz, yalnız BASLAT cümlesi
    const dq = await ytAc();
    await dq.goto(OYUN_URL);
    await hazirBekle(dq);
    await dq.fill('#yt-link', 'https://youtu.be/dQw4w9WgXcQ');
    await dq.click('#yt-cal');
    await dq.waitForTimeout(300);
    const disk = { ileti: await ileti(dq), istek: ytIstek.length - istekOnce, durum: await dq.evaluate(() => CanliOyun.youtube.durum()) };
    kontrol('YouTube: diskten açılan oyunda (file://) "yalnız BASLAT ile" cümlesi yazar, istek gitmez', disk.ileti === YAZI.disk && disk.istek === 0 && !disk.durum.oynatici, disk);
    await dq.close();
    kontrol('YouTube sayfalarında hata çıkmadı', ytHata.length === 0, ytHata.slice(0, 5).join(' | '));
  }
  // ==== YOUTUBE MÜZİĞİ — sonu ====

  // Oyun kodunda hata: döngü donmaz, hata bir kez bildirilir (ayrı sayfa; bilerek çıkarılan hata yukarıdaki
  // "sayfada hata çıkmadı" sayımına girmesin).
  const hs = await b.newPage({ viewport: { width: 720, height: 800 } }), hsHata = [];
  hs.on('pageerror', e => hsHata.push(e.message));
  await hs.goto(OYUN_URL);
  await hazirBekle(hs);
  const kirik = await hs.evaluate(async () => {
    const D = CanliOyun._test.D, oy = D.oy;
    D.oy = null;
    await new Promise(r => setTimeout(r, 500));
    D.oy = oy;
    D.kareMs = 0;
    await new Promise(r => setTimeout(r, 600));
    return { kareMs: CanliOyun.durum().kareMs, kisi: CanliOyun.durum().kisi };
  });
  // Yarım saniyede ~30 kare bozuk çizilir; hata her karede değil bir kez düşmeli (panelin kendi zamanlayıcısı
  // da aynı bozuk durumu okuyup bir iki hata verebilir, o yüzden üst sınır 4).
  kontrol('Oyun kodunda hata olsa da kare döngüsü sürer, hata her karede yinelenmez', kirik.kareMs > 0 && hsHata.length >= 1 && hsHata.length <= 4, { kareMs: kirik.kareMs, hata: hsHata.length, ilk: (hsHata[0] || '').slice(0, 60) });
  await hs.close();

  kontrol('Tüm testler boyunca sayfada hata çıkmadı', hatalar.length === 0, hatalar.slice(0, 5).join(' | '));
  await b.close();
  process.exit(raporla(sonuc) ? 1 : 0);
})().catch(e => { console.error('TEST ÇÖKTÜ', e); process.exit(1); });
