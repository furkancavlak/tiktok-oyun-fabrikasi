# Çekirdek ile oyun arasındaki sözleşme

Bu depo bir fabrikadır: **çekirdek** her TikTok yayın oyununda aynı kalan işi yapar, **oyun** yalnız kendine
özgü olanı yazar. Bu belge ikisi arasındaki sınırı tanımlar. Yeni oyun yazan (insan ya da ajan) çekirdeğe
dokunmaz; burada adı geçen kancaları doldurur.

## Depo düzeni

```
cekirdek/
  sayfa.html, stil.css      sayfa iskeleti (sahne + yayın masası paneli); metinler OYUN ayarından doldurulur
  ana-sayfa.html            BASLAT.bat ile açılan ana sayfa (oyun salonu: her oyun bir kabin; kabin rengi oyun kimliğinden kendiliğinden seçilir); köprü sunar, derlemeye girmez
  js/NN-*.js                çekirdek parçaları (aşağıda)
  test/                     ortak.js, cekirdek.test.js (her oyuna uygulanır), muzik.test.js (bütün oyunlar),
                            kopru.test.js, araclar.test.js
oyunlar/<ad>/
  oyun.json                 { "ad": "Görünen Ad", "paket": "dosya-adi", "aciklama": "Tek cümle." }
                            aciklama: ana sayfadaki oyun kabininde görünen tek, düz cümle; kurallardan yazılır
                            ("Yorum yazan halaya girer, beğeni tempoyu artırır, en çok hediye atan mendili alır.").
                            İsteğe bağlı "vitrin": false oyunu ana sayfadan gizler (komut satırından yine açılır).
  js/00-ayar.js             const OYUN = { … }  (HER ZAMAN İLK birleştirilir)
  js/NN-*.js                oyunun kancaları ve kendi çizimi
  test.js                   (isteğe bağlı) oyuna özgü kontroller
  muzik/                    (isteğe bağlı, depoya girmez) bu oyunun kendi hazır parçaları (docs/MUZIK.md)
  oyun.html                 ÜRETİLİR (derleme çıktısı; depoda durur)
sablon/                     en küçük çalışan oyun; `araclar/yeni-oyun.js` bunu kopyalar
araclar/                    derle.js, test.js, yeni-oyun.js, kare-cek.js, paket.js, muzik-hazirla.py,
                            esitlik.js (piksel), ses-esitlik.js (müzik)
kopru.js, BASLAT.bat        TikTok köprüsü ve Windows başlatıcısı
```

## Derleme

`node araclar/derle.js <ad>` şu sırayla tek bir kapalı işlevin içine birleştirir ve `oyunlar/<ad>/oyun.html`
yazar:

1. `oyunlar/<ad>/js/00-ayar.js`
2. `cekirdek/js/*.js` (ada göre sıralı)
3. `oyunlar/<ad>/js/` altındaki diğer dosyalar (ada göre sıralı)

Hepsi aynı kapalı işlevde olduğu için parçalar birbirinin adlarını doğrudan görür; `import` / `export` yoktur.
İşlev bildirimleri (`function ad() {}`) dosya sırasından bağımsız çağrılabilir; `const` / `let` ise ancak
tanımlandığı satır çalıştıktan sonra kullanılabilir. Bu yüzden `OYUN` ilk dosyadadır, kancalar işlev
bildirimi olarak yazılır. Açılış (`oyunBaslat` ve ilk kare) bütün dosyalar çalıştıktan sonra, bir mikro görevde
yapılır: oyunun kendi dosyalarındaki üst düzey `const` / `let` adları kancalar çağrıldığında hazırdır.
Oyunun üst düzeyde `D`'ye alan eklemesi (`Object.assign(D, { … })`) de böylece açılıştan önce olur.

Derleme zorunlu kancalardan biri işlev bildirimi olarak bulunmazsa adını yazıp durur.

Diğer komutlar: `node araclar/derle.js --hepsi` (ad verilmezse de böyle), `node araclar/derle.js --denetle [ad]`
(çıktı güncel değilse 1 ile çıkar; ad yoksa her oyun), `node araclar/derle.js <ad> --parca yol.html`
(html / head / body etiketsiz parça). Sekme başlığı `oyun.json`daki `ad`dır.

## Değişmez adlar

| Ad | Ne |
| --- | --- |
| `window.CanliOyun` | dışarıya açık arayüz: `olay`, `durum`, `baglan`, `kes`, `cevir`, `kopruBitti`, `_test` |
| `window.OYUN_KOPRU` | köprünün sayfaya yazdığı WebSocket adresi |
| `window.OYUN_MUZIK` | oyunun `muzik/liste.js` dosyasındaki hazır parça listesi (`oyunlar/<ad>/muzik/`) |
| `window.OYUN_MUZIK_KAPALI` | doğruysa `muzik/` klasörü yok sayılır (testler kullanır) |

## Oyunun ayarı: `OYUN`

```js
const OYUN = {
  id: 'mendil-kimde',                    // ASCII; tarayıcı saklama anahtarlarının öneki
  ad: 'Mendil Kimde?',
  logo: ['Mendil', 'Kimde?'],            // ikinci parça vurgu rengiyle yazılır
  nasil: { yorum: 'Yorum: halaya gir', begeni: 'Beğeni: tempo', hediye: 'Hediye: mendil' },
  yazi: {
    sira: 'Halay sırası', gosterge: 'Coşku', bos: 'Meydan boş. İlk yazan mendili alır.',
    birim: 'kişi', ses: 'Davul zurnayı başlat', sahne: 'Halay sahnesi', giris: 'halaya girer'
  },
  kapasite: 36,                          // sahnede aynı anda en çok kaç izleyici
  kademe: [                              // BÜYÜKTEN KÜÇÜĞE; sonuncunun min değeri 1 olmalı
    { min: 1000, ad: 'Meydan senin', tip: 'solo', etki: 'Gönderen ortaya çıkar, tek başına oynar' },
    { min: 1, ad: 'Zıpla', tip: 'zipla', etki: 'Gönderen zıplar' }
  ],
  tohum: [['zeyno.47', 320], ['elif_naz', 10]],   // deneme açılışındaki sahte kalabalık: [ad, jeton]
  sahteYorum: ['halay!', 'çek çek çek'],          // sahte izleyicinin yazdıkları
  sahteAd: ['halaysever06'],             // isteğe bağlı: sahte izleyici adları (yoksa çekirdeğin genel listesi)
  renk: {},                              // isteğe bağlı: tema renklerini ezer (aşağıda)
  panelRenk: {},                         // isteğe bağlı: yayın masasının renkleri ayrı (aşağıda, "Tema")
  kamera: {},                            // isteğe bağlı: { egim, F, enYakin, ustPay, altPay, ustPx, altPx, x, on, odakEn }
  etiket: {},                            // isteğe bağlı: { ustSinir, altSinir, disari, balonSira } ("Ad etiketleri")
  sahneYazi: {},                         // isteğe bağlı: { pankart: 'alt' } ("Sahne yazıları")
  muzik: { takim: 'davul-zurna', havalar: ['harman', 'toz', 'cifte'] }   // OYUNUN KENDİ MÜZİĞİ ("Müzik")
};
```

Kademenin isteğe bağlı `seriAd` alanı: hediye bu kademeye yalnız seriyle gelmişse (tek hediyenin jetonu kademenin
`min`'inin altında, adet × jeton üstünde) bildirim ve akış satırı `ad` yerine `seriAd` yazar. Kademenin adı tek
seferlik bir ödül söylüyorsa (Gelin Konvoyu 3B: `{ min: 1000, ad: 'Süper araba', seriAd: 'Drift şov' }`) seri onu
vaat etmesin diye. Masanın hediye düğmeleri ve "Bu oyunda hediyeler" listesi `ad`'ı yazar. Verilmezse bir şey değişmez.

Yeni oyun şablonu (`sablon/js/00-ayar.js`) önerilen ayarlarla gelir: `etiket: { ustSinir: true, altSinir: true,
disari: 'gizle' }`, `sahneYazi: { pankart: 'alt' }`. Bunlar verilmezse çekirdek eski davranışı sürdürür (var olan
oyunlar böyle çalışır).

### Müzik: `OYUN.muzik`

**Her oyunun müziği kendinedir.** Halayın davul zurnası başka oyunda çalmaz. Oyun `muzik` alanında bir çalgı
takımı seçer ve kendi havalarını yazar:

```js
muzik: {
  takim: 'dugun',             // 'davul-zurna' (halay), 'dugun' (darbuka, def, klarnet), 'mac' (seksenler TV spor
                              // jeneriği: davul makinesi, synth bas, bakır nefesli) ya da çekirdeğe eklenen yeni takım
  havalar: [ { id: 'kurdele', ad: 'Kurdele', bpm: 104, spb: 4, bar: 16, tonik: 329.6, dizi: […], davul: {…},
               bolum: {…}, form: 'AABBD' }, … ]          // en az iki ÖZGÜN hava
}
```

Takımların tarifi, nota ve davul yazımı, yeni takım ekleme ve ölçümler `docs/MUZIK.md`'dedir. Hava temposu
(`bpm`) oyunun hızıdır: bütün hareket vuruş saatine (`B`) bağlıdır. Bildirim yoksa oyun öntanımlı davul zurnayı
çalar ve `derle.js` her seferinde uyarır; şablon `takim: 'SEC'` ile gelir, seçilmeden test geçmez. Oyunun kendi
kayıtları (isteğe bağlı) yalnız `oyunlar/<ad>/muzik/` klasöründen çalar.

`yazi` içinde ayrıca isteğe bağlı `bosalt` (masadaki boşaltma düğmesi; basınca önce onay sorar) vardır. Eksik `yazi` alanları genel
karşılıklarıyla doldurulur. Kademeler çekirdekte büyükten küçüğe sıralanır ve en küçüğünün `min`'i 1'e çekilir.
Sahte izleyici hediyeyi kademelerden seçer: en büyüğü %0,7, ikincisi %3,8, üçüncüsü %10,5, dördüncüsü %25,
kalanı en küçüğü. `kamera.enYakin` verilmezse `F / 190`; `ustPay` (1.5) en arkadakinin ayağından adının üstüne,
`altPay` (0.15) en öndekinin ayağının altına bırakılan pay (metre).

Tema renkleri (`RENK`, CSS'te aynı adla `--zemin` vb.): `zemin`, `zemin2`, `zemin3`, `cizgi`, `vurgu`,
`sicak`, `serin`, `acik`, `soluk`, `murekkep`. `#rrggbb` biçiminde verilir. Çekirdek sahne üstü yazıları ve
etiketleri bunlarla boyar; panel açılışta CSS değişkenlerine (`--zemin-2` …) yazar. Uyarı: stil dosyasındaki
yarı saydam tonlar (`rgba(8,10,28,…)`, `rgba(246,236,217,…)`) eski yayın tarayıcılarında da çalışsın diye düz
yazılmıştır; `murekkep` ya da `acik` çok değişirse bu tonlar temadan ayrışır.

**Tema: sahne ve panel.** `OYUN.renk` hem sahneyi hem yayın masasını (panel, sayfanın arka planı) boyar. Sahnen
gündüz ya da açık renkliyse (`zemin: '#87c5ea'`) panel de açık renge döner ve okunmaz olur. O zaman
`panelRenk: {}` ver: sahne ve sahne üstü yazılar `renk`ten, panel ve sayfanın arka planı çekirdeğin koyu temasından
gelir (`panelRenk` içinde verdiğin adlar o temayı ezer). Sahne üstü yazılar (sıralama kutusu, gösterge, bildirim,
pankart) sahnenin parçasıdır, `renk`i kullanır.

```js
renk: { zemin: '#87c5ea', zemin2: '#bfe3f5', zemin3: '#2f6f9f', acik: '#fffaf0', murekkep: '#1d2433' },
panelRenk: {}            // panel koyu kalsın
```

## Kancalar (oyun bunları işlev bildirimi olarak tanımlar)

| Kanca | Ne zaman | Ne yapar |
| --- | --- | --- |
| `oyunBaslat(kayit)` | açılışta, tohum kalabalık kurulduktan sonra | Oyunun kendi durumunu kurar, oyuncuları yerine koyar, arka planı hazırlar |
| `oyunBosalt()` | "boşalt" düğmesinde, oyuncular silindikten sonra | Oyunun kendi durumunu sıfırlar |
| `oyunGiris(k)` | yeni izleyici katıldığında (`siraGuncelle` sonrası) | Giriş konumunu verir (`k.x`, `k.z`); sahneye dışarıdan gelsin |
| `oyunYerlesim()` | sıra her değiştiğinde | `D.sira` içindeki herkesin hedef yerini hesaplar |
| `oyunHediye(k, jeton, kademe, hediye, sayi)` | hediye sayıldıktan, sıra güncellenmeden önce | Kademenin sahnedeki etkisini başlatır. `hediye` hangi hediye olduğu: `{ id, ad }` ya da bilinmiyorsa `null` ("Hediyenin kimliği"). `sayi = { birim, adet }`: tek hediyenin jetonu ve kaç tane geldiği (seri; olay adet taşımıyorsa 1). `jeton` = birim × adet |
| `oyunLiderDegisti(eski, yeni)` | `D.lider` değişince | Rol devri: pankart, konfeti, işaretin el değiştirmesi |
| `oyunGuncelle(dt)` | her kare, müzik saatinden sonra | Hareket ettirir, süreleri ilerletir, eklemleri kurar |
| `oyunKamera()` | her kare | Kadraja girmesi gereken yer noktalarını döndürür: `[[x, z], …]` ya da seçenekli nesne ("Kamera") |
| `oyunZemin()` | her kare, kamera kurulduktan sonra | Arka planı ve zemini doğrudan `c` ile çizer (gölgeler dahil) |
| `oyunCiz()` | her kare, çizim listesi boşaltıldıktan sonra | Sahnedeki her şeyi çizim listesine ekler (`kap`, `ozel`, `insanEkle`) |
| `oyunUst(dt)` | isteğe bağlı; liste çizildikten sonra | Listenin üstüne çizilenler (uçan nesne, ışık) |
| `oyunEkAdlar()` | isteğe bağlı | Etiketi olacak izleyici olmayan oyuncuları döndürür (`ozel: true`, `ad`, `et`) |
| `oyunDurum(d)` | isteğe bağlı; `CanliOyun.durum()` içinde | Duruma oyuna özgü alan ekler |

Çekirdeğin her karede yaptıkları (sırayla): müzik saati (`B`) → coşkunun sönmesi → boşta kalanı çıkarma →
`oyunGuncelle` → çıkanları silme → `kameraSigdir(oyunKamera())` → `oyunZemin` → `oyunCiz` → listeyi derinliğe
göre çizme → `oyunUst` → ad etiketleri ve konuşma balonları → konfeti / kalpler → kenar karartması →
sahne üstü yazılar.

Ayrıntılar:
- Boşta kalan: 45 karede bir, `zaman - k.son` sınırı aşan bir kişi `cikar(k)` ile çıkar (24 kişiden kalabalıkta
  75 sn, değilse 240 sn; hediye atanın süresi `jeton × 4` sn, en çok 600 sn uzar). Lider ve `k.yildiz` çıkarılmaz.
- Çıkanları silme: `k.cikiyor` olan, 1,7 sn geçince ya da oyun `k.gitti = true` deyince `D.oy`'dan silinir.
  Çıkan oyuncuyu sahneden götürmek `oyunGuncelle`'nin işidir.
- `oyunCiz` çağrılmadan önce her izleyicinin `k.et`'i boşaltılır; o karede çizilmeyenin etiketi çıkmaz.
- Çizim listesi `oyunZemin`'den SONRA boşaltılır: `oyunZemin` içinde `kap` / `top` / `ozel` ile eklenen şey
  çizilmez. Zeminde yalnız `c` ile doğrudan çiz; derinliğe göre sıralanması gereken her şeyi (ağaç, direk)
  `oyunCiz`'de ekle.
- `ozel(derinlik, fn)` içindeki `fn` liste çizilirken çalışır: içinden `kap` / `top` / `ozel` çağırma (liste o
  anda sıralanmış ve dönülüyor, sıra bozulur). `fn` içinde yalnız `c` ile doğrudan çiz. Araç gibi tek parça
  nesneler böyle çizilir: bir `ozel`, içinde `pr()` ile bulunan noktalara `c` çizimi.
- Açılıştaki tohum kalabalık için `oyunGiris` çağrılmaz; sıra `oyunYerlesim` → `oyunBaslat` olur. Oyuncuya
  kendi alanlarını ekliyorsan (araç rengi, binek) bunu tek bir "hazır mı" işlevinde yap ve `oyunYerlesim`,
  `oyunGiris`, `oyunBaslat` üçünden de çağır.
- Derlenen kod katı kipte çalışır (`'use strict'`): bildirilmemiş değişkene atama hata verir.
- Bir kancan hata verirse o kare yarım kalır ama döngü sürer: deneme görünümünde sahnenin ortasında kırmızı
  bir şerit hatanın iletisini yazar, hata konsola bir kez düşer. Karede kırmızı şerit görüyorsan önce onu
  düzelt; adların çıkmaması ya da kameranın yaklaşmaması çoğu zaman bunun sonucudur. Sık neden: bir alanın
  tanımsız kalıp hesabı `NaN` yapması. Yayın görünümünde (`#yayin`) şerit çizilmez.
- `kameraSigdir` her noktanın yanına öntanımda 0,55 m pay ekler (bir insanın yarı genişliği). Daha geniş nesnede
  (araba) üçüncü değerle payı ver: `[x, z, 1.1]` ("Kamera").
- Hepsi tek kapalı işlevde olduğu için oyunda çekirdekteki bir adla (`kutuCiz`, `renkKat`, `ETIKET` …) işlev
  yazarsan çekirdeğinkini sessizce ezersin; derleme bunu `UYARI` diye yazar. Aynı adla `const` / `let` sayfayı
  açtırmaz; derleme adını söyleyip durur. Çekirdeğin adları aşağıda; kendi adlarını oyuna özgü seç.
- `muzik.sov`'u çekirdek değiştirmez; oyun açıp kapatır (halay: `oyunHediye` ve `oyunGuncelle` içinde
  `muzik.sov = B < D.sovBit`).

**Tek hediyenin değeri.** `oyunHediye`'nin beşinci bilgisi `{ birim, adet }`: "tek seferde şu kadar jetonluk hediye"
gibi bir kural toplamla (`jeton`) değil `birim` ile bakar; 100 jetonluk hediyeden 10 tanelik seri `{ birim: 100, adet: 10 }`
gelir, `jeton` 1000'dir. Deneme düğmeleri ve sahte kalabalık adet yollamaz (`adet: 1`, `birim` = `jeton`).

**Hediyenin kimliği.** `oyunHediye`'nin dördüncü bilgisi hangi hediyenin geldiğidir: `{ id, ad }` (biri eksik
olabilir) ya da kimlik bilinmiyorsa `null` (eski köprü, elle `olay` çağrısı). Üç bilgiyle yazılmış kancalar
değişmeden çalışır. `id` platformun hediye numarasıdır (metin), `ad` hediyenin adı (düz metin, en çok 40
karakter). Ad yabancıdan gelir: sahnede göstereceksen yalnız `fillText`, sayfada yalnız `textContent`. Kurala
numarayla bak; ad dile göre değişebilir. Gerçek numaraları bu depo doğrulamadı: önce gerçek yayında panelin olay
akışına bak (jetonun yanında ad yazar). Deneme yolları `deneme-` önekli sahte kimlik yollar (docs/OLAYLAR.md).

```js
const GUL = ['deneme-gul', '5655'];           // 5655: örnek numara, canlı yayında doğrula
function oyunHediye(k, jeton, kademe, hediye) {
  D.ip += (hediye && GUL.includes(hediye.id) ? 1 : -1) * jeton;   // Gül sağa çeker, başka hediye sola
}
```

## Çekirdeğin oyuna sunduğu adlar

**Durum**
- `D`: `oy` (kimlik → oyuncu `Map`), `sira` (jetona göre azalan dizi), `lider` (`sira[0]`), `cosku` (0–1),
  `begeni`, `sarsinti`. Oyun kendi alanlarını `D`'ye ekler.
- `zaman` (saniye), `B` (müzik vuruşu, kesirli; **tek saat budur**), `calgi` (`dumP`, `tekP`: vuruş anında 1'e
  çıkıp sönen nabızlar; `perde`), `muzik` (`sov` alanını oyun ayarlar: doğruysa tempo biraz artar).
- `OYUN`, `KADEME`, `MAKS`, `RENK`.

**Oyuncu `k`** (`karakterYap(id, ad)`): `id`, `ad`, `jeton`, `son` (son etkileşim), `katilim`, `sn` (sıradaki
yeri), `g` (görünüm), `x`, `z`, `y0`, `yon`, `yer` (0–1 yerine oturdu mu), `cikiyor`, `cikis` (çıkış zamanı),
`balon`, `zip0` / `zip1` (hediye sevincinin vuruş aralığı), `kos`, `j` (eklemler), `p` (ekrana düşmüş eklemler),
`f` / `l` (baktığı yön ve sol yanı; `iskeletKur` yazar), `mod` (izleyicide `'oyuncu'`), `yeni`, `et`
(etiketin ekrandaki yeri `{ x, y, s, d }`: başın tepesi, ölçek, derinlik; `insanEkle` kendisi kurar), `ozel`.
Oyunun yazdığı bayraklar:
- `yildiz`: öne çıkmış (halayda solo yapan). Boşta kalsa da çıkarılmaz, kalabalık dolunca yerinden edilmez,
  adı liderden sonra en öncelikli etikettir.
- `gitti`: çıkan oyuncu sahneden uzaklaştı, şimdi silinsin.
- `ozel`: izleyici olmayan oyuncu (çalgıcı, hakem): etiketi vurgu renginde ve öncelikli; sıradaki ilk beş payı yok.
- `guler` (hep güler), `ciddi` (hiç gülmez), `ufle` (yanaklar şişkin, ağız kapalı): `kafaCiz` bunlara bakar.
  Hiçbiri yoksa hediye sevinci süresince (`B < k.zip1`) ve `D.cosku > 0.72` iken güler.

**Olaylar ve yazılar:** `olay(o)`, `katil(id, ad, zorla)`, `cikar(k)`, `siraGuncelle()`, `bildir(ad, orta,
vurgu)`, `pankart(satir1, satir2)`, `gunluk(tur, ad, metin, hediye, id)` (son ikisi isteğe bağlı: `hediye` satırı
vurgulu yazar (`true`; çekirdeğin hediye satırı `{ jeton, ad, adet, kademe }` verir), `id` verilirse satırdaki ada
basınca yayıncının "Adını gizle" / "Sahneden çıkar" işlemleri açılır; "Yayın masası"), `konfeti(adet, guc)`, `kalpAt(adet)`.

**Sahne:** `c` (2B çizim bağlamı, 720×1280 sanal ölçekte), `GW`, `GH`, `ALAN_UST`, `ALAN_ALT`, `kam`,
`pr([x, y, z])` → `{ x, y, s, d, ok }`, `kap(pa, ra, pb, rb, renk, derinlik)` (iki ucu farklı yarıçaplı kapsül),
`top(p, r, renk, derinlik, cizgi)` (`cizgi`: isteğe bağlı çizgi kalınlığı), `ozel(derinlik, fn)`, `kapYol(...)`,
`golge(x, z, rx, rz)`, `ik(...)`, `renkSaydam('#rrggbb', a)`, `MUREKKEP`. Derinlikte büyük sayı uzak demektir;
eşit derinlikler eklendikleri sırayla çizilir. Çekirdeğin kendi çağırdıkları: `kameraSigdir(oyunKamera(), dt)`
(sonunda `kam.son = { enX, hd }`: bakılan x'ten en geniş uzaklık ve derinliğin yarısı; zemini kalabalığa göre
büyütmek için), `ETIKET_PAY` (36: bir ad satırının piksel yüksekliği),
`listeCiz()`, `etiketCiz(ekler)`, `kenarKarart()`.

**İnsan takımı** (izleyici insan olarak çizilecekse): `gorunumUret(id)`, `iskeletKur(k, poz)`, `kolKur(k)`,
`pozBekle(k)` (vuruşla sallanan bekleme pozu), `pozOtur(k, oturakY)` (oturma pozu), `insanEkle(k)` (gövde + baş;
`k.et` kurulur), `kafaCiz(k, ph, olcek)` (yalnız baş; araç penceresi gibi yerlerde), ölçüler `KALCA`, `GOGUS`, `KAFA_Y`, `KAFA_R`, `BACAK`, `KOL`.
- `poz = { hipX, hipY, egim, yat, omL, omR, aS, aL }`: kalçanın yana kayması ve yüksekliği (`KALCA` ayakta),
  öne eğilme, yana yatma, omuzların kalkması, sağ / sol ayak `[yana, ileri, yukarı]` (karakterin yerel ekseninde).
- `iskeletKur(k, poz)` `k.x`, `k.z`, `k.y0`, `k.yon` ve boydan eklemleri kurar; `W(yana, yukarı, ileri)` yerel →
  dünya çeviricisini döndürür (ayrıca `k._W`, `k._hipX`, `k._hipY`). Elleri (`k.j.haL`, `k.j.haR`) çağıran
  `W` ile koyar, sonra `kolKur(k)`.
- `insanEkle(k)` çizildiyse `true` döner; `k.p` o zaman o karenin ekran noktalarıdır (oyunun `k.j`'ye eklediği
  çalgı gibi eklemler de dahil), üstüne çalgı ya da eşya bu noktalarla eklenir.
- Hepsi isteğe bağlı, verilmezse eski görünüş:
  - `k.basYon` (sayı): başın dünyadaki yönü (`k.yon` gibi, π kameraya bakar). Gövde yerinde dururken baş yana
    döner: konuşana, paraya, yıldıza bakmak. `kafaCiz` doğrudan çağrıldığında da geçerlidir.
  - `k.basOlcek` / `kafaCiz(k, ph, olcek)`: başın büyüklük çarpanı (lider iri başlı, büyüyen arabanın sürücüsü).
    Ad etiketi büyüyen başın üstüne kayar.
  - `pozOtur(k, oturakY)`: oturma pozu; `oturakY` oturağın üst yüzünün `k.y0`'dan yüksekliği (metre, öntanım
    0,2 × boy). Alçak oturakta ayaklar yerde dizler kalkık, yüksek oturakta (sedir 0,42) ayaklar sarkar ve vuruşla
    sallanır. Döndüğü pozda `dizR` / `dizL`: elleri dizlere koymak için yerel nokta. `k.y0` yer (ayakların altı)
    olarak kalır, oturağı oyun çizer.
  - `k.elSekil = { R: 'yumruk', L: 'avuc' }`: el biçimi. `avuc` açık el (el sallama, tokat, "dur"), `yumruk` kapalı
    el. Parmaklar önkolun doğrultusundadır, başparmak gövdeye bakan yanda. Tanımsızsa yuvarlak el.
  - `k.kolBoy` (öntanım 1): kol kemiklerinin çarpanı. Uzağa uzanan, tavana tutunan, para uzatan kol 1,3–1,8.
  - Çizilen başın yeri `k.basEkran = { x, y, r, kare }` (testler ve `kare-cek` okur); çene `k.et.alt`.

```js
// sedirde oturan, başını konuşana çeviren, yumruğunu sallayan izleyici
k.y0 = 0;
const poz = pozOtur(k, 0.42), W = iskeletKur(k, poz);
k.j.haR = W(-0.22, poz.hipY + 0.5, 0.1);          // havaya kalkan sağ el
k.j.haL = W(...poz.dizL);                         // sol el dizde
k.elSekil = { R: 'yumruk' };
k.basYon = k.yon + 0.6;                            // gövde kameraya, baş biraz sola
kolKur(k);
// oyunCiz içinde: insanEkle(k); oturağı ozel(...) ile kendin çiz
```

**Kamera.** `oyunKamera()` ya eski biçimde `[[x, z], …]` döndürür (kamera x = 0'a bakar, herkes sığar) ya da
seçenekli bir nesne. Seçenekler `OYUN.kamera` içinde de kalıcı yazılabilir (nesnedeki değer onu ezer).

| Seçenek | Ne yapar |
| --- | --- |
| `noktalar: [[x, z, pay], …]` | Kadraja girecek yer noktaları. `pay` (metre, öntanım 0,55) noktanın yana genişliği: araba için 1,1, televizyon için 1,2 |
| `x: sayı \| 'orta'` | Kameranın baktığı x. `'orta'`: noktaların (odak varsa odağın) yatay ortası. Sahne yana kaymışsa uzaklaşmadan bakar |
| `odak: [[x, z, pay], …]`, `odakEn: 1.25` | Hep büyük kalacak nesne (televizyon, sahne, gelin arabası). Kalabalık kamerayı odağın gerektirdiğinden en çok `odakEn` kat uzaklaştırır; fazlası kadrajdan taşar, kadraj odağa ortalanır |
| `on: metre` | En öndeki noktadan bu kadar derine kadar sığdır; daha derindekiler (konvoyun kuyruğu) üstten taşabilir |
| `ustPx`, `altPx` | Şeridin üstünde / altında piksel payı. `ustPay` metre olduğu için ad etiketi gibi ekranda sabit boyda kalan şeyi tutmaz: `ustPay`'i başın tepesine (≈1,05) indir, `ustPx: 36` ver (bir ad satırı; çekirdekte `ETIKET_PAY`, ama `00-ayar.js` çekirdekten önce çalıştığı için orada sayıyı yaz) |

```js
function oyunKamera() {
  return {
    noktalar: D.sira.map(k => [k.hedefX, k.hedefZ]),
    odak: [[-1.3, 0.9, 1.2], [1.3, 0.9, 1.2]],       // televizyon: kalabalık onu küçültmesin
    odakEn: 1.2,
    x: 'orta'
  };
}
// OYUN.kamera = { ustPay: 1.05, ustPx: 36 }        // adlar için piksel payı
// konvoy gibi uzayan dizi: return { noktalar, on: 6 } → öndeki 6 m sığar, kuyruk ufka akar
```

**Ad etiketleri ve konuşma balonları.** `OYUN.etiket` (hepsi isteğe bağlı; yoksa eski davranış):

| Alan | Ne yapar |
| --- | --- |
| `ustSinir: true \| satır` | Adın üst kenarı bu satırın üstüne çıkmaz (`true` = `ALAN_UST`, sıralama kutusunun altı). Sınıra dayanan ad aşağı itilir, üst üste binen adlar aşağı doğru dizilir. Başı sınırın çok üstünde kalanın (itme iki ad boyundan fazla) adı, lider / yıldız / özel / yeni konuşan değilse yazılmaz: kenarda yığılmaz |
| `altSinir: true \| satır` | Adın alt kenarı bu satırın altına inmez (`true` = `ALAN_ALT`, yorum alanının üstü) |
| `disari: 'gizle'` | Bağlantı noktası ekran dışında kalanın adı ve balonu çizilmez (öntanım `'kenar'`: ekranın kenarına itilir, kalabalıkta kenarda yığılır) |
| `balonSira: 'derinlik' \| 'oncelik'` | Konuşma balonlarının çizim sırası (sonra çizilen üstte): `derinlik` öndeki üstte, `oncelik` lider üstte. Öntanım ekleme sırası |

Oyuncu başına (her karede `insanEkle`'den sonra yazılır; `insanEkle` bunları her karede sıfırlar):
- `k.et.asagi = true` (ya da kalıcı `k.etAsagi = true`): ad başın üstüne değil `k.et.alt` noktasının (insanEkle'de
  çene) altına asılır. Ön sıradakinin adı arkadakinin yüzünü örtmesin diye. Balonu o zaman başın üstünde çıkar.
- `k.et.bx`, `k.et.by`: konuşma balonunun ucunun ekrandaki yeri (balon onun üstünde durur).
- Etiketin çizildiği kutu `k.etKutu = [x, y, genişlik, yükseklik]` (çizilmediyse `null`).
- `k.oyunAd = { kutu: [x, y, genişlik, yükseklik], kare: kareSay }` (isteğe bağlı): oyun bir oyuncunun adını kendisi
  çiziyorsa (büyük ad kartı gibi) kutusunu böyle bildirir. Çekirdeğin ölçümü (`CanliOyun._test.olcum()`, kare-cek ve
  "en az bir ad okunur" testi) o oyuncunun etiketi yoksa bu kutuyu sayar. Yalnız o karede (ya da bir önceki karede)
  yazılmış kutu geçerlidir. Yazmayan oyun için hiçbir şey değişmez.

```js
// 00-ayar.js
etiket: { ustSinir: true, altSinir: true, disari: 'gizle', balonSira: 'derinlik' },
// oyunCiz: ön sıranın adı çenenin altına
if (insanEkle(k) && k.koltuk.sira === 0) k.et.asagi = true;
```

**Sahne yazıları.** Sıralama kutusu, gösterge, bildirimler ve pankart sayfa iskeletindedir. Bildirimler sağ
sütunda kalır, sıralama kutusunun üstüne binmez. Pankart öntanımda sıralama kutusunun üstünden geçer (eski hâl);
`OYUN.sahneYazi = { pankart: 'alt' }` ile kutunun altından, oyuncu şeridinin başından geçer. Kutuların ekrandaki
yerini `CanliOyun._test.olcum().kutular` verir.

**Çizim yardımcıları** (`cekirdek/js/33-cizim.js`; araç, mobilya, sahne gibi tek parça nesneler için). Hepsi
doğrudan `c` ile çizer: `ozel(derinlik, fn)` içindeki `fn`'den ya da `oyunZemin`'den çağır.
- `renkKat(a, b, t)`: iki `#rrggbb` (ya da `#rgb`) rengin karışımı, `'rgb(…)'` döner, önbellekli. Işık ve gölge
  tonu: `renkKat(renk, '#fff4dc', 0.22)` açık, `renkKat(renk, '#120a1e', 0.22)` koyu.
- `donusum(x, y, z, yon, olcek)` → `T`: nesnenin yeri, yönü (`π` kameraya bakar), ölçeği. `yerelNokta(T, yana,
  yukarı, ileri)` yerelden dünyaya `[x, y, z]`; `yana` nesnenin solu.
- `kutuCiz(T, a0, a1, y0, y1, c0, c1, renk, cizgi, tonlar)`: kutu; yalnız kameraya bakan yüzler çizilir, üst yüz
  açık, yanlar ve arka koyu ton (`tonlar = { ust, yan, arka }` ile değişir). Döner `{ on, arka, sol, sag, ust }`:
  hangi yüz göründü (plaka, ekran, kapı gibi ayrıntıyı yalnız görünen yüze koy).
- `yuzCiz(T, [[a, y, cc], …], renk, cizgi)`: yerel köşelerden yüzey; ekran noktalarını ya da (kameranın arkasında
  kalırsa) `null` döndürür. `yuzBakiyor(T, normal, merkez)`: yüzey kameraya bakıyor mu.
- `cokgenCiz(p, renk, cizgi)` (`renk` null ise yalnız çizgi), `daireCiz(p, r, renk, cizgi)`, `kapsulCiz(pa, ra, pb,
  rb, renk, cizgi)`: `pr()` noktalarıyla hemen çizenler (`r` metre).
- `ufukY()`: gerçek ufuk çizgisinin satırı (`kam.cy − F·tan(eğim)`); dik bakan kamerada ekranın üstündedir.
  `gokCiz({ gok, zemin, pus, gunes, ufuk })`: ufkun üstüne gök (`gok`: üstten ufka renkler), altına uzak zemin,
  ufukta pus şeridi ve güneş; ufuk satırını döndürür. Ufkun görünmesi için alçak ve geniş açılı kamera gerekir
  (`kamera: { egim: 0.5, F: 700 }` gibi).

```js
let sahneT = null;
function oyunZemin() {
  const u = gokCiz({ gok: ['#2a5a9c', '#7fb6e6', '#ffe3b0'], zemin: ['#9bbf6a', '#5f8a3c'], pus: '#fff1d0', gunes: { x: 0.72, r: 44 } });
  // u'nun altına yol, tarla, gölgeler …
}
function oyunCiz() {
  const T = donusum(0, 0, 1.5, Math.PI), m = pr([0, 0.5, 1.5]);
  ozel(m.d, () => {
    const g = kutuCiz(T, -0.9, 0.9, 0, 1.1, -0.5, 0.5, '#8a4a26', 2);      // dolap
    if (g.on) yuzCiz(T, [[-0.7, 0.2, 0.505], [0.7, 0.2, 0.505], [0.7, 0.9, 0.505], [-0.7, 0.9, 0.505]], '#a8d8e8', 1.5);
  });
}
```

**Yardımcılar:** `TAU`, `HP`, `clamp`, `lerp`, `yumusak`, `basamak`, `ozet`, `rastgeleUret`, `aciFark`,
`azHareket`, `$`.

**Dışarıya açık arayüz:** `CanliOyun.durum()` → `{ oyun, kisi, lider, cosku, begeni, vurus, sira: [[ad, jeton]…],
kareMs, parca, bagli, alinan, hava, ses }` ve `oyunDurum(d)`'nin ekledikleri. `CanliOyun._test` → `{ D, muzik,
Muzik, HAVALAR, TAKIMLAR, TAKIM, havalarKur, ayar, OYUN, KADEME, zamanEkle(sn), zaman(), vurusDondur(b), vurusIlerle(db), vurusCoz(), olcum(),
cekirdek }`:
- `vurusDondur(b)` / `vurusIlerle(db)` / `vurusCoz()`: yalnız test ve kare almak için. Kare döngüsü sürer ama `B`
  verilen değerde durur; aynı hareket evresi tekrar tekrar çizilir (`kare-cek` hareket şeridini böyle alır).
  Dondurulan `B` geri de alınabilir; oyunda kullanma.
- `olcum()`: son karenin ölçümü (720×1280 ölçeğinde): `kutular` (sıralama kutusu, gösterge, bildirimler, pankart:
  `[x, y, w, h]`), `kisiler` (`ad`, `lider`, `bas: { x, y, r }`, `etiket: [x, y, w, h]`).
- `cekirdek`: kamera, etiket, insan takımı ve çizim işlevleri (testler sahne dışı deneme için çağırır).

## Yayın masası

Sahnenin sağındaki masa yalnız yayıncıya görünür (`#yayin` görünümünde yoktur). İskeleti her oyunda aynıdır
(`cekirdek/sayfa.html`, `cekirdek/stil.css`, `cekirdek/js/60-panel.js`); oyun masaya yalnız şunları verir:

| Masada | Oyunun verdiği |
| --- | --- |
| Üst çubukta oyunun adı | `OYUN.ad` |
| Özet satırı: "Sahnede 9 / 36 kişi" | `OYUN.kapasite`, `OYUN.yazi.birim` |
| Deneme izleyicisinin hediye düğmeleri, canlı yayında "Bu oyunda hediyeler" | `OYUN.kademe` (`min`, `ad`, `etki`) |
| "Yorum yaz" ve "Takip et"in alt yazısı | `OYUN.yazi.giris` ("halaya girer") |
| Müzik kartındaki havalar | `OYUN.muzik` |
| Boşaltma düğmesi | `OYUN.yazi.bosalt` |
| Akışta hediyenin tetiklediği | kademenin `ad`ı |

**Kip.** Masa sayfanın nasıl açıldığına bakar, olay gelip gelmemesine değil. Köprü sayfayı sunarken kipi
`<html data-kip="deneme" | "canli">`e yazar (docs/OLAYLAR.md); masa daha ilk karesinde ona göre çizilir. Diskten
açılan sayfa deneme kipindedir. Betik aynı kipi `#panel[data-kip]`e ve kartların `hidden` özniteliğine de yazar. Canlı kipte
"Deneme izleyicisi" kartı (`#deneme-kart`: sahte yorum, beğeni, takip, hediye, otomatik kalabalık) masada yoktur;
yerinde "Bu oyunda hediyeler" (`#kademe-kart`) yazar. Elementler sayfada durur (testler ve araçlar `#oto`,
`#hiz-2`, `#hediyeler`'e doğrudan basar), görünmez ve klavyeyle de ulaşılmaz.

**Durum göstergesi** (`#d-bag-hucre[data-durum]`, yazısı `#d-bag`, alt satırı `#d-bag-alt`): bağlantıyı söyleyen
tek yer. `deneme` Deneme · `baglaniyor` Bağlanıyor · `bekliyor` Yayın bekleniyor (hesap yayında değil) · `canli`
Canlı (köprü TikTok'a bağlandığını bildirdiyse; alt satırda hesabın adı) · `koptu` Bağlantı koptu (sayfa motoru
kaybetti, yeniden deniyor) · `durdu` Durdu · `hata` Bağlanamadı · `bagli` Bağlı (durum bildirmeyen eski köprü:
"Canlı" denmez). Yayın bekleniyor, bağlanıyor, durdu ve bağlanamadıda motorun kendi cümlesi göstergenin altında
(`#durum-cumle`) olduğu gibi yazar.

**Bu oyunda.** Oyunun kendi denetimi (ör. "Gösteriyi başlat") yalnız `#bu-oyunda` içine girer; iskeletin başka
yerine eklenmez. Kart içi boşken gizlidir, ilk düğme gelince kendiliğinden görünür. Düğmeyi `oyunBaslat` içinde
kur; çekirdeğin sınıflarını kullan (`dugme`, `dugme kucuk`, aç / kapa için `anahtar` + `aria-pressed`). Yazı
`textContent` ile girer. Bu kart iki kipte de görünür: sahte izleyici olayı yollayan bir düğme koyma.

```js
function oyunBaslat() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'dugme kucuk';
  b.textContent = 'Gösteriyi başlat';
  b.onclick = () => { D.gosteri = zaman; };
  $('bu-oyunda').append(b);
}
```

**İkonlar.** Masanın ikon takımı sayfanın içindedir (`sayfa.html`, `#ikonlar`: `<symbol id="i-ad">`); dosya
indirilmez. Kullanım `ikon(ad)` (60-panel.js; `aria-hidden` süs ikon döner, yanına yazı koy). Takımın kuralı:
24 × 24, yuvarlak uçlu 2 px çizgi yazının renginde, her ikonda tek bir vurgu (hardal) ayrıntı; vurgu ayrıntısı
satır içi `style="fill:var(--ik-v);stroke:none"` (dolgu) ya da `style="stroke:var(--ik-v)"` (çizgi) ile boyanır.
Adlar: `canli`, `deneme`, `bekliyor`, `baglaniyor`, `koptu`, `durdu`, `hata`, `kisiler`, `jeton`, `tac`, `akis`,
`hayalet`, `hediye`, `kalkan`, `davul`, `ses`, `ayar`, `yorum`, `kalp`, `takip`, `paylas`, `goz`, `cikar`, `sahne`,
`oyunlar`, `supurge`.

**Akış.** `gunluk(tur, ad, metin, hediye, id)` satırı kurar (25-yazilar.js): başına türün ikonu, hediye satırında
hediyenin adı ve olayın taşıdığı adet · jeton · tetiklediği kademe ("Gül ×60 · 60 jeton · Çök"; adsız hediyede
yalnız "60 jeton · Çök", adet olay taşımıyorsa yazılmaz), `id` varsa ad bir düğmedir (basınca "Adını gizle" ve
"Sahneden çıkar" altında açılır). Oyun kendi türüyle (`gunluk('solo', ad, 'ortaya çıktı')`) yazarsa satır genel
akış ikonuyla, türün adı önde yazılır. Süzgeç (Hepsi / Hediyeler / Yorumlar) her türün son 40 satırını tutar.

**Masanın sabit adları** (testler ve araçlar okur; oyun okuyabilir, değiştirmez): `#panel`, `#d-bag`,
`#d-bag-alt`, `#d-bag-hucre`, `#durum-cumle`, `#d-kisi`, `#d-kapasite`, `#d-birim`, `#d-jeton`, `#d-lider`,
`#kisi-liste`, `#kisi-ara`, `#gunluk`, `#akis-suz`, `#deneme-kart`, `#sahte-ad`, `#s-yorum`, `#s-begeni`,
`#s-takip`, `#hediyeler`, `#oto`, `#hiz-0…2`, `#kademe-kart`, `#bu-oyunda`, `#balon-dugme`, `#yasak`,
`#mod-liste`, `#mod-ozet`, `#mod-temizle`, `#ses-dugme`, `#ses-duzey`, `#hava-sec` (`#hava-<id>`), `#sirayla`,
`#hazir-kutu`, `#parca-sec`, `#yt-kutu`, `#gelismis` (içinde `#bag-adres`, `#bag-dugme`, `#bag-rozet`,
`#bag-ileti`, `#d-kare`, `#d-bpm`, `#d-hava`), `#bosalt-sor`, `#bosalt` (onaydaki "Evet, boşalt"; işi yapan
budur), `#bosalt-vazgec`, `#yayin-gor`. Ana sayfadan açılınca motor "Oyunlar" bağlantısını `.masa-ad`'ın başına
ekler (kopru.js); masa onu "Oyunlara dön" düğmesi olarak yazar.

## Testler

`node araclar/test.js [ad]`: verilen oyun (ya da `oyunlar/` altındaki her oyun) için `derle.js --denetle`,
`cekirdek/test/cekirdek.test.js <ad>`, varsa `oyunlar/<ad>/test.js <ad>`; en sonda bir kez
`cekirdek/test/kopru.test.js` ve `cekirdek/test/araclar.test.js` (yeni-oyun, derle'nin ad denetimi, kare-cek).
Ortak parçalar `cekirdek/test/ortak.js`'te: oyun adı ilk bağımsız değişkenden (yoksa `halay`), sayfa
`oyunlar/<ad>/oyun.html`, ekran görüntüleri `test/cikti/<ad>/`, `CHROME_PATH` desteklenir, her sayfada
`window.OYUN_MUZIK_KAPALI = true`, Google Fonts istenmez (bağlantı yavaşsa sayfanın açılışını 30 sn bekletiyordu).
Sabit uyku yerine durum beklenir: `hazirBekle(p)` (oyun açıldı, kare döngüsü çiziyor), `bekle(p, ad, kosul, arg,
sinir)` (koşul doğru olunca döner; süre dolarsa beklenen durumun adını yazar, ardından gelen kontrol kalır),
`kareBekle(p, n)` (n kare daha çizildi). Ölçülen süreler (müzik saati, "bu arada bir şey olmadı" denetimleri,
kontrolün süresini sınadığı canlandırmalar) sabit kalır.
- Bölüm seçme (`--yalniz`), hızlı kademe (`--hizli`, `TEST_KADEME`) ve iki şerit (`--serit 2`): `AGENTS.md`,
  "Test döngüsü".
- Köprü testi P…P+11, araç testi P+12 kapısını kullanır. `node araclar/test.js` P'yi kendisi seçer: 127.0.0.1'de
  art arda 16 boş kapı bulur ve çocuklara `KOPRU_TEST_PORT` olarak verir (aynı bilgisayardaki iki koşu çakışmaz).
  Kapıyı sabitlemek için `KOPRU_TEST_PORT=8911 node araclar/test.js`; tek başına çalışan
  `node cekirdek/test/kopru.test.js` öntanımda 8791 kullanır (`--port 8911` ile değişir).
- `node araclar/kare-cek.js <ad>`: kareler (`kare-1/3/9/dolu/hediye.png`, `kare-hepsi.png`), hareket şeridi
  (`kare-hareket.png`: 9 kişi, `B` dondurulup çeyrek vuruş arayla 8 kare) ve her kare için ölçüm
  (`kare-<etiket>.json`: yüzlerin yarıçapı, ad kutuları, sahne yazılarının kutuları). Sıralama kutusuna giren ya
  da yorum alanına taşan ad, 9 pikselden küçük yüz varsa `DİKKAT` diye yazar. `--hareketsiz` şeridi atlar.
- `node araclar/esitlik.js <ad> [--taban <git-ref> | --html <yol>]`: çekirdeği değiştirdikten sonra var olan oyunun
  görüntüsü değişti mi? İki sayfayı donmuş saatle (performance.now, requestAnimationFrame, tohumlu Math.random,
  durdurulmuş setInterval, yazılımla çizim) aynı olaylarla sürer, 32 denetim noktasında tuvalleri piksel piksel
  karşılaştırır. `kare-cek` kareleri gerçek saatle alındığı için iki çalıştırma hiç aynı çıkmaz; eşitlik için bunu kullan.

## Oyunun uyması gerekenler

1. Dışarıdan gelen her şey `olay(o)` üzerinden girer; oyun `D`'yi başka girişten değiştirmez.
2. İzleyici metni asla HTML olarak yazılmaz: sayfaya `textContent`, tuvale `fillText`.
   Hediyenin adı (`hediye.ad`) da izleyici metnidir.
3. Sahnenin `ALAN_UST`–`ALAN_ALT` şeridi oyuncularındır. Üstü sahne yazıları, altı (1024 ve sonrası)
   TikTok'un yorum alanıdır; oraya bir şey çizme.
4. Hareket ve süreler vuruşla (`B`) ölçülür, saniyeyle değil. `B` geri gitmez.
5. Ses ve görsel üretimdir: depoya ses, görsel, hazır model eklenmez. Var olan bir şarkının notası yazılmaz.
6. `oyun.html` üretilir: `js/` değişince derle, ikisini birlikte işle.
7. Çekirdek testleri (`cekirdek/test/cekirdek.test.js <ad>`) her oyunda geçmelidir: yorum oyuna sokar, beğeni
   coşkuyu artırır, hediye sıralamayı değiştirir, en çok hediye atan liderdir, kalabalık `kapasite`de
   sınırlanır, 1080×1920'de en kalabalık hâlde kare başına işlem 33 ms'nin altındadır.
8. Yazı tipleri Türkçe harflerin tamamını taşır. Çekirdek başlıkta Paytone One, gövdede Rubik kullanır
   (`araclar/derle.js` içindeki `YAZI_TIPI`, `cekirdek/stil.css` içindeki `--baslik`). Yazı tipini değiştirmeden
   önce Ş, ş, Ğ, ğ, İ, ı harflerinin dosyada bulunduğunu doğrula; eksik harf yedek yazı tipinden gelir ve
   kelimenin içinde farklı kalınlıkta görünür. Testler web yazı tiplerini istemediği için bunu yakalamaz:
   kareye bakarak denetlenir.

## Örnek

`oyunlar/halay/` bütün kancaları kullanan tam bir oyundur. `sablon/` aynı kancaların en yalın hâlidir:
izleyiciler sıra sıra dizilip kameraya bakar, vuruşla sallanır; hediye atan zıplar; lider önde, ortada, altın
halkanın üstünde durur. Yeni oyuna şablondan başla, halaya bakarak zenginleştir.
