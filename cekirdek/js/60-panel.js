/* PANEL VE AÇILIŞ — sayfa yazıları, yayın masası (panel), sahnenin boyutlandırılması, oyunun başlatılması.
 * sayfaYaz: logo, nasıl oynanır, başlıklar, kademe tablosu ve tema renkleri OYUN'dan · boyutla: sahneyi 9:16 tutar
 * yayinModu: yalnız sahne görünümü (#yayin) · baslat: tohum kalabalığı kurar, oyunBaslat(kayit) çağırır, döngüyü açar
 * masaYaz: durum şeridi ve sahnedekiler listesi (250 ms'de bir; yayın görünümünde çalışmaz)
 * izleyiciGizle / izleyiciCikar (+ geri alma): yayıncının hızlı eylemleri; kimliğe göre, ayarla birlikte saklanır
 * window.CanliOyun: dışarıya açık arayüz (olay, baglan, kes, cevir, durum, _test). Testler bunu kullanır.
 * Açılış bütün parçalar çalıştıktan sonra (mikro görevde) yapılır: oyunun üst düzey const'ları kancalarda hazırdır.
 */
const KANCA_DURUM = typeof oyunDurum === 'function' ? oyunDurum : null;
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
function otoAyarla(v) { oto = v; anahtarYaz('oto', v, 'Otomatik izleyici'); }
async function sesDegistir(ac) {
  if (ac) {
    const ok = await muzik.sesAc();
    if (!ok)
      return;
  }
  else
    await muzik.sesKapat();
  $('ses-dugme').textContent = muzik.acik ? 'Sesi kapat' : 'Sesi aç';
  $('ses-dugme').classList.toggle('ana', !muzik.acik);
  $('ses-cagri').hidden = muzik.acik;
}
function boyutla() {
  const yayin = document.body.classList.contains('yayin'), dar = innerWidth <= 900, kok = document.documentElement, s = $('sahne');
  const cs = getComputedStyle(kok), yukH = kok.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let w;
  if (yayin)
    w = Math.min(innerWidth, yukH * 9 / 16);
  else if (dar)
    w = Math.min(innerWidth - 32, yukH * 0.58 * 9 / 16);
  else
    w = Math.min((yukH - 32) * 9 / 16, innerWidth - 32 - 20 - 300);
  w = Math.max(200, Math.floor(w));
  s.style.width = w + 'px';
  s.style.height = Math.round(w * 16 / 9) + 'px';
  const pw = Math.min(yayin ? 1080 : 900, Math.round(w * Math.min(2, devicePixelRatio || 1)));
  if (tuval.width !== pw) {
    tuval.width = pw;
    tuval.height = Math.round(pw * 16 / 9);
  }
}
function yayinModu(v) { document.body.classList.toggle('yayin', v); try {
  if ((location.hash === '#yayin') !== v)
    history.replaceState(null, '', v ? '#yayin' : location.pathname + location.search);
}
catch (e) { } boyutla(); if (!v)
  masaYaz(); }

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
  $('bosalt').textContent = y.bosalt;
  // kademe tablosu: küçükten büyüğe
  const tablo = $('kademe-tablo');
  [...KADEME].reverse().forEach((kd, i) => {
    const tr = document.createElement('tr');
    tr.style.setProperty('--kd', kademeRenk(i));
    for (const yazi of [kd.min + '+', kd.ad, kd.etki || '']) {
      const td = document.createElement('td');
      td.textContent = yazi;
      tr.append(td);
    }
    tablo.append(tr);
  });
}
// Kademenin paneldeki rengi (i: küçükten büyüğe sırası): en küçüğü serin, ortası vurgu, en büyüğü sıcak.
function kademeRenk(i) { const t = KADEME.length > 1 ? i / (KADEME.length - 1) : 1; return 'var(--' + (t < 0.34 ? 'serin' : t < 0.75 ? 'vurgu' : 'sicak') + ')'; }

/* ---- yayın masası: durum şeridi, sahnedekiler, yayıncının hızlı eylemleri ---- */
const KISI_SINIR = 12; // listede en çok kaç satır (gerisi aramayla bulunur): sayfa öğeleri kalabalıkla şişmesin
const sayi = n => Math.round(n).toLocaleString('tr-TR');
const yaz = (id, v) => { const e = $(id); v = String(v); if (e.textContent !== v)
  e.textContent = v; };
// Bağlantı hücresi: köprü durumunu bildiriyorsa (Yayin.kopruBaglanti) onu olduğu gibi söyler; "Canlı" yalnız TikTok'a
// gerçekten bağlıyken. Durum bildirmeyen eski köprülerde köprüye bağlı olmak "Canlı" sayılır (eski davranış).
// Hücre dardır: ana yazılar kısa tutulur, ayrıntı alt satırda.
const KOPRU_HUCRE = {
  deneme: ['deneme', 'Deneme', 'motordan sahte izleyici'],
  baglaniyor: ['bekliyor', 'Bağlanıyor', 'TikTok\'a bağlanılıyor'],
  bekliyor: ['bekliyor', 'Yayın yok', 'yayın henüz açık değil'],
  durdu: ['koptu', 'Durdu', 'oyun ana sayfadan durduruldu'],
  hata: ['koptu', 'Bağlanamadı', 'Yayın sekmesine bak']
};
function durumAl() {
  const ws = Yayin.ws;
  if (ws && ws.readyState === 1 && KOPRU_HUCRE[Yayin.kopruBaglanti])
    return KOPRU_HUCRE[Yayin.kopruBaglanti];
  if (ws && ws.readyState === 1)
    return ['canli', 'Canlı', sayi(Yayin.alinan) + ' olay alındı'];
  if (ws)
    return ['bekliyor', 'Bağlanıyor', 'köprü aranıyor'];
  if (Yayin.bitti)
    return KOPRU_HUCRE.durdu;
  if (Yayin.surekli)
    return ['koptu', 'Koptu', 'yeniden deniyor'];
  if ($('bag-rozet').classList.contains('hata'))
    return ['koptu', 'Bağlanamadı', 'Yayın sekmesine bak'];
  return ['deneme', 'Deneme', oto ? 'sahte izleyici açık' : 'sahte izleyici kapalı'];
}
function masaYaz() {
  if (document.body.classList.contains('yayin'))
    return;
  const [bag, bagAd, bagAlt] = durumAl(), hucre = $('d-bag-hucre');
  if (hucre.dataset.durum !== bag)
    hucre.dataset.durum = bag;
  yaz('d-bag', bagAd);
  yaz('d-bag-alt', bagAlt);
  let top = 0;
  for (const k of D.sira)
    top += k.jeton;
  yaz('d-kisi', D.sira.length);
  yaz('d-kisi-alt', 'en çok ' + MAKS);
  yaz('d-jeton', sayi(top));
  yaz('d-lider', D.lider ? D.lider.ad : '-');
  yaz('d-lider-alt', D.lider ? sayi(D.lider.jeton) + ' jeton' : 'henüz kimse yok');
  yaz('d-bpm', Math.round(muzik.calanBpm()));
  yaz('d-hava', muzik.calanAd());
  const ms = D.kareMs || 0;
  yaz('d-kare', ms ? ms.toFixed(1) : '-');
  $('d-kare-hucre').dataset.durum = ms > 33 ? 'kotu' : ms > 22 ? 'agir' : 'iyi';
  kisilerYaz();
}
const kisiSatirlar = new Map();
let kisiImza = '', modSurum = 0;
const gizliAd = id => { const g = ayar.gizli.find(x => x.id === id); return g ? g.ad : ''; };
function kisiSatirYap(id) {
  const li = document.createElement('li'), e = document.createElement('span');
  li.dataset.id = id;
  for (const s of ['no', 'ad', 'jt']) {
    const x = document.createElement('span');
    x.className = s;
    li.append(x);
  }
  e.className = 'eylem';
  for (const s of ['k-gizle', 'k-cikar tehlike']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini ' + s;
    e.append(b);
  }
  li.append(e);
  return li;
}
function kisiSatirDoldur(li, k) {
  const [no, ad, jt, e] = li.children, gizli = modKume.gizli.has(k.id), asil = gizli ? gizliAd(k.id) || k.ad : k.ad;
  no.textContent = k.sn + 1;
  ad.textContent = k.ad;
  ad.title = gizli ? asil : k.ad;
  jt.textContent = sayi(k.jeton);
  jt.classList.toggle('sifir', !k.jeton);
  li.classList.toggle('bas', k === D.lider);
  li.classList.toggle('gizli', gizli);
  const [bg, bc] = e.children;
  bg.textContent = gizli ? 'Göster' : 'Gizle';
  bg.setAttribute('aria-label', (gizli ? 'Adını yeniden göster: ' : 'Adını gizle: ') + asil);
  bc.textContent = 'Çıkar';
  bc.setAttribute('aria-label', 'Sahneden çıkar: ' + asil);
}
function kisilerYaz() {
  const ol = $('kisi-liste'), ara = temiz($('kisi-ara').value).toLocaleLowerCase('tr');
  const uyan = ara ? D.sira.filter(k => (k.ad + ' ' + k.id + ' ' + gizliAd(k.id)).toLocaleLowerCase('tr').includes(ara)) : D.sira;
  const liste = uyan.slice(0, KISI_SINIR);
  const imza = ara + '#' + modSurum + '#' + (D.lider && D.lider.id) + '#' + liste.map(k => k.id + ':' + k.jeton + ':' + k.ad + ':' + k.sn).join('|');
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
  if (!liste.length) {
    const li = document.createElement('li');
    li.className = 'bos-satir';
    li.textContent = ara ? 'Bu adla sahnede kimse yok.' : OYUN.yazi.bos;
    ol.append(li);
  }
  yaz('kisi-not', uyan.length > liste.length ? 'İlk ' + liste.length + ' kişi görünüyor, ' + (uyan.length - liste.length) + ' kişi daha var. Başkasını bulmak için adını ara.' : '');
}
// Yayıncının çıkardığı / adını gizlediği kişiler listesi (Yayın sekmesi) ve güvenlik şeridindeki özet.
function modYaz() {
  modSurum++;
  const ul = $('mod-liste');
  ul.textContent = '';
  const satirlar = [...ayar.cikan.map(x => [x, 'cikan']), ...ayar.gizli.map(x => [x, 'gizli'])];
  for (const [x, tur] of satirlar) {
    const li = document.createElement('li'), a = document.createElement('span'), n = document.createElement('span'), b = document.createElement('button');
    li.dataset.id = x.id;
    li.dataset.tur = tur;
    a.className = 'ad';
    a.textContent = x.ad;
    a.title = x.id;
    n.className = 'ne' + (tur === 'cikan' ? ' cik' : '');
    n.textContent = tur === 'cikan' ? 'sahneden çıkarıldı' : 'adı gizli';
    b.type = 'button';
    b.className = 'mini';
    b.textContent = 'Geri al';
    b.setAttribute('aria-label', 'Geri al: ' + x.ad + (tur === 'cikan' ? ', sahneye yeniden girebilir' : ', adı yeniden görünür'));
    li.append(a, n, b);
    ul.append(li);
  }
  if (!satirlar.length) {
    const li = document.createElement('li');
    li.className = 'bos';
    li.textContent = 'Kimse yok. Sahnedekiler listesinde ya da olay akışında bir adın üstüne gelince çıkan Gizle ve Çıkar düğmeleriyle eklenir.';
    ul.append(li);
  }
  $('mod-temizle').hidden = !satirlar.length;
  const c = ayar.cikan.length, g = ayar.gizli.length;
  yaz('mod-ozet', c || g ? c + ' çıkarılan · ' + g + ' gizli' : 'kimse yok');
  $('mod-ac').classList.toggle('dolu', !!(c || g));
  for (const li of $('gunluk').children)
    if (li.dataset.id) {
      li.classList.toggle('gizli', modKume.gizli.has(li.dataset.id));
      li.classList.toggle('cikan', modKume.cikan.has(li.dataset.id));
    }
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
function sekmeSec(ad, odakla) {
  for (const t of $('sekmeler').children) {
    const on = t.dataset.sekme === ad;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $('bolum-' + t.dataset.sekme).hidden = !on;
    if (on && odakla)
      t.focus();
  }
}
const yaziAlani = e => e && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) || e.isContentEditable);
// Deneme düğmelerinin hediye kimlikleri (köprünün deneme kipiyle aynı üçü, kopru.js denemeBaslat): en küçük kademe Gül.
const DENEME_HEDIYE = [{ id: 'deneme-gul', ad: 'Gül' }, { id: 'deneme-kalp', ad: 'Kalp' }, { id: 'deneme-yildiz', ad: 'Yıldız' }];

function baslat(kayit) {
  sayfaYaz();
  // panel düğmeleri
  HAVALAR.forEach((h, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dugme' + (i === 0 ? ' secili' : '');
    b.textContent = h.ad;
    b.id = 'hava-' + h.id;
    b.onclick = () => { muzik.bekleyen = h; muzik.havaSure = 0; };
    $('hava-sec').append(b);
  });
  [...KADEME].reverse().forEach((kd, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dugme';
    b.id = 'h-' + kd.min;
    b.style.setProperty('--kd', kademeRenk(i));
    const g = document.createElement('b'), j = document.createElement('span');
    j.textContent = 'jeton';
    g.append(sayi(kd.min), j);
    const s = document.createElement('small');
    s.textContent = kd.ad;
    b.append(g, s);
    // Her düğme sahte bir hediye kimliğiyle gelir ("deneme-" önekli, gerçek bir TikTok numarası değil): oyun yazarı
    // hediye türüne bakan kuralını TikTok'suz dener (docs/KANCALAR.md, oyunHediye'nin dördüncü bilgisi).
    const hd = DENEME_HEDIYE[i % DENEME_HEDIYE.length];
    b.title = (kd.etki || kd.ad) + ' · deneme hediyesi: ' + hd.ad;
    b.onclick = () => { ilkDokunus(); olay({ tip: 'hediye', kullanici: sahteKim(), jeton: kd.min, hediye: { id: hd.id, ad: hd.ad } }); };
    $('hediyeler').append(b);
  });
  HIZLAR.forEach((h, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dugme' + (i === hiz ? ' secili' : '');
    b.textContent = h.ad;
    b.id = 'hiz-' + i;
    b.onclick = () => { hiz = i; for (const x of $('hiz-sec').children)
      x.classList.toggle('secili', x === b); if (!oto)
      otoAyarla(true); };
    $('hiz-sec').append(b);
  });
  let dokunuldu = false;
  const ilkDokunus = () => { if (!dokunuldu) {
    dokunuldu = true;
    if (!muzik.acik)
      sesDegistir(true);
  } };
  $('s-yorum').onclick = () => { ilkDokunus(); olay({ tip: 'yorum', kullanici: sahteKim(), metin: sec(SAHTE_YORUM) }); };
  $('s-begeni').onclick = () => { ilkDokunus(); olay({ tip: 'begeni', kullanici: sahteKim(), adet: 15 }); };
  $('s-takip').onclick = () => { ilkDokunus(); olay({ tip: 'takip', kullanici: sahteKim() }); };
  otoAyarla(oto);
  $('oto').onclick = () => otoAyarla(!oto);
  // Boşalt: önce bütün oyuncular silinir, sonra oyun kendi durumunu sıfırlar (oyunBosalt), sonra sıra yeniden kurulur.
  $('bosalt').onclick = () => { D.oy.clear(); D.cosku = 0; siraImza = '?'; oyunBosalt(); siraGuncelle(); otoAyarla(false); try {
    localStorage.removeItem(SAKLA);
  }
  catch (e) { } masaYaz(); };
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
  $('mod-ac').onclick = () => { sekmeSec('yayin'); $('mod-grup').scrollIntoView({ block: 'nearest' }); const b = $('mod-liste').querySelector('button'); (b || $('sekme-yayin')).focus(); };
  $('mod-liste').onclick = e => { const b = e.target.closest('button'), li = b && b.closest('li'); if (!li)
    return; if (li.dataset.tur === 'cikan')
    izleyiciGeriAl(li.dataset.id);
  else
    izleyiciGoster(li.dataset.id); const ilk = $('mod-liste').querySelector('button'); (ilk || $('mod-ac')).focus(); };
  $('mod-temizle').onclick = () => { for (const x of [...ayar.gizli])
    izleyiciGoster(x.id); for (const x of [...ayar.cikan])
    izleyiciGeriAl(x.id); };
  // Sahnedekiler ve olay akışındaki Gizle / Çıkar düğmeleri (tek dinleyici; satırlar sık yenilenir).
  $('kisi-liste').onclick = e => {
    const b = e.target.closest('button'), li = b && b.closest('li');
    if (!li || !li.dataset.id)
      return;
    const id = li.dataset.id, sonraki = li.nextElementSibling || li.previousElementSibling;
    if (b.classList.contains('k-cikar')) {
      izleyiciCikar(id);
      const yeni = sonraki && sonraki.isConnected && sonraki.querySelector('.k-cikar');
      (yeni || $('kisi-ara')).focus();
    }
    else if (modKume.gizli.has(id))
      izleyiciGoster(id);
    else
      izleyiciGizle(id);
  };
  $('kisi-ara').oninput = () => kisilerYaz();
  $('gunluk').onclick = e => {
    const b = e.target.closest('button'), li = b && b.closest('li');
    if (!li || !li.dataset.id)
      return;
    const ad = li.querySelector('.ad').textContent;
    if (b.classList.contains('g-cikar'))
      izleyiciCikar(li.dataset.id, ad);
    else
      izleyiciGizle(li.dataset.id, ad);
    // Fareyle basıldıysa odak bırakılır (yoksa akış durmuş kalır); klavyede gizlenen düğmeden listeye geçer.
    if (e.detail)
      b.blur();
    else if (!b.offsetParent)
      $('gunluk').focus();
  };
  // Fare ya da odak akıştayken satırlar kaymaz (25-yazilar.js: gunlukDur); çıkınca bekleyenler yazılır.
  const akis = $('gunluk'), akisDur = () => { gunlukDur = akis.matches(':hover') || akis.contains(document.activeElement); };
  akis.addEventListener('pointerenter', () => { gunlukDur = true; });
  akis.addEventListener('pointerleave', () => setTimeout(akisDur, 0));
  akis.addEventListener('focusin', () => { gunlukDur = true; });
  akis.addEventListener('focusout', () => setTimeout(akisDur, 0));
  // sekmeler: tıkla ya da ok tuşlarıyla gez
  $('sekmeler').onclick = e => { const t = e.target.closest('[role=tab]'); if (t)
    sekmeSec(t.dataset.sekme); };
  $('sekmeler').onkeydown = e => {
    const s = [...$('sekmeler').children], i = s.indexOf(document.activeElement);
    if (i < 0)
      return;
    const j = e.key === 'ArrowRight' ? (i + 1) % s.length : e.key === 'ArrowLeft' ? (i + s.length - 1) % s.length : e.key === 'Home' ? 0 : e.key === 'End' ? s.length - 1 : -1;
    if (j < 0)
      return;
    e.preventDefault();
    sekmeSec(s[j].dataset.sekme, true);
  };
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
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dugme';
        b.id = 'parca-' + i;
        b.textContent = p.ad;
        b.onclick = async () => { dokunuldu = true; if (!muzik.acik)
          await sesDegistir(true); await muzik.hazirBaslat(i); kaynakYaz(); };
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
  $('bag-dugme').onclick = () => { if (Yayin.ws) {
    Yayin.kes();
    bagDurum('', 'Bağlantı kesildi.');
  }
  else
    Yayin.baglan($('bag-adres').value); };
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
    $('panel-not').textContent = 'Bu sayfayı köprü programı açtı. Yorum ve hediyeler gerçek yayından gelir. Deneme sekmesindeki sahte izleyici düğmeleri yalnızca deneme içindir; yayın sırasında basma.';
    $('deneme-uyari').hidden = false;
    sekmeSec('yayin');
    setInterval(siraSakla, 5000);
  }
  if (KOPRU || location.hash === '#yayin')
    muzik.sesAc(true).then(ok => { if (ok)
      sesDegistir(true); });
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
