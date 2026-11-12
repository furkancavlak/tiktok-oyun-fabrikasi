# Mimari

Bu belge çekirdeğin nasıl çalıştığını anlatır. Oyunun dolduracağı kancalar `docs/KANCALAR.md` içindedir, olay
biçimi `docs/OLAYLAR.md` içindedir; burada tekrarlanmaz.

## Büyük resim

```
TikTok canlı yayını
   |  yalnız okuma
   v
kopru.js (127.0.0.1) --WebSocket--> Yayin.cevir --> olay(o) --> D (oyun durumu)
                                                       ^             |
          sahte izleyici (panel, otomatik) ------------+             v
                                                kare(): müzik saati B, oyun, kamera, çizim
                                                                     |
                                                                     v
                                                  tuval 720×1280 --> yayın programı
```

Oyun tek bir tarayıcı sayfasıdır; yayın programı (TikTok LIVE Studio, OBS) o pencereyi yayına verir. Köprü
olmadan da çalışır: o zaman olaylar paneldeki sahte izleyiciden gelir. Üç kaynak da aynı kapıya, `olay(o)`ya
girer. Oyun `D`'yi başka yoldan değiştirmez.

## Çekirdek dosyaları (`cekirdek/js/`)

| Dosya | Ne yapar |
| --- | --- |
| `00-yardimci.js` | Sayı yardımcıları (`clamp`, `lerp`, `yumusak`, `basamak`), addan tekrarlanabilir rastgelelik (`ozet`, `rastgeleUret`), `aciFark`, `azHareket`, `$`. |
| `10-muzik.js` | `TAKIMLAR` (çalgı takımları: `davul-zurna`, `dugun`, `mac`; ses yapı taşları `mzTon`, `mzGurultu`, `mzEzgiKur`, `mzBas`, `mzAkor`), oyunun seçtiği `TAKIM` ve `HAVALAR` (`OYUN.muzik`'ten; bildirim yoksa davul zurna), `Muzik` sınıfı ve tek örneği `muzik`: zamanlayıcı, ses zinciri, vuruş saati, hazır parça kipi. |
| `20-oyuncular.js` | `OYUN` eksiklerini doldurur; `KADEME`, `MAKS`, `D`, `karakterYap`, `gorunumUret`, `katil`, `cikar`, `siraGuncelle`, `olay`. |
| `25-yazilar.js` | Sıra kutusu, bildirim satırı, pankart, masadaki akışın satırları ve süzgeci (`gunluk`, `gunlukSuzSec`; en yenisi üstte, ikon, hediye satırı). Hepsi `textContent`. |
| `30-sahne.js` | Tuval, `RENK` / `PANEL_RENK`, kamera (`kam`, `kamKur`, `pr`), `ik`, çizim listesi (`kap`, `top`, `ozel`, `listeCiz`), `kadrajHesap`, `kameraSigdir`, `golge`, `ETIKET`, `etiketCiz`, `kenarKarart`. |
| `31-insan.js` | İnsan takımı: `iskeletKur`, `kolKur`, `pozBekle`, `pozOtur`, `insanEkle`, `elSekilCiz`, `kafaCiz`. |
| `32-parcacik.js` | `konfeti`, `kalpAt`, `parcaCiz`: ekran koordinatında uçan parçacıklar. |
| `33-cizim.js` | Tek parça nesneler için çizim yardımcıları: `renkKat`, `donusum`, `yerelNokta`, `kutuCiz`, `yuzCiz`, `cokgenCiz`, `daireCiz`, `kapsulCiz`; gök ve ufuk: `ufukY`, `gokCiz`. |
| `35-kare.js` | `kare()`: her karenin sırası ve ölçümü. |
| `40-sahte-izleyici.js` | Deneme için uydurma ad, yorum, beğeni, hediye üreten otomatik izleyici. |
| `50-yayin.js` | `Yayin`: köprüye WebSocket bağlantısı, dış iletiyi olaya çevirme, sıra ve ayar saklama. |
| `60-panel.js` | Sayfa yazıları, yayın masası (durum göstergesi, özet, sahnedekiler, akışın biçimi ve süzgeci, kartlar, kip, yayıncının hızlı eylemleri), `boyutla`, yayın görünümü, açılış (`baslat`), `window.CanliOyun`. |

## Olay kapısı ve izleyici kaydı (`20-oyuncular.js`)

`olay(o)` önce kimliği süzer: kimlik ve ad kontrol karakterlerinden arındırılır, boşlukları sadeleşir; kimlik 64,
ad 18 karaktere kısalır. Kimliği boş olay düşer. Yayıncının panelden sahneden çıkardığı kimliğin olayı da düşer
(geri alınana kadar). Yasaklı kelime geçen ya da yayıncının adını gizlediği izleyicinin adı `misafir` olur.

- **Yorum:** izleyici sahneye girer (`katil`), `k.son` tazelenir. Metin 200 karaktere kısalır; yasaklı kelime,
  adres ve telefon süzülünce 30 karakterlik konuşma balonu olur. Balonlar panelden ya da `B` tuşuyla kapatılır;
  kapatınca ekrandaki balonlar da hemen silinir.
- **Beğeni:** adet 1 ile 500 arasına sıkışır; `D.begeni` ve coşku (adet × 0,006) artar, kalpler uçar. Sahnede
  olmayanı sahneye almaz; olan varsa `k.son` tazelenir.
- **Takip:** izleyici girer, adı 3 sn yeşil yazılır, "takip etti, hoş geldin" bildirimi çıkar.
- **Paylaşım:** coşku 0,05 artar. **Katılım:** yalnız günlüğe yazılır.
- **Hediye:** jeton ile adet çarpılır. Gönderen, yer yoksa da girer (`katil(…, zorla)`). Sırayla: jeton eklenir,
  coşku artar (en çok 0,35), `KADEME` içinde jetonu karşılayan en büyük kademe bulunur, sevinç aralığı kurulur
  (`k.zip0`, `k.zip1`: sonraki yarım vuruştan başlayıp 4 vuruş), bildirim ve zil sesi çıkar, `oyunHediye`
  çağrılır, sıra yenilenir. Lider değiştiyse `oyunLiderDegisti` çağrılır.

**Sıra:** `siraGuncelle` sahnedekileri jetona göre azalan, eşitse önce katılana göre dizer; ilki liderdir. Sonra
`oyunYerlesim` çağrılır ve sıra kutusu yenilenmek üzere işaretlenir.

**Kapasite:** sahne `kapasite` (`MAKS`, varsayılan 36) kadar kişi alır. Yer dolunca yeni gelen, jetonu en az olan
ve en uzun süredir sessiz kalanın yerini alır. Lider ve `k.yildiz` olanlar atılmaz. Yorumcu, hediye atmış birini
yerinden edemez; hediye atan edebilir. Atılacak kimse yoksa yeni gelen girmez.

**Boşta kalan:** 45 karede bir en çok bir kişi `cikar`ılır. Eşik sahnede 24 kişiden fazlaysa 75 sn, değilse
240 sn; buna `jeton × 4` sn (en çok 600) eklenir. Çıkan, 1,7 sn sonra ya da oyun `k.gitti` deyince silinir.

## Tek saat: müzik vuruşu `B` (`10-muzik.js`)

Oyundaki her hareket ve süre `B`'ye bağlıdır. `muzik.beatAt()` öncekinden küçük değer döndürmez. Ses kapalıyken
saat `performance.now()`'dan, açıkken `AudioContext.currentTime`'dan okunur; geçişte (`tabanDegistir`) vuruş
korunur. Üretilen müzik adım adım zamanlanır, her adımın vuruş kaydı `iz` dizisinde durur. Sayfa 0,4 sn'den
uzun kilitlenirse (olay seli, ağır kare) kaçan adımlar çalınmaz ama vuruş sayacı onlar kadar ileri alınır
(`atla`); saat donmadan sürer. Davul vuruşları ve
zurna notaları `olaylar` kuyruğuna yazılır; kare bunları `calgi.dumP`, `calgi.tekP` nabzına ve `calgi.perde`ye
çevirir. Hazır parçada vuruş, parçanın önceden ölçülmüş vuruş listesinden okunur (`hazirVurus`); çalgıcı
olayları o zaman vuruşa bakılarak yapay üretilir.

Tempo `bpm × carpan`'dır. `carpan` hedefi `1 + 0,3 × coşku`'dur (oyun `muzik.sov`'u açarsa +0,08) ve yumuşakça
yaklaşılır. Üretilen müzikte hava yaklaşık 100 sn sonra, form başında sırayla değişir. Her adımda takım davul
satırını (ve varsa üst, bas, akor satırlarını) ve ezgiyi çalar (`takim.vur`, `takim.satir`, `takim.nota`). Ses
zinciri bütün takımlarda aynıdır: takımın kolları (davul, ezgi, eşlik), `ana`, sıkıştırıcı, `son` (düzey), çıkış;
ortak yankı; düzey sıkıştırıcıdan sonra ayarlanır. Takımlar, nota yazımı, oyun başına hazır parça ve
`muzik-hazirla.py` için `docs/MUZIK.md`'ye bak.

## Sahne (`30-sahne.js`, `31-insan.js`)

Çizim 720×1280 sanal ölçekte yapılır (`GW`, `GH`); tuvalin gerçek boyutunu `boyutla` belirler, `kare` başında
ölçek `setTransform` ile uyarlanır. Eksenler: x sağ, y yukarı, z kameradan uzağa.

**Kamera.** Yüksekten bakan, dar açılı bir bakıştır: eğim 0,62 rad, `F` = 1400. `kamKur` konum ve eksenleri
hesaplar. `pr([x, y, z])` noktayı `{ x, y, s, d, ok }` olarak ekrana düşürür (`s`: metre başına piksel, `d`:
derinlik; kameradan 0,35 m'den yakın nokta görünmez sayılır). Oyun `OYUN.kamera` ile eğim, `F`, `enYakin`,
`ustPay`, `altPay` değerlerini ezebilir.

**Sığdırma.** `kameraSigdir`, oyunun verdiği `[x, z]` noktalarını `ALAN_UST`–`ALAN_ALT` (505–1006) şeridine
sığacak kadar uzaklaşır; genişlikte her nokta kendi derinliğiyle ve kendi payıyla (öntanım 0,55 m) sayılır. Sonuç
yumuşakça yaklaşır. Kamera öntanımda x = 0'a bakar; oyun seçenekli nesneyle bakılacak x'i, hep büyük kalacak
odağı, kuyruğu taşabilen ön sığdırmayı ve piksel paylarını verebilir (`docs/KANCALAR.md`, "Kamera"). Hesap
`kadrajHesap`'tadır. Yatay açı çok hafif salınır; hediye sarsıntısı (`D.sarsinti`) her karede
söner. `kam.son` (`enX`, `hd`) oyunun zemini kalabalığa göre büyütmesi içindir.

**Çizim listesi.** `kap` (iki ucu farklı yarıçaplı kapsül), `top` (daire) ve `ozel` (serbest çizim) parçaları
listeye ekler. `listeCiz` listeyi derinliğe göre uzaktan yakına sıralar; eşit derinlikler eklenme sırasıyla
çizilir. Zemin ve gölge listeye girmez; `oyunZemin` onları doğrudan çizer.

**Ad etiketleri.** `insanEkle` her oyuncunun `k.et`'ini kurar (başın tepesi, ölçek, derinlik). `etiketCiz`
önceliğe göre sıralar: lider, `k.yildiz`, `k.ozel`, son 6 sn içinde konuşan, ilk beş, sonra öne yakın olanlar.
Punto ölçekten gelir (13–18, lider +4). Çakışan etiket en çok iki kat yukarı kayar; sığmayan ve önceliği düşük
olan çizilmez. Yorum balonu 3,4 sn görünür. Lider vurgu renginde ve tacıyla yazılır. `OYUN.etiket` üst / alt
sınır, ekran dışındakini gizleme ve balon sırası ekler; `k.et.asagi` adı bağlantı noktasının altına asar
(`docs/KANCALAR.md`, "Ad etiketleri").

**İnsan takımı.** Oyun izleyiciyi insan çizecekse kullanır. `gorunumUret(id)` görünümü kimlikten türetir: aynı
izleyici her yayında aynı kıyafetle gelir. `iskeletKur(k, poz)` pozdan eklemleri kurar, `kolKur` kolları ellere
uzatır (ters kinematik `ik`), `pozBekle` vuruşla sallanan bekleme pozudur, `insanEkle` gövdeyi ve başı listeye
ekler, `kafaCiz` yüzü, saçı, yazmayı, kasketi çizer. Ölçüler iri başlı, kısa gövdelidir ki kalabalıkta yüzler
okunsun (`31-insan.js` başındaki sabitler). Alanlar ve poz biçimi için `docs/KANCALAR.md`.

## Bir karenin sırası (`35-kare.js`)

1. `dt` (en çok 0,05 sn) ve `zaman` ilerler. Müzik planlanır, `B` ve çalgı nabızları okunur (testin
   `vurusDondur` kancası doluysa `B` o değerde durur).
2. Coşku söner (saniyede 0,022), boşta kalan çıkarılır.
3. `oyunGuncelle(dt)`; çıkışı bitenler `D.oy`'dan silinir.
4. `kameraSigdir(oyunKamera(), dt)`; tuval ölçeği ayarlanır.
5. `oyunZemin()`, her `k.et` boşaltılır, `oyunCiz()`, `listeCiz()`, varsa `oyunUst(dt)`.
6. `etiketCiz` (varsa `oyunEkAdlar()` ile), `parcaCiz`, `kenarKarart`.
7. Kirliyse sıra kutusu yazılır; her 6 karede günlük, coşku çubuğu ve çalan parça bilgisi yenilenir.
8. Karenin işlem süresi ölçülüp `D.kareMs` içinde yumuşatılır; sonraki kare istenir.

Kancaların çağrılma anları için `docs/KANCALAR.md`.

## Derleme (`araclar/derle.js`)

Çıktı tek bir `oyun.html` olur: yayıncı dosyayı bir yere kopyalayıp açabilir, çalışırken dış bağımlılık
istemez (yalnız Google Fonts; yüklenmezse yedek yazı tipi). `import` yoktur; bütün parçalar tek kapalı işlevin
(`'use strict'`) içine art arda eklenir. Böylece parçalar birbirinin adlarını görür, sayfanın genel alanı
kirlenmez.

Sıra: `oyunlar/<ad>/js/00-ayar.js` (çekirdek `OYUN`u buradan okur), `cekirdek/js/*.js` (ada göre), oyunun diğer
dosyaları (ada göre). Derleme, on zorunlu kancanın işlev bildirimi olarak yazıldığını denetler; eksik varsa
adını yazıp durur. Sayfa iskeleti `cekirdek/sayfa.html`, stili `cekirdek/stil.css`'dir. `--denetle` depodaki
`oyun.html` güncel değilse 1 ile çıkar; `--parca` başka sayfaya gömülecek etiketsiz parça üretir.

## Yayın görünümü, panel, sahte izleyici (`60-panel.js`, `40-sahte-izleyici.js`)

- **Yayın görünümü:** adrese `#yayin` eklenir ya da panelden "Yalnızca sahneyi göster" seçilir. Panel gizlenir,
  sahne pencereyi 9:16 doldurur, tuval en çok 1080×1920 olur. Esc ya da sahne köşesindeki düğme paneli geri
  getirir. `#yayin` ya da köprüyle açılınca ses, tarayıcı izin verirse beklemeden açılmayı dener.
- **Yayın masası (panel):** iskeleti her oyunda aynıdır; oyuna özgü yazılar `OYUN`dan gelir (docs/KANCALAR.md,
  "Yayın masası"). Yukarıdan aşağı:
  - *Üst çubuk:* oyunun adı, tek durum göstergesi (Deneme, Bağlanıyor, Yayın bekleniyor, Canlı, Bağlantı koptu,
    Durdu, Bağlanamadı; gerekince altında motorun kendi cümlesi), "Oyunlara dön" (ana sayfadan açılınca) ve
    "Yalnızca sahneyi göster". `masaYaz` 250 ms'de bir yazar; yayın görünümünde çalışmaz.
  - *Özet satırı:* sahnede kaç kişi / kapasite, toplam jeton, lider.
  - *Sahnedekiler:* jetona göre ilk 20 kişi (gerisi ad aramasıyla). Ada basınca altında "Adını gizle" ve
    "Sahneden çıkar" açılır (klavyeyle de; Esc kapatır).
  - *Akış:* en yenisi üstte, satır başında türün ikonu, hediye satırı vurgulu (hediyenin adı · jeton · kademe);
    süzgeç Hepsi / Hediyeler / Yorumlar, her türün son 40 satırı. Fare ya da odak akıştayken satırlar kaymaz.
    Satırdaki ada basınca aynı iki işlem açılır (`gunluk` çağrısına kimlik verilmişse).
  - *Kartlar:* deneme kipinde "Deneme izleyicisi" (sahte yorum, beğeni, takip, kademe başına hediye, otomatik
    kalabalık ve hızı); canlı kipte onun yerine "Bu oyunda hediyeler" (eşik, ad, etki). Sonra "Bu oyunda" (oyunun
    kendi düğmeleri, boşken gizli), "Yayın güvenliği" (yorum balonları ve `B` tuşu, gizlenecek kelimeler,
    çıkarılan / adı gizlenenler ve geri alma), "Müzik" (ses, düzey, havalar, hazır parçalar, `#yt-kutu`).
  - *Alt sıra:* kapalı "Gelişmiş" (köprü adresi ve bağlan düğmesi, ileti biçimi, kare süresi, vuruş/dk, API
    açıklaması) ve boşaltma (sayfanın içinde onay sorar).
  - *Kip:* köprünün açtığı sayfa canlıdır, köprü "deneme" derse ya da sayfa diskten açıldıysa deneme
    (`#panel[data-kip]`). Canlı kipte deneme izleyicisi kartı masada yoktur.
  - Düzen masanın genişliğine göre değişir (CSS `@container masa`): geniş masada üç sütun, orta genişlikte iki,
    dar masada tek sütun. Masa eldeki yüksekliği kullanır, listeler kendi kartlarında kayar. Pencere uzun ve darsa
    sahne biraz küçülür ki masa en az 560 px kalsın; 900 px ve daha dar pencerede masa sahnenin altına iner.
  - Düğmeler de `olay(o)`ya yazar.
- **Hızlı eylemler:** "Gizle" (`izleyiciGizle`) kimliği `ayar.gizli`ye ekler, adı hemen `misafir` yapar ve balonunu
  siler; sonraki olaylarda da ad süzgecinden `misafir` çıkar. "Çıkar" (`izleyiciCikar`) kimliği `ayar.cikan`a ekler
  ve `cikar(k)` çağırır; lider çıkarsa `oyunLiderDegisti` çağrılır. Çıkarılanın olayları oyuna işlenmez. İkisi de
  `ayarYaz` ile tarayıcıda saklanır (en çok 300 kişi) ve Yayın güvenliği kartından geri alınır.
- **Sahte izleyici:** adı `OYUN.sahteAd`'dan (yoksa genel listeden), yorumu `OYUN.sahteYorum`'dan alır. Hediyeyi
  kademelerden seçer (en büyüğü %0,7, ikincisi %3,8, üçüncüsü %10,5, dördüncüsü %25). Açılıştaki kalabalık
  `OYUN.tohum`'dan gelir.
- **Gerçek yayın:** köprü sayfayı açarken `window.OYUN_KOPRU` adresini yazar. Bu varsa otomatik izleyici kapanır,
  tohum kalabalık kurulmaz (3 saatten yeni saklanmış sıra varsa o yüklenir), `Yayin` bağlanır, kopunca 3 sn'de
  bir yeniden dener. Sıra 5 sn'de bir tarayıcıya yazılır (en çok 60 kişi). Panelin sahte düğmeleri yine
  çalışır; yayında basılmamalıdır (panel de bunu söyler).

## Köprü (`kopru.js`)

Sayfayı sunar ve içine `OYUN_KOPRU` satırını ekler; `/durum` JSON verir; `/muzik/` yalnız açılan oyunun
`muzik/` klasöründeki (`oyunlar/<ad>/muzik/`) düz adlı `.js` ve ses dosyalarını sunar; ortak bir müzik klasörü yoktur. WebSocket elle yazılmıştır, bağımlılık yoktur; istemciden yalnız kapanış ve ping işlenir.
Yalnız `127.0.0.1` dinler. Kaynak `tiktok-live-connector`'dır; `cevir` kütüphanenin iki sürümünün biçimini
olaya indirger, bağlantı koparsa artan aralıkla yeniden dener. `--deneme` kütüphaneyi yüklemeden sahte olay
üretir. Sayfa tarafında benzer çeviri `Yayin.cevir`'dedir; seri hediye bitince bir kez sayılır.

## Testler

`node araclar/test.js [ad]` her oyun için üç şey çalıştırır (sonda bir kez köprü, müzik ve araç testleri): `derle.js --denetle`, `cekirdek/test/cekirdek.test.js`
(olay kuralları, kapasite, bozuk girdi ve HTML, olay seli, vuruş saatinin geri gitmemesi, ses ölçümü, hazır
parça, yayın görünümü, kare süresi, uzun çalışma) ve varsa oyunun kendi `test.js`'i. Çekirdek testleri her
oyuna uygulanır; oyuna özgü sayılar sayfadaki `OYUN`dan okunur. En sonda köprü testi ve bütün oyunları birlikte ölçen müzik testi (`muzik.test.js`: düzey, denge, oyunlar arası
fark, dinleme önizlemesi) bir kez çalışır. Testler
TikTok'a bağlanmaz: köprü testleri kütüphanenin eski ve yeni sürümünün taklitlerini geçici klasörde kurar.
Tarayıcı `CHROME_PATH` ile ya da Playwright'ın Chromium'uyla bulunur.

## Bilinen sınırlar

- Kıyafet, ten ve saç paleti çekirdektedir ve halay havasındadır (yazma, kasket, önlük). Başka havada bir oyun
  bunları çekirdekten değiştirmeden uyarlayamaz. Müzik artık oyunundur (`OYUN.muzik`); oyunun dünyasına uyan
  takım yoksa çekirdeğe yeni takım eklenir (`docs/MUZIK.md`).
- Kamera sağa sola dönmez (yaw yalnız hafif salınım); bakılan x kayar ama perspektif hep önden bakar.
- Sahne yazıları (sıra, bildirim, pankart) sayfa iskeletinde sabit yerdedir; oyun yalnız pankartı sıralama
  kutusunun altına alabilir (`OYUN.sahneYazi.pankart = 'alt'`).
- Sahte izleyici adları için genel liste Türkçe sabittir; yalnız `OYUN.sahteAd` ile değişir.
- Konfeti ve sahte olaylar `Math.random` kullanır, tekrarlanamaz. Görünüm ise kimlikten türetilir.
- Sıra kaydı yalnız köprü kipinde tutulur ve 3 saatte eskir.
- TikTok LIVE Studio adımı bu depoda denenmedi (`docs/YAYIN.md`).
