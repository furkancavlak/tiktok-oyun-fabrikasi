# AGENTS.md — bu depoda çalışan ajanlar için

Bu depo TikTok canlı yayınları için etkileşimli oyun üreten bir fabrikadır. İzleyici yorum, beğeni ve hediyeyle
oynar; oyun yayıncının bilgisayarında, tarayıcıda çalışır. Kod ve belgeler Türkçedir; tanımlayıcılar Türkçe,
ASCII harflerle yazılır.

**Kullanıcı bir oyun fikri söylediyse** (ör. "gelin konvoyu oyunu yap") `.claude/skills/yeni-oyun/SKILL.md`
dosyasını oku ve oradaki sırayı izle. Bu dosya deponun haritasıdır; o dosya işin tarifidir.

## İki katman

| Katman | Yer | Kim değiştirir |
| --- | --- | --- |
| Çekirdek | `cekirdek/` | Yeni oyun yazarken DEĞİŞTİRİLMEZ. Olay kapısı, izleyici kaydı, sıralama, sahne yazıları, kamera, çizim listesi, insan takımı, müzik saati, deneme paneli, köprü istemcisi. |
| Oyun | `oyunlar/<ad>/` | Yalnız o oyuna özgü olan: ayar, kurallar, diziliş, çizim, hediye etkileri ve **müziği** (`OYUN.muzik`: çalgı takımı + kendi havaları). |

İkisi arasındaki sınır `docs/KANCALAR.md` içindedir: oyunun dolduracağı kancalar ve çekirdeğin sunduğu adlar.
Çekirdekte eksik bir şey görürsen oyunun içinde çöz ve raporunda "çekirdeğe şu eklenmeli" diye yaz.

## Komutlar

```bash
npm install                                   # bir kez
node araclar/yeni-oyun.js <ad> "<Görünen Ad>" # şablondan yeni oyun
node araclar/derle.js <ad>                    # oyunlar/<ad>/js + cekirdek → oyunlar/<ad>/oyun.html
node araclar/kare-cek.js <ad>                 # sahne kareleri → test/cikti/<ad>/kare-hepsi.png
node araclar/test.js <ad>                     # çekirdek testleri + oyunun kendi testi (+ köprü, müzik, araçlar)
node araclar/test.js                          # bütün oyunlar + köprü testleri
node araclar/test.js <ad> --yalniz cekirdek,oyun --hizli   # düzenlerken: yalnız seçilen bölümler ("Test döngüsü")
node kopru.js --ana-sayfa --ac                # ana sayfa (oyun salonu): Dene / Yayın / Durdur / Motoru kapat
                                              # BASLAT.bat bunu --gizli ile penceresiz açar (günlük: motor-gunlugu.txt)
                                              # macOS: BASLAT.command, Linux: BASLAT.sh aynısını görünür Terminal penceresinde yapar
node kopru.js --deneme --oyun <ad> --ac       # köprü + oyun, TikTok'suz, sahte olaylarla
node kopru.js <tiktok_adi> --oyun <ad> --ac   # gerçek yayın (yalnız okur)
node araclar/paket.js <ad>                    # yayıncıya verilecek klasör → dist/<ad>/
node araclar/surum.js                         # yalnız bakımcı: Windows hazır paketi (kendi Node'u + kütüphane) ve ZIP → dist/surum-…/
```

Testler ve kareler bir tarayıcı ister. Kurulu Chrome'u göstermek en hızlısıdır:
`CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node araclar/test.js <ad>`
(yoksa bir kez `npx playwright install chromium`).

## Test döngüsü

Bütün testler (`node araclar/test.js`) yaklaşık 18 dakika sürer. Her değişiklikte hepsi gerekmez: değiştirdiğin şeyi
sınayan bölümü çalıştır. Bölümler: `derle`, `cekirdek`, `oyun` (her oyun için), `kopru`, `muzik`, `araclar` (bir kez).
`--yalniz` bölümleri seçer, `--hizli` çekirdek testlerindeki uzun dayanıklılık testini (9 × 10 sn) kısa sürümüyle
(4 × 10 sn) çalıştırır; başka hiçbir şeyi atlamaz. Her bölümün süresi sonda ÖZET'te yazar.

| Ne değişti | Düzenlerken | Bitirmeden önce ekle |
| --- | --- | --- |
| (a) yalnız `kopru.js` | `node araclar/test.js halay --yalniz kopru --hizli` | `araclar` (paketin içinden motoru açar) |
| (b) yalnız `cekirdek/ana-sayfa.html` | `node araclar/test.js halay --yalniz kopru --hizli` (ana sayfa testleri köprü testinin içinde) | `araclar` (pakete girdiğini denetler) |
| (c) bir oyunun `oyunlar/<ad>/js/` dosyaları | `node araclar/derle.js <ad>`, sonra `node araclar/test.js <ad> --yalniz derle,cekirdek,oyun --hizli` | müziğe (`OYUN.muzik`) dokunduysan `muzik` |
| (d) çekirdek `cekirdek/js/` | `node araclar/derle.js --hepsi`, sonra `node araclar/test.js --yalniz derle,cekirdek,oyun --hizli` (bütün oyunlar) | `node araclar/test.js --hizli` (köprü istemcisi, müzik, araçlar da çekirdeği kullanır) |

Kural: düzenleme döngüsünde `--hizli` ve `--yalniz`. Sürümden (ve `araclar/surum.js`'ten) önce bir kez tam koşu:
`node araclar/test.js` (`--hizli` olmadan). Bilgisayarda başka bir tarayıcı testi çalışmıyorsa `--serit 2` ekle:
oyun bölümleri ile köprü → müzik → araçlar aynı anda yürür. Başka bir tarayıcı testi çalışıyorsa tek şeritte kal;
iki şerit makineyi yorar, kare süresi ölçümleri kalabilir. Köprü test kapılarını araç kendisi boş bir bloktan seçer
(sabitlemek için `KOPRU_TEST_PORT`), iki koşu birbirinin kapısına çarpmaz.

## Harita

```
cekirdek/js/          çekirdek parçaları; başlarındaki yorum ne yaptıklarını söyler
cekirdek/sayfa.html   sayfa iskeleti: solda 9:16 sahne, sağda deneme paneli
cekirdek/ana-sayfa.html  BASLAT.bat'ın açtığı ana sayfa: açılış sahnesi (kütüphane orada iner), oyun salonu, bilet, Dene / Yayın
cekirdek/node-yok.html   Node.js kurulu değilse BASLAT.bat'ın tarayıcıda açtığı yardım sayfası
cekirdek/test/        her oyuna uygulanan testler ve köprü testleri
oyunlar/halay/        tam örnek oyun: Mendil Kimde? (bütün kancaları kullanır)
sablon/               en yalın oyun; yeni oyun bundan başlar
araclar/              derle, test, yeni-oyun, kare-cek, paket, muzik-hazirla, esitlik, ses-esitlik
kopru.js              TikTok yayınını yalnız okuyup oyuna aktaran program
docs/KANCALAR.md      çekirdek / oyun sözleşmesi   ← yeni oyun yazarken asıl başvuru
docs/OLAYLAR.md       olay biçimi ve CanliOyun arayüzü
docs/MIMARI.md        çekirdek nasıl çalışır
docs/MUZIK.md         her oyunun kendi müziği: takımlar, nota yazımı, ölçümler, oyun başına kendi parçaların
docs/YAYIN.md         yayıncı için: nasıl yayına verilir
```

## Değişmezler — bunları bozan değişiklik kabul edilmez

1. **İzleyici metni asla HTML olarak yazılmaz.** Ad ve yorum yabancıdan gelir: sayfaya `textContent`, tuvale
   `fillText`. `innerHTML`, `insertAdjacentHTML`, `document.write` yok.
   Hediyenin adı (`hediye.ad`, `docs/OLAYLAR.md`) da yabancıdan gelir; aynı kural geçer.
2. **Köprü salt okur.** Hesaba giriş, oturum bilgisi, çerez, yayına mesaj gönderme eklenmez; kolaylaştıran
   seçenek de açılmaz. Köprü yalnız `127.0.0.1` dinler, her istekte `Host`'a, soketlerde `Origin`'e bakar
   (`docs/OLAYLAR.md`); başka bir site olay akışını ve yayıncının adını okuyamaz. Ana sayfa kipinde kütüphaneyi
   kendisi indirir (sabit komut, `npm install --omit=dev`); testler bunun yerine `--kurulum-betigi <yol>` bayrağıyla taklidi kullanır (ortam değişkeni okunmaz).
   Komut satırı kiplerinde olay akışı yalnız her açılışta yeni bir kimlikle açılır (`/olay/<kimlik>`).
3. **Dışarıdan gelen her şey `olay(o)` üzerinden girer.** Sahte izleyici, köprü ve testler aynı kapıyı kullanır.
4. **Gerçek yayında sahte ad görünmez.** Köprüden açılan sayfada otomatik kalabalık kapalıdır.
5. **Ses ve görsel üretimdir.** Depoya ses dosyası, görsel, hazır model eklenmez; karakterler kodla çizilir.
   Var olan bir şarkının notası, başka bir yayının çizimi, adı ya da müziği kopyalanmaz. Mekanik alınabilir.
6. **Oyun tek dosyadır**, çalışırken dış bağımlılığı yoktur (yalnız Google Fonts; yüklenmezse yedek yazı
   tipiyle çalışır). Çerçeve, paketleyici, `import` / `export` eklenmez.
7. **Sahne 9:16'dır**, çizim 720×1280 sanal ölçekte yapılır. Alt beşte bir (1024 ve sonrası) TikTok'un yorum
   alanıdır, boş kalır.
8. **Tek saat müziğin vuruşudur (`B`).** Hareket ve süreler vuruşla ölçülür. Saat geri gitmez.
9. **`oyun.html` üretilir.** Kaynağı değiştir, derle, ikisini birlikte işle.
10. **Testler TikTok'a bağlanmaz.** Köprü testleri kütüphanenin taklidini kullanır.
11. **Her oyunun müziği kendinedir.** Oyun `OYUN.muzik` ile takımını seçer, kendi özgün havalarını yazar
    (`docs/MUZIK.md`). Bir oyunun davul zurnası (ya da başka havası) başka oyunda "şimdilik" bırakılmaz.

## Görsel çıta

Bu oyunlar bir yayında, küçük ekranda, kalabalıkla izlenir. Her oyunda aranan:

- **İzleyici kendini bulur.** Her izleyicinin sahnede bir karşılığı ve adı vardır; kalabalıkta da okunur.
- **Yüzler görünür.** İnsan çiziliyorsa iri başlı, kısa gövdeli, kameraya dönük (`insanEkle`, `kafaCiz`).
- **Kadraj her kalabalıkta doludur.** 1 kişide boş sahne, en kalabalık hâlde taşma olmaz (`oyunKamera`).
- **Lider bir bakışta ayrılır**; rol el değiştirdiğinde bunu herkes görür.
- **Her şey vuruşla oynar.** Duran hiçbir şey yoktur.
- **En büyük hediyenin bir gösterisi vardır.** Sahneyi birkaç saniyeliğine o kişi alır.
- **Tek bir renk dünyası.** Sahnenin zemini, ışığı ve yazıları aynı paletten gelir.

Testlerin geçmesi bunların hiçbirini göstermez. `node araclar/kare-cek.js <ad>` çalıştır, `kare-hepsi.png`
dosyasına kendi gözünle bak, gördüğün kusuru düzelt, yeniden bak.

## Bir oyun ne zaman bitmiştir

- `node araclar/test.js <ad>` 0 kalanla bitti.
- `kare-hepsi.png` dosyasına bakıldı: 1, 3, 9 kişi, tam kalabalık ve en büyük hediye karesinin her biri çıtayı
  tutuyor.
- En kalabalık hâlde, 1080×1920'de kare başına işlem 33 ms'nin altında (kare-cek yazar).
- `node kopru.js --deneme --oyun <ad>` ile açılıp sahte olayların oyuna işlendiği görüldü.
- `oyun.json` içinde oyunun kendi `aciklama` cümlesi var (ana sayfadaki kabin; şablonun cümlesi kalmadı).
- Oyunun kendi müziği var (`OYUN.muzik`, derleme müzik uyarısı vermiyor); müzik testi geçti ve
  `test/cikti/<ad>/muzik-onizleme.wav` kullanıcıya dinlemesi için verildi.
- Kullanıcıya neyin testle, neyin gözle doğrulandığı ve neyin hiç denenmediği söylendi (ses kulakla
  dinlenmedi, gerçek yayın denenmedi gibi).

## Yazım

- 2 boşluk girinti, noktalı virgül, tek tırnak. Biçimlendirici yok; çevredeki koda uy.
- Yorumlar "neden"i söyler. Birden çok ifade taşıyan satırın sonuna `//` yorumu ekleme: gerisini de yorum yapar.
- Kullanıcıya görünen metin tam Türkçe harflerle, düz ve kısa yazılır.

## Bilinen sınırlar

- `tiktok-live-connector` resmi değildir ve isteği imzalatmak için üçüncü bir hizmete gider; bir gün
  çalışmayabilir. 2.5.0 altı sürümler artık bağlanamıyor.
- TikTok LIVE Studio adımı bu depoda denenmedi (`docs/YAYIN.md` içindeki doğrulama tablosu).
- **Her oyunun müziği kendinedir.** Oyun `00-ayar.js` içinde `OYUN.muzik = { takim, havalar }` ile çalgı takımını
  seçer ve kendi özgün havalarını yazar; halayın davul zurnası başka oyunda çalmaz (`docs/MUZIK.md`). Depoda müzik
  dosyası yoktur; isteyen bir oyuna kendi kayıtlarını ekler, onlar yalnız `oyunlar/<ad>/muzik/` içinde durur.
