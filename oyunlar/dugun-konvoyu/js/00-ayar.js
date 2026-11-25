/* AYAR — Düğün Konvoyu oyununun yazıları, hediye kademeleri, açılış kalabalığı, sahte yorumları ve müziği.
 * Derlemede HER ZAMAN İLK dosyadır; çekirdek OYUN'u buradan okur (docs/KANCALAR.md).
 * Oyun: en önde süslü gelin arabası gider (izleyici değildir, gelin ile damat oturur). Yorum yazan izleyici kendi
 * arabası ve plakasıyla konvoyun sonuna katılır. Beğeniler konvoy coşkusunu doldurur. Hediyeler gönderenin kendi
 * arabasında korna, konfeti, süs, turbo ve düğün şovu yapar. En çok hediye atan konvoy lideridir: gelin
 * arabasının hemen arkasında, altın bayraklı arabayla gider.
 * Gelin Konvoyu (oyunlar/konvoy) oyunundan farkı: orada lider gelin arabasına biner; burada gelin arabası sabittir,
 * lider ayrı bir roldür ve hediyeler gönderenin kendi arabasında kalıcı izler bırakır (süs, ışık).
 */
const OYUN = {
  id: 'dugun-konvoyu',
  ad: 'Düğün Konvoyu',
  logo: ['Düğün', 'Konvoyu'],
  nasil: { yorum: 'Yorum: konvoya katıl', begeni: 'Beğeni: coşku', hediye: 'Hediye: arabana süs' },
  yazi: {
    sira: 'Konvoy lideri', gosterge: 'Coşku', bos: 'Gelin arabası yolda. İlk yazan arkasına takılır.',
    birim: 'araba', ses: 'Düğün müziğini başlat', sahne: 'Düğün konvoyu sahnesi', giris: 'konvoya katılır',
    bosalt: 'Konvoyu boşalt'
  },
  kapasite: 36,
  // Büyükten küçüğe. Kademeyi çekirdek toplam jetonla (tek hediyenin değeri × adet) seçer; seriyle gelen
  // 1000 jetona tek hediyenin vaadi olan "Düğün şovu" değil "Şov konvoyu" yazar (aynı etki).
  kademe: [
    { min: 1000, ad: 'Düğün şovu', seriAd: 'Şov konvoyu', tip: 'sov', etki: 'Gönderenin arabası gelin arabasının önüne geçer, büyür, döner; gökte havai fişek' },
    { min: 200, ad: 'Turbo', tip: 'turbo', etki: 'Gönderenin arabası alev saçarak ileri fırlar, bütün konvoy korna çalar' },
    { min: 50, ad: 'Araba süsü', tip: 'sus', etki: 'Gönderenin arabasına balon, kurdele ve yanıp sönen ışık eklenir (kalıcı)' },
    { min: 10, ad: 'Konfeti', tip: 'konfeti', etki: 'Gönderenin arabasının etrafında konfeti patlar' },
    { min: 1, ad: 'Korna', tip: 'korna', etki: 'Gönderenin arabası korna çalıp zıplar' }
  ],
  tohum: [['sağdıç_emre', 260], ['gelinin_kuzeni', 120], ['nazlı_can', 55], ['dj_mahmut', 20], ['elif_naz', 10], ['hasan.usta', 3], ['pınar_34', 0], ['berfin_gül', 0], ['korna_kemal', 0]],
  sahteAd: ['damat_tarafı', 'gelinin_kuzeni', 'sağdıç_emre', 'nazlı_can', 'dj_mahmut', 'elif_naz', 'hasan.usta', 'pınar_34', 'berfin_gül', 'korna_kemal', 'şoför_nevzat', 'ayten_hanım', 'kemo_44', 'deniz.yıldızı', 'rıza_amca', 'sude_nur', 'baran.21', 'muhtar_emmi', 'selo_02', 'songül.k', 'laz_ziya', 'egeli_duru', 'bozkır_ali', 'nur.sena', 'yeğen_ozan', 'kınacı_fatma', 'tuğba.23', 'harput_cemil', 'malatyalı_sena', 'gaziantepli.ali'],
  sahteYorum: ['konvoya ben de katıldım', 'korna çalın!', 'düüt düüt', 'gelin çok güzel olmuş', 'damat bey selam', 'dörtlüleri yakın', 'Elazığ’dan selamlar', 'arkadan geliyorum', 'yavaş gidin', 'balonu bağladım', 'maşallah', 'konvoy uzadı', 'plakamı gördüm', 'lider kim', 'turbo atın', 'şov istiyoruz', 'Malatya’dan katıldım', 'gaza bas abi'],
  // Altın saat: pembe-turuncu gök, sıcak ışık, deniz yeşili vurgu. Mürekkep ve açık ton çekirdeğinkiyle aynı kalır
  // (stil dosyasındaki yarı saydam tonlar onlardan türer; docs/KANCALAR.md).
  renk: { zemin: '#24142e', zemin2: '#3a1d44', zemin3: '#57295c', cizgi: '#7a3f74', vurgu: '#ffd166', sicak: '#ff6b6b', serin: '#3ccfb4', soluk: '#e7bfd8' },
  // Alçak ve geniş açılı kamera: konvoy ufka doğru uzar. Araç + tavandan çıkan sürücü insandan uzun, adın üstüne pay.
  kamera: { egim: 0.5, F: 700, enYakin: 3.5, ustPay: 2.2, altPay: 0.25 },
  etiket: { ustSinir: true, altSinir: true, disari: 'gizle' },
  sahneYazi: { pankart: 'alt' },
  // Müzik: düğün takımı (darbuka, def zili, klarnet, bas). İki özgün hava, Gelin Konvoyu'nunkilerden ayrı:
  // Tül (uşşak, 110 vuruş/dk, 16'lık ölçü) ve Dörtlüler (rast, 122 vuruş/dk, 8'lik ölçü). Yazım docs/MUZIK.md.
  muzik: {
    takim: 'dugun',
    havalar: [
      { id: 'tul', ad: 'Tül', bpm: 110, spb: 4, bar: 16, tonik: 311.1,
        dizi: [0, 150, 300, 500, 700, 800, 1000],                       // uşşak
        davul: { ana: 'D..kT.kkD.k.T.k.', cesni: 'D..kT.kkD.DkT.kr', gecis: 'D.T.D.T.DkTkrrrr' },
        ust: { ana: '....z.......z...', cesni: '....z...z...z.z.', gecis: 'z.z.z.z.z.z.zzzz' },
        bas: { ana: '1.....1.5.......', cesni: '1.....1.5...5.8.', gecis: '1...5...1.5.8.5.' },
        bolum: {
          A: '0:2 1:2 2:4 3:2 2:2 1:4 | 2:2 3:2 4:2 5:2 4:4 3:4 | 4:2 3:2 2:2 3:2 1:4 2:4 | 1:2 0:2 1:2 -1:2 0~:8',
          B: '5:4 6:2 5:2 4:4 5:4 | 7:2 6:2 5:2 4:2 5:4 -:4 | 4:2 5:2 4:2 3:2 2:2 3:2 2:2 1:2 | 2:2 1:2 0:4 0~:8',
          D: '-:16 -:16'
        },
        eslik: { A: '0:16 3:16 0:16 0:16', B: '3:16 0:16 4:16 0:16' },
        form: 'AABBD' },
      { id: 'dortluler', ad: 'Dörtlüler', bpm: 122, spb: 4, bar: 8, tonik: 293.7,
        dizi: [0, 200, 350, 500, 700, 900, 1050],                       // rast
        davul: { ana: 'D.kTD.T.', cesni: 'D.kTDkTk', gecis: 'DkTkrrTr' },
        ust: { ana: '..z...z.', cesni: '..z.z.z.', gecis: 'zzz.zzzz' },
        bas: { ana: '1...5.1.', cesni: '1...5.8.', gecis: '1.5.8.5.' },
        bolum: {
          A: '0:2 2:2 4:2 2:2 | 3:2 4:2 5:4 | 4:2 3:2 2:2 3:2 | 4:4 -:4 | 5:2 4:2 3:2 2:2 | 3:2 2:2 1:2 0:2 | 1:4 -1:2 1:2 | 0~:8',
          B: '7:2 6:2 5:2 6:2 | 7:4 5:4 | 6:2 5:2 4:2 3:2 | 4:4 -:4 | 2:2 3:2 4:2 5:2 | 4:2 3:2 2:2 1:2 | 2:4 1:2 -1:2 | 0~:8',
          D: '-:8 -:8 -:8 -:8'
        },
        eslik: { A: '0:16 3:16 4:16 0:16', B: '0:16 4:16 3:16 0:16' },
        form: 'AABBD' }
    ]
  }
};
