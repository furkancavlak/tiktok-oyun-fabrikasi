/* SAHNE ÜSTÜ YAZILAR — sıra kutusu, bildirimler, pankart, masadaki akış.
 * bildir(ad, orta, vurgu): sağdaki bildirim satırı · pankart(satir1, satir2): ortadan geçen büyük duyuru
 * gunluk(tur, ad, metin, hediye, id): masadaki akış; gunlukSuzSec: akışın süzgeci. Boş sıranın yazısı OYUN.yazi.bos'tan gelir.
 * Hepsi textContent ile yazılır. Sıra kutusu ve günlük olay anında değil karede bir kez güncellenir
 * (yüzlerce olay aynı anda gelse de sayfa takılmasın diye).
 */
/* ---- sahne üstü yazılar ---- */
let siraImza = '';
function siraYaz() {
  const ilk = D.sira.slice(0, 5), imza = ilk.map(k => k.id + ':' + k.jeton + ':' + k.ad).join('|');
  if (imza === siraImza)
    return;
  siraImza = imza;
  const ol = $('sira-liste');
  ol.textContent = '';
  if (!ilk.length) {
    const li = document.createElement('li');
    li.className = 'bos';
    li.textContent = OYUN.yazi.bos;
    ol.append(li);
    return;
  }
  ilk.forEach((k, i) => {
    const li = document.createElement('li');
    if (i === 0)
      li.className = 'bas';
    const no = document.createElement('span');
    no.className = 'no';
    no.textContent = i + 1;
    const ad = document.createElement('span');
    ad.className = 'ad';
    ad.textContent = k.ad;
    const jt = document.createElement('span');
    jt.className = 'jt';
    jt.textContent = k.jeton;
    li.append(no, ad, jt);
    ol.append(li);
  });
}
let bildirimSon = 0;
function bildir(ad, orta, vurgu) {
  const kutu = $('bildirim');
  if (zaman - bildirimSon < 0.12 && kutu.lastChild)
    kutu.lastChild.remove();
  bildirimSon = zaman; // aynı anda yağan hediyeler tek satırda yenilenir
  const d = document.createElement('div'), b = document.createElement('b');
  d.append(ad + ' · ' + orta);
  if (vurgu) {
    b.textContent = ' ' + vurgu;
    d.append(b);
  }
  kutu.append(d);
  while (kutu.children.length > 3)
    kutu.firstChild.remove();
  setTimeout(() => { d.classList.add('git'); setTimeout(() => d.remove(), 320); }, 2800);
}
// OYUN.sahneYazi = { pankart: 'alt' } (isteğe bağlı): pankart sıralama kutusunun üstünden değil, altından, oyuncu
// şeridinin başından geçer (sıralama ve gösterge hep okunur). Öntanım 'ust': eski yeri, sıralama kutusunun üstü.
const SAHNE_YAZI = Object.assign({ pankart: 'ust' }, OYUN.sahneYazi || {});
function pankart(b1, b2) {
  const yer = $('pankart-yeri');
  yer.textContent = '';
  const p = document.createElement('div');
  p.className = SAHNE_YAZI.pankart === 'alt' ? 'pankart alt' : 'pankart';
  const a = document.createElement('div');
  a.className = 'b1';
  a.textContent = b1;
  const b = document.createElement('div');
  b.className = 'b2';
  b.textContent = b2;
  p.append(a, b);
  yer.append(p);
  setTimeout(() => p.remove(), 3500);
}
/* ---- masadaki akış ----
 * En yenisi üstte. Fare ya da klavye odağı akıştayken (gunlukDur) satırlar kaymaz: yeni olaylar bekler, yayıncı
 * tıklamak istediği satırı kaçırmaz. Her satırın başında türünün ikonu (ikon: 60-panel.js); id verilen satırda ad bir
 * düğmedir, basınca altında "Adını gizle" ve "Sahneden çıkar" açılır (60-panel.js bunları dinler).
 * hediye isteğe bağlıdır: true satırı vurgulu yazar (oyunun kendi satırları); çekirdeğin hediye satırı
 * { jeton, ad, adet, kademe } verir: "Gül ×60 · 60 jeton · Çök". ad (hediyenin adı) yabancıdan gelir, temizlenmiş
 * gelir (hediyeKimlik) ve yalnız metin olur; adet yalnız olay taşıyorsa ve 1'den büyükse yazar; adsız hediyede
 * yalnız "60 jeton · Çök". Süzgeç (Hepsi / Hediyeler / Yorumlar) her türün son 40 satırını ayrı tutar: kalabalık
 * yayında yorumlar hediyeleri listeden itmesin. oyun gunluk(tur, ad, metin) diye de çağırabilir.
 */
const GUNLUK_SINIR = 40;
const gunlukBekleyen = [];
let gunlukDur = false, gunlukYeni = 0, gunlukSuz = 'hepsi';
const GUNLUK_TIP = { yorum: 'y', 'beğeni': 'b', takip: 't', hediye: 'h', 'paylaşım': 'p', geldi: 'g', gizlendi: 'm', 'çıkarıldı': 'm', 'geri alındı': 'm' };
const GUNLUK_IKON = { y: 'yorum', b: 'kalp', t: 'takip', h: 'hediye', p: 'paylas', g: 'kisiler', gizlendi: 'goz', 'çıkarıldı': 'cikar', 'geri alındı': 'kalkan' };
const GUNLUK_BOS = { t: 'takip etti', p: 'yayını paylaştı', g: 'yayına geldi' };
const GUNLUK_SUZ = { hepsi: () => true, hediye: li => li.classList.contains('t-h'), yorum: li => li.classList.contains('t-y') };
const gunlukKayit = { hepsi: [], hediye: [], yorum: [] };
function gunluk(tur, ad, metin, hediye, id) { gunlukBekleyen.push([tur, ad, metin, hediye, id, Date.now()]); gunlukYeni++; if (gunlukBekleyen.length > GUNLUK_SINIR)
  gunlukBekleyen.shift(); }
const ikiHane = n => (n < 10 ? '0' : '') + n;
const gunlukOge = (etiket, sinif, yazi) => { const e = document.createElement(etiket); e.className = sinif; if (yazi != null) e.textContent = yazi; return e; };
function gunlukSatir(tur, ad, metin, hediye, id, t) {
  const li = document.createElement('li'), s = new Date(t), tip = GUNLUK_TIP[tur] || (hediye ? 'h' : 'o');
  li.className = 't-' + tip;
  // türün adı ekran okuyucu için kalır; gözle ikondan okunur
  li.append(ikon(GUNLUK_IKON[tip === 'm' ? tur : tip] || 'akis'), gunlukOge('span', 'tur gorunmez', tur));
  const ic = gunlukOge('span', 'icerik'), m = gunlukOge('span', 'metin');
  ic.append(id ? gunlukOge('button', 'ad', String(ad)) : gunlukOge('span', 'ad', String(ad)), m);
  if (hediye && typeof hediye === 'object' && hediye.jeton) {
    const n = hediye.adet > 1 ? ' ×' + Math.round(hediye.adet).toLocaleString('tr-TR') : '';
    if (hediye.ad)
      m.append(hediye.ad + n + ' · ');
    m.append(gunlukOge('span', 'h-jt', Math.round(hediye.jeton).toLocaleString('tr-TR') + ' jeton'), ' · ' + (hediye.kademe || ''));
  }
  else if (tip === 'b' && /^×\d+$/.test(metin))
    m.textContent = metin.slice(1) + ' beğeni';
  else if (!metin)
    m.textContent = GUNLUK_BOS[tip] || tur;
  else
    m.textContent = (tip === 'm' || tip === 'o' ? tur + ' · ' : '') + kisalt(String(metin), 80);
  li.append(ic, gunlukOge('span', 'zm', ikiHane(s.getHours()) + ':' + ikiHane(s.getMinutes()) + ':' + ikiHane(s.getSeconds())));
  if (id) {
    li.dataset.id = id;
    const b = ic.firstChild, e = gunlukOge('div', 'eylem');
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    e.hidden = true;
    for (const [sinif, ik] of [['g-gizle', 'goz'], ['g-cikar tehlike', 'cikar']]) {
      const x = gunlukOge('button', 'mini ' + sinif);
      x.type = 'button';
      x.append(ikon(ik), document.createElement('span'));
      e.append(x);
    }
    li.append(e);
    gunlukModYaz(li);
  }
  return li;
}
// Satırın kişisi çıkarıldı mı, adı gizli mi: sınıflar ve "Adını gizle / göster" yazısı (60-panel.js modYaz da çağırır).
function gunlukModYaz(li) {
  const id = li.dataset.id;
  if (!id)
    return;
  const gizli = modKume.gizli.has(id), [g, c] = li.querySelector('.eylem').children, ad = li.querySelector('.ad').textContent;
  li.classList.toggle('gizli', gizli);
  li.classList.toggle('cikan', modKume.cikan.has(id));
  g.lastChild.textContent = gizli ? 'Adını göster' : 'Adını gizle';
  g.setAttribute('aria-label', (gizli ? 'Adını yeniden göster: ' : 'Adını gizle: ') + ad);
  c.lastChild.textContent = 'Sahneden çıkar';
  c.setAttribute('aria-label', 'Sahneden çıkar: ' + ad);
}
function gunlukYaz() {
  const dur = $('akis-dur');
  if (gunlukDur) {
    if (gunlukYeni) {
      dur.hidden = false;
      dur.textContent = 'Durdu · ' + (gunlukYeni > GUNLUK_SINIR ? GUNLUK_SINIR + '+' : gunlukYeni) + ' yeni';
    }
    return;
  }
  if (!dur.hidden)
    dur.hidden = true;
  gunlukYeni = 0;
  if (!gunlukBekleyen.length)
    return;
  const yeniler = gunlukBekleyen.map(g => gunlukSatir(...g)).reverse(); // en yenisi önde
  gunlukBekleyen.length = 0;
  for (const ad in gunlukKayit) {
    const uyan = yeniler.filter(GUNLUK_SUZ[ad]);
    if (uyan.length)
      gunlukKayit[ad] = uyan.concat(gunlukKayit[ad]).slice(0, GUNLUK_SINIR);
  }
  const gor = yeniler.filter(GUNLUK_SUZ[gunlukSuz]);
  if (!gor.length)
    return;
  const ul = $('gunluk'), parca = document.createDocumentFragment();
  parca.append(...gor);
  ul.prepend(parca);
  while (ul.children.length > GUNLUK_SINIR)
    ul.lastChild.remove();
  ul.scrollTop = 0;
}
// Süzgeci değiştirir: listeye o türün son 40 satırı konur (aynı öğeler, yeniden kurulmaz; kişilerin durumu tazelenir).
function gunlukSuzSec(ad) {
  if (!GUNLUK_SUZ[ad])
    return;
  gunlukSuz = ad;
  for (const li of gunlukKayit[ad])
    gunlukModYaz(li);
  const ul = $('gunluk');
  ul.replaceChildren(...gunlukKayit[ad]);
  ul.scrollTop = 0;
}
