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
  'Tarayıcı ayarlarında "donanım', 'hızlandırması"nı açın ya da 2B', 'oyunlardan birini yayına verin:', 'Gelin Konvoyu, Mendil Kimde?,', 'Vur Düzelsin!, Müsait Bir Yerde.'];
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
  if (r.domElement.width !== w || r.domElement.height !== h)
    r.setSize(w, h, false);
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
const KALITE = { kademe: 0, aralik: 0, ornek: [], son: 0, yavas: false, uyari: null };
const KALITE_SINIR = 26, KALITE_YAVAS = 40;
function kaliteOlc() {
  const t = performance.now(), d = t - KALITE.son;
  KALITE.son = t;
  // sekme arkadayken ya da ilk karede gelen uzun boşluklar sayılmaz
  if (!(d > 0 && d < 1000))
    return;
  KALITE.ornek.push(d);
  KALITE.toplam = (KALITE.toplam || 0) + d;
  // en az 20 kare ve 1,5 saniye ya da 90 kare biriktirince karar verir: yavaş makinede de birkaç saniyede bir kademe
  if (KALITE.ornek.length < 90 && !(KALITE.ornek.length >= 20 && KALITE.toplam >= 1500))
    return;
  KALITE.toplam = 0;
  const s = KALITE.ornek.slice().sort((a, b) => a - b);
  KALITE.aralik = s[s.length >> 1];
  KALITE.ornek.length = 0;
  if (KALITE.aralik > KALITE_SINIR && KALITE.kademe < KALITE_KADEME.length - 1)
    kaliteKur(KALITE.kademe + 1);
  else if (KALITE.aralik > KALITE_YAVAS && KALITE.kademe === KALITE_KADEME.length - 1 && !KALITE.yavas) {
    KALITE.yavas = true;
    kaliteUyar('Bu bilgisayarın ekran kartı 3B sahneye yetişmiyor (kare başına yaklaşık ' + Math.round(KALITE.aralik) + ' ms; akıcı görüntü için 33 ms altı gerekir). Kalite en düşükte. Tarayıcının donanım hızlandırmasını açın ya da 2B oyunlardan birini yayına verin (Gelin Konvoyu, Mendil Kimde?, Vur Düzelsin!, Müsait Bir Yerde).');
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
  efektleriGuncelle();
  golgeAyarla();
  DUNYA.r.render(DUNYA.sahne, DUNYA.kamera);
}
// Ad etiketi: tavanın biraz üstü. Okunacak kadar büyük görünen arabaya (metre başına en az ETIKET_PX piksel) verilir;
// gelin arabasınınki daha küçükken de yazılır. Yakın çekimin konusu ve drift atanın adını oyunUst büyük yazar.
const ETIKET_PX = 20;
const _et = new THREE.Vector3(), _etE = { x: 0, y: 0, ok: false };
function oyunCiz() {
  if (!DUNYA.r)
    return;
  const kam = DUNYA.kamera, F = (GH / 2) / Math.tan(kam.fov * Math.PI / 360), ileri = DUNYA.bakis;
  const kart = kartKonusu().k;
  let yazildi = false, yedek = null, yedekKart = null;
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
    const et = { x: _etE.x, y: _etE.y, s, d: derin }, seritte = et.y > SERIT_UST - 45 && et.y < SERIT_ALT - 10 && et.x > 0 && et.x < GW;
    // yakın çekimin konusunun, drift atanın ve yeni gelin arabasının adı yalnız büyük kartta yazar (oyunUst)
    if (k === kart) {
      if (et.x > 0 && et.x < GW && et.y > 0 && et.y < SERIT_ALT)
        yedekKart = et;
      continue;
    }
    // gelin arabasının adı her çekimde yazılır (geniş çekimde de kim olduğu görünsün)
    if (s >= ETIKET_PX || k === D.lider) {
      k.et = et;
      // ekranın dışındaki adı çekirdek çizmez (disari: 'gizle'): sayılmaz
      yazildi = yazildi || (et.x > 0 && et.x < GW && et.y > 0 && et.y < SERIT_ALT);
    }
    else if (seritte && (!yedek || s > yedek.et.s))
      yedek = { k, et };
  }
  // Kadrajda hiç ad kalmadıysa (konu kartta, ötekiler küçük) en büyük görünen arabanın adı yine yazılır: sahnede her
  // zaman en az bir ad okunur. Kadrajda başka araba hiç yoksa kartın konusu küçük etiketini de alır.
  if (!yazildi && yedek)
    yedek.k.et = yedek.et;
  else if (!yazildi && yedekKart && kart)
    kart.et = yedekKart;
}
// Büyük ad kartının konusu (yoksa k: null): şov çekiminde drift atan, yakın çekimde o izleyici, lider çekiminde yeni
// gelin arabası. Bu arabanın küçük etiketi çizilmez: ad bir kez, büyük yazılır.
// Süper araba anı (10-oyun.js superAraba) hangi çekimde olursa olsun SUPER_KART_V vuruş boyunca kartı alır (şov hariç):
// reji o anın yakın çekimini ekleyene dek de izleyici adını büyük görür. b0: kartın girişi bu andan sayılır.
const SUPER_KART_V = 8;
function kartKonusu() {
  const R = D.reji, ad = R.cekim && R.cekim.ad;
  if (ad === 'sov' && D.drift && D.drift.k.ar)
    return { k: D.drift.k, ust: 'DRIFT ŞOV!' };
  const sa = D.superAn;
  if (sa && B - sa.b0 < SUPER_KART_V && D.oy.get(sa.k.id) === sa.k && !sa.k.cikiyor)
    return { k: sa.k, ust: 'SÜPER ARABA', b0: sa.b0, super: true };
  if (ad === 'yakin' && R.konu && D.oy.has(R.konu.id) && D.oy.get(R.konu.id) === R.konu)
    return { k: R.konu, ust: (R.konu.sn + 1) + '. araba' + (R.konu.jeton > 0 ? ' · ' + R.konu.jeton + ' jeton' : '') };
  if (ad === 'lider' && D.lider)
    return { k: D.lider, ust: 'YENİ GELİN ARABASI' };
  return { k: null, ust: '' };
}
// Kornada arabanın yanında beliren "DÜT!" ve büyük ad kartları.
function oyunUst() {
  if (!DUNYA.r)
    return;
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
  const R = D.reji, ad = R.cekim && R.cekim.ad, { k, ust, b0, super: sup } = kartKonusu(), kb0 = b0 !== undefined ? b0 : R.cekim && R.cekim.b0;
  if (k && R.cekim && B - kb0 > 0.3) {
    const gir = clamp((B - kb0 - 0.3) * 2.5, 0, 1);
    c.globalAlpha = gir;
    c.font = '34px "Paytone One", Rubik, system-ui, sans-serif';
    const w = Math.min(560, c.measureText(k.ad).width + 52), x = GW / 2, y = SERIT_ALT - 52 + (1 - gir) * 16;
    c.fillStyle = k === D.lider ? RENK.vurgu : renkSaydam(MUREKKEP, 0.82);
    c.strokeStyle = k === D.lider ? MUREKKEP : RENK.vurgu;
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(x - w / 2, y - 27, w, 54, 27);
    c.fill();
    c.stroke();
    c.fillStyle = k === D.lider ? MUREKKEP : RENK.acik;
    c.fillText(k.ad, x, y + 2, w - 30);
    c.font = '20px "Paytone One", Rubik, system-ui, sans-serif';
    c.lineWidth = 4;
    c.strokeStyle = MUREKKEP;
    c.strokeText(ust, x, y - 42);
    c.fillStyle = sup ? SUPER_RENK : ad === 'sov' ? RENK.sicak : RENK.vurgu;
    c.fillText(ust, x, y - 42);
    c.globalAlpha = 1;
  }
  c.textBaseline = 'alphabetic';
}
