/* YOUTUBE MÜZİĞİ — yayıncı Müzik bölümüne bir YouTube linki yapıştırır, "Çal"a basar; şarkı oyunun kendi müziği
 * yerine YouTube'dan çalar.
 * - Yalnız resmî YouTube IFrame Player API'si; oynatıcı youtube-nocookie.com'dan açılır. API betiği ilk "Çal"a
 *   basılınca yüklenir: basılmadıkça sayfa YouTube'a hiçbir istek göndermez (AGENTS.md değişmez 6'nın tek istisnası).
 *   İndirme, ses ayıklama, aracı hizmet yok.
 * - YouTube çalarken oyunun sesi muzik.disSustur(true) ile kısılır; durunca, hata olunca ya da "Oyunun müziğine dön"e
 *   basılınca kaldığı hâliyle geri gelir. Vuruş saati (B) hiç değişmez: dans oyunun kendi temposunda sürer, şarkıyı
 *   izlemez (bilerek: yayıncı tempo eşlemeyi istemedi).
 * - Kutunun bütün öğeleri burada, createElement / textContent ile #yt-kutu içine kurulur. #yt-kutu yoksa hiçbir şey
 *   yapılmaz. Yapıştırılan metin hiçbir zaman HTML'e ya da bir adrese girmez: linkCoz yalnız sıkı kalıplara uyan
 *   11 karakterlik video kimliğini (ve varsa liste kimliğini) çıkarır, oynatıcıya yalnız bunlar verilir.
 * - Oynatıcı çerçevesi (iframe) yerinden hiç oynatılmaz (taşınan iframe yeniden yüklenir ve şarkı kesilir). Yalnız
 *   sahne görünümünde (#yayin) panel display:none olur; çerçeve sayfada kalır, tarayıcı içindeki şarkıyı çalmayı sürdürür.
 * - Son çalışan link (yalnız doğrulanmış kimliklerden kurulan biçimi) ve YouTube ses düzeyi oyun başına saklanır
 *   (localStorage "<oyun id>-youtube"). Sayfa açılınca hiçbir şey kendiliğinden çalmaz.
 * Dışarıya: CanliOyun.youtube = { kur(kutu), linkCoz(metin), cal(link), durdur(), don(), durum() }.
 */
const YT_MUZIK = (() => {
  const API = 'https://www.youtube.com/iframe_api', OYNATICI = 'https://www.youtube-nocookie.com';
  const SAKLA_AD = String(OYUN.id || 'canli-oyun') + '-youtube';
  const KIMLIK = /^[A-Za-z0-9_-]{11}$/, LISTE = /^[A-Za-z0-9_-]{10,64}$/;
  const YAZI = {
    degil: 'Bu bir YouTube linki değil.',
    disk: 'YouTube müziği yalnız BASLAT ile açılan oyunda çalışır.',
    aciliyor: 'YouTube açılıyor…',
    caliyor: 'YouTube\'dan çalıyor. Oyunun müziği sessiz; dans oyunun kendi temposunda sürer.',
    basla: 'Şarkı kendiliğinden başlamadı. Oynatıcının ortasındaki oynat düğmesine bas.',
    durdu: 'Durdu. Oyunun müziği geri geldi.',
    bitti: 'Şarkı bitti. Oyunun müziği geri geldi.',
    don: 'Oyunun müziği çalıyor.',
    api: 'YouTube açılamadı: internet yok ya da YouTube bu bilgisayarda engelli. Oyunun müziği çalmaya devam ediyor.',
    yok: 'Bu video bulunamadı: silinmiş, gizli ya da link eksik olabilir. Başka bir link dene.',
    gomme: 'Bu video burada çalınamıyor, sahibi başka sitelerde oynatmayı kapatmış. Başka bir link dene.',
    html5: 'Bu video tarayıcıda oynatılamadı. Başka bir link dene.',
    tanima: 'YouTube bu sayfayı tanıyamadı. Oyunu BASLAT ile açıp yeniden dene.',
    uyari: 'Telifli şarkı çalarsan TikTok yayının sesini kısabilir ya da yayını kapatabilir, sorumluluk sende.'
  };
  const hataYazi = k => k === 101 || k === 150 ? YAZI.gomme : k === 2 || k === 100 ? YAZI.yok : k === 5 ? YAZI.html5 : k === 153 ? YAZI.tanima :
    'YouTube bu videoyu oynatamadı (hata ' + k + '). Başka bir link dene.';

  // Yapıştırılan metinden { video, liste } ya da null. Kabul: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/,
  // youtube.com/live/, music.youtube.com/watch?v= (www. ve m. de), başında https:// olsun olmasın, ek parametrelerle.
  // Ana bilgisayar adı birebir karşılaştırılır (youtube.com.baska.site, kullanıcı adlı, kapılı adresler geçmez).
  function linkCoz(metin) {
    let s = typeof metin === 'string' ? metin.trim() : '';
    if (!s || s.length > 400 || /[\s<>"'`\\]/.test(s))
      return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s))
      s = 'https://' + s;
    let u;
    try {
      u = new URL(s);
    }
    catch (e) {
      return null;
    }
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || u.port)
      return null;
    const h = u.hostname, yol = u.pathname;
    let video = null, m;
    if (h === 'youtu.be')
      video = (m = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(yol)) && m[1];
    else if (h === 'youtube.com' || h === 'www.youtube.com' || h === 'm.youtube.com' || h === 'music.youtube.com') {
      if (yol === '/watch' || yol === '/watch/')
        video = u.searchParams.get('v');
      else if (h !== 'music.youtube.com' && (m = /^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(yol)))
        video = m[1];
    }
    if (!video || !KIMLIK.test(video))
      return null;
    const liste = u.searchParams.get('list');
    return { video, liste: liste && LISTE.test(liste) ? liste : null };
  }
  // Saklanan ve kutuya geri yazılan biçim: yalnız doğrulanmış kimliklerden kurulur (yapıştırılan metin saklanmaz).
  const linkYaz = l => 'https://www.youtube.com/watch?v=' + l.video + (l.liste ? '&list=' + l.liste : '');

  function oku() {
    try {
      const v = JSON.parse(localStorage.getItem(SAKLA_AD) || '{}'), l = linkCoz(v && v.link);
      return { link: l ? linkYaz(l) : '', ses: Number.isFinite(+v.ses) ? clamp(Math.round(+v.ses), 0, 100) : 80 };
    }
    catch (e) {
      return { link: '', ses: 80 };
    }
  }
  function yaz(ek) {
    try {
      localStorage.setItem(SAKLA_AD, JSON.stringify(Object.assign(oku(), ek)));
    }
    catch (e) { }
  }

  let kutu = null, el = null, apiSoz = null, oyuncu = null, nesil = 0, caliyor = false, donus = 0, basla = 0;

  // API betiğini bir kez yükler. Başarısız olursa (internet yok, engelli, 15 sn'de hazır olmadı) bir sonraki "Çal"
  // yeniden dener.
  function apiYukle() {
    if (apiSoz)
      return apiSoz;
    apiSoz = new Promise((coz, red) => {
      let bitti = false;
      const s = document.createElement('script'), onceki = window.onYouTubeIframeAPIReady;
      const bitir = ok => {
        if (bitti)
          return;
        bitti = true;
        clearTimeout(sure);
        if (ok && window.YT && typeof window.YT.Player === 'function')
          coz(window.YT);
        else {
          apiSoz = null;
          s.remove();
          red(new Error('YouTube API yüklenemedi'));
        }
      };
      const sure = setTimeout(() => bitir(false), 15000);
      window.onYouTubeIframeAPIReady = () => {
        if (typeof onceki === 'function')
          try {
            onceki();
          }
          catch (e) { }
        bitir(true);
      };
      s.src = API;
      s.async = true;
      s.onerror = () => bitir(false);
      document.head.append(s);
    });
    return apiSoz;
  }

  function ileti(metin, tur) {
    if (!el)
      return;
    el.ileti.textContent = metin;
    el.ileti.dataset.tur = tur || '';
  }
  function dugmeler() {
    if (!el)
      return;
    el.durdur.disabled = !oyuncu;
    el.don.disabled = !oyuncu && !caliyor;
  }
  // Oyunun müziği geri gelir (oyunun kendi durumu hiç değişmemişti, yalnız sesi kısıktı).
  function sesGeri() {
    clearTimeout(donus);
    clearTimeout(basla);
    if (caliyor || muzik.disSessiz) {
      caliyor = false;
      muzik.disSustur(false);
    }
    dugmeler();
  }
  // Oynatıcıyı kaldırır; eski oynatıcıdan gelecek olaylar (nesil) yok sayılır.
  function kapat() {
    nesil++;
    if (oyuncu)
      try {
        oyuncu.destroy();
      }
      catch (e) { }
    oyuncu = null;
    if (el) {
      el.yer.textContent = '';
      el.yer.hidden = true;
    }
  }
  function durumDegisti(n, s, link) {
    if (n !== nesil)
      return;
    if (s === 1) {
      clearTimeout(donus);
      clearTimeout(basla);
      if (!caliyor) {
        caliyor = true;
        muzik.disSustur(true);
      }
      ileti(YAZI.caliyor, 'calis');
      yaz({ link: linkYaz(link) });
      dugmeler();
    }
    // 3: yükleniyor, ses durumu değişmez. Duraklama, bitiş, sıradaki listede videoya geçiş: kısa bir beklemeden sonra
    // (listede bir sonraki şarkı hemen başlarsa oyunun müziği araya girip çıkmasın) oyunun müziği geri gelir.
    else if (s !== 3 && caliyor) {
      clearTimeout(donus);
      donus = setTimeout(() => {
        if (n === nesil && caliyor) {
          sesGeri();
          ileti(s === 0 ? YAZI.bitti : YAZI.durdu, '');
        }
      }, 1200);
    }
  }

  async function cal(metin) {
    if (!el)
      return false;
    const link = linkCoz(metin === undefined ? el.link.value : metin);
    if (!link) {
      ileti(YAZI.degil, 'hata');
      return false;
    }
    if (location.protocol !== 'https:' && location.protocol !== 'http:') {
      ileti(YAZI.disk, 'hata');
      return false;
    }
    kapat();
    sesGeri();
    const n = nesil;
    ileti(YAZI.aciliyor, '');
    let YTg;
    try {
      YTg = await apiYukle();
    }
    catch (e) {
      if (n === nesil) {
        ileti(YAZI.api, 'hata');
        sesGeri();
      }
      return false;
    }
    if (n !== nesil || !el)
      return false;
    const yer = document.createElement('div');
    el.yer.textContent = '';
    el.yer.append(yer);
    el.yer.hidden = false;
    // Oynatıcıya yalnız doğrulanmış kimlikler ve sayfanın kendi kökeni gider.
    const pv = { playsinline: 1, rel: 0, origin: location.origin };
    if (link.liste) {
      pv.listType = 'playlist';
      pv.list = link.liste;
    }
    try {
      oyuncu = new YTg.Player(yer, {
        host: OYNATICI, width: '100%', height: '100%', videoId: link.video, playerVars: pv,
        events: {
          onReady: e => {
            if (n !== nesil)
              return;
            try {
              e.target.setVolume(+el.ses.value);
              e.target.playVideo();
            }
            catch (x) { }
            clearTimeout(basla);
            basla = setTimeout(() => { if (n === nesil && !caliyor)
              ileti(YAZI.basla, ''); }, 8000);
          },
          onStateChange: e => durumDegisti(n, e && e.data, link),
          onError: e => {
            if (n !== nesil)
              return;
            ileti(hataYazi(Number(e && e.data) | 0), 'hata');
            kapat();
            sesGeri();
          }
        }
      });
    }
    catch (e) {
      kapat();
      sesGeri();
      ileti(YAZI.api, 'hata');
      return false;
    }
    dugmeler();
    return true;
  }
  function durdur() {
    if (oyuncu)
      try {
        oyuncu.stopVideo();
      }
      catch (e) { }
    const vardi = caliyor || !!oyuncu;
    sesGeri();
    if (vardi)
      ileti(YAZI.durdu, '');
  }
  function don() {
    kapat();
    sesGeri();
    ileti(YAZI.don, '');
  }

  const yap = (tur, sinif, metin) => {
    const e = document.createElement(tur);
    if (sinif)
      e.className = sinif;
    if (metin)
      e.textContent = metin;
    return e;
  };
  // Kutuyu kurar. kutu verilmezse #yt-kutu aranır; yoksa false döner, hiçbir şey yapmaz. Aynı kutuya iki kez kurmaz.
  // Yeni masa #yt-kutu'yu sonradan eklerse CanliOyun.youtube.kur() çağırır (çalan şarkı varsa durur: çerçeve taşınamaz).
  function kur(yeni) {
    const k = yeni || document.getElementById('yt-kutu');
    if (!k || !(k instanceof HTMLElement))
      return false;
    if (k === kutu && el && k.contains(el.link))
      return true;
    if (kutu) {
      kapat();
      sesGeri();
      kutu.textContent = '';
    }
    kutu = k;
    k.textContent = '';
    k.classList.add('yt-kutu');
    const s = oku();
    const baslik = yap('span', 'etiket', 'YouTube\'dan şarkı');
    const satir = yap('div', 'yt-satir'), alan = yap('div', 'alan'), lb = yap('label', 'gorunmez', 'YouTube linki');
    const link = yap('input');
    link.type = 'text';
    link.id = 'yt-link';
    link.autocomplete = 'off';
    link.spellcheck = false;
    link.maxLength = 400;
    link.placeholder = 'youtube.com/watch?v=… ya da youtu.be/…';
    link.value = s.link;
    lb.htmlFor = 'yt-link';
    alan.append(lb, link);
    const calD = yap('button', 'dugme ana', 'Çal'), durD = yap('button', 'dugme', 'Durdur');
    calD.type = durD.type = 'button';
    calD.id = 'yt-cal';
    durD.id = 'yt-durdur';
    satir.append(alan, calD, durD);
    const sesS = yap('div', 'yt-satir yt-ses-satir'), sesL = yap('label', '', 'YouTube sesi'), ses = yap('input');
    ses.type = 'range';
    ses.id = 'yt-ses';
    ses.min = '0';
    ses.max = '100';
    ses.value = String(s.ses);
    sesL.htmlFor = 'yt-ses';
    sesS.append(sesL, ses);
    const yer = yap('div', 'yt-oynatici');
    yer.id = 'yt-oynatici-yer';
    yer.hidden = true;
    const il = yap('p', 'yt-ileti');
    il.id = 'yt-ileti';
    il.setAttribute('role', 'status');
    il.setAttribute('aria-live', 'polite');
    const donD = yap('button', 'dugme', 'Oyunun müziğine dön');
    donD.type = 'button';
    donD.id = 'yt-don';
    const uy = yap('p', 'aciklama yt-uyari', YAZI.uyari);
    uy.id = 'yt-uyari';
    const donS = yap('div', 'yt-satir');
    donS.append(donD);
    k.append(baslik, satir, sesS, yer, il, donS, uy);
    el = { link, cal: calD, durdur: durD, ses, yer, ileti: il, don: donD };
    calD.onclick = () => { cal(); };
    durD.onclick = durdur;
    donD.onclick = don;
    link.onkeydown = e => { if (e.key === 'Enter') {
      e.preventDefault();
      cal();
    } };
    ses.oninput = () => {
      const v = clamp(Math.round(+ses.value) || 0, 0, 100);
      if (oyuncu)
        try {
          oyuncu.setVolume(v);
        }
        catch (e) { }
      yaz({ ses: v });
    };
    dugmeler();
    return true;
  }
  const durum = () => ({ kutu: !!(kutu && kutu.isConnected), caliyor, oynatici: !!oyuncu, ileti: el ? el.ileti.textContent : '' });

  const arayuz = { kur, linkCoz, cal, durdur, don, durum };
  // Sayfanın bütün parçaları çalıştıktan sonra: window.CanliOyun (60-panel.js) o zaman vardır.
  queueMicrotask(() => {
    if (window.CanliOyun)
      window.CanliOyun.youtube = arayuz;
    if (!kur())
      addEventListener('load', () => kur(), { once: true });
  });
  return arayuz;
})();
