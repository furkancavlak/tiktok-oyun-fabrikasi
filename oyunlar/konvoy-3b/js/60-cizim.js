/* ÇİZİM KANCALARI — 3B sahne ile çekirdeğin 2B üst katmanını aynı karede buluşturur.
 * oyunZemin(): 2B tuvali temizler (saydam üst katman), kamerayı rejiye kurdurur, arabaları ve efektleri yerleştirir,
 *   three.js sahnesini çizer. Dikkat: çekirdeğin D.kareMs ölçümü yalnız işlemcinin işini sayar; ekran kartı çizimi
 *   sonra, eşzamansız yapar. Gerçek kare süresini bu dosya kendisi ölçer (iki kare arası, KALITE) ve kare yetişmiyorsa
 *   kaliteyi kademe kademe düşürür: çizim ölçeği, gölgeler, uzak dekor, görüş uzaklığı.
 * oyunCiz(): her arabayı three.js kamerasıyla 720×1280 sanal tuvale düşürür, ekranda okunacak kadar büyük olanlara
 *   k.et verir (adı, balonu, öncelik kurallarını çekirdek çizer).
 * oyunUst(): korna yazıları ("DÜT!"), yakın çekimdeki izleyicinin ve drift atanın büyük adı, gelin süsünün izi.
 * oyunKamera(): çekirdeğin 2B kamerası kullanılmaz; sabit, zararsız bir nokta döner.
 * Efektler: drift dumanı (yumuşak lekeler), havai fişekler (noktalar), selektör yapan farların parıltısı.
 */
function oyunKamera() { return [[0, 0]]; }

// WebGL yok: sahnede ne olduğunu düz Türkçeyle söyleyen bir kart (kurallar, sıralama, yazılar yine çalışır).
const WEBGL_YOK = ['Bu oyun 3B çizilir:', 'ekran kartı (WebGL) gerekir.', '', 'Bu bilgisayarda ya da tarayıcıda', 'WebGL kapalı.', '',
  'Tarayıcı ayarlarında "donanım', 'hızlandırması"nı açın ya da 2B', 'oyunlardan birini yayına verin:', 'Gelin Konvoyu, Mendil Kimde?', 've Vur Düzelsin!'];
function webglYok() {
  const g = c.createLinearGradient(0, 0, 0, GH);
  g.addColorStop(0, GOK.ust);
  g.addColorStop(0.6, GOK.ufuk);
  g.addColorStop(1, '#c9b98a');
  c.fillStyle = g;
  c.fillRect(0, 0, GW, GH);
  c.fillStyle = renkSaydam(MUREKKEP, 0.82);
  c.beginPath();
  c.roundRect(60, 540, 600, 440, 28);
  c.fill();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  WEBGL_YOK.forEach((satir, i) => {
    c.font = (i < 2 ? '30px "Paytone One", ' : '500 25px ') + 'Rubik, system-ui, sans-serif';
    c.fillStyle = i < 2 ? RENK.vurgu : RENK.acik;
    c.fillText(satir, GW / 2, 590 + i * 36);
  });
  c.textBaseline = 'alphabetic';
  if (!KALITE.uyari)
    kaliteUyar('WebGL yok: bu oyunun 3B sahnesi bu bilgisayarda çizilemiyor. Sahnede bir uyarı görünür; yayına 2B oyunlardan birini verin.');
}

/* ---- efektler ---- */
const EFEKT = { duman: [], fisek: null, parilti: null };
function efektleriKur() {
  for (let i = 0; i < 72; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOKU.leke, color: '#ece8e2', transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    DUNYA.sahne.add(sp);
    EFEKT.duman.push(sp);
  }
  const nokta = (n, boy) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: boy, map: DOKU.leke, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    p.frustumCulled = false;
    DUNYA.sahne.add(p);
    return p;
  };
  EFEKT.fisek = nokta(14 * 60, 2.4);
  EFEKT.parilti = nokta(KAP_ARABA * 2, 1.1);
}
const _fr = new THREE.Color(), _fr2 = new THREE.Color();
function efektleriGuncelle() {
  // drift dumanı: lastiklerden çıkar, büyüyüp yükselerek söner
  let i = 0;
  for (const p of D.duman) {
    if (i >= EFEKT.duman.length)
      break;
    const u = (B - p.b0) / 3, sp = EFEKT.duman[i++];
    if (u < 0)
      continue;
    sp.visible = true;
    sp.position.set(p.x - DUNYA.kx, 0.3 + u * 1.4, p.z - DUNYA.kz);
    const r = (p.r + u * 2.2) * 2;
    sp.scale.set(r, r, 1);
    sp.material.opacity = 0.7 * (1 - u) * Math.min(1, u * 8 + 0.2);
  }
  for (; i < EFEKT.duman.length; i++)
    EFEKT.duman[i].visible = false;
  // havai fişekler: yükselen iz, sonra açılan küre; renkler katkılı karışımla parlar
  const fp = EFEKT.fisek.geometry.attributes.position, fc = EFEKT.fisek.geometry.attributes.color;
  let n = 0;
  for (const f of D.fisekler) {
    const u = B - f.b0, x = f.x - DUNYA.kx, z = f.z - DUNYA.kz;
    if (u < 0)
      continue;
    if (u < 0.8) {
      const y = lerp(2, f.y, yumusak(u / 0.8));
      for (let j = 0; j < 4 && n < fp.count; j++, n++) {
        fp.setXYZ(n, x, y - j * 1.2, z);
        fc.setXYZ(n, 1 - j * 0.2, 0.85 - j * 0.2, 0.5 - j * 0.1);
      }
      continue;
    }
    const t = (u - 0.8) / 2.6;
    if (t > 1)
      continue;
    const r = 15 * Math.sqrt(t), dus = 6 * t * t, al = Math.pow(1 - t, 1.3) * 1.6;
    _fr.set(f.renk);
    _fr2.set(f.renk2);
    for (let j = 0; j < f.n && n < fp.count; j++, n++) {
      // küre üstünde eşit dağılmış yönler (altın açı)
      const yy = 1 - 2 * (j + 0.5) / f.n, rr = Math.sqrt(1 - yy * yy), a = f.aci + j * 2.39996;
      fp.setXYZ(n, x + Math.cos(a) * rr * r, f.y + yy * r - dus, z + Math.sin(a) * rr * r);
      const c2 = j % 2 ? _fr : _fr2;
      fc.setXYZ(n, c2.r * al, c2.g * al, c2.b * al);
    }
    if (t < 0.12 && n < fp.count) {
      fp.setXYZ(n, x, f.y, z);
      fc.setXYZ(n++, 3 * (0.12 - t) / 0.12, 3 * (0.12 - t) / 0.12, 2.4 * (0.12 - t) / 0.12);
    }
  }
  EFEKT.fisek.geometry.setDrawRange(0, n);
  fp.needsUpdate = fc.needsUpdate = true;
  // selektör yapan farların parıltısı
  const pp = EFEKT.parilti.geometry.attributes.position, pc = EFEKT.parilti.geometry.attributes.color;
  n = 0;
  for (const k of gorunenArabalar) {
    if (!(B >= k.far && B < k.far + 3 && ((B - k.far) * 2 % 1) < 0.55) || !k._M)
      continue;
    const F = KASA[k.ar.tip].far;
    for (const s of [-1, 1]) {
      if (n >= pp.count)
        break;
      _v.set(F.x + 0.12, F.y, s * F.z).applyMatrix4(k._M);
      pp.setXYZ(n, _v.x, _v.y, _v.z);
      pc.setXYZ(n++, 1, 0.95, 0.75);
    }
  }
  EFEKT.parilti.geometry.setDrawRange(0, n);
  pp.needsUpdate = pc.needsUpdate = true;
}

/* ---- boyut, gölge, gök ---- */
function boyutEsle() {
  const r = DUNYA.r, o = KALITE_KADEME[KALITE.kademe].olcek, w = Math.round(tuval.width * o), h = Math.round(tuval.height * o);
  if (r.domElement.width !== w || r.domElement.height !== h) {
    // pencere boyu değişti: sonraki 1 sn kalite ölçümüne girmez
    if (boyutEsle.tw !== tuval.width)
      KALITE.sus = performance.now() + 1000;
    boyutEsle.tw = tuval.width;
    r.setSize(w, h, false);
  }
}
/* ---- kalite: gerçek kare aralığına göre kademe kademe düşer ---- */
// olcek: çizim çözünürlüğü (tuval CSS ile tam boy kalır) · golge: gölge haritası (0 = kapalı) · uzak: arka sıralar,
// bahçeler, camiler · gorus: sisin bittiği uzaklık (metre).
const KALITE_KADEME = [
  { olcek: 1, golge: 2048, uzak: true, gorus: 1 },
  { olcek: 0.8, golge: 1024, uzak: true, gorus: 1 },
  { olcek: 0.66, golge: 0, uzak: true, gorus: 0.8 },
  { olcek: 0.5, golge: 0, uzak: false, gorus: 0.55 },
  { olcek: 0.36, golge: 0, uzak: false, gorus: 0.45 }
];
// Ölçü: iki kare arası (requestAnimationFrame aralığı). Pencere: en az 30 kare ve 1,5 sn. Atılan örnekler: sekme
// görünürlüğü ya da tuval boyu değiştikten sonraki 1 sn, tek başına uzun kare (bir takılma; önceki kare akıcıyken
// 250 ms üstü). "Ekranın kendi temposu" (temel): sakin pencerelerin en küçük ortancası (60 Hz'de ~16,7, 30 Hz'de ~33).
// Yavaş: ortanca hem 45 ms'yi hem temelin 1,4 katını aşıyor. Art arda 3 yavaş pencere → bir kademe aşağı. 30 kare/sn
// sabit bir ekran (33 ms) yavaş sayılmaz. Toparlanma: kademe düşükken bekleme süresi (ilki 10 sn) boyunca hiç yavaş
// pencere gelmezse bir kademe yukarı denenir; deneme sonrası 3 pencere içinde yine yavaşlarsa geri iner ve bekleme ikiye
// katlanır (en çok 160 sn): kademe gidip gelmez. En düşük kademede de art arda 3 yavaş pencere → uyarı (panelde kalıcı,
// yayın görünümünde sahnede bir kez, 10 sn).
const KALITE = { kademe: 0, aralik: 0, ornek: [], son: 0, toplam: 0, yavas: false, uyari: null, temel: Infinity, yavasSay: 0, iyiSn: 0,
  bekleme: 10, deneme: 0, sus: 0, onceki: 0, sahneUyari: null, gecmis: [] };
const KALITE_YAVAS_MS = 45, KALITE_YAVAS_KAT = 1.4;
addEventListener('visibilitychange', () => { KALITE.sus = performance.now() + 1000; });
function kaliteOlc() {
  const t = performance.now(), d = t - KALITE.son, onceki = KALITE.onceki;
  KALITE.son = t;
  KALITE.onceki = d;
  if (!(d > 0 && d < 5000) || t < KALITE.sus || document.hidden)
    return;
  // tek başına uzun kare (takılma): sayılmaz
  if (d > 250 && onceki < 100)
    return;
  KALITE.ornek.push(d);
  KALITE.toplam += d;
  // pencere: 90 kare, ya da 30 kare ve 1,5 sn, ya da (çok yavaşken) 6 kare ve 2,5 sn
  const n = KALITE.ornek.length;
  if (n < 90 && !(n >= 30 && KALITE.toplam >= 1500) && !(n >= 6 && KALITE.toplam >= 2500))
    return;
  const sure = KALITE.toplam / 1000;
  KALITE.toplam = 0;
  const s = KALITE.ornek.slice().sort((a, b) => a - b);
  KALITE.aralik = s[s.length >> 1];
  KALITE.ornek.length = 0;
  // ekranın temposu 30 Hz'den yavaş sayılmaz (temel en çok 34 ms): yavaş eşiği 45–48 ms
  const yavas = KALITE.aralik > Math.max(KALITE_YAVAS_MS, Math.min(KALITE.temel, 34) * KALITE_YAVAS_KAT);
  if (!yavas)
    KALITE.temel = Math.min(KALITE.temel, KALITE.aralik);
  KALITE.gecmis.push([Math.round(t / 100) / 10, +KALITE.aralik.toFixed(1), KALITE.kademe]);
  if (KALITE.gecmis.length > 40)
    KALITE.gecmis.shift();
  if (yavas) {
    KALITE.iyiSn = 0;
    KALITE.yavasSay++;
    // yukarı deneme başarısız: hemen geri, bekleme ikiye katlanır
    if (KALITE.deneme > 0) {
      KALITE.deneme = 0;
      KALITE.bekleme = Math.min(160, KALITE.bekleme * 2);
      KALITE.yavasSay = 0;
      kaliteKur(KALITE.kademe + 1);
      return;
    }
    if (KALITE.yavasSay >= 3) {
      KALITE.yavasSay = 0;
      // çok yavaşsa (120 ms üstü) iki kademe birden
      if (KALITE.kademe < KALITE_KADEME.length - 1)
        kaliteKur(Math.min(KALITE_KADEME.length - 1, KALITE.kademe + (KALITE.aralik > 120 ? 2 : 1)));
      else if (!KALITE.yavas) {
        KALITE.yavas = true;
        KALITE.sahneUyari = { b0: zaman };
        kaliteUyar('Bu bilgisayarın ekran kartı 3B sahneye yetişmiyor (kare başına yaklaşık ' + Math.round(KALITE.aralik) + ' ms; akıcı görüntü için 33 ms altı gerekir). Kalite en düşükte. Tarayıcının donanım hızlandırmasını açın ya da 2B oyunlardan birini yayına verin (Gelin Konvoyu, Mendil Kimde?, Vur Düzelsin!).');
      }
    }
    return;
  }
  KALITE.yavasSay = 0;
  if (KALITE.deneme > 0 && --KALITE.deneme === 0)
    KALITE.bekleme = 10;
  KALITE.iyiSn += sure;
  if (KALITE.kademe > 0 && KALITE.iyiSn >= KALITE.bekleme && KALITE.deneme === 0) {
    KALITE.iyiSn = 0;
    KALITE.deneme = 3;
    kaliteKur(KALITE.kademe - 1);
  }
}
function kaliteKur(n) {
  KALITE.kademe = n;
  const k = KALITE_KADEME[n], g = DUNYA.gunes;
  g.castShadow = k.golge > 0;
  if (k.golge && g.shadow.mapSize.x !== k.golge) {
    g.shadow.mapSize.set(k.golge, k.golge);
    if (g.shadow.map) {
      g.shadow.map.dispose();
      g.shadow.map = null;
    }
  }
  boyutEsle();
}
// Yayın masasında (panelde) düz bir uyarı satırı; izleyici görmez. Metin sabit, textContent ile yazılır.
function kaliteUyar(metin) {
  if (!KALITE.uyari) {
    KALITE.uyari = document.createElement('p');
    KALITE.uyari.className = 'not';
    KALITE.uyari.style.color = '#ffcf4d';
    const yer = $('panel-not');
    if (yer && yer.parentNode)
      yer.parentNode.insertBefore(KALITE.uyari, yer.nextSibling);
  }
  KALITE.uyari.textContent = metin;
}
function golgeAyarla() {
  const g = DUNYA.gunes, o = DUNYA.golgeOdak || DUNYA.kamera.position, R = DUNYA.golgeR, kam = g.shadow.camera;
  // Gölge haritası odağın çevresinde; texel adımına oturtulur ki kamera kayarken gölgeler titremesin.
  const adim = 2 * R / g.shadow.mapSize.x, x = Math.round(o.x / adim) * adim, z = Math.round(o.z / adim) * adim;
  g.target.position.set(x, 0, z);
  g.position.set(x + GUNES_YON.x * 150, GUNES_YON.y * 150, z + GUNES_YON.z * 150);
  if (kam.right !== R) {
    kam.left = kam.bottom = -R;
    kam.right = kam.top = R;
    kam.updateProjectionMatrix();
  }
  g.target.updateMatrixWorld();
  // gök ve bulutlar kamerayla gezer; zemin 50 metrelik adımlarla (dokusu yerinde kalsın)
  const kp = DUNYA.kamera.position;
  DUNYA.gok.position.copy(kp);
  DUNYA.bulutlar.position.set(kp.x, 0, kp.z);
  // zemin 200 metrelik adımlarla kayar: tarla dokusu (200 m'lik karo) dünyada yerinde kalır
  DUNYA.zemin.position.x = Math.round((kp.x + DUNYA.kx) / 200) * 200 - DUNYA.kx;
  DUNYA.zemin.position.z = Math.round((kp.z + DUNYA.kz) / 200) * 200 - DUNYA.kz;
}

/* ---- kancalar ---- */
function oyunZemin() {
  c.clearRect(0, 0, GW, GH);
  // çekirdek adların kutusunu (k.etKutu) birazdan sıfırlar: bir önceki karenin kutusu ad-araba bağı için saklanır
  for (const k of gorunenArabalar)
    k._etKutuOnce = k.etKutu ? k.etKutu.slice() : null;
  if (!DUNYA.r) {
    dunyaKur();
    if (!DUNYA.r) {
      webglYok();
      return;
    }
  }
  kaliteOlc();
  boyutEsle();
  if (kokenAyarla(false))
    DUNYA.golgeOdak = null;
  parcalariUret(1);
  DALGA.value = B;
  rejiGuncelle(sonDt);
  arabalariYerlestir();
  parkGizle();
  sokakGuncelle();
  efektleriGuncelle();
  golgeAyarla();
  DUNYA.r.render(DUNYA.sahne, DUNYA.kamera);
}
// Ad etiketi: tavanın biraz üstü. Okunacak kadar büyük görünen arabaya (metre başına en az ETIKET_PX piksel) verilir;
// gelin arabasınınki daha küçükken de yazılır. Yakın çekimin konusu ve drift atanın adını oyunUst büyük yazar.
const ETIKET_PX = 20, GENIS_AD = 8;
const _et = new THREE.Vector3(), _etE = { x: 0, y: 0, ok: false };
function oyunCiz() {
  if (!DUNYA.r)
    return;
  const kam = DUNYA.kamera, F = (GH / 2) / Math.tan(kam.fov * Math.PI / 360), ileri = DUNYA.bakis;
  const kk = kartKonusu(), kart = kk.k;
  // süper araba kartı ekrandayken (üç satır, şeridin altı) kartın hizasına düşen küçük adlar yazılmaz: kartın üstüne binmesin
  const kartAlti = kk.an ? SUPER_KART_Y - 96 : Infinity;
  let yazildi = false, yedek = null, genisSay = 0;
  const genis = genisMi(D.reji.cekim);
  for (const k of gorunenArabalar) {
    if (!k._M || k.cikiyor)
      continue;
    const K = KASA[k.ar.tip], ust = Math.max(K.ev[1][1], K.ev[2][1]);
    _et.set((K.ev[1][0] + K.ev[2][0]) / 2, ust + 0.32, 0).applyMatrix4(k._M);
    const derin = rejiV1.subVectors(_et, kam.position).dot(ileri);
    if (derin < 0.5)
      continue;
    ekranNokta(kam, _et, _etE);
    const s = F / derin;
    // sürücünün başı: kare-cek ve testlerin ölçümü (k.basEkran)
    if (k._bas) {
      const bd = rejiV1.subVectors(k._bas, kam.position).dot(ileri);
      if (bd > 0.5) {
        const be = ekranNokta(kam, k._bas, { x: 0, y: 0, ok: false });
        k.basEkran = { x: be.x, y: be.y, r: 0.15 * F / bd, kare: kareSay };
      }
    }
    if (!_etE.ok)
      continue;
    k._etNokta = k._etNokta || { x: 0, y: 0, kare: 0 };
    k._etNokta.x = _etE.x;
    k._etNokta.y = _etE.y;
    k._etNokta.kare = kareSay;
    const et = { x: _etE.x, y: _etE.y, s, d: derin }, seritte = et.y > SERIT_UST - 45 && et.y < SERIT_ALT - 10 && et.x > 0 && et.x < GW;
    // yakın çekimin konusunun, drift atanın ve yeni gelin arabasının adı yalnız büyük kartta yazar (oyunUst)
    if (k === kart || et.y > kartAlti)
      continue;
    // gelin arabasının adı her çekimde yazılır (geniş çekimde de kim olduğu görünsün). Geniş çekimde küçük adların
    // tozu olmasın: yalnız gelin arabası, ilk beş, yeni katılanlar ve son yazanlar (en çok GENIS_AD tane).
    const aday = genis ? (k === D.lider || k.sn < 5 || zaman - k.yeni < 25 || zaman - k.son < 15) && genisSay < GENIS_AD : s >= ETIKET_PX;
    if (aday || k === D.lider) {
      if (genis)
        genisSay++;
      k.et = et;
      // ekranın dışındaki adı çekirdek çizmez (disari: 'gizle'): sayılmaz
      yazildi = yazildi || (et.x > 0 && et.x < GW && et.y > 0 && et.y < SERIT_ALT);
    }
    else if (seritte && (!yedek || s > yedek.et.s))
      yedek = { k, et };
  }
  // Kadrajda hiç ad kalmadıysa (konu kartta, ötekiler küçük) en büyük görünen arabanın adı yine yazılır: sahnede her
  // zaman en az bir ad okunur. Kartın konusunun adı yalnız büyük kartta yazar (k.oyunAd ile çekirdeğin ölçümüne girer).
  if (!yazildi && yedek)
    yedek.k.et = yedek.et;

}
// Büyük ad kartının konusu (yoksa k: null): şov çekiminde drift atan, yakın çekimde o izleyici, lider çekiminde yeni
// gelin arabası. Bu arabanın küçük etiketi çizilmez: ad bir kez, büyük yazılır.
// Çıkmakta olan ya da kaydı yenilenmiş araba kartı taşımaz (konu yanlış kişiyi göstermesin).
const kartGecerli = k => k && k.ar && !k.cikiyor && D.oy.get(k.id) === k;
// Süper araba anı (10-oyun.js superAraba, D.superAn): çekime ya da vurguya bağlı an (c.an, vurgu.an); şov çekiminde ve şov
// vurgusunda aynı arabanın taze anı da sayılır (tek seferde 1000 jetonluk hediye hem süper arabayı hem drift şovunu verir).
// O zaman kart, çekim ne olursa olsun, üstte "SÜPER ARABA" (drift dönerken "SÜPER ARABA · DRIFT ŞOV"), ortada ad, altta
// ikinci bilgi: aynı hediye gelin arabasını da verdiyse "Gelin arabası da artık onda", yoksa hediyenin jetonu.
const superYeni = k => D.superAn && D.superAn.k === k && B - D.superAn.b0 < DRIFT_V * 3;
const donuyor = k => !!D.drift && D.drift.k === k && D.drift.donus !== null;
function superAlt(an) {
  if (an.lider)
    return 'Gelin arabası da artık onda';
  return an.tekrar ? 'Yine ' + sayi(an.birim) + ' jeton' : sayi(an.birim) + ' jetonluk hediye';
}
function kartKonusu() {
  const R = D.reji, c = R.cekim, ad = c && c.ad;
  let kart = { k: null, ust: '' };
  if (ad === 'sov' && D.drift && kartGecerli(D.drift.k))
    kart = { k: D.drift.k, ust: 'DRIFT ŞOV!', an: c.an };
  // bekleme süresinde gelen olay: geniş çekimin üstünde büyük ad (ve halka). Süper araba vurgusu olay çekimi dışındaki
  // her çekimde (kısa ara kesmede, vincin kalkışında da) çıkar: duyuru kameranın kesmesini beklemez.
  else if (R.vurgu && B - R.vurgu.b0 < R.vurgu.sure && kartGecerli(R.vurgu.k) && (genisMi(c) || (R.vurgu.an && c && !OLAY_CEKIMLERI.includes(c.ad) && !c.olay)))
    kart = { k: R.vurgu.k, ust: R.vurgu.ust, halka: true, an: R.vurgu.an };
  else if (ad === 'yakin' && kartGecerli(R.konu))
    kart = { k: R.konu, ust: (R.konu.sn + 1) + '. araba' + (R.konu.jeton > 0 ? ' · ' + R.konu.jeton + ' jeton' : ''), an: c.an };
  else if (ad === 'lider' && D.lider)
    kart = { k: D.lider, ust: 'YENİ GELİN ARABASI', an: c.an };
  else if (ad === 'super' && kartGecerli(c.k))
    kart = { k: c.k, ust: 'SÜPER ARABA', an: c.an };
  else if (ad === 'sollama' && kartGecerli(c.k))
    kart = { k: c.k, ust: 'ÖNE GEÇİYOR', an: c.an };
  if (!kart.k)
    return kart;
  let an = kart.an && kart.an.k === kart.k ? kart.an : null;
  if (!an && (kart.ust === 'DRIFT ŞOV!' || kart.ust === 'SÜPER ARABA') && superYeni(kart.k))
    an = D.superAn;
  kart.an = an;
  if (an) {
    kart.ust = donuyor(kart.k) ? 'SÜPER ARABA · DRIFT ŞOV' : 'SÜPER ARABA';
    kart.alt = superAlt(an);
  }
  else if (kart.ust === 'SÜPER ARABA' && donuyor(kart.k))
    kart.ust = 'SÜPER ARABA · DRIFT ŞOV';
  return kart;
}
// Süper araba kartının yeri: adın hapı şeridin biraz yukarısında, altında ikinci satıra yer kalsın (alt beşte bir, 1024
// sonrası, boş kalır). Süper araba çekimi arabayı bu kartın üstüne sığdırır (50-reji.js SUPER_ALT).
const SUPER_KART_Y = SERIT_ALT - 60;
// Kornada arabanın yanında beliren "DÜT!" ve büyük ad kartları.
// Ad ile araba arasında bağ: çekirdek adı çakışmasın diye yukarı aşağı kaydırabilir; kayan ad (ya da bir başka arabanın
// tavanına kendi arabasınınkinden yakın duran ad) kendi arabasının tavanına ince bir çizgiyle bağlanır. Böylece hiçbir
// ad komşu arabanınmış gibi okunmaz. Adın yeri bir önceki karenin kutusudur (çekirdek adları bu kancadan sonra çizer).
// ORNEK.etiket: { ad: yazılan, bagli: çizgi çekilen, belirsiz: başka arabaya daha yakın olup çizgisi olmayan }.
function etiketBagla() {
  let ad = 0, bagli = 0, belirsiz = 0;
  const noktalar = gorunenArabalar.filter(k => k._etNokta && k._etNokta.kare === kareSay && !k.cikiyor);
  c.lineWidth = 2;
  for (const k of noktalar) {
    const kt = k._etKutuOnce, n = k._etNokta;
    if (!kt || !k.et)
      continue;
    ad++;
    const bx = kt[0] + kt[2] / 2, by = kt[1] + kt[3], kendi = Math.hypot(bx - n.x, by - n.y);
    let baska = Infinity;
    for (const o of noktalar)
      if (o !== k)
        baska = Math.min(baska, Math.hypot(bx - o._etNokta.x, by - o._etNokta.y));
    const cizgi = kendi > 14 || baska < kendi * 1.6;
    if (cizgi) {
      bagli++;
      c.strokeStyle = renkSaydam(MUREKKEP, 0.75);
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(n.x, n.y);
      c.stroke();
      c.fillStyle = RENK.vurgu;
      c.beginPath();
      c.arc(n.x, n.y, 4, 0, TAU);
      c.fill();
      c.stroke();
    }
    else if (baska < kendi)
      belirsiz++;
  }
  ORNEK.etiket = { ad, bagli, belirsiz };
}
function oyunUst() {
  if (!DUNYA.r)
    return;
  etiketBagla();
  // Süper arabanın küçük adı süper araba renginde bir halkayla çevrilir: geniş çekimde de hangi arabanın süper araba
  // olduğu adından okunur. Çekirdek adları bu kancadan sonra çizer; halka bir önceki karenin ad kutusunun biraz dışında.
  c.lineWidth = 3;
  c.strokeStyle = SUPER_RENK;
  for (const k of gorunenArabalar) {
    const kt = k._etKutuOnce;
    if (!kt || !k.et || k.cikiyor || !k.ar || k.ar.tip !== 'super')
      continue;
    c.beginPath();
    c.roundRect(kt[0] - 3, kt[1] - 3, kt[2] + 6, kt[3] + 6, (kt[3] + 6) / 2);
    c.stroke();
  }
  // yayın görünümünde panel gizli: ekran kartı yetişmiyorsa sahnede bir kez, 10 sn, küçük düz bir kart
  const su = KALITE.sahneUyari;
  if (su && zaman - su.b0 < 10 && document.body.classList.contains('yayin')) {
    c.globalAlpha = Math.min(1, (10 - (zaman - su.b0)) * 2);
    c.fillStyle = renkSaydam(MUREKKEP, 0.85);
    c.beginPath();
    c.roundRect(70, 520, 580, 96, 18);
    c.fill();
    c.fillStyle = RENK.acik;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '500 22px Rubik, system-ui, sans-serif';
    c.fillText('Ekran kartı 3B sahneye yetişmiyor: kalite en düşükte.', GW / 2, 552, 550);
    c.fillText('Donanım hızlandırmasını açın ya da 2B oyun seçin.', GW / 2, 586, 550);
    c.globalAlpha = 1;
  }
  const kam = DUNYA.kamera;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const k of gorunenArabalar) {
    if (!k._M || !(B >= k.korna && B < k.korna + KORNA_V))
      continue;
    const K = KASA[k.ar.tip];
    _et.set(K.far.x + 0.2, K.far.y + 0.9, 0).applyMatrix4(k._M);
    const derin = rejiV1.subVectors(_et, kam.position).dot(DUNYA.bakis);
    if (derin < 1)
      continue;
    ekranNokta(kam, _et, _etE);
    if (!_etE.ok || _etE.y < SERIT_UST + 20 || _etE.y > SERIT_ALT - 20 || _etE.x < 30 || _etE.x > GW - 30)
      continue;
    const s = (GH / 2) / Math.tan(kam.fov * Math.PI / 360) / derin;
    const u = (B - k.korna) / KORNA_V, olc = 0.8 + 0.35 * Math.sin(Math.min(1, u * 4) * HP), punto = Math.round(clamp(s * 0.3, 14, 34) * olc);
    c.globalAlpha = Math.min(1, (1 - u) * 3);
    c.font = punto + 'px "Paytone One", Rubik, system-ui, sans-serif';
    c.lineWidth = 4;
    c.strokeStyle = MUREKKEP;
    const y = _etE.y - u * s * 0.4;
    c.strokeText('DÜT!', _etE.x, y);
    c.fillStyle = RENK.vurgu;
    c.fillText('DÜT!', _etE.x, y);
  }
  c.globalAlpha = 1;
  // gelin süsü el değiştirince eski arabadan yenisine bir ışık izi akar
  const ku = D.kurdeleUcus;
  if (ku && ku.kime._M && ku.eski && ku.eski._M) {
    const bas = B - ku.b0;
    for (let i = 0; i < 12; i++) {
      const t = clamp(bas / 0.9 - i * 0.06, 0, 1);
      if (t <= 0 || bas > 1.6)
        continue;
      const y = yumusak(t);
      rejiV2.setFromMatrixPosition(ku.eski._M).lerp(_et.setFromMatrixPosition(ku.kime._M), y);
      rejiV2.y += 1.2 + Math.sin(t * Math.PI) * 3;
      ekranNokta(kam, rejiV2, _etE);
      const derin = rejiV1.subVectors(rejiV2, kam.position).dot(DUNYA.bakis);
      if (!_etE.ok || derin < 1)
        continue;
      c.globalAlpha = (1 - i / 12) * clamp(2 - bas, 0, 1);
      c.fillStyle = i % 2 ? '#ffd166' : '#e23d2f';
      c.beginPath();
      c.arc(_etE.x, _etE.y, clamp(0.25 * 1300 / derin, 4, 22), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  // büyük ad kartı: yakın çekimin konusu ya da drift atan (şov çekiminde). Şeridin altında, yolun üstünde durur.
  const R = D.reji, ad = R.cekim && R.cekim.ad, kart = kartKonusu(), { k, ust } = kart, b0 = kart.halka ? R.vurgu.b0 : R.cekim ? (R.cekim.kartB0 || R.cekim.b0) : B;
  // bekleme süresindeki olay: arabanın çevresinde vuruşla atan altın halka (kamera kesmeden)
  if (kart.halka && k._M) {
    const p = ekranNokta(DUNYA.kamera, _et.setFromMatrixPosition(k._M), { x: 0, y: 0, ok: false });
    const derin = rejiV1.subVectors(_et, DUNYA.kamera.position).dot(DUNYA.bakis);
    // halka yalnız oyuncu şeridinde: araba üstteki yazıların (sıralama, bildirim) altında kalıyorsa çizilmez
    if (p.ok && derin > 1 && p.y > SERIT_UST - 40 && p.y < SERIT_ALT) {
      const r = clamp(3.2 * (GH / 2) / Math.tan(DUNYA.kamera.fov * Math.PI / 360) / derin, 18, 140) * (1 + 0.08 * Math.sin(TAU * B));
      c.lineWidth = 5;
      c.strokeStyle = RENK.vurgu;
      c.globalAlpha = 0.9;
      c.beginPath();
      c.ellipse(p.x, p.y, r, r * 0.6, 0, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
    }
  }
  if (k && B - b0 > 0.3) {
    // Süper araba kartı (kart.an): üst satır iri ve süper arabanın renginde, ad hapı da o renkte (arabanın boyası), altında
    // ikinci satır. Öbür kartlar: küçük üst satır, gelin arabasınınki sarı hap.
    const sup = !!kart.an, gir = clamp((B - b0 - 0.3) * 2.5, 0, 1);
    c.globalAlpha = gir;
    c.font = '34px "Paytone One", Rubik, system-ui, sans-serif';
    const w = Math.min(560, c.measureText(k.ad).width + 52), x = GW / 2, y = (sup ? SUPER_KART_Y : SERIT_ALT - 52) + (1 - gir) * 16;
    c.fillStyle = sup ? SUPER_RENK : k === D.lider ? RENK.vurgu : renkSaydam(MUREKKEP, 0.82);
    c.strokeStyle = sup || k === D.lider ? MUREKKEP : RENK.vurgu;
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(x - w / 2, y - 27, w, 54, 27);
    c.fill();
    c.stroke();
    c.fillStyle = sup || k === D.lider ? MUREKKEP : RENK.acik;
    c.fillText(k.ad, x, y + 2, w - 30);
    // çekirdeğin ölçümüne (CanliOyun._test.olcum, "en az bir ad okunur" denetimi) bu ad da girer: docs/KANCALAR.md
    k.oyunAd = { kutu: [x - w / 2, y - 27, w, 54], kare: kareSay };
    c.font = (sup ? 34 : 20) + 'px "Paytone One", Rubik, system-ui, sans-serif';
    c.lineWidth = sup ? 6 : 4;
    c.strokeStyle = MUREKKEP;
    const uy = y - (sup ? 51 : 42);
    c.strokeText(ust, x, uy, GW - 60);
    c.fillStyle = ust.startsWith('SÜPER ARABA') ? SUPER_RENK : ad === 'sov' ? RENK.sicak : RENK.vurgu;
    c.fillText(ust, x, uy, GW - 60);
    if (kart.alt) {
      c.font = '600 20px Rubik, system-ui, sans-serif';
      c.lineWidth = 4;
      c.strokeText(kart.alt, x, y + 45, GW - 60);
      c.fillStyle = RENK.acik;
      c.fillText(kart.alt, x, y + 45, GW - 60);
    }
    c.globalAlpha = 1;
    D.kartYazi = { ust, ad: k.ad, alt: kart.alt || '', kare: kareSay };
  }
  c.textBaseline = 'alphabetic';
}
