/* PANEL VE AÇILIŞ — sayfa yazıları, yayın masası (panel), sahnenin boyutlandırılması, oyunun başlatılması.
 * sayfaYaz: logo, nasıl oynanır, başlıklar, hediye kademeleri ve tema renkleri OYUN'dan · boyutla: sahneyi 9:16 tutar
 * yayinModu: yalnız sahne görünümü (#yayin) · baslat: tohum kalabalığı kurar, oyunBaslat(kayit) çağırır, döngüyü açar
 * masaYaz: durum göstergesi, özet satırı ve sahnedekiler listesi (250 ms'de bir; yayın görünümünde çalışmaz)
 * kipUygula: masanın kipi. "canli" (sayfayı köprü açtı ve köprü deneme kipinde değil): deneme izleyicisi kartı yok,
 *   yerinde bu oyunun hediyeleri yazar; "deneme" (diskten açıldı ya da köprü deneme kipinde): her şey açık.
 * Akış: satırları 25-yazilar.js kurar; masa ada basınca açılan işlemleri ve süzgeç düğmelerini yönetir (akisAc, akisSuzSec).
 * izleyiciGizle / izleyiciCikar (+ geri alma): yayıncının hızlı eylemleri; kimliğe göre, ayarla birlikte saklanır
 * window.CanliOyun: dışarıya açık arayüz (olay, baglan, kes, cevir, durum, _test). Testler bunu kullanır.
 * Açılış bütün parçalar çalıştıktan sonra (mikro görevde) yapılır: oyunun üst düzey const'ları kancalarda hazırdır.
 */
const KANCA_DURUM = typeof oyunDurum === 'function' ? oyunDurum : null;
const SVG_NS = 'http://www.w3.org/2000/svg';
// Masanın ikonu: sayfa.html'deki #ikonlar takımından bir çizim (sabit, bizim çizimimiz; izleyici metni değil).
// Süs ikondur (aria-hidden): yanındaki yazı ne olduğunu söyler.
function ikon(ad) {
  const s = document.createElementNS(SVG_NS, 'svg'), u = document.createElementNS(SVG_NS, 'use');
  s.setAttribute('class', 'ik');
  s.setAttribute('aria-hidden', 'true');
  u.setAttribute('href', '#i-' + ad);
  s.append(u);
  return s;
}
function ikonDegis(svg, ad) {
  const u = svg.firstElementChild, h = '#i-' + ad;
  if (u.getAttribute('href') !== h)
    u.setAttribute('href', h);
}
// Aç / kapa düğmesi: görünen ad + küçük durum yazısı (ekran okuyucu durumu aria-pressed'den alır).
function anahtarYaz(id, on, ad) {
  const b = $(id), d = document.createElement('span');
  d.className = 'durum';
  d.setAttribute('aria-hidden', 'true');
  d.textContent = on ? 'açık' : 'kapalı';
  b.textContent = ad + ' ';
  b.append(d);
  b.setAttribute('aria-pressed', on);
}
function otoAyarla(v) { oto = v; anahtarYaz('oto', v, 'Otomatik kalabalık'); }
async function sesDegistir(ac) {
  if (ac) {
    const ok = await muzik.sesAc();
    if (!ok)
      return;
  }
  else
    await muzik.sesKapat();
  $('ses-yazi').textContent = muzik.acik ? 'Sesi kapat' : 'Sesi aç';
  $('ses-dugme').classList.toggle('ana', !muzik.acik);
  $('ses-cagri').hidden = muzik.acik;
}
// Masanın en az genişliği (px): pencere uzun ve darsa sahne biraz küçülür ki masa iki sütuna sığsın (stil.css).
const MASA_EN_AZ = 560;
function boyutla() {
  const yayin = document.body.classList.contains('yayin'), dar = innerWidth <= 900, kok = document.documentElement, s = $('sahne');
  const cs = getComputedStyle(kok), yukH = kok.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let w;
  if (yayin)
    w = Math.min(innerWidth, yukH * 9 / 16);
  else if (dar)
    w = Math.min(innerWidth - 32, yukH * 0.58 * 9 / 16);
  else
    w = Math.min((yukH - 32) * 9 / 16, innerWidth - 32 - 20 - MASA_EN_AZ);
  w = Math.max(200, Math.floor(w));
  s.style.width = w + 'px';
  s.style.height = Math.round(w * 16 / 9) + 'px';
  const pw = Math.min(yayin ? 1080 : 900, Math.round(w * Math.min(2, devicePixelRatio || 1)));
  if (tuval.width !== pw) {
    tuval.width = pw;
    tuval.height = Math.round(pw * 16 / 9);
  }
}
function yayinModu(v) {
  document.body.classList.toggle('yayin', v);
  try {
    if ((location.hash === '#yayin') !== v)
      history.replaceState(null, '', v ? '#yayin' : location.pathname + location.search);
  }
  catch (e) { }
  boyutla();
  if (!v)
    masaYaz();
}

// Sayfadaki oyuna özgü her yazı OYUN'dan gelir (hepsi textContent; HTML yazılmaz).
// Tema renklerini CSS değişkenlerine yazar. sahne: sahne ve sahne üstü yazılar (kökte, her yere geçer);
// panel (isteğe bağlı): yalnız yayın masası ve sayfanın arka planı. panel yoksa masa da sahnenin renklerini alır.
function renkUygula(sahne, panel) {
  const yaz = (st, R) => {
    for (const [ad, css] of [['zemin', '--zemin'], ['zemin2', '--zemin-2'], ['zemin3', '--zemin-3'], ['cizgi', '--cizgi'], ['vurgu', '--vurgu'], ['sicak', '--sicak'], ['serin', '--serin'], ['acik', '--acik'], ['soluk', '--soluk'], ['murekkep', '--murekkep']])
      st.setProperty(css, R[ad]);
    // panelin yarı saydam tonları da temadan türetilir
    for (const [ad, css, a] of [['vurgu', '--vurgu-a', 0.13], ['sicak', '--sicak-a', 0.17], ['sicak', '--sicak-b', 0.42], ['serin', '--serin-a', 0.16], ['acik', '--acik-a', 0.05], ['acik', '--acik-b', 0.1], ['murekkep', '--murekkep-a', 0.55]])
      st.setProperty(css, renkSaydam(R[ad], a));
  };
  const kok = document.documentElement.style, ps = $('panel').style;
  yaz(kok, sahne);
  if (panel) {
    yaz(ps, panel);
    ps.color = panel.acik;
    kok.setProperty('--sayfa-zemin', panel.zemin);
    kok.setProperty('--sayfa-zemin-2', panel.zemin2);
  }
  else {
    for (const css of ['--sayfa-zemin', '--sayfa-zemin-2'])
      kok.removeProperty(css);
    ps.cssText = ps.cssText.replace(/--[\w-]+:[^;]*;?/g, '');
    ps.color = '';
  }
}
const yeni = (etiket, sinif, yazi) => { const e = document.createElement(etiket); if (sinif) e.className = sinif; if (yazi != null) e.textContent = yazi; return e; };
function sayfaYaz() {
  renkUygula(RENK, PANEL_RENK);
  const y = OYUN.yazi, logo = $('logo'), lp = [].concat(OYUN.logo || OYUN.ad || '').map(String);
  logo.textContent = '';
  logo.append(lp[0] + (lp.length > 1 ? ' ' : ''));
  if (lp.length > 1) {
    const b = document.createElement('b');
    b.textContent = lp.slice(1).join(' ');
    logo.append(b);
  }
  for (const tur of ['yorum', 'begeni', 'hediye']) {
    const s = $('nasil-' + tur), m = OYUN.nasil[tur];
    if (m)
      s.append(String(m));
    else
      s.hidden = true;
  }
  $('masa-oyun').textContent = String(OYUN.ad || '');
  $('sira-baslik').textContent = y.sira;
  $('gosterge-baslik').textContent = y.gosterge;
  $('ses-cagri').textContent = y.ses;
  tuval.setAttribute('aria-label', y.sahne);
  $('s-yorum-not').textContent = y.giris;
  $('s-takip-not').textContent = y.giris;
  $('bosalt-ad').textContent = y.bosalt;
  $('d-birim').textContent = y.birim;
  $('d-kapasite').textContent = MAKS;
  // Bu oyunda hediyeler (canlı yayında deneme izleyicisinin yerinde): küçükten büyüğe eşik, ad, sahnede olan
  const liste = $('kademe-liste');
  for (const kd of [...KADEME].reverse()) {
    const li = document.createElement('li'), sag = document.createElement('div');
    sag.append(yeni('span', 'kd-ad', kd.ad));
    if (kd.etki)
      sag.append(yeni('span', 'kd-etki', kd.etki));
    li.append(yeni('span', 'esik', sayi(kd.min) + '+'), sag);
    liste.append(li);
  }
}

/* ---- yayın masası: durum göstergesi, özet, sahnedekiler, yayıncının hızlı eylemleri ---- */
const KISI_SINIR = 20; // listede en çok kaç satır (gerisi aramayla bulunur): sayfa öğeleri kalabalıkla şişmesin
const sayi = n => Math.round(n).toLocaleString('tr-TR');
const yaz = (id, v) => { const e = $(id); v = String(v); if (e.textContent !== v)
  e.textContent = v; };
// Durum göstergesi: masada bağlantıyı söyleyen TEK yer. Köprü durumunu bildiriyorsa (Yayin.kopruBaglanti) onu söyler;
// "Canlı" yalnız köprü TikTok yayınına gerçekten bağlandığını bildirdiğinde. Durum bildirmeyen eski köprüye bağlıyken
// "Bağlı" der (Canlı değil). [durum, ad, alt satır, ikon]. Köprünün kendi cümlesi (bag-ileti) gerektiğinde göstergenin
// altında (#durum-cumle) olduğu gibi yazar: yayın yok, bağlanamadı, durdu.
const DURUM_YAZI = {
  deneme: ['deneme', 'Deneme', 'sahte izleyiciler, TikTok\'a bağlı değil', 'deneme'],
  baglaniyor: ['baglaniyor', 'Bağlanıyor', 'TikTok\'a bağlanılıyor', 'baglaniyor'],
  bekliyor: ['bekliyor', 'Yayın bekleniyor', 'yayın henüz açık değil', 'bekliyor'],
  bagli: ['canli', 'Canlı', 'yayına bağlı', 'canli'],
  durdu: ['durdu', 'Durdu', 'oyun ana sayfadan durduruldu', 'durdu'],
  hata: ['hata', 'Bağlanamadı', '', 'hata']
};
const DURUM_CUMLELI = ['bekliyor', 'baglaniyor', 'durdu', 'hata'];
const KOPTU_CUMLE = 'Oyunla motor arasındaki bağlantı koptu. Sahne çalışmaya devam ediyor; 3 saniyede bir yeniden bağlanmayı deniyorum.';
function durumAl() {
  const ws = Yayin.ws, kb = Yayin.kopruBaglanti;
  if (ws && ws.readyState === 1 && DURUM_YAZI[kb]) {
    const d = DURUM_YAZI[kb].slice();
    // Canlıyken alt satırda yayının hesabı: köprünün kendi cümlesinden ("@ad yayınına bağlandı …")
    const m = kb === 'bagli' && /@(\S+) yayınına/.exec($('bag-ileti').textContent);
    if (m)
      d[2] = '@' + m[1];
    return d;
  }
  if (ws && ws.readyState === 1)
    return ['bagli', 'Bağlı', sayi(Yayin.alinan) + ' olay alındı', 'akis'];
  if (ws)
    return ['baglaniyor', 'Bağlanıyor', 'motor aranıyor', 'baglaniyor'];
  if (Yayin.bitti)
    return DURUM_YAZI.durdu;
  if (Yayin.surekli)
    return ['koptu', 'Bağlantı koptu', 'yeniden deniyor', 'koptu'];
  if ($('bag-rozet').classList.contains('hata'))
    return DURUM_YAZI.hata;
  return ['deneme', 'Deneme', oto ? 'sahte izleyiciler, TikTok\'a bağlı değil' : 'TikTok\'a bağlı değil', 'deneme'];
}
// Masanın kipi sayfanın nasıl açıldığından gelir, olay gelip gelmemesinden değil: köprünün açtığı sayfa canlıdır,
// köprü "deneme" derse denemedir; diskten açılan sayfa denemedir (elle canlı bir köprüye bağlanırsa canlıya geçer).
const CANLI_BAGLANTI = ['baglaniyor', 'bekliyor', 'bagli', 'hata'];
// Köprü sayfayı sunarken kipi <html data-kip>'e yazar (kopru.js kipEk): masa ilk karesinden doğru düzende çizilir.
const SUNULAN_KIP = ['deneme', 'canli'].includes(document.documentElement.getAttribute('data-kip')) ? document.documentElement.getAttribute('data-kip') : '';
let masaKip = '';
function kipBak() {
  const b = Yayin.kopruBaglanti;
  kipUygula(b === 'deneme' ? 'deneme' : CANLI_BAGLANTI.includes(b) ? 'canli' : masaKip || SUNULAN_KIP || (KOPRU ? 'canli' : 'deneme'));
}
function kipUygula(k) {
  if (k === masaKip)
    return;
  masaKip = k;
  document.documentElement.setAttribute('data-kip', k);
  $('panel').dataset.kip = k;
  // Canlı yayında deneme izleyicisi kartı masada yoktur: sahte yorum, sahte hediye, otomatik kalabalık basılamaz.
  $('deneme-kart').hidden = k === 'canli';
  $('kademe-kart').hidden = k !== 'canli';
  if (k === 'canli' && oto)
    otoAyarla(false);
}
function masaYaz() {
  if (document.body.classList.contains('yayin'))
    return;
  kipBak();
  const [bag, bagAd, bagAlt, bagIkon] = durumAl(), g = $('d-bag-hucre');
  if (g.dataset.durum !== bag)
    g.dataset.durum = bag;
  ikonDegis(g.querySelector('.ik'), bagIkon);
  yaz('d-bag', bagAd);
  yaz('d-bag-alt', bagAlt);
  const cumle = bag === 'koptu' ? KOPTU_CUMLE : DURUM_CUMLELI.includes(bag) ? $('bag-ileti').textContent : '', dc = $('durum-cumle');
  yaz('durum-cumle', cumle);
  dc.hidden = !cumle;
  if (dc.dataset.durum !== bag)
    dc.dataset.durum = bag;
  let top = 0;
  for (const k of D.sira)
    top += k.jeton;
  yaz('d-kisi', D.sira.length);
  yaz('d-jeton', sayi(top));
  yaz('d-lider', D.lider ? D.lider.ad : 'henüz yok');
  yaz('d-lider-jt', D.lider ? sayi(D.lider.jeton) : '');
  $('d-lider').title = D.lider ? D.lider.ad : '';
  // Gelişmiş: kare süresi, vuruş
  yaz('d-bpm', Math.round(muzik.calanBpm()));
  yaz('d-hava', muzik.calanAd());
  const ms = D.kareMs || 0;
  yaz('d-kare', ms ? ms.toFixed(1) : '-');
  $('d-kare-hucre').dataset.durum = ms > 33 ? 'kotu' : ms > 22 ? 'agir' : 'iyi';
  kisilerYaz();
}

// Sahnedekiler: her satır bir düğmedir (sıra, ad, jeton); basınca altında "Adını gizle" ve "Sahneden çıkar" açılır.
// Aynı anda tek satır açık (acikKisi). Satırlar kimliğe göre yeniden kullanılır; liste 250 ms'de bir, yalnız
// değiştiyse yazılır.
const kisiSatirlar = new Map();
let kisiImza = '', modSurum = 0, acikKisi = null;
const gizliAd = id => { const g = ayar.gizli.find(x => x.id === id); return g ? g.ad : ''; };
function islemDugme(sinif, ikonAd) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mini ' + sinif;
  b.append(ikon(ikonAd), document.createElement('span'));
  return b;
}
function kisiSatirYap(id) {
  const li = document.createElement('li'), d = document.createElement('button'), e = document.createElement('div');
  li.dataset.id = id;
  d.type = 'button';
  d.className = 'kisi-dugme';
  d.setAttribute('aria-expanded', 'false');
  for (const s of ['no', 'ad', 'jt'])
    d.append(yeni('span', s));
  e.className = 'eylem';
  e.hidden = true;
  e.append(islemDugme('k-gizle', 'goz'), islemDugme('k-cikar tehlike', 'cikar'));
  li.append(d, e);
  return li;
}
function kisiSatirDoldur(li, k) {
  const [d, e] = li.children, [no, ad, jt] = d.children, gizli = modKume.gizli.has(k.id), asil = gizli ? gizliAd(k.id) || k.ad : k.ad, acik = k.id === acikKisi;
  no.textContent = k.sn + 1;
  ad.textContent = k.ad;
  ad.title = gizli ? asil : k.ad;
  jt.textContent = sayi(k.jeton);
  jt.classList.toggle('sifir', !k.jeton);
  li.classList.toggle('bas', k === D.lider);
  li.classList.toggle('gizli', gizli);
  li.classList.toggle('acik', acik);
  d.setAttribute('aria-expanded', acik);
  e.hidden = !acik;
  const [bg, bc] = e.children;
  bg.lastChild.textContent = gizli ? 'Adını göster' : 'Adını gizle';
  bg.setAttribute('aria-label', (gizli ? 'Adını yeniden göster: ' : 'Adını gizle: ') + asil);
  bc.lastChild.textContent = 'Sahneden çıkar';
  bc.setAttribute('aria-label', 'Sahneden çıkar: ' + asil);
}
function kisilerYaz() {
  const ol = $('kisi-liste'), ara = temiz($('kisi-ara').value).toLocaleLowerCase('tr');
  const uyan = ara ? D.sira.filter(k => (k.ad + ' ' + k.id + ' ' + gizliAd(k.id)).toLocaleLowerCase('tr').includes(ara)) : D.sira;
  const liste = uyan.slice(0, KISI_SINIR);
  if (acikKisi && !liste.some(k => k.id === acikKisi))
    acikKisi = null;
  const imza = ara + '#' + modSurum + '#' + acikKisi + '#' + (D.lider && D.lider.id) + '#' + liste.map(k => k.id + ':' + k.jeton + ':' + k.ad + ':' + k.sn).join('|');
  if (imza === kisiImza)
    return;
  kisiImza = imza;
  const odak = ol.contains(document.activeElement) ? document.activeElement : null, kalan = new Set(liste.map(k => k.id));
  for (const [id, li] of kisiSatirlar)
    if (!kalan.has(id)) {
      li.remove();
      kisiSatirlar.delete(id);
    }
  const bos = ol.querySelector('.bos-satir');
  if (bos)
    bos.remove();
  liste.forEach((k, i) => {
    let li = kisiSatirlar.get(k.id);
    if (!li) {
      li = kisiSatirYap(k.id);
      kisiSatirlar.set(k.id, li);
    }
    kisiSatirDoldur(li, k);
    if (ol.children[i] !== li)
      ol.insertBefore(li, ol.children[i] || null);
  });
  if (odak && odak !== document.activeElement && ol.contains(odak))
    odak.focus();
  if (!liste.length)
    ol.append(yeni('li', 'bos-satir', ara ? 'Bu adla sahnede kimse yok.' : OYUN.yazi.bos));
  yaz('kisi-not', uyan.length > liste.length ? 'İlk ' + liste.length + ' kişi görünüyor, ' + (uyan.length - liste.length) + ' kişi daha var. Başkasını bulmak için adını ara.' : '');
}
function kisiAc(id) {
  acikKisi = id;
  kisiImza = '';
  kisilerYaz();
}

/* ---- akış ----
 * Satırları 25-yazilar.js kurar (ikon, ad düğmesi, hediye satırı, süzgeç: gunlukSatir, gunlukSuzSec). Masa burada
 * satırdaki ada basınca işlemleri açar (sahnedekilerle aynı; aynı anda tek satır) ve süzgeç düğmelerini yazar. */
let akisAcik = null;
function akisAc(li) {
  if (akisAcik && akisAcik !== li) {
    akisAcik.classList.remove('acik');
    akisAcik.querySelector('.eylem').hidden = true;
    akisAcik.querySelector('button.ad').setAttribute('aria-expanded', 'false');
  }
  akisAcik = li;
  if (li) {
    li.classList.add('acik');
    li.querySelector('.eylem').hidden = false;
    li.querySelector('button.ad').setAttribute('aria-expanded', 'true');
  }
}
function akisSuzSec(ad) {
  akisAc(null);
  gunlukSuzSec(ad);
  $('gunluk').dataset.suz = gunlukSuz;
  for (const b of $('akis-suz').children)
    b.setAttribute('aria-pressed', b.dataset.suz === gunlukSuz);
}

// Yayıncının çıkardığı / adını gizlediği kişiler (Yayın güvenliği kartı): özet ve geri alma listesi.
function modYaz() {
  modSurum++;
  const ul = $('mod-liste');
  ul.textContent = '';
  const satirlar = [...ayar.cikan.map(x => [x, 'cikan']), ...ayar.gizli.map(x => [x, 'gizli'])];
  for (const [x, tur] of satirlar) {
    const li = document.createElement('li'), a = yeni('span', 'ad', x.ad), b = yeni('button', 'mini', 'Geri al');
    li.dataset.id = x.id;
    li.dataset.tur = tur;
    a.title = x.id;
    b.type = 'button';
    b.setAttribute('aria-label', 'Geri al: ' + x.ad + (tur === 'cikan' ? ', sahneye yeniden girebilir' : ', adı yeniden görünür'));
    li.append(a, yeni('span', 'ne' + (tur === 'cikan' ? ' cik' : ''), tur === 'cikan' ? 'sahneden çıkarıldı' : 'adı gizli'), b);
    ul.append(li);
  }
  $('mod-temizle').hidden = !satirlar.length;
  const c = ayar.cikan.length, g = ayar.gizli.length;
  yaz('mod-ozet', c || g ? c + ' çıkarılan · ' + g + ' gizli' : 'kimse yok');
  for (const li of $('gunluk').children)
    gunlukModYaz(li);
  kisiImza = '';
  masaYaz();
}
function modDegisti() { modKur(); ayarYaz(); modYaz(); }
// Adını gizle: ad "misafir" olur ve öyle kalır (yasaklı kelimeli adla aynı yol). Konuşma balonu hemen silinir.
function izleyiciGizle(id, ad) {
  if (!id || modKume.gizli.has(id))
    return;
  const k = D.oy.get(id);
  ad = String((k && k.ad !== 'misafir' ? k.ad : ad) || id).slice(0, 64);
  ayar.gizli.push({ id, ad });
  if (ayar.gizli.length > 300)
    ayar.gizli.shift();
  if (k) {
    k.ad = 'misafir';
    k.balon = null;
    D.siraKirli = true;
  }
  gunluk('gizlendi', ad, 'adı artık misafir yazılır');
  modDegisti();
}
function izleyiciGoster(id) {
  const i = ayar.gizli.findIndex(x => x.id === id);
  if (i < 0)
    return;
  const g = ayar.gizli.splice(i, 1)[0], k = D.oy.get(id);
  if (k && k.ad === 'misafir' && !yasakVar(g.ad)) {
    k.ad = kisalt(g.ad, 18);
    D.siraKirli = true;
  }
  gunluk('geri alındı', g.ad, 'adı yeniden görünür');
  modDegisti();
}
// Sahneden çıkar: cikar(k) ile gider ve geri alınana kadar olayları oyuna işlenmez. Lider çıkarsa rol devredilir.
function izleyiciCikar(id, ad) {
  if (!id || modKume.cikan.has(id))
    return;
  const k = D.oy.get(id);
  ad = String(gizliAd(id) || (k ? k.ad : ad) || id).slice(0, 64);
  ayar.cikan.push({ id, ad });
  if (ayar.cikan.length > 300)
    ayar.cikan.shift();
  if (k && !k.cikiyor) {
    const eski = D.lider;
    k.balon = null;
    cikar(k);
    if (eski === k && D.lider)
      oyunLiderDegisti(eski, D.lider);
  }
  gunluk('çıkarıldı', ad, 'olayları oyuna işlenmez');
  modDegisti();
}
function izleyiciGeriAl(id) {
  const i = ayar.cikan.findIndex(x => x.id === id);
  if (i < 0)
    return;
  const c = ayar.cikan.splice(i, 1)[0];
  gunluk('geri alındı', c.ad, 'yeniden oyuna girebilir');
  modDegisti();
}
function balonAyarla(v) {
  ayar.balon = v;
  anahtarYaz('balon-dugme', v, 'Yorum balonları');
  if (!v)
    balonlariSil(); // kapatınca ekrandaki balonlar da hemen gider
  ayarYaz();
}
// Yasaklı kelime eklenince (alan bırakılınca) sahnedeki eşleşen ad ve balonlar da hemen gizlenir.
function yasakUygula() {
  balonlariSil(k => yasakVar(k.balon.m));
  for (const k of D.oy.values())
    if (k.ad !== 'misafir' && yasakVar(k.ad)) {
      k.ad = 'misafir';
      D.siraKirli = true;
    }
}
// Boşaltma sayfanın içinde onay ister: düğme yerini "Emin misin? Evet, boşalt / Vazgeç" sorusuna bırakır.
// #bosalt asıl işi yapan düğmedir (testler ve araçlar ona doğrudan basar).
function bosaltSor(ac) {
  $('bosalt-onay').hidden = !ac;
  $('bosalt-onay').parentElement.classList.toggle('soruyor', ac); // soru kendi satırında, Gelişmiş'in altında durur
  $('bosalt-sor').hidden = ac;
  $('bosalt-sor').setAttribute('aria-expanded', ac);
  (ac ? $('bosalt-vazgec') : $('bosalt-sor')).focus();
}
// Ana sayfadan açılınca motor "← Oyunlar" bağlantısını .masa-ad'ın başına ekler (kopru.js); masa onu kendi
// düğmelerinden biri gibi yazar.
function anaDonYaz() {
  const a = document.querySelector('.masa-bas .ana-don');
  if (!a || a.querySelector('svg'))
    return;
  a.classList.add('dugme');
  a.replaceChildren(ikon('oyunlar'), 'Oyunlara dön');
}
const yaziAlani = e => e && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) || e.isContentEditable);
// Deneme düğmelerinin hediye kimlikleri (köprünün deneme kipiyle aynı üçü, kopru.js denemeBaslat): en küçük kademe Gül.
const DENEME_HEDIYE = [{ id: 'deneme-gul', ad: 'Gül' }, { id: 'deneme-kalp', ad: 'Kalp' }, { id: 'deneme-yildiz', ad: 'Yıldız' }];

function baslat(kayit) {
  sayfaYaz();
  // panel düğmeleri
  HAVALAR.forEach((h, i) => {
    const b = yeni('button', 'dugme' + (i === 0 ? ' secili' : ''), h.ad);
    b.type = 'button';
    b.id = 'hava-' + h.id;
    b.onclick = () => { muzik.bekleyen = h; muzik.havaSure = 0; };
    $('hava-sec').append(b);
  });
  [...KADEME].reverse().forEach((kd, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dugme';
    b.id = 'h-' + kd.min;
    b.append(yeni('span', 'h-esik', sayi(kd.min) + ' jeton'), yeni('span', 'h-ad', kd.ad));
    // Her düğme sahte bir hediye kimliğiyle gelir ("deneme-" önekli, gerçek bir TikTok numarası değil): oyun yazarı
    // hediye türüne bakan kuralını TikTok'suz dener (docs/KANCALAR.md, oyunHediye'nin dördüncü bilgisi).
    const hd = DENEME_HEDIYE[i % DENEME_HEDIYE.length];
    b.title = (kd.etki || kd.ad) + ' · deneme hediyesi: ' + hd.ad;
    b.onclick = () => { ilkDokunus(); olay({ tip: 'hediye', kullanici: sahteKim(), jeton: kd.min, hediye: { id: hd.id, ad: hd.ad } }); };
    $('hediyeler').append(b);
  });
  HIZLAR.forEach((h, i) => {
    const b = yeni('button', 'dugme' + (i === hiz ? ' secili' : ''), h.ad);
    b.type = 'button';
    b.id = 'hiz-' + i;
    b.onclick = () => {
      hiz = i;
      for (const x of $('hiz-sec').children)
        x.classList.toggle('secili', x === b);
      if (!oto)
        otoAyarla(true);
    };
    $('hiz-sec').append(b);
  });
  let dokunuldu = false;
  const ilkDokunus = () => {
    if (!dokunuldu) {
      dokunuldu = true;
      if (!muzik.acik)
        sesDegistir(true);
    }
  };
  $('s-yorum').onclick = () => { ilkDokunus(); olay({ tip: 'yorum', kullanici: sahteKim(), metin: sec(SAHTE_YORUM) }); };
  $('s-begeni').onclick = () => { ilkDokunus(); olay({ tip: 'begeni', kullanici: sahteKim(), adet: 15 }); };
  $('s-takip').onclick = () => { ilkDokunus(); olay({ tip: 'takip', kullanici: sahteKim() }); };
  otoAyarla(oto);
  $('oto').onclick = () => otoAyarla(!oto);
  // Boşalt: önce bütün oyuncular silinir, sonra oyun kendi durumunu sıfırlar (oyunBosalt), sonra sıra yeniden kurulur.
  $('bosalt-sor').onclick = () => bosaltSor(true);
  $('bosalt-vazgec').onclick = () => bosaltSor(false);
  $('bosalt-onay').onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); bosaltSor(false); } };
  $('bosalt').onclick = () => {
    D.oy.clear();
    D.cosku = 0;
    siraImza = '?';
    oyunBosalt();
    siraGuncelle();
    otoAyarla(false);
    try {
      localStorage.removeItem(SAKLA);
    }
    catch (e) { }
    if (!$('bosalt-onay').hidden)
      bosaltSor(false);
    masaYaz();
  };
  anahtarYaz('sirayla', muzik.sirayla, 'Havaları sırayla çal');
  $('sirayla').onclick = () => { muzik.sirayla = !muzik.sirayla; anahtarYaz('sirayla', muzik.sirayla, 'Havaları sırayla çal'); };
  // yayın güvenliği: balonlar, yasaklı kelimeler, çıkarılanlar
  ayarOku();
  anahtarYaz('balon-dugme', ayar.balon, 'Yorum balonları');
  $('yasak').value = ayar.yasak.join(', ');
  const yasakSay = () => yaz('yasak-say', ayar.yasak.length ? ayar.yasak.length + ' kelime' : '');
  yasakSay();
  $('balon-dugme').onclick = () => balonAyarla(!ayar.balon);
  $('yasak').oninput = e => { ayar.yasak = e.target.value.split(',').map(x => x.trim().toLocaleLowerCase('tr')).filter(x => x.length > 1).slice(0, 200); ayarYaz(); yasakSay(); };
  $('yasak').onchange = yasakUygula;
  $('mod-liste').onclick = e => {
    const b = e.target.closest('button'), li = b && b.closest('li');
    if (!li)
      return;
    if (li.dataset.tur === 'cikan')
      izleyiciGeriAl(li.dataset.id);
    else
      izleyiciGoster(li.dataset.id);
    // Klavyeyle basıldıysa odak listenin ilk düğmesine (liste boşaldıysa kelime alanına) geçer.
    if (!e.detail)
      ($('mod-liste').querySelector('button') || $('yasak')).focus();
  };
  $('mod-temizle').onclick = () => {
    for (const x of [...ayar.gizli])
      izleyiciGoster(x.id);
    for (const x of [...ayar.cikan])
      izleyiciGeriAl(x.id);
  };
  // Sahnedekiler: ada basınca işlemler açılır; işlem düğmeleri tek dinleyicide (satırlar sık yenilenir).
  $('kisi-liste').onclick = e => {
    const b = e.target.closest('button'), li = b && b.closest('li');
    if (!li || !li.dataset.id)
      return;
    const id = li.dataset.id;
    if (b.classList.contains('kisi-dugme')) {
      kisiAc(acikKisi === id ? null : id);
      return;
    }
    const odakIcinde = li.contains(document.activeElement), sonraki = li.nextElementSibling || li.previousElementSibling;
    acikKisi = null;
    if (b.classList.contains('k-cikar')) {
      izleyiciCikar(id);
      const yeniOdak = sonraki && sonraki.isConnected && sonraki.querySelector('.kisi-dugme');
      (yeniOdak || $('kisi-ara')).focus();
    }
    else {
      if (modKume.gizli.has(id))
        izleyiciGoster(id);
      else
        izleyiciGizle(id);
      if (odakIcinde && li.isConnected)
        li.firstChild.focus();
    }
  };
  $('kisi-liste').addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !acikKisi)
      return;
    const li = kisiSatirlar.get(acikKisi);
    kisiAc(null);
    if (li && li.isConnected)
      li.firstChild.focus();
  });
  $('kisi-ara').oninput = () => kisilerYaz();
  // Akış: biçimleme, süzgeç, ada basınca işlemler
  $('akis-suz').onclick = e => { const b = e.target.closest('button'); if (b) akisSuzSec(b.dataset.suz); };
  $('gunluk').onclick = e => {
    const b = e.target.closest('button'), li = b && b.closest('li');
    if (!li || !li.dataset.id || modKume.cikan.has(li.dataset.id))
      return;
    if (b.classList.contains('ad')) {
      akisAc(akisAcik === li ? null : li);
      return;
    }
    const id = li.dataset.id, ad = li.querySelector('.ad').textContent, odakIcinde = li.contains(document.activeElement);
    akisAc(null);
    if (b.classList.contains('g-cikar'))
      izleyiciCikar(id, ad);
    else if (modKume.gizli.has(id))
      izleyiciGoster(id);
    else
      izleyiciGizle(id, ad);
    // Fareyle basıldıysa odak bırakılır (yoksa akış durmuş kalır); klavyede satırın adına döner.
    if (e.detail)
      b.blur();
    else if (odakIcinde)
      (li.isConnected ? li.querySelector('button.ad') : $('gunluk')).focus();
  };
  $('gunluk').addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !akisAcik)
      return;
    const li = akisAcik;
    akisAc(null);
    li.querySelector('button.ad').focus();
  });
  // Fare ya da odak akıştayken satırlar kaymaz (25-yazilar.js: gunlukDur); çıkınca bekleyenler yazılır.
  const akis = $('gunluk'), akisDur = () => { gunlukDur = akis.matches(':hover') || akis.contains(document.activeElement); };
  akis.addEventListener('pointerenter', () => { gunlukDur = true; });
  akis.addEventListener('pointerleave', () => setTimeout(akisDur, 0));
  akis.addEventListener('focusin', () => { gunlukDur = true; });
  akis.addEventListener('focusout', () => setTimeout(akisDur, 0));
  $('ses-dugme').onclick = () => { dokunuldu = true; sesDegistir(!muzik.acik); };
  $('ses-cagri').onclick = () => { dokunuldu = true; sesDegistir(true); };
  $('ses-duzey').oninput = e => muzik.duzeyAyarla(e.target.value / 100 * 0.7);
  // Hazır parçalar: oyunun yanındaki muzik/liste.js varsa yüklenir ve müzik yalnız o parçalardan çalar;
  // üretilen havaların düğmeleri gizlenir. Klasör yoksa hiçbir şey değişmez, üretilen müzik çalar.
  const kaynakYaz = () => {
    for (const x of $('parca-sec').children)
      x.classList.toggle('secili', muzik.hazirCal && x.id === 'parca-' + muzik.hz.no);
  };
  kare.kaynakYaz = kaynakYaz;
  if (!window.OYUN_MUZIK_KAPALI) {
    const ml = document.createElement('script');
    ml.src = 'muzik/liste.js';
    ml.onload = () => {
      if (!muzik.hazirKur(window.OYUN_MUZIK))
        return;
      muzik.parcalar.forEach((p, i) => {
        const b = yeni('button', 'dugme', p.ad);
        b.type = 'button';
        b.id = 'parca-' + i;
        b.onclick = async () => {
          dokunuldu = true;
          if (!muzik.acik)
            await sesDegistir(true);
          await muzik.hazirBaslat(i);
          kaynakYaz();
        };
        $('parca-sec').append(b);
      });
      $('hazir-kutu').hidden = false;
      $('hava-sec').hidden = true;
      $('hava-grup').hidden = true;
      $('sirayla').parentElement.hidden = true;
      muzik.kaynakSec('hazir').then(kaynakYaz);
    };
    document.head.append(ml);
  }
  $('yayin-gor').onclick = () => yayinModu(true);
  $('cik-yayin').onclick = () => yayinModu(false);
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('yayin'))
      yayinModu(false);
    // B: yorum balonlarını aç / kapa. Yalnız sahne görünümünde de çalışır (panel gizliyken tek yol budur).
    else if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !yaziAlani(e.target)) {
      e.preventDefault();
      balonAyarla(!ayar.balon);
    }
  });
  addEventListener('hashchange', () => yayinModu(location.hash === '#yayin'));
  $('bag-dugme').onclick = () => {
    if (Yayin.ws) {
      Yayin.kes();
      bagDurum('', 'Bağlantı kesildi.');
    }
    else
      Yayin.baglan($('bag-adres').value);
  };
  if (document.readyState === 'loading')
    addEventListener('DOMContentLoaded', anaDonYaz); // motorun bağlantısı DOMContentLoaded'da eklenir, bizimki ondan sonra çalışır
  else
    anaDonYaz();
  addEventListener('resize', boyutla);
  if (window.ResizeObserver)
    new ResizeObserver(boyutla).observe(document.documentElement);
  // Başlangıç kalabalığı: sayfa boş açılmasın. Gerçek yayında sahte ad olmaz; saklanan sıra geri gelir.
  // Yayıncının çıkardığı kişi geri gelmez, adını gizlediği kişi misafir yazılır.
  const eski = kayit && Array.isArray(kayit.oyuncular) ? kayit.oyuncular : KOPRU ? (siraOku() || []) : null;
  const tohum = eski || (OYUN.tohum || []).map(([ad, jeton]) => ({ id: 'sahte:' + ad, ad, jeton }));
  tohum.filter(t => !modKume.cikan.has(String(t.id))).forEach((t, i) => { const k = karakterYap(String(t.id), modKume.gizli.has(String(t.id)) ? 'misafir' : String(t.ad)); k.jeton = +t.jeton || 0; k.katilim = i * 0.001; D.oy.set(k.id, k); });
  siraImza = '?';
  siraGuncelle();
  oyunBaslat(kayit);
  // Bu oyunda: oyun kendi düğmesini #bu-oyunda içine koyduysa (oyunBaslat ya da sonra) kart görünür.
  const buOyunda = () => { $('bu-oyunda-kart').hidden = !$('bu-oyunda').children.length; };
  buOyunda();
  new MutationObserver(buOyunda).observe($('bu-oyunda'), { childList: true });
  if (kayit && typeof kayit.cosku === 'number')
    D.cosku = kayit.cosku;
  if (kayit && kayit.hava) {
    const h = HAVALAR.find(x => x.id === kayit.hava);
    if (h) {
      muzik.hava = h;
      for (const x of $('hava-sec').children)
        x.classList.toggle('secili', x.id === 'hava-' + h.id);
    }
  }
  document.body.classList.toggle('yayin', location.hash === '#yayin');
  boyutla();
  kamKur();
  if (KOPRU) {
    otoAyarla(false);
    $('bag-adres').value = KOPRU;
    Yayin.surekli = true;
    Yayin.baglan(KOPRU);
    Yayin.surekli = true;
    setInterval(siraSakla, 5000);
  }
  kipBak();
  if (KOPRU || location.hash === '#yayin')
    muzik.sesAc(true).then(ok => {
      if (ok)
        sesDegistir(true);
    });
  modYaz();
  setInterval(masaYaz, 250);
  requestAnimationFrame(t => { sonKare = t; kare(t); });
}

// Son karenin ölçümü (720×1280 ölçeğinde): sahne yazılarının kutuları, her oyuncunun yüzü (merkez ve yarıçap) ve
// ad etiketinin kutusu. kare-cek.js bunu kare-<ad>.json olarak yazar; testler adların sıralama kutusuna girip
// girmediğine buradan bakar. Kutular [x, y, genişlik, yükseklik].
function kareOlcum() {
  const s = $('sahne').getBoundingClientRect(), o = GW / (s.width || GW), yuv = v => Math.round(v * 10) / 10;
  const kutu = el => {
    if (!el || el.hidden)
      return null;
    const r = el.getBoundingClientRect();
    return r.width ? [yuv((r.left - s.left) * o), yuv((r.top - s.top) * o), yuv(r.width * o), yuv(r.height * o)] : null;
  };
  const kisiler = [], gor = new Set();
  for (const k of [...D.oy.values(), ...(KANCA_EK_ADLAR ? KANCA_EK_ADLAR() || [] : [])]) {
    if (!k || gor.has(k) || k.cikiyor)
      continue;
    gor.add(k);
    const be = k.basEkran && k.basEkran.kare >= kareSay - 1 ? k.basEkran : null;
    kisiler.push({ ad: k.ad, lider: k === D.lider, ozel: !!k.ozel, bas: be ? { x: yuv(be.x), y: yuv(be.y), r: yuv(be.r) } : null, etiket: k.etKutu ? k.etKutu.map(yuv) : null });
  }
  return {
    kare: kareSay, alan: [ALAN_UST, ALAN_ALT],
    kutular: { sira: kutu($('sira-liste').parentElement), cosku: kutu(document.querySelector('.cosku')), bildirim: [...$('bildirim').children].map(kutu), pankart: kutu(document.querySelector('.pankart')) },
    kisiler
  };
}
// Dışarıya açık küçük arayüz: köprü yazanlar ve denemeler için.
window.CanliOyun = {
  olay, baglan: a => Yayin.baglan(a), kes: () => Yayin.kes(), cevir: m => Yayin.cevir(m), kopruBitti: ileti => Yayin.bitir(ileti),
  durum: () => {
    const d = { oyun: OYUN.id, kisi: D.sira.length, lider: D.lider && D.lider.ad, cosku: D.cosku, begeni: D.begeni, vurus: B, sira: D.sira.map(k => [k.ad, k.jeton]), kareMs: D.kareMs, parca: parca.length, bagli: !!(Yayin.ws && Yayin.ws.readyState === 1), alinan: Yayin.alinan, hava: muzik.hava.id, ses: muzik.acik };
    if (KANCA_DURUM)
      KANCA_DURUM(d);
    return d;
  },
  _test: {
    D, muzik, Muzik, HAVALAR, TAKIMLAR, TAKIM, havalarKur, ayar, OYUN, KADEME, zamanEkle: sn => { zaman += sn; }, zaman: () => zaman,
    // Vuruş saatini dondurur / ilerletir / bırakır (yalnız test ve kare almak için: dondurulmuş B geri de alınabilir,
    // oyunda kullanılmaz). Kare döngüsü sürer; yalnız B sabit kalır, hareketin aynı evresi tekrar tekrar alınabilir.
    vurusDondur: b => { vurusKilit = b === undefined ? B : +b; B = vurusKilit; return vurusKilit; },
    vurusIlerle: db => { vurusKilit = (vurusKilit === null ? B : vurusKilit) + (+db || 0); B = vurusKilit; return vurusKilit; },
    vurusCoz: () => { vurusKilit = null; },
    olcum: kareOlcum,
    // Çekirdeğin çizim ve kamera işlevleri: testler ve gösterim kareleri sahne dışı denemeler için çağırır.
    cekirdek: { kam, pr, kameraSigdir, kadrajHesap, etiketCiz, ETIKET, listeCiz, liste, karakterYap, iskeletKur, kolKur, pozBekle, pozOtur, insanEkle, kafaCiz, elSekilCiz, renkKat, donusum, yerelNokta, yuzBakiyor, cokgenCiz, yuzCiz, kutuCiz, daireCiz, kapsulCiz, ufukY, gokCiz, renkUygula, RENK, RENK_OTO, PANEL_RENK, SAHNE_YAZI, pankart, bildir, ALAN_UST, ALAN_ALT, ETIKET_PAY, c, GW, GH }
  },
  async _sesTesti(sn, i) {
    const oc = new OfflineAudioContext(2, 44100 * sn, 44100), m = new Muzik();
    m.hava = HAVALAR[i || 0];
    m.sesKur(oc);
    m.acik = true;
    m.sonraki = 0.05;
    while (m.sonraki < sn)
      m.adimCal();
    const buf = await oc.startRendering(), d = buf.getChannelData(0);
    let tepe = 0, kare2 = 0, gecis = 0;
    const dilim = [];
    for (let i2 = 0; i2 < d.length; i2++) {
      const v = d[i2];
      if (Math.abs(v) > tepe)
        tepe = Math.abs(v);
      kare2 += v * v;
      if (i2 && (v > 0) !== (d[i2 - 1] > 0))
        gecis++;
      if (i2 % 44100 === 44099) {
        let q = 0;
        for (let w = i2 - 44099; w <= i2; w++)
          q += d[w] * d[w];
        dilim.push(+Math.sqrt(q / 44100).toFixed(3));
      }
    }
    return { tepe: +tepe.toFixed(3), rms: +Math.sqrt(kare2 / d.length).toFixed(3), sifirGecis: Math.round(gecis / sn), dilim, adimlar: m.iz.length };
  }
};
window.claude?.hot?.snapshot?.(() => ({ oyuncular: D.sira.map(k => ({ id: k.id, ad: k.ad, jeton: k.jeton })), cosku: D.cosku, hava: muzik.hava.id }));
queueMicrotask(() => {
  if (window.claude?.hot?.ready)
    window.claude.hot.ready(baslat);
  else
    baslat(window.claude?.hot?.data ?? {});
});
