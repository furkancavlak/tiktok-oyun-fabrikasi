# Müzik: her oyunun kendi müziği

**Kural: her oyunun müziği kendinedir.** Halayın davul zurnası başka oyunda çalmaz. Yeni bir oyun yazıyorsan
müziğini de sen seçersin: hangi çalgı takımı, hangi ezgiler, hangi tempo. Bu belge nasıl yapılacağını anlatır.

Müzik `cekirdek/js/10-muzik.js` içinde üretilir (Web Audio). Depoda ses dosyası yoktur ve olmamalıdır.
İsteyen bir oyunda kendi kayıtlarını da çaldırabilir; bunlar o oyunun klasöründe durur, depoya girmez
(aşağıda, "Hazır parçalar").

## Oyunun müzik bildirimi: `OYUN.muzik`

Oyun müziğini kendi `js/00-ayar.js` dosyasında söyler:

```js
const OYUN = {
  // …
  muzik: {
    takim: 'dugun',              // çalgı takımı (aşağıdaki tablo)
    havalar: [                   // bu oyunun ezgileri; sırayla döner (en az iki, özgün)
      { id: 'kurdele', ad: 'Kurdele', bpm: 104, … },
      { id: 'selektor', ad: 'Selektör', bpm: 118, … }
    ]
  }
};
```

- `takim`: ezgiyi ve davul satırını hangi çalgıların çalacağı. Bilinmeyen ad yazılırsa derleme uyarır, sayfa
  konsola hata yazar (testler kalır) ve şimdilik davul zurna çalar.
- `havalar`: hava nesneleri (aşağıda). Takımın kendi hazır havası varsa id'siyle de anılabilir:
  `havalar: ['harman', 'toz', 'cifte']` (yalnız `davul-zurna`'nın hazır havaları var; onlar halayındır).
- Bildirim yoksa oyun eskisi gibi davul zurnayı ve halayın üç havasını çalar; `node araclar/derle.js` bunun için
  her seferinde uyarı yazar. Şablon (`sablon/js/00-ayar.js`) `takim: 'SEC'` ile gelir: seçmeden bırakılamaz.

Hangi oyun ne çalıyor:

| Oyun | Takım | Havalar | Tempo (vuruş/dk) |
| --- | --- | --- | --- |
| `halay` | `davul-zurna` | Harman Yeri, Toz Duman, Çifte Mendil | 104, 132, 84 |
| `konvoy` | `dugun` | Kurdele (hicaz), Selektör (nihavend) | 104, 118 |
| `vur-duzelsin` | `mac` | Naklen Yayın (majör), Tribün (dorian) | 112, 120 |

## Takımlar

| Takım | Ne çalar | Davul satırı harfleri | Ek satırlar |
| --- | --- | --- | --- |
| `davul-zurna` | Davul (tokmak, çubuk), kamışlı zurna, alttan dem. Köy meydanı, halay. | `D` düm, `T` tek, `k` hafif tek | yok |
| `dugun` | Darbuka, def zili, klarnet, alttan yumuşak bas. Düğün, oyun havası, konvoy. | `D` düm, `T` tek, `k` ka (hafif), `r` parmak trili (bir adımda üç hafif vuruş), `z` def zili | `ust`, `bas` |
| `mac` | Davul makinesi, yuvarlak synth bas, bakır nefesli ezgi, kısa akor vuruşları. Seksenler televizyon spor jeneriği, tribün. | `D` bas davul, `T` trampet, `g` hafif trampet, `c` el çırpma, `m` tom, `h` kapalı hi-hat, `o` açık hi-hat | `ust`, `bas`, `akor` |

Nasıl üretildikleri (hepsi klasik, sade tarifler; sıkıştırıcı ve yankı ortaktır):

- **davul-zurna**: düm, perdesi 150'den 52 Hz'e düşen sinüs + kısa gürültü; tek, 3,3 kHz bant gürültüsü + üçgen
  dalga. Zurna, testere + kare dalganın sert doymasından geçip 1,35 ve 2,75 kHz'de yükseltilmiş, kamışlı bir ses;
  dem aynı sesin alçak, sürekli kopyası.
- **dugun**: düm, 200'den 104 Hz'e inen sinüs; tek ve ka, 3–4 kHz bant gürültüsü + kısa çınlayan üçgen; def zili,
  7–9 kHz dar bant gürültüsü (iki çıngırak). Klarnet, kare + üçgen dalga (tek sayılı harmonikler), yumuşak alçak
  geçiren süzgeç, az nefes gürültüsü, geniş vibrato, notalar arası kaygan geçiş. Bas, üçgen + sinüs, kısa çekilen tel.
- **mac**: bas davul, 135'ten 48 Hz'e inen sinüs + tık; trampet, bant gürültüsü + ince ton; el çırpma, üç kısa
  gürültü + kuyruk; hi-hat, yüksek geçiren gürültü. Bas, testere + sinüs, 380 Hz'e kapanan süzgeç (oktav atlayan
  seksenler basına uygun). Ezgi, iki hafif akort farklı testere, hafif doyma, her notada açılıp kapanan süzgeç
  ("pat" diye açılan bakır); kısa, kesik çalar. Akor vuruşu, üç sesli testere akoru.

### Takım seçmek

Oyununun dünyasına bak: köy meydanı ve halay ise `davul-zurna`, düğün ve gelin arabası ise `dugun`, televizyon,
maç, tribün, seksenler ise `mac`. Hiçbiri uymuyorsa (ör. deniz kenarı, uzay, at yarışı) yeni takım ekle.
Var olan bir takımı seçmek serbesttir, ama havalar oyununun kendisinin olmalı.

### Yeni takım

`cekirdek/js/10-muzik.js` içine `TAKIMLAR.ad = …` ile eklenir. Sürekli çalan bir ezgi sesi olan takımlar için
`mzSurekliTakim({ … })` kurulumu, notayı, hava geçişini ve susmayı hazır getirir; takım yalnız şunları söyler:

```js
TAKIMLAR.ornek = mzSurekliTakim({
  ad: 'Kısa tarif',
  harf: { D: 'dum', T: 'tek', h: '' },  // davul / üst satır harfi → oyuna giden olay ('dum', 'tek'; '' = olay yok)
  dolgu: 'T',                            // coşku ve şovda davul satırının boş adımlarına konan harf
  satirlar: ['ust', 'bas'],              // havada okunan ek satırlar: 'ust', 'bas', 'akor'
  davulDuzey: 1.5, basDuzey: 0.2, akorDuzey: 0.07,
  ezgi: { dalga: [['square', 0.5, 0]], hp: 170, tepe: [[1500, 1.1, 4]], lp: 2600, lpQ: 0.6,
    vibHz: 6, seviye: 0.4, dip: 0.25, atak: 0.014, kesik: 0.94, kayma: 0.016, vib: [4, 16] },
  basSes: { dalga: [['triangle', 0.8]], lp: [500, 1400], q: 0.7, surme: 0.5, oktav: 0.25, boy: 2.5 },
  vur(m, harf, t, s, dur) { /* harfi çal: mzTon(…) ve mzGurultu(…) ile */ }
});
```

- Yapı taşları: `mzTon` (perdesi düşen ton: davul gövdesi, tom), `mzGurultu` (süzülmüş kısa gürültü: tokmak, zil,
  el çırpma, hi-hat), `mzEzgiKur` / `mzEzgiNota` (sürekli ezgi sesi), `mzBas`, `mzAkor`. Seslerin hepsi takımın
  veri yollarına (`m.ses.davul`, ezgi, `m.ses.bas`, `m.ses.akor`) bağlanır; sıkıştırıcı ve yankı ortaktır, yenisini
  kurma. `m.ses.kanal` (`davul`, `ezgi`, `eslik`, `yanki`) testlerin kolları tek tek kısması içindir.
- Sert ve tiz değil, sade olsun: yumuşak süzgeçler, orta düzeyler. Kulakla doğrulayamıyorsan ölç (aşağıda).
- Testlerdeki takım listesi kendiliğinden güncellenir; derleme uyarısı takım adlarını dosyadan okur.
- `davul-zurna`'ya dokunma: halay onunla örnek örnek aynı çalmalı (`node araclar/ses-esitlik.js halay --taban <ref>`).

## Bir havanın tanımı

```js
{ id: 'kurdele', ad: 'Kurdele',
  bpm: 104,        // dakikadaki vuruş (coşku 0 iken). OYUNUN HIZIDIR: bütün hareket vuruş saatine (B) bağlı
  spb: 4,          // vuruş başına adım: 4 = onaltılık, 3 = 6/8'lik sekizlik
  bar: 16,         // ölçü başına adım
  tonik: 329.6,    // karar sesinin frekansı (Hz)
  dizi: [0, 110, 390, 500, 700, 810, 1000],   // dizinin 7 sesi, karardan sent olarak (çeyrek sesler serbest)
  davul: { ana: 'D.D.k.T.D.k.T.r.', cesni: 'D.D.kkT.D.kkT.kr', gecis: 'D.krT.krD.krTrTr' },
  ust:   { ana: '..z...z...z...z.' },          // takım okuyorsa: zil, hi-hat (davulla aynı anda çalar)
  bas:   { ana: '1.1.....5.......' },          // takım okuyorsa: 1 kök, 3 üçlü, 5 beşli, 8 oktav (akorun kökünden)
  akor:  { ana: 'X.....x.......x.' },          // takım okuyorsa: x akor vuruşu, X vurgulu
  bolum: { A: '…', B: '…', D: '-:16 -:16' },
  eslik: { A: '0:16 0:16 1:16 0:16', B: '…' }, // akor kökleri (ezgiyle aynı yazım); bas ve akor buna göre çalar
  form: 'AABBD' }
```

Tempo seçerken oyununun hareketine bak: yürüyüş, vuruş, korna, dans hepsi vuruşla ölçülür. Tempo değişince oyunun
gerçek saatteki hızı değişir; oyunun testlerindeki gerçek zaman beklemelerini buna göre denetle.

## Ezgi yazımı

Bölüm, boşlukla ayrılmış notalardır: `derece:süre`.

| Yazım | Anlamı |
| --- | --- |
| `4:2` | Dizinin 4. derecesi, 2 adım. Derece 0 karardır; 7 bir oktav üstü, -1 kararın altı. |
| `5':2` | Üstten çarpma ile gir. |
| `0~:8` | Tril (üst komşu sesle). Uzun karar seslerinde kullanılır. |
| `-:2` | Sus. |
| `\|` | Ölçü çizgisi; yalnız okunurluk içindir. |

Her bölümün toplam süresi `bar`'ın tam katı olmalıdır; değilse konsola uyarı düşer ve test kalır. `eslik`
bölümleri ezgi bölümüyle aynı uzunlukta olmalıdır. Ezgi derecesi `h.sent`, frekansı `h.frek` ile bulunur.

## Davul ve öbür satırlar

Her satır, ölçü başına `bar` karakterlik dizgilerdir. Ölçüler sırayla `ana` ve `cesni` kalıbını çalar; bölümün
son ölçüsünde `gecis` çalınır. Kalıplardan biri yoksa yerine `ana` çalar. `.` boş adımdır. Harfler takıma göredir
(yukarıdaki tablo); takımın tanımadığı harf ya da yanlış uzunlukta kalıp konsola hata düşürür.

`D` adlı bölüm davul solosudur: ezgi, bas ve akor susar; davul ve üst satır `cesni` ve `gecis` kalıplarını
doldurarak çalar.

## Yeni hava yazarken

1. Oyununun `OYUN.muzik.havalar` dizisine ekle. `id` oyunda benzersiz ve ASCII olsun.
2. Ezgi **özgün** olmalı. Var olan bir türkünün, şarkının, marşın, tezahüratın, jeneriğin ya da reklam müziğinin
   notalarını yazma; tanınabilir bir ritim kalıbını da kopyalama. Bir hak sahibinin tanıyabileceği hiçbir şey olmasın.
3. En az iki hava yaz; çekirdek yaklaşık 100 saniyede bir, form başında sıradakine geçer.
4. `node araclar/test.js <ad>` çalıştır (aşağıdaki ölçümler). Sonra `test/cikti/<ad>/muzik-onizleme.wav` dosyasını
   dinle ya da kullanıcıya dinlet: ölçümler perdeyi, dengeyi ve farkı doğrular, kulağa hoş gelip gelmediğini
   doğrulamaz.

## Ölçümler

Kulak yerine ölçüm. Hepsi sesi dosyaya yazan bir bağlamda (OfflineAudioContext), oyunun kullandığı yoldan üretilir.

- `cekirdek/test/cekirdek.test.js` (her oyun): her havanın ezgi notaları hedef perdede mi, davul vuruşları
  zamanında mı, kırpılma var mı, davul solosunda ezgi susuyor mu, en yüksek düzey + en hızlı tempo + şovda tepe.
- `cekirdek/test/muzik.test.js` (bütün oyunlar birlikte; `node araclar/test.js` en sonda bir kez çalıştırır):
  - **ses yüksekliği**: K süzgeçli ortalama (BS.1770'e yakın, kapısız LUFS) davul zurnanın ±2,5 dB'i içinde;
    tepe < 0,95, kırpılma yok, sessiz yer yok, DC kayması < 0,002;
  - **denge**: davul, ezgi ve eşlik ayrı ayrı üretilir; davul ezgiden en çok 3 dB yüksek, en çok 8 dB alçak
    (davul zurnada 4–7 dB alçak); eşlik ezgiden en az 4 dB alçak;
  - **fark**: takımı farklı her iki oyun arasında ezginin tınısı (oktav bantlarındaki tayf zarfı ya da ilk on
    harmoniğin dizilişi, ortalama dB farkı ≥ 4) ve davulun tınısı (oktav bantları, ortalama dB farkı ≥ 3,5) ayrışmalı.
    Eşikler, aynı oyunun kendi havaları arasındaki farkın (ölçünün takım içi oynaması: ezgi ≤ 0,9 / 1,9 dB,
    davul ≤ 3,1 dB) üstündedir; aynı müziği çalan iki oyunda fark 0'dır. Aynı takımı seçen iki
    oyunun havaları da aynıysa test uyarı yazar.
  - Ölçümlerin tamamı `test/cikti/muzik-olcum.json`, dinleme önizlemeleri `test/cikti/<ad>/muzik-onizleme.wav`
    (30 sn, havalar sırayla).
- `node araclar/ses-esitlik.js <ad> --taban <git-ref>`: çekirdekte müziği değiştirdiysen bir oyunun müziğinin
  değişmediğini gösterir. Ses motoruna verilen her emri (düğüm, bağlantı, parametre çizelgesi, tampon içeriği)
  kaydedip karşılaştırır. Chrome aynı dosyayı iki kez ürettiğinde bile örnekler son basamaklarda (~1e-6)
  oynayabildiği için karar emir kaydına göre verilir; örnek farkı ayrıca yazılır.

## Hazır parçalar (isteğe bağlı, oyun başına)

Bir oyunda üretilen müzik yerine kendi kayıtlarını çaldırabilirsin: kendi yaptığın ya da kullanma hakkın olan
parçalar. **Parçalar oyunun kendi klasöründe durur: `oyunlar/<ad>/muzik/`** (paketlenince `dist/<ad>/muzik/`).
Bütün oyunların ortak kullandığı bir müzik klasörü yoktur; köprü yalnız açtığı oyunun klasörünü sunar. Klasör
yoksa hiçbir şey değişmez: oyunun kendi üretilen müziği çalar, deneme panelinde parça bölümü görünmez.

```bash
pip install librosa                                  # bir kez; mp3 için ffmpeg de kurulu olmalı
python araclar/muzik-hazirla.py "parçaların klasörü" <oyun adı>
python araclar/muzik-hazirla.py "C:/Users/ben/Muzik/konvoy" konvoy
```

Betik her parçanın vuruşlarını ölçer, dosyayı `oyunlar/<ad>/muzik/` altına Türkçe harfsiz bir adla kopyalar ve
`oyunlar/<ad>/muzik/liste.js` dosyasını yazar. Aynı parçayı iki oyunda istiyorsan betiği iki oyun için ayrı
çalıştır. Sonra oyunu aç: klasörde parça varsa müzik **yalnız o parçalardan** çalar, sırayla döner; panelde
üretilen havaların yerine parça düğmeleri görünür. Köprü açılırken hangi klasörü sunduğunu yazar
(`node kopru.js --deneme --oyun <ad>`). Üretilen müziğe dönmek için o oyunun `muzik/` klasörünü kaldır ya da adını
değiştir.

Nasıl çalışır:

- Parça bir ses öğesiyle (`Audio`) çalınır. Vuruş saati (`B`), parçanın **önceden ölçülmüş vuruş anlarından**
  gelir (`liste.js` içindeki `vurus`); tempo kayan kayıtta da hareket vuruşta kalır.
- Adım atılan nabız 75–150 vuruş/dk arasına alınır: izleyici çift tempo bulduysa iki vuruşta bir basılır.
  `kayma`, bas davulun en güçlü düştüğü vuruştur; dört vuruşluk döngü oradan başlar.
- Coşku arttıkça parça en çok %25 hızlanır (perde değişmez). Üretilen müzikte sınır %38'dir; kayıt daha
  fazla hızlanınca bozulur.
- Parça bitince sıradaki başlar. Ses kapalıyken ya da parça açılamazsa oyunun üretilen müziği sürer.
- Hediye zili ve çalgıcıların hareketi hazır parçada da çalışır; davul şovu yalnız görüntüdür.

Dikkat edilecekler:

- **`oyunlar/<ad>/muzik/` depoya girmez** (`.gitignore`'daki `muzik/` kuralı her derinlikte geçer). Parçalarının
  hakkı sende kalır; başkasının kaydını koyma, yayında telif sorunu sana döner.
- Baştan sona aynı tempoda, girişi kısa, sözsüz parçalar en iyi sonucu verir.
- Vuruş ölçümü kulakla doğrulanmaz. Hareket yarı ya da çift hızda görünürse `liste.js` yeniden üretilmeden
  düzelmez; betikteki 75–150 aralığını o parça için değiştir.

## YouTube'dan şarkı (yayıncı için)

Oyunun kendi müziği yerine kendi seçtiğin bir şarkıyı YouTube'dan çalabilirsin. Her oyunda aynı çalışır.

1. Oyunu BASLAT ile aç (diskten çift tıklanarak açılan oyunda YouTube çalmaz: "YouTube müziği yalnız BASLAT ile
   açılan oyunda çalışır." yazar).
2. Yayın masasının **Müzik** bölümündeki "YouTube'dan şarkı" kutusuna linki yapıştır, **Çal**'a bas.
   Kabul edilen linkler: `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`, `youtube.com/live/…`,
   `music.youtube.com/watch?v=…`; sonunda başka bilgiler ya da bir çalma listesi (`list=…`) olabilir.
3. Oynatıcı kutunun içinde görünür. Şarkı çalarken oyunun kendi müziği susar, sahnede havanın adı ve vuruş/dk
   yerine şarkının adı yazar. Hediye zili gibi efekt sesleri şarkının üstünde duyulmaya devam eder. **Durdur**'a
   basınca, şarkı bitince ya da **Oyunun müziğine dön**'e basınca oyunun müziği kaldığı yerden geri gelir.
   "YouTube sesi" kaydırıcısı yalnız şarkının sesini ayarlar; oyunun ses düğmesi ve düzeyi oyunun bütün sesini
   (müzik ve efektler) ayarlar.
4. "Yalnızca sahneyi göster" görünümünde şarkı çalmaya devam eder.

Bilmen gerekenler:

- **Telif sende.** Telifli şarkı çalarsan TikTok yayının sesini kısabilir ya da yayını kapatabilir, sorumluluk sende.
  Kutunun altında da bu cümle yazar.
- **Dans şarkıyı izlemez.** Hareket oyunun kendi temposunda sürer (ses kapalıyken olduğu gibi); şarkının temposuna
  uymaya çalışılmaz. Ritmi tutturmak istiyorsan `muzik/` klasörüyle kendi parçalarını kullan ("Hazır parçalar").
- **Bazı videolar çalmaz.** Sahibi başka sitelerde oynatmayı kapatmışsa "Bu video burada çalınamıyor…", video
  silinmiş ya da gizliyse "Bu video bulunamadı…" yazar; oyunun müziği geri gelir, başka bir link dene. Plak
  şirketlerinin resmî kliplerinin çoğu başka sitelerde çalmaya kapalıdır. İnternet yoksa "YouTube açılamadı…" yazar.
- YouTube bazen videonun önünde reklam gösterebilir; bu oyunun elinde değildir.
- Son çalışan link ve YouTube ses düzeyi o oyun için hatırlanır (tarayıcının kendi deposunda). Sayfa açılınca hiçbir
  şey kendiliğinden çalmaz.
- **İki yol.** Ses motorunda ana düzeyin (`muzik.ses.son`) altında iki yol vardır: `muzik.ses.muzikYol` (çalan müziğin
  hepsi: davul, ezgi, eşlik, yankı, davul şovu; takımların bağlandığı `ses.ana` buraya akar) ve `muzik.ses.efektYol`
  (tek seferlik efektler: hediye zili). YouTube çalarken yalnız müzik yolu ve hazır parçanın ses öğesi susar. Bir
  oyuna ya da çekirdeğe yeni bir efekt sesi (korna, alkış…) eklenirse `muzik.ses.efektYol`'a bağlanır; müziğin bir
  parçasıysa (çalan havanın içindeki dolgu gibi) takımın yollarına.
- Nasıl çalışır: yalnız YouTube'un resmî oynatıcısı (IFrame Player API, `youtube-nocookie.com`). Şarkı indirilmez,
  sesi ayrılmaz, aracı bir hizmet kullanılmaz. Oynatıcı ancak "Çal"a basınca yüklenir; basılmadıkça oyun YouTube'a
  hiçbir istek göndermez (`AGENTS.md` değişmez 6). Kod: `cekirdek/js/12-youtube.js`; oyunun müziğini kısan
  `muzik.disSustur(evet, ad)`.

## Adlar

| Ad | Ne |
| --- | --- |
| `OYUN.muzik` | oyunun müzik bildirimi: `{ takim, havalar }` |
| `TAKIMLAR`, `TAKIM`, `HAVALAR` | çekirdekteki takımlar, oyunun seçtiği takım, oyunun havaları (`CanliOyun._test` içinde de) |
| `window.OYUN_MUZIK` | `oyunlar/<ad>/muzik/liste.js` içinde `muzik-hazirla.py` tarafından yazılan parça listesi |
| `window.OYUN_MUZIK_KAPALI` | Doğruysa `muzik/` klasörü yok sayılır; testler üretilen müziği sınamak için bunu kullanır |
| `muzik.disSustur(evet, ad)`, `muzik.disSessiz` | Oyunun müziğini dışarıdan kısar / geri açar (YouTube çalarken): yalnız `muzikYol` ve hazır parçanın ses öğesi. Efektler, saat, hava, tempo, ses açık / kapalı, ana düzey aynı kalır |
| `muzik.disAd` | Dışarıdan çalan şarkının sahnede yazılacak adı: temizlenmiş, en çok 36 karakter, düz metin (boşsa "YouTube'dan şarkı"); dış kaynak yokken `null`. Sahnedeki çalan satırı (`35-kare.js`) bunu okur |
| `muzik.ses.muzikYol`, `muzik.ses.efektYol` | Ana düzeyin altındaki iki yol: müzik (takımların `ses.ana`'sı buraya akar) ve tek seferlik efektler (hediye zili) |
| `CanliOyun.youtube` | YouTube kutusu (`12-youtube.js`): `kur(kutu)`, `linkCoz(metin)`, `cal(link)`, `durdur()`, `don()`, `durum()` |
