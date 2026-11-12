/* GERÇEK YAYIN BAĞLANTISI — köprü programına WebSocket ile bağlanır, iletileri olay(o)'ya çevirir.
 * KOPRU: sayfayı köprü açtıysa dolu gelir (kopru.js sayfaya window.OYUN_KOPRU yazar)
 * Yayin.cevir: dış ileti → oyun olayı · Yayin.baglan / kes · kopunca 3 sn'de bir yeniden dener
 * siraSakla / siraOku: jeton sıralamasını tarayıcıda 3 saat saklar · ayarOku / ayarYaz: balon, süzgeç ve
 * yayıncının çıkardığı / adını gizlediği izleyiciler
 * Bu dosya TikTok'a doğrudan bağlanmaz ve hiçbir kimlik bilgisi tutmaz.
 * kopruBaglanti: köprünün durum iletisindeki "baglanti" alanı (deneme · baglaniyor · bekliyor · bagli · durdu · hata);
 * masadaki Bağlantı hücresi bunu gösterir. Alanı yollamayan eski köprülerde null kalır, hücre eskisi gibi davranır.
 */
const KOPRU = typeof window.OYUN_KOPRU === 'string' ? window.OYUN_KOPRU : null; // sayfayı köprü programı açtıysa dolu gelir
const KOPRU_BAGLANTI = ['deneme', 'baglaniyor', 'bekliyor', 'bagli', 'durdu', 'hata'];
const Yayin = {
  ws: null, alinan: 0, yeniden: null, kopruBaglanti: null, bitti: false,
  cevir(m) {
    if (!m || typeof m !== 'object')
      return null;
    if (m.tip === 'hediye' && m.hediye !== undefined) {
      // Oyunun kendi biçimi, hediye kimliğiyle: kimlik denetlenip geçer, bozuksa düşer (olay yine sayılır).
      const o = Object.assign({}, m), hd = hediyeKimlik(m.hediye);
      if (hd)
        o.hediye = hd;
      else
        delete o.hediye;
      return o;
    }
    if (m.tip)
      return m; // oyunun kendi biçimi
    const e = String(m.event || m.type || '').toLowerCase(), d = m.data && typeof m.data === 'object' ? m.data : m, u = d.user && typeof d.user === 'object' ? d.user : d;
    const kullanici = { id: u.uniqueId || u.userId || u.id || u.nickname, ad: u.nickname || u.uniqueId || u.displayName };
    if (!kullanici.id)
      return null;
    if (e === 'chat' || e === 'comment')
      return { tip: 'yorum', kullanici, metin: d.comment || d.message || d.text || '' };
    if (e === 'like')
      return { tip: 'begeni', kullanici, adet: d.likeCount || d.count || 1 };
    if (e === 'follow')
      return { tip: 'takip', kullanici };
    if (e === 'share')
      return { tip: 'paylasim', kullanici };
    if (e === 'member' || e === 'join')
      return { tip: 'katilim', kullanici };
    if (e === 'social') {
      const t = String(d.displayType || d.label || '');
      return t.includes('follow') ? { tip: 'takip', kullanici } : t.includes('share') ? { tip: 'paylasim', kullanici } : null;
    }
    if (e === 'gift') {
      const g = (d.giftDetails && typeof d.giftDetails === 'object' && d.giftDetails) || (d.gift && typeof d.gift === 'object' && d.gift) || d;
      const tur = d.giftType ?? g.giftType ?? g.type, bitti = d.repeatEnd ?? d.repeat_end;
      if (+tur === 1 && bitti !== undefined && !+bitti)
        return null; // seri sürüyor, bitince sayılır
      const o = { tip: 'hediye', kullanici, jeton: +(d.diamondCount ?? g.diamondCount ?? g.diamond_count ?? d.coins) || 1, adet: +(d.repeatCount ?? d.repeat_count ?? d.count) || 1 };
      // Hediyenin kimliği: kütüphanenin üç biçimi (düz giftId/giftName, giftDetails.id/giftName, gift.id/name) ya da
      // hazır { hediye }. Ayrıntı nesnesi yoksa g === d olur; d.id / d.name kullanıcıya ait olabilir, bakılmaz.
      const gd = g !== d ? g : {}, dolu = (...a) => a.find(v => v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0');
      const hd = hediyeKimlik(d.hediye) || hediyeKimlik({ id: dolu(d.giftId, gd.id, gd.gift_id), ad: dolu(d.giftName, gd.giftName, gd.name) });
      if (hd)
        o.hediye = hd;
      return o;
    }
    return null;
  },
  baglan(adres) {
    const sur = this.surekli;
    this.kes();
    this.surekli = sur;
    this.bitti = false;
    adres = String(adres || '').trim();
    if (!/^wss?:\/\//i.test(adres)) {
      bagDurum('hata', 'Adres ws:// ya da wss:// ile başlamalı.');
      return;
    }
    let ws;
    try {
      ws = new WebSocket(adres);
    }
    catch (e) {
      bagDurum('hata', 'Bu adres açılamadı.');
      return;
    }
    this.ws = ws;
    bagDurum('', 'Bağlanıyor…');
    ws.onopen = () => { bagDurum('acik', 'Köprüye bağlandı. Sahte izleyiciyi kapattım.'); otoAyarla(false); };
    ws.onmessage = ev => { let m; try {
      m = JSON.parse(ev.data);
    }
    catch (e) {
      return;
    } for (const tek of Array.isArray(m) ? m : [m]) {
      if (tek && tek.tip === 'kopru') {
        if (KOPRU_BAGLANTI.includes(tek.baglanti))
          this.kopruBaglanti = tek.baglanti;
        // Köprü bu başlatmanın bittiğini söyledi (oyun durduruldu ya da yerine başkası açıldı): yeniden denenmez.
        if (tek.baglanti === 'durdu') {
          this.bitti = true;
          this.surekli = false;
          clearTimeout(this.yeniden);
          try {
            dispatchEvent(new Event('kopru-durdu')); // köprünün bekçisi (varsa) beklemeden örtüyü gösterir
          }
          catch (e) { }
        }
        bagDurum('acik', tek.ileti || '');
        continue;
      }
      const o = this.cevir(tek);
      if (o) {
        this.alinan++;
        olay(o);
      }
    } };
    ws.onerror = () => { if (this.ws === ws && !this.surekli && !this.bitti)
      bagDurum('hata', 'Bağlanılamadı. Köprü programı çalışıyor mu? Adres alanına köprünün penceresinde yazan tam olay adresini yaz (ws://127.0.0.1:8787/olay/… gibi). Bu sayfayı Claude içinde açtıysan dış bağlantı kapalıdır; indirdiğin dosyadan dene.'); };
    ws.onclose = () => {
      if (this.ws !== ws)
        return;
      this.ws = null;
      $('bag-dugme').textContent = 'Bağlan';
      if (this.bitti) {
        this.kopruBaglanti = 'durdu';
        bagDurum('durdu', $('bag-ileti').textContent);
        return;
      }
      this.kopruBaglanti = null;
      if (this.surekli) {
        bagDurum('hata', 'Köprüyle bağlantı koptu. 3 saniyede bir yeniden deniyorum.');
        clearTimeout(this.yeniden);
        this.yeniden = setTimeout(() => { if (this.surekli && !this.ws)
          adresTazele(adres).then(a => {
            if (a !== adres && $('bag-adres').value === adres)
              $('bag-adres').value = a; // Yayın sekmesindeki adres de yeni kimliği göstersin
            if (this.surekli && !this.ws)
              this.baglan(a);
          }); }, 3000);
      }
      else if (!$('bag-rozet').classList.contains('hata'))
        bagDurum('', 'Bağlantı kapandı.');
    };
    $('bag-dugme').textContent = 'Bağlantıyı kes';
  },
  // Sayfanın başlatması bitti (köprünün bekçisi örtüyü gösterdi): yeniden denemeyi bırakır, rozet ve hücre "Durdu" der.
  bitir(ileti) {
    this.bitti = true;
    this.kes();
    this.kopruBaglanti = 'durdu';
    bagDurum('durdu', ileti || 'Bu sayfanın oyunu kapandı.');
  },
  kes() { this.surekli = false; clearTimeout(this.yeniden); if (this.ws) {
    const w = this.ws;
    this.ws = null;
    try {
      w.close();
    }
    catch (e) { }
  } $('bag-dugme').textContent = 'Bağlan'; }
};
// Komut satırı köprüsü her açılışta olay adresine yeni bir kimlik verir (/olay/<kimlik>). Köprü kapanıp yeniden açılınca
// eski kimlik 403 alır; köprünün açtığı sayfa yeniden denemeden önce yeni adresi kendi sayfasından okur (aynı köken; başka
// bir site bu sayfayı okuyamaz). Elle girilen adres ve ana sayfa kipinin adresi (/olay/<oyun>/<başlatma>) olduğu gibi kalır.
function adresTazele(adres) {
  if (!KOPRU || !/^https?:$/.test(location.protocol) || !/\/olay(\/[0-9a-f]{24})?$/.test(adres))
    return Promise.resolve(adres);
  return fetch(location.pathname, { cache: 'no-store' }).then(r => r.text()).then(t => {
    const m = /"(\/olay(?:\/[0-9a-f]{24})?)";/.exec(t);
    return m ? adres.replace(/\/olay(\/[0-9a-f]{24})?$/, m[1]) : adres;
  }).catch(() => adres);
}
// Tarayıcı saklama anahtarları oyunun kimliğiyle başlar: iki oyun aynı tarayıcıda birbirinin sırasını görmez.
const SAKLA = String(OYUN.id || 'canli-oyun') + '-sira', AYAR_SAKLA = String(OYUN.id || 'canli-oyun') + '-ayar';
function siraSakla() { if (!KOPRU)
  return; try {
  localStorage.setItem(SAKLA, JSON.stringify({ t: Date.now(), oyuncular: D.sira.filter(k => k.jeton > 0).slice(0, 60).map(k => ({ id: k.id, ad: k.ad, jeton: k.jeton })) }));
}
catch (e) { } }
function siraOku() { try {
  const v = JSON.parse(localStorage.getItem(SAKLA) || 'null');
  return v && Date.now() - v.t < 3 * 3600e3 && Array.isArray(v.oyuncular) ? v.oyuncular : null;
}
catch (e) {
  return null;
} }
// Saklanan çıkarılan / gizlenen kaydı: yalnız { id, ad } metinleri, en çok 300 kişi.
const modKayit = a => Array.isArray(a) ? a.filter(x => x && typeof x.id === 'string' && x.id).slice(-300).map(x => ({ id: x.id.slice(0, 64), ad: String(x.ad || x.id).slice(0, 64) })) : [];
function ayarOku() { try {
  const v = JSON.parse(localStorage.getItem(AYAR_SAKLA) || 'null');
  if (v) {
    ayar.balon = v.balon !== false;
    ayar.yasak = Array.isArray(v.yasak) ? v.yasak.filter(x => typeof x === 'string' && x) : [];
    ayar.gizli = modKayit(v.gizli);
    ayar.cikan = modKayit(v.cikan);
  }
}
catch (e) { } modKur(); }
function ayarYaz() { try {
  localStorage.setItem(AYAR_SAKLA, JSON.stringify(ayar));
}
catch (e) { } }
// Rozet köprüye bağlı olunca da TikTok'un durumunu söyler (köprü bildirdiyse): "Bağlı" yalnız yayından olay gelirken.
const ROZET_YAZI = { deneme: 'Deneme', baglaniyor: 'Bağlanıyor', bekliyor: 'Yayın bekleniyor', bagli: 'Bağlı', durdu: 'Durdu', hata: 'TikTok bağlı değil' };
function bagDurum(sinif, ileti) { const r = $('bag-rozet'); r.className = 'rozet' + (sinif ? ' ' + sinif : ''); r.textContent = sinif === 'durdu' ? 'Durdu' : sinif === 'acik' ? (ROZET_YAZI[Yayin.kopruBaglanti] || 'Bağlı') : sinif === 'hata' ? 'Bağlanamadı' : 'Bağlı değil'; $('bag-ileti').textContent = ileti || ''; }
