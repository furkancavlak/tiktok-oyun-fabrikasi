# Olaylar ve dış arayüz

Oyuna dışarıdan gelen her şey tek bir işlevden girer: `olay(o)`. Sahte izleyici, köprü ve testler aynı
işlevi çağırır. Sayfada `window.CanliOyun.olay(o)` olarak erişilir. Aşağıdaki etkiler ve kademeler halay oyununa aittir; başka oyunlar kendi kademelerini `OYUN.kademe` ile tanımlar (bkz. KANCALAR.md).

## Oyunun kendi olay biçimi

```js
{ tip: 'yorum',    kullanici: { id: 'ayse', ad: 'Ayşe' }, metin: 'halay!' }
{ tip: 'begeni',   kullanici: { id: 'ayse', ad: 'Ayşe' }, adet: 15 }
{ tip: 'hediye',   kullanici: { id: 'ayse', ad: 'Ayşe' }, jeton: 5, adet: 3 }   // 15 jeton sayılır
{ tip: 'takip',    kullanici: { id: 'ayse', ad: 'Ayşe' } }
{ tip: 'paylasim', kullanici: { id: 'ayse', ad: 'Ayşe' } }
{ tip: 'katilim',  kullanici: { id: 'ayse', ad: 'Ayşe' } }                      // yalnız günlüğe yazılır
```

| Alan | Açıklama |
| --- | --- |
| `kullanici.id` | Kişiyi ayırt eden değer (TikTok `uniqueId`). Zorunlu; yoksa olay yok sayılır. En çok 64 karakter. |
| `kullanici.ad` | Sahnede görünen ad. Yoksa `id` kullanılır. 18 karaktere kısaltılır. |
| `metin` | Yorum. Balonda 30 karaktere kısaltılır; bağlantı ve uzun rakam dizileri gizlenir. |
| `jeton` | Tek hediyenin jeton değeri. Sayı değilse ya da 1'den küçükse 1 sayılır. |
| `adet` | Hediye adedi (seri). Belirtilmezse 1. |

Her olayın etkisi:

| `tip` | Etki |
| --- | --- |
| `yorum` | Kişi halayda değilse girer. Yorum balon olur. |
| `begeni` | Coşku artar (`adet` × 0,006, en çok 1). Halaya sokmaz. |
| `takip` | Kişi halaya girer, bildirim çıkar. |
| `paylasim` | Coşku biraz artar. |
| `hediye` | Kişi girer (yer doluysa jetonu en az olanı yerinden eder), `jeton × adet` puan alır, sıra yeniden dizilir, kademesine göre hareket tetiklenir. |

Halaydaki hediye kademeleri (`KADEME`, toplam jetona göre): 1+ zıpla · 10+ omuz · 50+ çök · 200+ davulcu coşar ·
1000+ gönderen tek başına oynar.

## Köprüden kabul edilen ileti biçimleri

Oyun köprüye WebSocket ile bağlanır ve her iletiyi JSON olarak okur (tek nesne ya da dizi).
`CanliOyun.cevir` şu biçimleri oyun olayına çevirir:

```js
// 1. Oyunun kendi biçimi: olduğu gibi geçer (depodaki kopru.js bunu yollar)
{ "tip": "hediye", "kullanici": { "id": "ayse", "ad": "Ayşe" }, "jeton": 5, "adet": 3 }

// 2. { event, data } zarfı, düz alanlar
{ "event": "chat", "data": { "uniqueId": "ayse", "nickname": "Ayşe", "comment": "halay!" } }
{ "event": "gift", "data": { "uniqueId": "ayse", "diamondCount": 5, "repeatCount": 3, "giftType": 1, "repeatEnd": true } }
{ "event": "like", "data": { "uniqueId": "ayse", "likeCount": 15 } }
{ "event": "follow", "data": { "uniqueId": "ayse" } }

// 3. { event, data } zarfı, iç içe kullanıcı ve hediye ayrıntısı
{ "event": "gift", "data": { "user": { "uniqueId": "ayse", "nickname": "Ayşe" },
                             "giftDetails": { "diamondCount": 5, "giftType": 1 }, "repeatCount": 3, "repeatEnd": 1 } }
```

**Seri hediyeler.** `giftType` 1 olan hediyelerde izleyici her tıkladığında bir ileti gelir ve
`repeatCount` artar. Oyun yalnız seri bittiğinde (`repeatEnd` doğru / 1) sayar; yoksa aynı hediye defalarca
sayılır. `repeatEnd` alanı hiç yoksa ileti tek seferlik kabul edilir.

Köprü ayrıca durum iletisi yollar; oyun bunu panelde gösterir, olay saymaz:

```js
{ "tip": "kopru", "ileti": "@ayse yayınına bağlandı. Yorum ve hediyeler oyuna akıyor.", "baglanti": "bagli" }
```

`baglanti` alanı masadaki **Bağlantı** hücresini ve Yayın sekmesindeki rozeti belirler:

| `baglanti` | Hücre | Ne demek |
| --- | --- | --- |
| `bagli` | **Canlı** (yanında alınan olay sayısı) | TikTok yayınına bağlanıldı, yorum ve hediyeler akıyor. |
| `bekliyor` | **Yayın yok** (alt satır: yayın henüz açık değil; rozet: Yayın bekleniyor) | TikTok'ta yayın henüz açık değil; köprü kendisi yeniden dener. |
| `baglaniyor` | **Bağlanıyor** | TikTok'a bağlanılıyor. |
| `deneme` | **Deneme** | Köprü sahte izleyici yolluyor; TikTok'a bağlanılmadı. |
| `durdu` | **Durdu** | Oyun ana sayfadan durduruldu. |
| `hata` | **Bağlanamadı** | Kütüphane yok ya da bağlantı kurulamadı; ayrıntı Yayın sekmesinde. |

`baglanti` alanı olmayan iletiler (eski köprüler) yeni sayfada eskisi gibi çalışır: köprüye bağlı olmak **Canlı**
sayılır. Yeni köprüyle eski sayfa da çalışır; eski sayfa alanı yok sayar.

## `window.CanliOyun`

| Üye | Açıklama |
| --- | --- |
| `olay(o)` | Bir olayı işler. |
| `baglan(adres)` / `kes()` | Köprüye bağlanır / bağlantıyı keser. |
| `cevir(ileti)` | Dış iletiyi oyun olayına çevirir (işlemez); tanımazsa `null`. |
| `durum()` | Çekirdeğin alanları (kişi sayısı, lider, coşku, vuruş, sıra, bağlantı durumu vb.) ve oyunun `oyunDurum(d)` kancasıyla eklediği alanlar. Tam liste için `cekirdek/js` altındaki `durum` işlevine bak. |
| `_test` | Testler için iç durum (`D`, `muzik`, `Muzik`, `HAVALAR`, `ayar`, `zamanEkle`). Kararlı arayüz değildir. |

## Köprünün adresleri

Köprü yalnız `127.0.0.1` dinler ve her kipte her isteğin `Host` başlığına bakar: yalnız `127.0.0.1:<kapı>` ya da
`localhost:<kapı>`. Başka bir ad taşıyan istek (DNS yeniden bağlama) 403 alır.

| Adres | Yanıt |
| --- | --- |
| `GET /` | Oyun. Köprü sayfaya `window.OYUN_KOPRU` yazar; oyun bunu görünce kendiliğinden bağlanır. |
| `GET /#yayin` | Yalnız sahne (panel gizli). |
| `GET /durum` | `{ durum, bagliSayfa, sayac }` JSON. |
| `GET /muzik/<dosya>` | Oyunun isteğe bağlı hazır parçaları. `liste.js` yoksa boş bir betik döner (konsola 404 düşmesin). |
| WebSocket | Olay akışı. Köprü yalnız yollar; istemciden veri beklemez. Kaynak (`Origin`) köprünün kendi adresi olmalı; bu kiplerde ayrıca kaynak bildirmeyen istemci ve diskten açılmış oyun sayfası (`null` ya da `file:`) kabul edilir, çünkü orada `oyun.html` dosyadan açılıp elle bağlanabilir. Başka bir sitenin kaynağı geri çevrilir. |

Ana sayfa kipinde (`node kopru.js --ana-sayfa`, `BASLAT.bat` böyle açar) adresler başkadır:

| Adres | Yanıt |
| --- | --- |
| `GET /` | Ana sayfa (`cekirdek/ana-sayfa.html`; pakette köprünün yanında). Açılışta yükleme sahnesi. |
| `GET /api/oyunlar` | `{ anaSayfa, paket, oyunlar: [{ id, ad, aciklama }], aktif: { oyun, ad, kip, kullanici, calistirma, baglanti } \| null, durum, kutuphane: { durum: "hazir" \| "iniyor" \| "hata", sure, neden } }`. |
| `GET /durum` | `{ durum, bagliSayfa, sayac, aktif }` JSON. |
| `POST /api/baslat` | Gövde `{ oyun, kip: "deneme" \| "canli", kullanici }`. Çalışanı durdurur, seçileni yeni bir başlatma kimliğiyle (`calistirma`) başlatır; eski başlatmanın soketleri kapatılır. Aynı oyun aynı kipte ve aynı adla yeniden istenirse bağlantı koparılmaz; TikTok'a henüz bağlı değilse hemen yeniden denenir. Yanıt `{ tamam, adres }` ya da `{ tamam: false, hata, alan }`. Kütüphane inmeden canlı istenirse 409 (`alan: "kutuphane"`). Kullanıcı adı: harf, rakam, `_`, `.`; 2-24 karakter; noktayla bitmez. |
| `POST /api/durdur` | Gövde `{}`. Çalışan oyunun sahte olaylarını ya da TikTok bağlantısını kapatır; motor boşta bekler. |
| `POST /api/kutuphane` | Gövde `{}`. İndirme başarısız olduysa yeniden dener. |
| `GET /oyun/<id>/` | Çalışan oyunun sayfası, köprüye bağlı (`/olay/<id>/<calistirma>`), masada "← Oyunlar" bağlantısı ve başlatma bekçisi: aynı oyun yeniden başlatılınca sayfa kendini yeniler; başka oyun açılır ya da oyun durdurulursa "Bu oyun artık çalışmıyor" örtüsü gösterir. Çalışmayan oyun için ana sayfaya yönlendirir. |
| `GET /oyun/<id>/muzik/<dosya>` | O oyunun isteğe bağlı hazır parçaları (`liste.js` yoksa boş betik). |
| `GET /onizleme/<id>/` | Aynı oyun köprüsüz ve sessiz; ana sayfadaki kabinin önizlemesi (`#yayin` ile). |
| WebSocket `/olay/<id>/<calistirma>` | Yalnız çalışan başlatmanın olayları. Kaynak yalnız köprünün kendi sayfası; başka yol, başka kaynak, kaynaksız istemci ve eski başlatmanın kimliği geri çevrilir. |

POST istekleri yalnız köprünün kendi sayfasından kabul edilir (`Host`, `Origin`, varsa `Sec-Fetch-Site`, JSON gövde,
en çok 4 KB).
