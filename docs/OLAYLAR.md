# Olaylar ve dış arayüz

Oyuna dışarıdan gelen her şey tek bir işlevden girer: `olay(o)`. Sahte izleyici, köprü ve testler aynı
işlevi çağırır. Sayfada `window.CanliOyun.olay(o)` olarak erişilir. Aşağıdaki etkiler ve kademeler halay oyununa aittir; başka oyunlar kendi kademelerini `OYUN.kademe` ile tanımlar (bkz. KANCALAR.md).

## Oyunun kendi olay biçimi

```js
{ tip: 'yorum',    kullanici: { id: 'ayse', ad: 'Ayşe' }, metin: 'halay!' }
{ tip: 'begeni',   kullanici: { id: 'ayse', ad: 'Ayşe' }, adet: 15 }
{ tip: 'hediye',   kullanici: { id: 'ayse', ad: 'Ayşe' }, jeton: 5, adet: 3 }   // 15 jeton sayılır
{ tip: 'hediye',   kullanici: { id: 'ayse', ad: 'Ayşe' }, jeton: 1, adet: 3, hediye: { id: '5655', ad: 'Rose' } }  // hangi hediye
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
| `hediye` | İsteğe bağlı: hangi hediye. `{ id, ad }`; ikisi de yoksa alan hiç olmaz. Olmasa da hediye eskisi gibi sayılır. |
| `hediye.id` | Platformun hediye numarası, metin olarak (`'5655'`). En çok 32 karakter. Sayı gelirse metne çevrilir. Boş metin ve 0 "yok" sayılır. |
| `hediye.ad` | Hediyenin adı, düz metin. Denetim karakterleri atılır, kırpılır, 40 karaktere kısaltılır. Yabancıdan gelir: izleyici adı gibi **asla HTML olarak yazılmaz** (sayfaya `textContent`, tuvale `fillText`). |

Hediye kimliği oyuna `oyunHediye(k, jeton, kademe, hediye)` kancasının dördüncü bilgisi olarak gelir (bkz.
KANCALAR.md); bilinmiyorsa `null`. Paneldeki olay akışında jetonun yanında hediyenin adı yazılır
(`15 jeton · Rose → Zıpla`). Deneme yolları sahte, `deneme-` önekli kimlikler yollar (gerçek numarayla karışmasın):
`{ id: 'deneme-gul', ad: 'Gül' }`, `{ id: 'deneme-kalp', ad: 'Kalp' }`, `{ id: 'deneme-yildiz', ad: 'Yıldız' }`.
Köprünün deneme kipi bunları sırayla yollar; paneldeki Deneme düğmelerinin en küçük kademesi Gül, sonrakiler Kalp ve
Yıldız (sonra yine baştan). Gerçek yayında hangi numaraların ve adların geldiği (ad yerel dilde mi gelir) bu depoda
denenmedi; oyunun kuralını kurmadan önce gerçek yayında panelin olay akışına bak.

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

Hediye kimliği her biçimde şuradan okunur (`CanliOyun.cevir` ve köprünün `cevir`'i aynı alanlara bakar):

```js
// 1. Oyunun kendi biçimi: hediye alanı denetlenip geçer (bozuksa düşer, hediye yine sayılır)
{ "tip": "hediye", "kullanici": { "id": "ayse" }, "jeton": 1, "adet": 3, "hediye": { "id": "5655", "ad": "Rose" } }

// 2. Düz alanlar (tiktok-live-connector 1.x, WebcastPushConnection): giftId, giftName
{ "event": "gift", "data": { "uniqueId": "ayse", "giftId": 5655, "giftName": "Rose", "diamondCount": 1, "repeatCount": 3,
                             "giftType": 1, "repeatEnd": true } }

// 3a. İç içe, giftDetails (2.0–2.4, TikTokLiveConnection): giftId ya da giftDetails.id, giftDetails.giftName
{ "event": "gift", "data": { "user": { "uniqueId": "ayse" }, "giftId": 5655,
                             "giftDetails": { "id": "5655", "giftName": "Rose", "diamondCount": 1, "giftType": 1 }, "repeatCount": 3, "repeatEnd": 1 } }

// 3b. İç içe, gift (2.5, TikTokLiveConnection): giftId ya da gift.id, gift.name
{ "event": "gift", "data": { "user": { "uniqueId": "ayse" }, "giftId": "5655",
                             "gift": { "id": "5655", "name": "Rose", "diamondCount": 1, "type": 1 }, "repeatCount": 3, "repeatEnd": 1 } }

// Hepsi şuna çevrilir:
{ "tip": "hediye", "kullanici": { "id": "ayse", "ad": "ayse" }, "jeton": 1, "adet": 3, "hediye": { "id": "5655", "ad": "Rose" } }
```

Sıra: kimlik için `giftId` → `giftDetails.id` / `gift.id` → `gift.gift_id`; ad için `giftName` → `giftDetails.giftName` →
`gift.name`. Ayrıntı nesnesi yoksa düz verideki `id` ve `name` alanlarına bakılmaz (kullanıcıya ait olabilir).
Kimlik de ad da yoksa olayda `hediye` alanı olmaz. Seri kuralı değişmez: seri sürerken gelen ileti kimliğiyle
birlikte yok sayılır, seri bitince bir kez sayılır. Eski köprü alanı yollamaz (oyun eskisi gibi çalışır, kanca
`null` alır); yeni köprüyle eski sayfa da çalışır, eski sayfa alanı yok sayar.

**Seri hediyeler.** `giftType` 1 olan hediyelerde izleyici her tıkladığında bir ileti gelir ve
`repeatCount` artar. Oyun yalnız seri bittiğinde (`repeatEnd` doğru / 1) sayar; yoksa aynı hediye defalarca
sayılır. `repeatEnd` alanı hiç yoksa ileti tek seferlik kabul edilir.

Köprü ayrıca durum iletisi yollar; oyun bunu panelde gösterir, olay saymaz:

```js
{ "tip": "kopru", "ileti": "@ayse yayınına bağlandı. Yorum ve hediyeler oyuna akıyor.", "baglanti": "bagli" }
```

`baglanti` alanı masanın üstündeki durum göstergesini (ve Gelişmiş'teki köprü rozetini) belirler:

| `baglanti` | Gösterge | Ne demek |
| --- | --- | --- |
| `bagli` | **Canlı** (yanında yayının hesabı) | TikTok yayınına bağlanıldı, yorum ve hediyeler akıyor. |
| `bekliyor` | **Yayın bekleniyor** (yayın henüz açık değil; altında köprünün cümlesi) | TikTok'ta yayın henüz açık değil; köprü kendisi yeniden dener. |
| `baglaniyor` | **Bağlanıyor** | TikTok'a bağlanılıyor. |
| `deneme` | **Deneme** | Köprü sahte izleyici yolluyor; TikTok'a bağlanılmadı. |
| `durdu` | **Durdu** | Oyun ana sayfadan durduruldu. |
| `hata` | **Bağlanamadı** | Kütüphane yok ya da bağlantı kurulamadı; köprünün cümlesi göstergenin altında yazar. |

`baglanti` alanı olmayan iletiler (eski köprüler) yeni sayfada da işlenir; gösterge köprüye bağlıyken **Bağlı**
der, **Canlı** demez (köprü TikTok'a bağlandığını söylemedi). Yeni köprüyle eski sayfa da çalışır; eski sayfa alanı yok sayar.

### Sayfanın kipi: `<html data-kip>`

Köprü bir oyun sayfasını sunarken (`GET /` ve ana sayfa kipinde `/oyun/<ad>/`) sayfanın başına, `window.OYUN_KOPRU`'yu
yazdığı betiğe `document.documentElement.setAttribute("data-kip", "deneme" | "canli")` ekler: `--deneme` ya da ana
sayfadaki **Dene** ile başlatılmışsa `deneme`, TikTok yayınına bağlanacaksa `canli`. Değer köprünün seçtiği bu iki
sabit kelimeden biridir; istekten gelen hiçbir şey yazılmaz. Masa bunu ilk karesinde okur: `canli`da deneme
izleyicisi kartı hiç görünmez (köprünün ilk durum iletisi gelmeden önce de), `deneme`de canlı düzen hiç görünmez.
Diskten açılan sayfada öznitelik yoktur; sayfa deneme kipindedir. Bu alanı yazmayan eski köprüde sayfa eskisi gibi
köprüden açıldığı için canlı kipte başlar, köprünün durum iletisi gelince düzelir.

## `window.CanliOyun`

| Üye | Açıklama |
| --- | --- |
| `olay(o)` | Bir olayı işler. |
| `baglan(adres)` / `kes()` | Köprüye bağlanır / bağlantıyı keser. |
| `kopruBitti(ileti)` | Bu sayfanın başlatması bitti: yeniden bağlanmayı bırakır, rozet ve durum göstergesi **Durdu** der. Köprünün bekçisi örtüyü gösterirken çağırır; köprünün `durdu` iletisi de aynı işi yapar. Bekçi sayfayı yeni başlatmaya yenilerse sayfa yine bağlanır. |
| `cevir(ileti)` | Dış iletiyi oyun olayına çevirir (işlemez); tanımazsa `null`. |
| `durum()` | Çekirdeğin alanları (kişi sayısı, lider, coşku, vuruş, sıra, bağlantı durumu vb.) ve oyunun `oyunDurum(d)` kancasıyla eklediği alanlar. Tam liste için `cekirdek/js` altındaki `durum` işlevine bak. |
| `_test` | Testler için iç durum (`D`, `muzik`, `Muzik`, `HAVALAR`, `ayar`, `zamanEkle`). Kararlı arayüz değildir. |

## Köprünün adresleri

Köprü yalnız `127.0.0.1` dinler ve her kipte her isteğin `Host` başlığına bakar: yalnız `127.0.0.1:<kapı>` ya da
`localhost:<kapı>`. Başka bir ad taşıyan istek (DNS yeniden bağlama) 403 alır.

| Adres | Yanıt |
| --- | --- |
| `GET /` | Oyun. Köprü sayfaya `window.OYUN_KOPRU` yazar (`ws://…/olay/<kimlik>`); oyun bunu görünce kendiliğinden bağlanır. Ayrıca sayfanın kipini `<html data-kip>`e yazar (aşağıda). |
| `GET /#yayin` | Yalnız sahne (panel gizli). |
| `GET /durum` | `{ durum, bagliSayfa, sayac }` JSON. |
| `GET /muzik/<dosya>` | Oyunun isteğe bağlı hazır parçaları. `liste.js` yoksa boş bir betik döner (konsola 404 düşmesin). |
| WebSocket `/olay/<kimlik>` | Kimlik her açılışta yeni ve tahmin edilemez; köprü tam adresi açılışta pencereye yazar (`Olay adresi: ws://127.0.0.1:<kapı>/olay/<kimlik>`). Başka yol, kimliksiz `/olay` ya da yanlış kimlik, kaynağına bakılmadan el sıkışmadan önce 403 alır (başka bir sitenin kum havuzlu iframe'i `Origin: null` yollasa da). Diskten açılan `oyun.html` ya da başka bir program bağlanacaksa Yayın sekmesindeki adres alanına bu tam adres yazılır; düz `ws://127.0.0.1:8787` artık bağlanmaz. Olay akışı. Köprü yalnız yollar; istemciden veri beklemez. Kaynak (`Origin`) köprünün kendi adresi olmalı; bu kiplerde ayrıca kaynak bildirmeyen istemci ve diskten açılmış oyun sayfası (`null` ya da `file:`) kabul edilir, çünkü orada `oyun.html` dosyadan açılıp elle bağlanabilir. Başka bir sitenin kaynağı geri çevrilir. |

Ana sayfa kipinde (`node kopru.js --ana-sayfa`; `BASLAT.bat` bunu `--gizli` ile penceresiz açar) adresler başkadır:

| Adres | Yanıt |
| --- | --- |
| `GET /` | Ana sayfa (`cekirdek/ana-sayfa.html`; pakette köprünün yanında). Açılışta yükleme sahnesi. |
| `GET /api/oyunlar` | `{ anaSayfa, paket, platform: "windows" \| "mac" \| "linux", motor, arkaPlan, uyku, oyunlar: [{ id, ad, aciklama }], aktif: { oyun, ad, kip, kullanici, calistirma, baglanti } \| null, durum, kutuphane: { durum: "hazir" \| "iniyor" \| "hata", sure, neden } }`. |
| `GET /durum` | `{ durum, bagliSayfa, sayac, aktif }` JSON. |
| `POST /api/baslat` | Gövde `{ oyun, kip: "deneme" \| "canli", kullanici }`. Çalışanı durdurur, seçileni yeni bir başlatma kimliğiyle (`calistirma`) başlatır; eski başlatmanın soketleri kapatılır. Aynı oyun aynı kipte ve aynı adla yeniden istenirse bağlantı koparılmaz; TikTok'a henüz bağlı değilse hemen yeniden denenir. Yanıt `{ tamam, adres }` ya da `{ tamam: false, hata, alan }`. Kütüphane inmeden canlı istenirse 409 (`alan: "kutuphane"`). Kullanıcı adı: harf, rakam, `_`, `.`; 2-24 karakter; noktayla bitmez. |
| `POST /api/durdur` | Gövde `{}`. Çalışan oyunun sahte olaylarını ya da TikTok bağlantısını kapatır; motor boşta bekler. |
| `POST /api/kutuphane` | Gövde `{}`. İndirme başarısız olduysa yeniden dener. |
| `POST /kapat` | Başlık `X-Fabrika: kapat`. Gövde `{}` (ana sayfadaki **Motoru kapat**): motoru uyutur. Çalışan oyun ve TikTok bağlantısı durur, açık oyun sayfalarına "Motor durdu" denir (yeniden bağlanmayı bırakırlar), süren kurulum kesilir; süreç yaşar, yalnız dinler. Yanıt `{ tamam, uyku: true, … }` (ana sayfa durumu). Gövde `{ tam: true }` (yalnız başka klasörün başlatıcısı; sayfa yollamaz): `{ tamam, tam, ileti }` yazılır, motor tamamen kapanır. |
| `POST /uyan` | Başlık `X-Fabrika: uyan`, gövde `{}`. Uyuyan motoru uyandırır ("Başlat" düğmesi, aynı klasörün başlatıcısı). Yanıt ana sayfa durumu. |
| `POST /nabiz` | Başlık `X-Fabrika: nabiz`, gövde `{}`. "Motor durdu" ekranı açık: uyuyan motor yaşasın. Yanıt `{ tamam, uyku }`; `uyku: false` ise ekran salona döner. |
| `GET /oyun/<id>/` | Çalışan oyunun sayfası, köprüye bağlı (`/olay/<id>/<calistirma>`), masada "← Oyunlar" bağlantısı ve başlatma bekçisi: aynı oyun yeniden başlatılınca sayfa kendini yeniler; başka oyun açılır ya da oyun durdurulursa "Bu oyun artık çalışmıyor" örtüsü gösterir. Çalışmayan oyun için ana sayfaya yönlendirir. |
| `GET /oyun/<id>/muzik/<dosya>` | O oyunun isteğe bağlı hazır parçaları (`liste.js` yoksa boş betik). |
| `GET /onizleme/<id>/` | Aynı oyun köprüsüz ve sessiz; ana sayfadaki kabinin önizlemesi (`#yayin` ile). |
| WebSocket `/olay/<id>/<calistirma>` | Yalnız çalışan başlatmanın olayları. Kaynak yalnız köprünün kendi sayfası; başka yol, başka kaynak, kaynaksız istemci ve eski başlatmanın kimliği geri çevrilir. |

POST istekleri yalnız köprünün kendi sayfasından kabul edilir (`Host`, `Origin`, varsa `Sec-Fetch-Site`, JSON gövde,
en çok 4 KB). `POST /kapat`, `/uyan` ve `/nabiz` ayrıca kendi `X-Fabrika` başlığını ister: tarayıcı başka bir sitenin bu başlıklı isteği için
önce izin sorar, köprü izin vermez. `Origin` varsa köprünün kendi adresi olmalıdır; hiç yoksa istek tarayıcıdan değil
(tarayıcı her POST'a `Origin` yazar), bu bilgisayardaki bir programdan, ör. başlatıcıdan gelmiştir ve kabul edilir.

`motor` klasörün, sürümün (`SURUM.txt`) ve köprü kodunun kısa özetidir (klasörün yolu verilmez); `BASLAT.bat`'ın
başlatıcısı (`--gizli`) kapıdaki motorun aynı klasörün aynı sürümü olup olmadığını buna bakarak anlar; değilse ona
`POST /kapat` `{ tam: true }` der, kapı boşalınca kendi motorunu açar; aynı klasörün motoru uykudaysa onu `POST /uyan` ile uyandırır.
Uyku (`uyku: true`): oyun başlatılamaz (`POST /api/baslat` 409, `alan: "uyku"`), sıradan istekler motoru ne uyandırır ne
yaşatır; yalnız `POST /nabiz` yaşatır. "Motor durdu" ekranı 20 sn'de bir nabız yollar (arka plan sekmesi dakikada bire
kısılır); 150 sn nabız gelmezse motor tamamen kapanır (penceresiz ve görünür pencereli motorda aynı; `KOPRU_UYKU_MS`
yalnız testler içindir). Uyku ekranını yoklamayla gören başka bir sekme yalnız görünürken nabız yollar. `arkaPlan: true` motorun penceresiz çalıştığını söyler; o motor
hiçbir oyun sayfası soketle bağlı değilken 10 dakika boyunca istek almazsa kendiliğinden kapanır
(`KOPRU_BOS_KAPANIS_MS` yalnız testler için süreyi kısaltır). Çıktısı köprünün klasöründeki `motor-gunlugu.txt`
dosyasına yazılır (1 MB'ı geçince bir sonraki açılışta baştan başlar).
