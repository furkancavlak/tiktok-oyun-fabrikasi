# TikTok Oyun Fabrikası

## İndir

**Windows (kurulum yok):** [Releases](https://github.com/furkancavlak/tiktok-oyun-fabrikasi/releases) sayfasından
`tiktok-oyun-fabrikasi-…-windows-x64.zip` dosyasını indir, bir klasöre çıkar (sağ tık → **Tümünü ayıkla**) ve
içindeki `BASLAT.bat` dosyasına çift tıkla. Node.js ve TikTok kütüphanesi paketin içindedir; hiçbir şey kurman
gerekmez. Windows, internetten inen bir dosyayı ilk açılışta uyarabilir; uyarırsa **Ek bilgi → Yine de çalıştır**.
ZIP'in içinden, çıkarmadan çift tıklarsan `BASLAT.bat` önce klasöre çıkarmanı söyler.

**Kaynak koddan (Node.js gerekir):** depoyu indir, Node.js'i kur (Windows'ta nodejs.org'daki .msi kurulum dosyası,
node.exe değil), `BASLAT.bat` dosyasına çift tıkla. Ayrıntı aşağıda, "Hızlı başlangıç".

**Mac / Linux:** Node.js'i kur. Mac'te `BASLAT.command` dosyasına çift tıkla; açılmazsa Terminal'de klasöre girip
`sh BASLAT.command` yaz (ikisi de aynı işi yapar). Linux'ta `sh BASLAT.sh` (aşağıda "Mac / Linux").

TikTok canlı yayınlarında izleyicilerin oynadığı dikey oyunlar için bir depo. İzleyici yorum yazarak oyuna girer, beğeniyle ortak göstergeyi doldurur, hediyeyle sahnede etki başlatır. En çok hediye atan özel rolü alır. Depoyu Claude Code ile açıp tek cümleyle oyun fikrini anlatırsan, ajan oyunu hazır çekirdeğin üstüne kurar.

![Örnek oyun Mendil Kimde?: 1, 3, 9, 36 izleyici ve en büyük hediye anı](docs/ekran-goruntusu.png)

Bu proje TikTok ile bağlantılı değildir ve TikTok tarafından onaylanmamıştır.

## Ne var

| Parça | Yer | Ne yapar |
| --- | --- | --- |
| Çekirdek | `cekirdek/` | Her oyunda aynı kalan iş: sahne, izleyici sırası, coşku göstergesi, hediye kademeleri, lider tablosu, müzik saati, yayın masası (deneme ve moderasyon paneli), testler |
| Örnek oyun | `oyunlar/halay/` | "Mendil Kimde?": bir halay oyunu. Yorum yazan halaya girer, en çok hediye atan halay başı olur |
| Şablon | `sablon/` | Çalışan en küçük oyun. Yeni oyun buradan kopyalanır |
| Köprü | `kopru.js` | Bir TikTok canlı yayınını okur ve olayları oyun sayfasına iletir |
| Araçlar | `araclar/` | Derleme, test, ekran görüntüsü, yeni oyun açma, yayıncı paketi, müzik hazırlama |

Oyun ile çekirdek arasındaki sözleşme `docs/KANCALAR.md` dosyasındadır.

## Hızlı başlangıç

Gerekenler: Node.js 18 veya üstü (https://nodejs.org, LTS sürümü).

### Yol 1: Çift tıkla, oyunu seç (Windows, komut yazmadan)

1. Depoyu indir (GitHub'da **Code → Download ZIP**) ve klasörü aç.
2. `BASLAT.bat` dosyasına çift tıkla. Tarayıcıda bir açılış ekranı gelir; ilk seferde TikTok kütüphanesi orada iner
   (yaklaşık bir dakika, bir kez olur). Beklerken **Beklemeden dene** ile oyunları deneyebilirsin. Node.js kurulu
   değilse bunun yerine kısa bir yardım sayfası açılır.
3. Sonra ana sayfa açılır: bir oyun salonu, her oyun bir kabin, ekranında oyunun canlı önizlemesi.
   - Sarı **Dene**: oyun sahte izleyicilerle açılır, hiçbir hesaba bağlanmaz, ad gerekmez.
   - Kırmızı **Yayın**: önce sağ üstteki bilete TikTok kullanıcı adını yaz, **Kaydet**'e (ya da Enter'a) bas;
     düğme yanar, basınca kendi canlı yayınına bağlanır. Köprü yayını yalnızca okur.
   - Açık oyun üstteki şeritte görünür: **Oyuna dön** ya da **Durdur**.
4. Oyunların motoru arka planda, penceresiz çalışır. Çift tıklayınca bir an siyah bir pencere görünür; motor hazır
   olunca kendiliğinden kapanır. Ana sayfanın altındaki **Motoru kapat** motoru durdurur; sayfa "Motor durdu."
   der ve **Başlat** düğmesi çıkar, ona basınca salon aynı sekmede geri gelir. O sekmeyi kapatınca motor iki üç
   dakika içinde tamamen kapanır. Tarayıcıda oyun fabrikasının hiçbir sayfası açık değilse motor 10 dakika sonra
   kendiliğinden de kapanır. Motor
   açılamazsa siyah pencere kapanmaz, nedenini yazar. Oyundan ana sayfaya **← Oyunlar** bağlantısıyla dönülür.

### Mac / Linux

Aynı ana sayfa Mac'te `BASLAT.command`, Linux'ta `BASLAT.sh` ile açılır (Node.js yine gerekli). Mac'te
`BASLAT.command` dosyasına Finder'da çift tıkla; motorun penceresi Terminal penceresidir, açık kalsın. Linux'ta
terminalde klasöre girip `sh BASLAT.sh` yaz. Mac ve Linux'ta motor görünür pencerede kalır: Terminal penceresini
kapatmak onu kapatır; ana sayfadaki **Motoru kapat** onu durdurur (**Başlat** yeniden açar, sekme kapanınca tamamen kapanır). Bu iki başlatıcı henüz gerçek bir Mac ya da Linux masaüstünde
denenmedi; yalnız Windows'taki testlerden geçti.

Mac'te ilk açılış: internetten inen bir betiği macOS ilk seferde engelleyebilir ("geliştiricisi doğrulanamadı"
gibi bir uyarı). macOS engellerse Sistem Ayarları → Gizlilik ve Güvenlik altında **Yine de Aç** düğmesini ara;
eski sürümlerde dosyaya sağ tıklayıp **Aç** de. Her zaman çalışan yol Terminal'dir: klasöre `cd` ile gir ve
`sh BASLAT.command` yaz.

Komut satırından aynısı ve tek oyunla doğrudan açılış:

```
npm install
node kopru.js --ana-sayfa --ac               # ana sayfa, motor bu pencerede (Ctrl+C kapatır)
node kopru.js --ana-sayfa --ac --gizli       # aynısı penceresiz (BASLAT.bat böyle açar; günlük: motor-gunlugu.txt)
node kopru.js --deneme --oyun halay --ac     # tek oyun, sahte izleyicilerle
```

Testler ve ekran görüntüsü için Chrome gerekir.

### Yol 2: Kendi oyununu Claude Code ile yap

1. Depo klasöründe Claude Code'u aç. Ajan `AGENTS.md` dosyasını ve `.claude/skills/` altındaki beceriyi okur; çekirdeğin sınırlarını ve komutları oradan öğrenir.
2. Fikrini tek cümleyle yaz. Örnek: "Yorum yazan herkes bir balık olsun, hediye atan balık büyüsün, en çok hediye atan köpekbalığı olsun."
3. Ajan şablonu kopyalar, oyunu yazar, derler ve test eder. Yeni oyun, `BASLAT.bat` ile açılan ana sayfada kendi
   kartıyla görünür (kartın tek cümlesi oyunun `oyun.json` dosyasındaki `aciklama`). Elle yapmak istersen komutlar şunlar:

```
node araclar/yeni-oyun.js <ad> "<Görünen Ad>"
node araclar/derle.js <ad>
node araclar/test.js <ad>
node araclar/kare-cek.js <ad>
node kopru.js --deneme --oyun <ad> --ac
```

`kare-cek.js`, sahnenin 1, 3, 9 kişiyle ve tam kalabalıkla görüntülerini `test/cikti/<ad>/` klasörüne kaydeder. `test.js` bütün oyunlara ortak çekirdek testlerini uygular; adı verilmezse hepsini çalıştırır.

### Yol 3: Canlı yayına çık

1. Gerçek yayını okumak için:

```
node kopru.js <tiktok_kullanici_adi> --oyun <ad> --ac
```

2. Yayıncı programcı değilse paket hazırla:

```
node araclar/paket.js <ad>
```

`dist/<ad>/` klasörü oluşur: oyun, köprü, ana sayfa, `BASLAT.bat` ve kısa bir `OKU.txt`. Yayıncı `BASLAT.bat`
dosyasına çift tıklayınca tek oyunlu ana sayfa açılır. Klasörü yayıncıya ver. Yayıncı için adım adım anlatım `docs/YAYIN.md` dosyasındadır.

Köprü şifre istemez; yayını yalnızca okur.

## Oyun nasıl işler

| İzleyici ne yapar | Oyunda ne olur |
| --- | --- |
| Yorum yazar | Oyuna girer. Yorum sahnede konuşma balonu olarak görünür |
| Beğeni atar | Ortak gösterge (halayda "coşku") dolar. Gösterge zamanla söner |
| Hediye gönderir | Hediyenin jeton değerine göre kademeli bir etki başlar. Her oyun kademeleri kendi tanımlar |
| En çok hediye atar | Lider tablosunun başına geçer ve oyunun özel rolünü alır (halayda halay başı) |

Sahne 720x1280 sanal ölçekte çizilir, TikTok'un dikey yayınına göre. Alt kısım yorum alanına bırakılır. Olay biçimleri `docs/OLAYLAR.md` dosyasında.

## Sınırlar

- Köprü resmî olmayan `tiktok-live-connector` kütüphanesini kullanır. Kütüphane imza için üçüncü taraf bir servise (Euler Stream) dayanır. Servis ücretsiz kullanımı sınırlayabilir ya da durdurabilir.
- TikTok, canlı yayın yorumlarını ve hediyelerini okumak için resmî bir açık API sunmuyor. TikTok bir gün bu yolu kapatırsa köprü çalışmaz.
- Telefondan yayın desteklenmiyor. Yayın bilgisayardan yapılır ve hesapta TikTok LIVE Studio erişimi gerekir.
- Depoda müzik dosyası yok. Her oyun kendi müziğini üretir: halay davul zurna, gelin konvoyu darbuka ve klarnet, Vur Düzelsin seksenlerin televizyon spor jeneriği. İstersen bir oyuna kendi parçalarını yerelde ekleyebilirsin (`oyunlar/<ad>/muzik/`, `docs/MUZIK.md`); bunlar depoya girmez.
- Doğrulama durumu için `docs/YAYIN.md` sonundaki tabloya bak: gerçek yayın okuma bir kez denendi, LIVE Studio yakalama henüz denenmedi.

## Belgeler

| Dosya | İçerik |
| --- | --- |
| `docs/KANCALAR.md` | Çekirdek ile oyun arasındaki sözleşme, depo düzeni, komutlar |
| `docs/OLAYLAR.md` | Olay biçimi ve köprü iletileri |
| `docs/MUZIK.md` | Her oyunun kendi müziği: çalgı takımları, nota yazımı, oyun başına kendi parçaların |
| `docs/YAYIN.md` | Yayıncı için kurulum ve sorun giderme |
| `docs/MIMARI.md` | Mimari notlar |

## Lisans

Bu deponun kendi kodu MIT lisanslıdır. Ayrıntı `LICENSE` dosyasında.

TikTok bağlantısını kuran `tiktok-live-connector` ve `tiktok-live-proto` kütüphaneleri bu deponun parçası değildir ve
AGPL-3.0 lisanslıdır. Kaynak koddan kurarken onları npm indirir; hazır Windows paketi ise ikisini de kaynak kodu ve lisans
metniyle birlikte `node_modules` içinde taşır. Hazır paketi başkasına verirsen bu lisansın koşulları geçerlidir: paketi
olduğu gibi, lisans dosyalarıyla birlikte ver. Paketteki Node.js'in lisansı `node\LICENSE` dosyasındadır.

## English summary

TikTok Game Factory is a repo for vertical, interactive games played by viewers of a TikTok live stream. A comment puts a viewer into the game, likes raise a shared gauge, gifts trigger tiered effects, and the top gifter gets a special role. The repo contains a shared core (`cekirdek/`), an example game (a halay line dance, `oyunlar/halay/`), a game template (`sablon/`), a bridge (`kopru.js`) and tools (`araclar/`). Open the repo in Claude Code, describe a game in one sentence, and the agent builds it on the core.

Quick try on Windows: double-click `BASLAT.bat`; a home page opens in the browser with every game, a live preview, a "try with fake viewers" button and a "connect to your live stream" button (the TikTok username is typed on the page). On Windows the engine then runs in the background without a window; "Motoru kapat" on the home page puts it to sleep with a "Başlat" button to wake it; it exits for good a couple of minutes after that tab is closed, and by itself 10 minutes after the last page is closed. From a terminal: `npm install`, then `node kopru.js --ana-sayfa --ac`, or one game directly with `node kopru.js --deneme --oyun halay --ac`. Live: `node kopru.js <username> --oyun <name> --ac`. `node araclar/paket.js <name>` builds a double-click package for a non-programmer streamer.

Limits: the bridge reads streams through the unofficial `tiktok-live-connector` library, which depends on a third-party signing service (Euler Stream) that may limit or stop free use. TikTok offers no official public API for live comments and gifts. Streaming from a phone is not supported. No music files are shipped. Not affiliated with or endorsed by TikTok. Documentation is in Turkish. MIT licence.
