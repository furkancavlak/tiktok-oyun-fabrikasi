# Yayıncı rehberi

Bu rehber, programcı olmayan bir yayıncı içindir. Elinde bir oyun paketi klasörü olduğunu varsayar (`dist/<ad>/`, ya da sana verilen klasör). Paket, TikTok canlı yayınındaki yorum, beğeni ve hediyeleri okuyup oyuna aktarır.

## Gerekenler

- Yayını bilgisayardan yapıyor olmalısın. Telefondan yayın desteklenmez.
- TikTok hesabında LIVE Studio erişimi olmalı. Kimin erişim alacağına TikTok karar verir.
- Windows bilgisayar ve Node.js (aşağıda kurulumu var).
- İnternet bağlantısı.

Şifre gerekmez. Köprü TikTok hesabına girmez; yalnızca herkese açık yayını okur.

## Kurulum

1. https://nodejs.org adresine git ve LTS yazan sürümü indirip kur. Kurulum sırasında her şeyi varsayılan bırakabilirsin.
2. Paket klasörünü bilgisayarında istediğin bir yere koy. Klasör yolunda Türkçe harf olabilir.

## Yayına başlama

1. Paket klasöründeki `BASLAT.bat` dosyasına çift tıkla. Node.js kurulu değilse tarayıcıda kısa bir yardım sayfası
   açılır (nodejs.org, LTS sürümü); kurduktan sonra yeniden çift tıkla.
2. Tarayıcıda bir açılış ekranı gelir: motor çalışıyor mu, TikTok kütüphanesi kurulu mu, oyunlar hazır mı, satır satır
   yazar. İlk seferde kütüphane orada iner (yaklaşık bir dakika, internet ister; bir kez olur). Beklerken
   **Beklemeden dene** ile oyunu sahte izleyicilerle açabilirsin; kırmızı düğmeler kütüphane inince kendiliğinden yanar.
   İnemezse ekran "İndirilemedi. İnternet bağlantını kontrol et." der: **Yeniden dene** ya da **Şimdilik yalnız dene**.
3. Hazır olunca ana sayfa (oyun salonu) açılır. Siyah pencere de açık kalır: o oyunun motorudur. Kapatırsan oyun durur;
   yayın bitene kadar açık bırak (küçültebilirsin).
4. Önce sarı **Dene** düğmesine bas: oyun TikTok'a bağlanmadan, sahte izleyicilerle açılır. Neye benzediğini gör.
5. Yayına geçmek için masanın sol üstündeki **← Oyunlar** bağlantısıyla ana sayfaya dön. Sağ üstteki bilete TikTok
   kullanıcı adını yaz (başındaki `@` hazır durur) ve **Kaydet**'e ya da Enter'a bas. Bilet "Kayıtlı" yazar, kırmızı
   **Yayın** düğmesi yanar; ona bas. Ad bu bilgisayarda kayıtlı kalır, bir dahaki sefere yeniden yazman gerekmez.
   Ana sayfadaki şeritte açık oyun ve motorun son durumu yazar ("şu an canlı yayında değil" gibi); **Durdur**
   oyunu kapatır, **Oyuna dön** oyunun sayfasını açar. Sayfanın altındaki **Yayına nasıl alırım?** dört adımı gösterir.
6. Oyun sayfasında solda sahne, sağda yayın masası (panel) vardır. Masanın en üstündeki şeritte **Bağlantı** kutusu
   ne olduğunu söyler:
   - **Canlı**: TikTok yayınına bağlanıldı; yorumlar, beğeniler ve hediyeler oyuna akıyor. Yanında kaç olay alındığı yazar.
   - **Yayın yok** (altında "yayın henüz açık değil"): TikTok'ta yayın henüz açık değil. Yayını başlat; motor kendisi yeniden dener. Beklemek
     istemezsen ana sayfada aynı oyunun **Yayın** düğmesine yeniden bas, hemen dener.
   - **Bağlanıyor**: TikTok'a bağlanılıyor.
   - **Deneme**: sahte izleyiciler; TikTok'a bağlanılmadı.
   - **Durdu**: oyun ana sayfadan durduruldu.
7. Sayfada bir kez herhangi bir yere tıkla ya da başlat düğmesine bas. Tarayıcılar, kullanıcı tıklamadan ses çalmaya izin vermez.

Denemeden yayına geçince denemenin sahte izleyicileri sıralamadan silinir; gerçek yayında görünmezler. Başka bir
sekmede açık kalmış eski oyun sayfası da yeni başlatmaya kendiliğinden geçer; oyun durdurulduysa ya da başka oyun
açıldıysa "Bu oyun artık çalışmıyor" der.

## TikTok LIVE Studio'ya ekleme

1. Masanın sağ üstündeki **Yalnızca sahneyi göster** düğmesine bas (ya da adresin sonuna `#yayin` ekleyip Enter'a
   bas). Panel gizlenir, yalnızca sahne görünür. Panele dönmek için `Esc` tuşuna bas.
2. LIVE Studio'da yeni bir kaynak ekle ve **pencere yakalama** seç.
3. Listeden oyunun açık olduğu tarayıcı penceresini seç.
4. Pencereyi yayın düzenindeki yerine yerleştir ve boyutlandır.

Tarayıcı kaynağı (browser source) yöntemi bu oyunda boş görünebilir. Pencere yakalama kullan.

Yakalama sırasında tarayıcı penceresi küçültülmemeli. Küçültülmüş pencere yakalanmaz.

## Güvenlik

İzleyicilerin adları ve yorumları ekranda görünür. Kötü bir yorum ya da ad doğrudan yayına çıkabilir. Masadaki
**Yayın güvenliği** şeridi ve listeler bunun içindir:

- **Yorum balonları** anahtarı: kapatınca ekrandaki balonlar da hemen silinir. Yorumlar ekranda görünmez, yine de
  izleyiciyi oyuna sokar. Klavyede `B` tuşu da balonları açıp kapatır; yalnızca sahne görünümündeyken (panel gizliyken)
  de çalışır. Önce oyun penceresine bir kez tıkla.
- **Gizlenecek kelimeler:** virgülle ayırarak yaz. Bu kelimeleri içeren yorum balon olmaz, adında geçen izleyici
  `misafir` yazılır. Alandan çıkınca sahnede o an eşleşen ad ve balonlar da gizlenir.
- **Sahnedekiler** listesinde ya da **Olay akışında** bir adın üstüne gel:
  - **Gizle:** o izleyicinin adı hemen ve kalıcı olarak `misafir` olur.
  - **Çıkar:** izleyici sahneden gider; geri alana kadar yorumu, hediyesi ve beğenisi oyuna işlenmez.
  - Fare olay akışının üstündeyken akış durur, satırlar kaymaz. Kaç yeni olay beklediği başlıkta yazar.
- Çıkardıkların ve adını gizlediklerin **Yayın** sekmesinde listelenir; oradan tek tek ya da hepsini geri alabilirsin.
  Liste bu bilgisayarda saklanır, sonraki yayında da geçerlidir.

Ayarları yayına çıkmadan önce yap: yalnızca sahne görünümünde panel gizlidir, orada yalnız `B` tuşu çalışır.
Paneli de açık tutmak istersen yakalamada pencereyi yalnız sahneyi gösterecek şekilde kırpabilirsin; LIVE Studio'nun
buna izin verip vermediği denenmedi.

## Sorun giderme

| Belirti | Neden ve çözüm |
| --- | --- |
| "Node.js bulunamadı" (ve tarayıcıda yardım sayfası) | Node.js kurulu değil ya da kurulumdan sonra bilgisayar yeniden başlatılmadı. https://nodejs.org adresinden LTS sürümünü kur, `BASLAT.bat` dosyasını yeniden aç. |
| Açılış ekranı "İndirilemedi. İnternet bağlantını kontrol et." | TikTok kütüphanesi inemedi. İnterneti kontrol edip **Yeniden dene**'ye bas. O zamana kadar **Dene** çalışır. |
| Köprü bağlanamıyor, 403 hatası | Kütüphane eski. Paket klasöründe bir komut satırı aç ve `npm install tiktok-live-connector@latest` yaz. Sonra `BASLAT.bat` dosyasını yeniden aç. |
| "Yayın kapalı" ya da kullanıcı bulunamadı | Yayın açık değil ya da kullanıcı adı yanlış. Önce TikTok'ta yayını başlat, adı `@` olmadan yaz. |
| Siyah pencere "zaten açık" deyip kapanıyor | `BASLAT.bat` iki kez açıldı. Sorun değil: tarayıcıda açılan ana sayfayı kullan. |
| "Oyun motoru başka bir pencerede zaten açık" | Motor eski yoldan (komut satırından, tek oyunla) başka bir pencerede açık. O siyah pencereyi kapat, `BASLAT.bat` dosyasına yeniden çift tıkla. |
| Kapı dolu (port meşgul) | Başka bir program aynı kapıyı tutuyor; onu kapat. Olmazsa komut satırında `node kopru.js --ana-sayfa --port 9000 --ac` çalıştır. |
| Ana sayfa "Motor çalışmıyor" ya da "Motora ulaşılamıyor" diyor | Siyah pencere kapanmış. `BASLAT.bat` dosyasına yeniden çift tıkla; açık sayfa motor gelince kendiliğinden devam eder. |
| Kullanıcı adı kabul edilmiyor | TikTok adında yalnız harf, rakam, alt çizgi ve nokta olur; en çok 24 karakter, noktayla bitmez. Ekrandaki adını değil, profil adresindeki `@` ile başlayan adı yaz. |
| Bağlantı kutusu "Yayın yok" | TikTok'ta yayın henüz açık değil. Yayını başlat; motor kendisi dener ya da ana sayfada **Yayın**'a yeniden bas. |
| Ses yok | Tarayıcılar tıklamadan ses açmaz. Sayfada başlat düğmesine bas. Pencere yakalama bilgisayar sesini ayrıca almıyorsa LIVE Studio'da ses kaynağını kontrol et. |
| LIVE Studio'da oyun görünmüyor | Tarayıcı kaynağı yerine pencere yakalama kullan. Pencerenin küçültülmediğinden emin ol. |
| Oyun açık ama yorumlar gelmiyor | Masanın üstündeki Bağlantı kutusuna bak; ayrıntı Yayın sekmesinde yazar. Yayın açıksa ve yorum yazılıyorsa kütüphaneyi güncelle (403 satırı). |

## Doğrulama durumu (10 Kasım 2026)

Bu tablo neyin denendiğini dürüstçe gösterir. "Denenmedi" yazan adımların çalışacağı varsayılıyor, doğrulanmadı.

| Adım | Durum |
| --- | --- |
| Köprünün gerçek bir TikTok canlı yayınını okuması | `tiktok-live-connector` 2.5.0 ile bir kez denendi: yorum, beğeni, hediye ve takip olayları oyuna ulaştı. 1.x sürümü artık bağlanamıyor (imza isteği 403 dönüyor). |
| `BASLAT.bat`, Windows 10, temiz kopya, Türkçe harfli klasör yolu | Soru soran eski sürümüyle denendi, çalışıyor. Ana sayfa açan yeni sürümü (11 Kasım 2026) görünür pencerede çift tıklanarak henüz denenmedi; köprünün ana sayfa kipi otomatik testlerle ve görünmez tarayıcıyla denendi. |
| Node.js kurulu olmayan bir bilgisayar; insanın çift tıklaması | Denenmedi |
| TikTok LIVE Studio pencere yakalama | Denenmedi |

## Kütüphane hakkında

Köprü resmî olmayan `tiktok-live-connector` kütüphanesini kullanır ve TikTok ile bağlantılı değildir. Kütüphane imza için üçüncü taraf bir servise (Euler Stream) dayanır; bu servis ücretsiz kullanımı sınırlayabilir ya da durdurabilir. TikTok'un canlı yorum ve hediye okumak için resmî açık bir API'si yok, yani bu yol bir gün kapanabilir.
