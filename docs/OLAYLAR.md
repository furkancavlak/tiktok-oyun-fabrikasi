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
{ "tip": "kopru", "ileti": "@ayse yayınına bağlandı. Yorum ve hediyeler oyuna akıyor." }
```

## `window.CanliOyun`

| Üye | Açıklama |
| --- | --- |
| `olay(o)` | Bir olayı işler. |
| `baglan(adres)` / `kes()` | Köprüye bağlanır / bağlantıyı keser. |
| `cevir(ileti)` | Dış iletiyi oyun olayına çevirir (işlemez); tanımazsa `null`. |
| `durum()` | Çekirdeğin alanları (kişi sayısı, lider, coşku, vuruş, sıra, bağlantı durumu vb.) ve oyunun `oyunDurum(d)` kancasıyla eklediği alanlar. Tam liste için `cekirdek/js` altındaki `durum` işlevine bak. |
| `_test` | Testler için iç durum (`D`, `muzik`, `Muzik`, `HAVALAR`, `ayar`, `zamanEkle`). Kararlı arayüz değildir. |

## Köprünün adresleri

| Adres | Yanıt |
| --- | --- |
| `GET /` | Oyun. Köprü sayfaya `window.OYUN_KOPRU` yazar; oyun bunu görünce kendiliğinden bağlanır. |
| `GET /#yayin` | Yalnız sahne (panel gizli). |
| `GET /durum` | `{ durum, bagliSayfa, sayac }` JSON. |
| WebSocket (herhangi bir yol) | Olay akışı. Köprü yalnız yollar; istemciden veri beklemez. |

Ana sayfa kipinde (`node kopru.js --ana-sayfa`, `BASLAT.bat` böyle açar) adresler başkadır:

| Adres | Yanıt |
| --- | --- |
| `GET /` | Ana sayfa (`cekirdek/ana-sayfa.html`; pakette köprünün yanında). |
| `GET /api/oyunlar` | `{ anaSayfa, paket, oyunlar: [{ id, ad, aciklama }], aktif: { oyun, ad, kip, kullanici } \| null, durum }`. |
| `POST /api/baslat` | Gövde `{ oyun, kip: "deneme" \| "canli", kullanici }`. Çalışanı durdurur, seçileni başlatır; yanıt `{ tamam, adres }` ya da `{ tamam: false, hata }`. Yalnız köprünün kendi sayfasından kabul edilir (Host, Origin, JSON gövde). Kullanıcı adı: harf, rakam, `_`, `.`; 2-24 karakter. |
| `GET /oyun/<id>/` | Çalışan oyunun sayfası, köprüye bağlı (`/olay/<id>`), masada "← Oyunlar" bağlantısı. Çalışmayan oyun için ana sayfaya yönlendirir. |
| `GET /oyun/<id>/muzik/<dosya>` | O oyunun isteğe bağlı hazır parçaları. |
| `GET /onizleme/<id>/` | Aynı oyun köprüsüz ve sessiz; ana sayfadaki kartın önizlemesi (`#yayin` ile). |
| WebSocket `/olay/<id>` | O oyunun olayları; başka oyun çalışırken olay gelmez. |
