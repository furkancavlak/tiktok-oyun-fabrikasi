/* AYAR — Gelin Konvoyu 3B: Gelin Konvoyu'nun aynı kuralları, kademeleri, yazıları ve müziği; sahne three.js ile
 * gerçek 3B çizilir ve otomatik bir kamera rejisi çeker (js/50-reji.js).
 * Derlemede HER ZAMAN İLK dosyadır; çekirdek OYUN'u buradan okur (docs/KANCALAR.md).
 * Oyun: yorum yazan izleyici kendi arabasıyla konvoya katılır. En çok hediye atanın arabası gelin arabasıdır:
 * en önde, fiyonklu, kurdeleli, çiçekli. Hediyeler korna, zigzag, havai fişek ve drift yaptırır.
 * three.js oyun.json'daki "kitaplik": ["three"] ile sayfaya gömülür (genel THREE nesnesi).
 */
const OYUN = {
  id: 'konvoy-3b',
  ad: 'Gelin Konvoyu 3B',
  logo: ['Gelin', 'Konvoyu'],
  nasil: { yorum: 'Yorum: konvoya katıl', begeni: 'Beğeni: gaz', hediye: 'Hediye: gelin arabası' },
  yazi: {
    sira: 'Konvoy sırası', gosterge: 'Gaz', bos: 'Yol boş. İlk yazan gelin arabasına biner.',
    birim: 'araba', ses: 'Düğün havasını başlat', sahne: 'Gelin konvoyu sahnesi (3B)', giris: 'konvoya katılır', bosalt: 'Yolu boşalt'
  },
  kapasite: 36,
  // Büyükten küçüğe. tip, oyunHediye'nin hangi etkiyi başlatacağını seçer; etki paneldeki tabloda yazar.
  kademe: [
    { min: 1000, ad: 'Drift şov', tip: 'drift', etki: 'Gönderenin arabası en öne çıkar, dönerek drift atar; kamera ona geçer' },
    { min: 200, ad: 'Havai fişek', tip: 'fisek', etki: 'Gökte havai fişekler patlar, davul coşar' },
    { min: 50, ad: 'Sağ sol', tip: 'zigzag', etki: 'Bütün konvoy sağa sola kıvrılır' },
    { min: 10, ad: 'Hep beraber korna', tip: 'korna', etki: 'Bütün arabalar korna çalar, farlar yanıp söner' },
    { min: 1, ad: 'Korna', tip: 'tek', etki: 'Gönderenin arabası korna çalıp zıplar' }
  ],
  tohum: [['zeyno.47', 320], ['urfalı_bekir', 140], ['gülizar_teyze', 60], ['dj_mahmut', 25], ['elif_naz', 10], ['hasan.usta', 5], ['pınar_34', 0], ['damat_tarafı', 0], ['berfin_gül', 0]],
  sahteAd: ['damat_tarafı', 'gelinin_kuzeni', 'zeyno.47', 'urfalı_bekir', 'gülizar_teyze', 'mert.can.21', 'elif_naz', 'dj_mahmut', 'karadenizli.cemo', 'sibel_abla', 'ozan_dayı', 'mardinli_rojin', 'tuğçe.sk', 'hasan.usta', 'pınar_34', 'şoför_nevzat', 'berfin_gül', 'yusuf.63', 'nazlı_can', 'korna_kemal', 'şahin_k', 'melo.27', 'sağdıç_emre', 'fatoş_01', 'efe_tr', 'cano_23', 'zilan.d', 'hüso_baba', 'ayten_hanım', 'kemo_44', 'deniz.yıldızı', 'rıza_amca', 'sude_nur', 'baran.21', 'ipek_böceği', 'muhtar_emmi', 'selo_02', 'songül.k', 'laz_ziya', 'egeli_duru', 'bozkır_ali', 'nur.sena'],
  sahteYorum: ['konvoya ben de varım', 'korna çalın!', 'düt düüüt', 'gelin arabası kimde', 'sağ şeritten geliyorum', 'Bursa’dan selamlar', 'damat nerede ya', 'yavaş abi yavaş', 'kurdeleyi bağladım', 'selektör yak', 'davul zurna nerede', 'maşallah gelinimize', 'en arkadayım', 'beni de alın', 'dörtlüleri yak', 'İzmir’den katıldım', 'şoför bey gaza bas', 'konvoy uzadıkça uzadı', 'adımı gördüm', 'drift atın!'],
  // Gündüz, ikindi güneşi: koyu gök mavisi zeminler (sahne üstü kutular ve yayın masası), sıcak sarı vurgu, kiremit
  // kırmızısı. Mürekkep ve açık ton çekirdeğin kendi tonları kalır (stil dosyasındaki yarı saydam tonlar onlardan
  // türetildi; docs/KANCALAR.md). Sahnenin kendisi 3B çizildiği için bu zeminler koyu kalabilir: panel ayrı renk
  // istemez. (panelRenk: {} verilince çekirdek testinin tema denetimi bu oyunda kalıyor; rapora yazıldı.)
  renk: { zemin: '#1f3f5f', zemin2: '#2a5275', zemin3: '#3a6a95', cizgi: '#55849f', vurgu: '#ffcf4d', sicak: '#e2553a', serin: '#2fb8a8', soluk: '#c7d7e6' },
  // Ad etiketleri oyuncu şeridinde kalır (ALAN_UST–ALAN_ALT); ekran dışındaki arabanın adı yazılmaz.
  etiket: { ustSinir: true, altSinir: true, disari: 'gizle', balonSira: 'derinlik' },
  sahneYazi: { pankart: 'alt' },
  // Müzik: düğün oyun havası (darbuka, def zili, klarnet, alttan bas). Gelin Konvoyu'nun iki havası, aynı oyunun
  // 3B baskısı olduğu için aynen. Yazım docs/MUZIK.md. Tempo konvoyun hızını ve rejinin kesmelerini belirler.
  muzik: {
    takim: 'dugun',
    havalar: [
      { id: 'kurdele', ad: 'Kurdele', bpm: 104, spb: 4, bar: 16, tonik: 329.6,
        dizi: [0, 110, 390, 500, 700, 810, 1000],                       // hicaz
        davul: { ana: 'D.D.k.T.D.k.T.r.', cesni: 'D.D.kkT.D.kkT.kr', gecis: 'D.krT.krD.krTrTr' },
        ust: { ana: '..z...z...z...z.', cesni: '..z...z...z.z.z.', gecis: '..z.z.z.z.z.zzzz' },
        bas: { ana: '1.1.....5.......', cesni: '1.1.....5...8...', gecis: '1.1.....5.5.8.8.' },
        bolum: {
          A: "4:2 5':2 4:2 3:2 4:4 4:1 5:1 6:2 | 5:2 4:2 5:2 4:2 3:2 2:2 3:4 | 3:1 2:1 1:2 2:2 3:2 4:2 5:2 4:1 3:1 2:2 | 2:2 1:2 0:4 0~:8",
          B: "7:4 7:2 6:2 7:2 8':2 7:4 | 6:2 5:2 6:2 5:2 4:4 -:4 | 4:1 5:1 6:1 5:1 4:2 3:2 4:1 3:1 2:1 3:1 2:2 1:2 | 2:2 1:2 0:4 0~:8",
          D: '-:16 -:16'
        },
        eslik: { A: '0:16 0:16 1:16 0:16', B: '3:16 0:16 3:8 1:8 0:16' },
        form: 'AABBD' },
      { id: 'selektor', ad: 'Selektör', bpm: 118, spb: 4, bar: 8, tonik: 349.2,
        dizi: [0, 200, 300, 500, 700, 800, 1100],                       // nihavend
        davul: { ana: 'D.kDT.kr', cesni: 'D.kDTkTk', gecis: 'DkTrTrTr' },
        ust: { ana: 'z.z.z.z.', cesni: 'z.zzz.z.', gecis: 'z.z.zzzz' },
        bas: { ana: '1..15...', cesni: '1..18...', gecis: '1.5.8.5.' },
        bolum: {
          A: "0:2 2:2 4:2 5:2 | 4:4 2:2 3:2 | 4:2 3:2 2:2 1:2 | 2:4 -:2 2:1 3:1 | 4:2 4:1 5:1 4:2 3:2 | 2:2 3:1 2:1 1:2 0:2 | 1:2 -1:2 0:4 | 0~:8",
          B: "7:2 7:2 6:2 5:2 | 6:4 5:2 4:2 | 5:2 4:2 3:2 4:2 | 5:4 -:4 | 4':2 3:2 2:2 3:2 | 2:1 1:1 0:1 1:1 2:2 -1:2 | 0:4 2:2 1:2 | 0~:8",
          D: '-:8 -:8 -:8 -:8'
        },
        eslik: { A: '0:16 4:16 0:8 3:8 4:8 0:8', B: '0:16 4:16 3:16 4:8 0:8' },
        form: 'AABBD' }
    ]
  }
};
