---
name: yeni-oyun
description: Bu depoda TikTok canlı yayını için yeni bir etkileşimli oyun kurma tarifi. Kullanıcı bir oyun fikri söylediğinde ("gelin konvoyu oyunu yap", "at yarışı olsun", "izleyiciler halat çeksin", "şöyle bir yayın oyunu istiyorum"), var olan bir oyunu değiştirmek istediğinde ya da "bunu yayına nasıl veririm" diye sorduğunda kullanılmalıdır. Fikri kurallara çevirme, şablondan başlatma, sahneyi çıtaya göre çizme, kareye bakarak düzeltme, test ve teslim adımlarını içerir.
---

# Yeni oyun: fikirden yayına

Kullanıcı tek cümlelik bir fikir verir; sen çalışan, yayına verilebilir bir oyun teslim edersin. Çekirdek
(`cekirdek/`) işin ortak yarısını zaten yapıyor. Senin işin `oyunlar/<ad>/` altını yazmak.

Başlamadan oku: `AGENTS.md` (harita, değişmezler, görsel çıta), `docs/KANCALAR.md` (dolduracağın kancalar ve
çekirdeğin sunduğu adlar), `docs/MUZIK.md` (oyunun müziği), `oyunlar/halay/js/` (tam örnek).

**Her oyunun müziği kendinedir.** Halayın davul zurnası başka oyunda çalmaz; yeni oyun kendi çalgı takımını seçer
ve kendi özgün havalarını yazar (aşağıda, 3. adım).

## 1. Fikri kurala çevir

Bu türde her oyun aynı dört soruya cevap verir. Cevapları kendin ver, kullanıcıya kısa bir tabloyla göster,
itiraz yoksa devam et. Kullanıcıyı soru yağmuruna tutma; yalnız fikir gerçekten iki ayrı oyuna çıkıyorsa sor.

| Soru | Halaydaki cevap |
| --- | --- |
| Yorum yazan sahnede ne olur? | Halaya girer |
| Beğeniler neyi yükseltir? | Coşkuyu, onunla tempoyu |
| Hediye kademeleri ne yapar? (genelde 1, 10, 50, 200, 1000 jeton) | Zıpla, omuz, çök, davul şovu, solo |
| En çok hediye atan kim olur? | Halay başı; mendil onda |
| Hangi müzik çalar? (takım, havalar, tempo) | Davul zurna; halayın üç havası, 84–132 vuruş/dk |

İyi kurallar: izleyici attığı hediyenin karşılığını **hemen ve kendi adıyla** görür; küçük hediye küçük ama
görünür bir şey yapar; en büyük hediye sahneyi birkaç saniyeliğine o kişiye verir; liderlik el değiştirebilir
ki yarış sürsün. Kimse cezalandırılmaz, kimse sahneden kovulmaz (yalnız uzun süre sessiz kalan çıkar; bunu
çekirdek yapar).

## 2. Sahneyi düşün

Yazmadan önce şunlara karar ver:

- **İzleyici sahnede ne?** İnsan (`insanEkle`), araç içinde insan (`kafaCiz` ile baş, gövdesi senin çizimin),
  ya da başka bir şey. Her izleyicinin adı görünecek; çizim `k.et` alanını kurmalı.
- **Nerede dururlar?** 1, 3, 9 ve tam kalabalıkta diziliş. Sıra (`k.sn`) jetona göre gelir: öndekiler daha çok
  hediye atanlardır; bunu dizilişte görünür kıl.
- **Sahnenin ortasında ne var?** Boş orta zayıf durur.
- **Lider nasıl ayrılır?** Yer, işaret, renk; bir bakışta.
- **Renk dünyası.** Zemin, ışık ve yazılar tek paletten (`OYUN.renk`). Sahne gündüz / açık renkliyse
  `panelRenk: {}` ekle: yayın masası çekirdeğin koyu temasında kalır, okunur.
- **Ses dünyası.** Sahne nerede geçiyor, orada ne çalar? Köy meydanı: `davul-zurna`; düğün, konvoy: `dugun`
  (darbuka, def, klarnet); televizyon, maç, seksenler: `mac` (davul makinesi, synth bas, bakır nefesli). Hiçbiri
  uymuyorsa yeni takım gerekir (`docs/MUZIK.md` "Yeni takım"). Tempo oyunun hızıdır: hareket vuruşla ölçülür.

## 3. Kur

```bash
node araclar/yeni-oyun.js <ad> "<Görünen Ad>"
```

Şablon `js/10-oyun.js` içinde bütün kancaların en yalın hâlini getirir. **Bu dosya artık senin oyununun
dosyasıdır**: kancaları yerinde değiştir ya da dosyayı silip baştan yaz (asıl şablon `sablon/` altında kalır,
bozulmaz). Büyüdükçe konuya göre yeni dosyalara böl (`20-hareket.js`, `30-dekor.js`, `40-cizim.js` gibi). Aynı
kanca iki dosyada tanımlı kalmasın.

`js/00-ayar.js` önerilen ayarlarla gelir; silme: `etiket: { ustSinir: true, altSinir: true, disari: 'gizle' }`
(adlar sıralama kutusuna ve yorum alanına girmez, ekran dışındakinin adı kenarda yığılmaz), `sahneYazi: { pankart:
'alt' }` (pankart sıralama kutusunun üstünden geçmez).

Sonra şu sırayla ilerle; her adımdan sonra derleyip kareye bak:

1. `oyun.json` içindeki `aciklama`: ana sayfadaki oyun kabininde görünen tek, düz cümle. Kurallar belli olunca yaz;
   şablondan gelen cümle geçicidir. Örnek: "Yorum yazan halaya girer, beğeni tempoyu artırır, en çok hediye atan
   mendili alıp halayın başına geçer." Jargon yok; izleyici ne yapar, oyunda ne olur.
   `js/00-ayar.js`: yazılar, kademeler (`etki` metniyle), tohum kalabalık, sahte yorumlar, kapasite.
   **Müzik de burada**: `muzik: { takim, havalar }`. Şablon `takim: 'SEC'` ile gelir; seçmeden bırakırsan derleme
   uyarır, sayfa konsola hata yazar, test kalır. En az iki **özgün** hava yaz (nota ve davul yazımı
   `docs/MUZIK.md`; örnekler `oyunlar/konvoy/js/00-ayar.js`, `oyunlar/vur-duzelsin/js/00-ayar.js`). Var olan
   şarkı, türkü, marş, tezahürat, jenerik ya da reklam müziği yazma.
2. Diziliş ve hareket: `oyunYerlesim`, `oyunGiris`, `oyunGuncelle`, `oyunKamera`.
3. Çizim: `oyunZemin` (arka plan, zemin, gölgeler), `oyunCiz` (izleyiciler ve sahnedeki her şey).
4. Hediye etkileri ve rol devri: `oyunHediye`, `oyunLiderDegisti`.
5. Oyuna özgü testler: `oyunlar/<ad>/test.js` (her kademenin etkisini başlattığını sına).

Çizim için bilmen gerekenler:

- Eksenler: x sağ, y yukarı, z kameradan uzağa. `pr([x, y, z])` ekrandaki yeri ve `s` (metre başına piksel)
  verir. Boyutları `s` ile çarp ki uzaktaki küçük görünsün.
- Sahnedeki nesneleri `oyunCiz` içinde `kap`, `top`, `ozel` ile çizim listesine ekle; derinliğe göre sıralanıp
  çizilirler. Zemin ve arka plan `oyunZemin` içinde doğrudan `c` ile çizilir; orada listeye eklenen şey
  çizilmez (liste sonradan boşaltılır).
- Araç gibi tek parça nesneyi bir `ozel(derinlik, fn)` ile ekle ve `fn` içinde yalnız `c` ile çiz; `fn`
  içinden `kap` / `top` çağırma. Kutu, yüzey, renk tonu için çekirdeğin yardımcılarını kullan: `donusum`,
  `kutuCiz`, `yuzCiz`, `yerelNokta`, `renkKat`, `daireCiz`, `kapsulCiz` (docs/KANCALAR.md, "Çizim yardımcıları").
  Tam örnek: `oyunlar/konvoy/js/40-araba.js` (dönebilen kutu, kameraya bakan yüzler, pencereden çıkan sürücü).
- Gök ve ufuk: `oyunZemin` başında `gokCiz({ gok, zemin, pus, gunes })`; döndürdüğü ufuk satırının altına yol,
  tarla çiz. Ufkun görünmesi için alçak, geniş açılı kamera (`kamera: { egim: 0.5, F: 700 }`).
- İnsan takımının ekleri: oturan izleyici `pozOtur(k, oturakY)`, başını çeviren `k.basYon`, iri başlı
  `k.basOlcek` (ya da `kafaCiz(k, ph, olcek)`), açık el / yumruk `k.elSekil = { R: 'yumruk' }`, uzun kol
  `k.kolBoy = 1.5`. Bunları kendin yazma; örnekler docs/KANCALAR.md'de.
- Dış çizgi rengi `MUREKKEP`; renkler `RENK` içinden.
- Hareketi `B` (vuruş) ile sür: `Math.sin(TAU * B)` vuruşta bir tur atar. `calgi.dumP` her güçlü vuruşta 1'e
  çıkıp söner; ışık ve zıplama için kullan.
- `Math.random()` yalnız parçacık gibi süs için. İzleyicinin görünümü kimliğinden türesin (`ozet(k.id)`,
  `rastgeleUret`): aynı kişi her yayında aynı görünür.

Sık takılınan yerler:

- Kancalar `function oyunX() {}` biçiminde işlev bildirimi olmalı; ok işlevi yazarsan derleme durur.
- `oyunKamera()` kadraja girmesi gereken yer noktalarını döndürür; yakınlaşmayı çekirdek yapar. Öntanımda kamera
  `x = 0`'a bakar. Gerekirse nesne döndür: `{ noktalar, x: 'orta' }` (yana kaymış sahne), `odak` (ortadaki büyük
  nesne kalabalık yüzünden küçülmesin), `on: 6` (uzayan dizinin önü sığsın, kuyruğu ufka aksın), nokta başına pay
  `[x, z, 1.1]` (geniş nesne), `ustPx: 36` (ad için piksel payı). Kendi kamera hilesini yazma.
- İnsan çizmiyorsan (araç, hayvan, top) her izleyicinin etiket yerini kendin yaz:
  `k.et = { x, y, s, d }` (`pr()` sonucundan: adın duracağı tepe noktası, ölçek, derinlik). Çekirdek `k.et`
  alanını her karede boşaltır; yazmazsan ad görünmez.
- `oyunHediye` sıra güncellenmeden önce çağrılır: içindeyken `D.lider` hâlâ eski liderdir. Yeni lider için
  `oyunLiderDegisti` kancasını kullan (ilk lider belirirken ve sahne boşaltılırken çağrılmaz).
- Çıkan izleyiciyi (`k.cikiyor`) sahneden sen götürürsün; uzaklaşınca `k.gitti = true` de. Demezsen 1,7 sn
  sonra olduğu yerde kaybolur.
- Müzik oyunun kendisinindir (`OYUN.muzik`). Takımı seçtikten sonra tempoyu oyunun hareketine göre ayarla, oyunun
  gerçek zamanlı testlerini (bekleme süreleri) yeni tempoyla yeniden çalıştır. Kullanıcı kendi kayıtlarını
  isterse yalnız o oyunun klasörüne gider: `python araclar/muzik-hazirla.py "<klasör>" <ad>` → `oyunlar/<ad>/muzik/`.
- `gorunumUret(id)` yöresel kıyafet verir (yazma, kasket, önlük). Başka kılık gerekiyorsa gövdeyi kendin çiz,
  başı `kafaCiz` ile al.
- Adın yeri: ön sıradakinin adı arkadakinin yüzünü örtüyorsa `k.et.asagi = true` (çenenin altına asılır);
  balonun yerini `k.et.bx / k.et.by` ile ver. Etiketi kendin çizme; çekirdeğinki sınırlara ve çakışmaya bakar.
- Çekirdekteki bir adla (`kutuCiz`, `renkKat`, `ETIKET` …) işlev ya da `const` yazma. Derleme `UYARI` verirse
  kendi adını değiştir; `const` çakışmasında derleme durur.
- `00-ayar.js` çekirdekten önce çalışır: orada `ALAN_UST`, `ETIKET_PAY` gibi çekirdek adları kullanılamaz
  (`ustSinir: true`, `ustPx: 36` gibi değer yaz).
- Tuvale başlık yazısı çizerken çekirdeğin yazı tiplerini kullan: `'30px "Paytone One", Rubik, system-ui,
  sans-serif'` (başlık) ya da `'700 21px Rubik, system-ui, sans-serif'` (gövde). Başka yazı tipi ekleyeceksen
  önce Ş, ş, Ğ, ğ, İ, ı harflerinin o yazı tipinde bulunduğunu doğrula: eksik harf başka yazı tipinden gelir ve
  kelimenin ortasında ince, yabancı bir harf olarak görünür (eski başlık yazı tipinde "USTA İŞ BAŞINDA!" böyle
  çıkıyordu). Karede Türkçe harfli her yazıya yakından bak.
- Ön sırada yan yana duran iri başlı kişiler arasında en az 0,57 m bırak; iki sıkı sıra tek bir baş yumağına
  döner, adlar yüzlerin üstüne biner. Televizyon gibi bir nesnenin altı ile yorum alanı arasına tek sıra sığar.

## 4. Kareye bak, düzelt, yine bak

```bash
node araclar/derle.js <ad> && node araclar/kare-cek.js <ad>
```

`test/cikti/<ad>/kare-hepsi.png` dosyasını aç ve **kendi gözünle** şunları denetle. Komut ayrıca
`kare-hareket.png` (9 kişi, çeyrek vuruş arayla 8 kare: hareketin ritmi) ve her kare için `kare-<etiket>.json`
(yüz yarıçapları, ad kutuları) yazar; sıralama kutusuna giren ad, yorum alanına taşan ad ya da 9 pikselden küçük
yüz varsa sonunda `DİKKAT` diye söyler. En az iki tur yap; ilk
karede her zaman düzeltilecek bir şey çıkar.

- Yüzler ya da izleyicinin karşılığı net görünüyor mu, adlar okunuyor mu?
- 1 kişide sahne boş mu kalıyor? Tam kalabalıkta taşıyor ya da karıncaya dönüyor mu?
- Lider hemen seçiliyor mu?
- Ortadaki nesneler izleyicilerin önünü kapatıyor mu?
- Üst yazılarla (sıralama kutusu, gösterge) sahnedeki şeyler çakışıyor mu?
- Alt beşte bir boş mu?
- En büyük hediye karesi diğerlerinden açıkça farklı mı?
- Renkler tek bir dünyadan mı, yoksa her şey ayrı telden mi çalıyor?

Hareketin ritmini `kare-hareket.png` gösterir; akıcılığı görmek için oyunu aç (`node kopru.js --deneme --oyun <ad> --ac`).

## 5. Sına

```bash
node araclar/test.js <ad>
```

Çekirdek testleri kuralların iskeletini, bozuk girdiyi, olay selini, müzik saatini, yayın görünümünü ve
uzun süre çalışmayı sınar. Müzik testi (`cekirdek/test/muzik.test.js`, en sonda bir kez) her oyunun müziğinin
düzeyini, dengesini ve başka takımlı oyunlardan farkını ölçer; `test/cikti/<ad>/muzik-onizleme.wav` dinleme
önizlemesini yazar. Kalan kontrol varsa oyunun kancalarında hata vardır; çekirdeği değiştirerek
geçirme.

## 6. Teslim et

Kullanıcıya kısa ve dürüst bir özet ver:

- Oyun ne yapıyor (kurallar tablosu).
- Nasıl açılır: `BASLAT.bat` dosyasına çift tıkla, ana sayfada oyunun kabininde sarı **Dene** (ya da
  `node kopru.js --deneme --oyun <ad> --ac`). Kabinin cümlesi `oyun.json` içindeki `aciklama`; yazıldığından emin ol.
- Kare dosyasının yeri ve müzik önizlemesi (`test/cikti/<ad>/muzik-onizleme.wav`): kullanıcı dinleyip karar verir.
- Neyin testle, neyin gözle doğrulandığı; neyin **hiç** doğrulanmadığı (ses kulakla dinlenmedi, gerçek yayın
  denenmedi, hareket yalnız karelerden görüldü gibi).
- Yayına verme adımları için `docs/YAYIN.md`; yayıncı paketi için `node araclar/paket.js <ad>`.

## Yapma

- `cekirdek/` altını değiştirme. Eksik bir şey varsa oyunda çöz, raporda öner. (Çekirdeği değiştiren, var olan
  oyunların görüntüsünün değişmediğini `node araclar/esitlik.js <ad>` ile kanıtlar.) Tek istisna yeni çalgı
  takımıdır: `cekirdek/js/10-muzik.js` içine **eklenir**, var olan takımlara dokunulmaz; halay ve öbür oyunların
  müziğinin değişmediğini `node araclar/ses-esitlik.js <ad> --taban <ref>` gösterir.
- Başka oyunun havalarını kopyalama, halayın davul zurnasını "şimdilik" bırakma: her oyunun müziği kendinedir.
- Başka bir yayının çizimini, adını, müziğini kopyalama. Mekanik alınır, görünüş senin olur.
- Depoya görsel ya da ses dosyası ekleme.
- "Testler geçti" diyerek bitirme; kareye bakmadan teslim etme.
- Gerçek yayına bağlanmayı kullanıcı istemeden deneme. İsterse: köprü yalnız okur, herhangi bir açık
  yayınla denenebilir; o izleyicilerin adlarıyla dönen görüntü yayına ya da videoya konmaz.
