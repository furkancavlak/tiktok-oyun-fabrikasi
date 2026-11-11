/* DÜNYA — three.js sahnesi: çizici, ışık, gök, bulutlar, zemin, kıvrılan yol ve yol kenarındaki kasaba.
 * Çekirdeğin 2B tuvali (#tuval) saydam bir üst katman olarak kalır; bu dosya #sahne içine, #tuval'in ÖNÜNE (arkasında
 * kalsın diye) ikinci bir tuval koyar ve onu three.js ile çizer. İkisi aynı karede çizilir (oyunZemin, js/60-cizim.js).
 * DUNYA: { r (çizici), sahne, kamera, gunes, kx / kz (çizim kökeni), parcalar, gpu }
 * dunyaKur(): bir kez kurar · dunyaGuncelle(): kökeni kaydırır, konvoyun önünde ve arkasında yolu üretir, siler
 * Yigin: birçok küçük parçayı (kutu, silindir, top) köşe renkleriyle TEK geometriye birleştirir: kasabanın bir
 * parçası birkaç çizim çağrısıyla çizilir.
 * Yol PARCA metrelik parçalardan kurulur; her şey yolun s (ileri metre) değerinin tohumundan türer: aynı yer her
 * geçişte aynı görünür. Hiçbir görsel dosya yoktur: dokular CanvasTexture ile kodla çizilir.
 */
const PARCA = 60;            // bir yol parçasının boyu (metre)
const YOL_YARI = 4.2;        // asfaltın yarı genişliği
const KALDIRIM = 7.4;        // kaldırımın dış kenarı (yolun ortasından)
const KALDIRIM_Y = 0.16;
const AGAC_L = 6.0;          // ağaç ve direklerin yolun ortasına uzaklığı
const BINA_L = 10.6;         // ön sıra binaların cephesi
const PARK_L = 3.45;         // sol kaldırımın dibinde park etmiş arabalar
const GOK = { ust: '#4f93db', orta: '#93c3ee', ufuk: '#ffe2b6', sis: '#f2dcc0', gunes: '#fff1cf' };
const GUNES_YON = new THREE.Vector3(-0.42, 0.74, 0.52).normalize();
const DUNYA = { r: null, sahne: null, kamera: null, kx: 0, kz: 0, parcalar: new Map(), gpu: null, yok: false, bakis: new THREE.Vector3(0, 0, 1), golgeR: 30 };

/* ---- birleştirici ---- */
const _m4 = new THREE.Matrix4(), _m3 = new THREE.Matrix3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _r = new THREE.Color();
class Yigin {
  constructor(uvlu) {
    this.p = [];
    this.n = [];
    this.c = [];
    this.u = uvlu ? [] : null;
    this.i = [];
    this.ek = null;
  }
  // g: BufferGeometry, m: Matrix4, renk: THREE.Color ya da '#rrggbb', ek: köşe başına ek değer (boya maskesi gibi)
  geo(g, m, renk, ek) {
    const col = renk instanceof THREE.Color ? renk : _r.set(renk), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, E = g.attributes.boya;
    const t = this.p.length / 3;
    _m3.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(m);
      this.p.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_m3).normalize();
      this.n.push(_v.x, _v.y, _v.z);
      this.c.push(col.r, col.g, col.b);
      if (this.u)
        this.u.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
      // ek değer (boya maskesi, dalga payı): çağrıda verilen sabit ya da parçanın kendi "boya" özniteliği
      if (ek !== undefined || E)
        (this.ek || (this.ek = new Array(t + i).fill(0))).push(ek !== undefined ? ek : E.getX(i));
      else if (this.ek)
        this.ek.push(0);
    }
    // Aynalayan matris (determinantı eksi) üçgenlerin sargısını ters çevirir: yüzler dışa baksın diye geri çevrilir.
    const ters = m.determinant() < 0, n = g.index ? g.index.count : P.count, ix = j => g.index ? g.index.getX(j) : j;
    for (let j = 0; j < n; j += 3)
      if (ters)
        this.i.push(t + ix(j), t + ix(j + 2), t + ix(j + 1));
      else
        this.i.push(t + ix(j), t + ix(j + 1), t + ix(j + 2));
    return this;
  }
  // Köşe renkli bir kalıbı (araba gövdesi) kendi renkleriyle ekler; "boya" işaretli köşeler boya rengini alır.
  geoBoyali(g, m, boya) {
    const t = this.c.length / 3, C = g.attributes.color, E = g.attributes.boya, b = boya instanceof THREE.Color ? boya : new THREE.Color(boya);
    this.geo(g, m, '#ffffff');
    for (let i = 0; i < C.count; i++) {
      const j = (t + i) * 3, bo = E && E.getX(i) > 0.5;
      this.c[j] = bo ? b.r : C.getX(i);
      this.c[j + 1] = bo ? b.g : C.getY(i);
      this.c[j + 2] = bo ? b.b : C.getZ(i);
      if (this.ek)
        this.ek[t + i] = 0;
    }
    return this;
  }
  bos() { return this.p.length === 0; }
  bitir() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.u)
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    if (this.ek)
      g.setAttribute('boya', new THREE.Float32BufferAttribute(this.ek, 1));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}
// Hazır parçalar (birim ölçülü), birleştiricide ölçeklenip döndürülür.
const KALIP = {
  kutu: new THREE.BoxGeometry(1, 1, 1),
  silindir: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1),
  silindir8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1),
  koni: new THREE.ConeGeometry(0.5, 1, 12, 1),
  kubbe: new THREE.SphereGeometry(0.5, 16, 8, 0, TAU, 0, Math.PI / 2),
  top: new THREE.IcosahedronGeometry(0.5, 1),
  piramit: new THREE.ConeGeometry(0.7072, 1, 4, 1)
};
KALIP.piramit.rotateY(Math.PI / 4);
// Yerel çerçevede (M0) bir parça: konum (x, y, z), ölçü (sx, sy, sz), y ekseni etrafında dönüş ry, eğim rx / rz.
function parcaEkle(Y, M0, kalip, x, y, z, sx, sy, sz, renk, ry, rx, rz, ek) {
  _e.set(rx || 0, ry || 0, rz || 0);
  _q.setFromEuler(_e);
  _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  if (M0)
    _m4.premultiply(M0);
  Y.geo(KALIP[kalip], _m4, renk, ek);
}

/* ---- dokular (kodla çizilir) ---- */
function dokuYap(w, h, ciz, tekrar) {
  const t = document.createElement('canvas');
  t.width = w;
  t.height = h;
  ciz(t.getContext('2d'), w, h);
  const d = new THREE.CanvasTexture(t);
  d.colorSpace = THREE.SRGBColorSpace;
  if (tekrar)
    d.wrapS = d.wrapT = THREE.RepeatWrapping;
  d.anisotropy = 4;
  return d;
}
function gurultuBoya(a, w, h, renkler, adet, rmin, rmax, tohum) {
  const r = rastgeleUret(tohum);
  for (let i = 0; i < adet; i++) {
    a.fillStyle = renkler[Math.floor(r() * renkler.length)];
    a.globalAlpha = 0.25 + r() * 0.5;
    const x = r() * w, y = r() * h, rr = rmin + r() * (rmax - rmin);
    a.beginPath();
    a.arc(x, y, rr, 0, TAU);
    a.fill();
  }
  a.globalAlpha = 1;
}
let DOKU = null;
function dokulariHazirla() {
  DOKU = {
    // asfalt: koyu gri, ince taneli, yer yer yamalı
    asfalt: dokuYap(256, 256, (a, w, h) => {
      a.fillStyle = '#5d5c62';
      a.fillRect(0, 0, w, h);
      gurultuBoya(a, w, h, ['#4d4c52', '#6b6a70', '#57565c', '#747379'], 2600, 0.5, 1.6, 11);
      a.globalAlpha = 0.12;
      a.fillStyle = '#3e3d44';
      a.fillRect(30, 40, 90, 60);
      a.fillRect(150, 170, 70, 50);
      a.globalAlpha = 1;
    }, true),
    // kaldırım: açık gri karo, derzli
    kaldirim: dokuYap(128, 128, (a, w, h) => {
      a.fillStyle = '#c9c2b6';
      a.fillRect(0, 0, w, h);
      gurultuBoya(a, w, h, ['#bdb5a8', '#d5cec2', '#c4bcae'], 500, 0.6, 2, 5);
      a.strokeStyle = '#a39b8e';
      a.lineWidth = 3;
      for (let i = 0; i <= 2; i++) {
        a.beginPath();
        a.moveTo(i * 64, 0);
        a.lineTo(i * 64, h);
        a.moveTo(0, i * 64);
        a.lineTo(w, i * 64);
        a.stroke();
      }
    }, true),
    // zemin: kasabanın çevresindeki tarlalar: sıra sıra ekili, kimi biçilmiş, kimi yeşil (200 m'lik bir karo)
    zemin: dokuYap(512, 512, (a, w, h) => {
      a.fillStyle = '#a9a55e';
      a.fillRect(0, 0, w, h);
      const r = rastgeleUret(19), renk = ['#9fae5c', '#c8b26a', '#8ea052', '#b9a25c', '#7f9a4c', '#d2bf7a', '#a3b465'];
      for (let y = 0; y < h;) {
        const hy = 40 + Math.floor(r() * 4) * 16;
        for (let x = 0; x < w;) {
          const wx = 60 + Math.floor(r() * 5) * 24, c0 = renk[Math.floor(r() * renk.length)];
          a.fillStyle = c0;
          a.fillRect(x, y, wx, hy);
          // ekin sıraları
          a.strokeStyle = renkKat(c0, '#4a4a2a', 0.22);
          a.lineWidth = 1.5;
          const dik = r() < 0.5;
          for (let q = 3; q < (dik ? wx : hy); q += 6) {
            a.beginPath();
            if (dik) { a.moveTo(x + q, y); a.lineTo(x + q, y + hy); }
            else { a.moveTo(x, y + q); a.lineTo(x + wx, y + q); }
            a.stroke();
          }
          // tarla sınırı: ince toprak yol ya da çit
          a.strokeStyle = '#8a7a52';
          a.lineWidth = 2;
          a.strokeRect(x, y, wx, hy);
          x += wx;
        }
        y += hy;
      }
      gurultuBoya(a, w, h, ['#6f8a44', '#c9b277'], 300, 1, 3, 7);
    }, true),
    // jant: dört kollu çelik jant, ortası koyu göbek (dönüşü görünsün diye kollar belirgin); sol yarı lastik sırtı
    teker: dokuYap(256, 128, (a) => {
      a.fillStyle = '#1d1d21';
      a.fillRect(0, 0, 128, 128);
      a.strokeStyle = '#2c2c31';
      a.lineWidth = 6;
      for (let i = 0; i < 8; i++) {
        a.beginPath();
        a.moveTo(i * 16, 0);
        a.lineTo(i * 16 + 8, 128);
        a.stroke();
      }
      a.fillStyle = '#1d1d21';
      a.fillRect(128, 0, 128, 128);
      a.fillStyle = '#26262b';
      a.beginPath();
      a.arc(192, 64, 63, 0, TAU);
      a.fill();
      a.fillStyle = '#c9ccd2';
      a.beginPath();
      a.arc(192, 64, 44, 0, TAU);
      a.fill();
      a.fillStyle = '#5b5f68';
      for (let i = 0; i < 4; i++) {
        const x = 192 + Math.cos(i * HP + 0.4) * 26, y = 64 + Math.sin(i * HP + 0.4) * 26;
        a.beginPath();
        a.ellipse(x, y, 9, 13, i * HP + 0.4, 0, TAU);
        a.fill();
      }
      a.fillStyle = '#eef0f3';
      a.beginPath();
      a.arc(192, 64, 11, 0, TAU);
      a.fill();
      // jantın üst kenarında parlama (güneş yansıması): dönüşte de görünür
      a.strokeStyle = 'rgba(255,255,255,.85)';
      a.lineWidth = 4;
      a.beginPath();
      a.arc(192, 64, 40, -2.4, -1.2);
      a.stroke();
      a.fillStyle = '#e23d2f';
      a.fillRect(186, 22, 12, 9);
    }),
    // bulut
    bulut: dokuYap(256, 128, (a) => {
      const r = rastgeleUret(3);
      for (let i = 0; i < 26; i++) {
        const x = 40 + r() * 176, y = 50 + r() * 40, rr = 18 + r() * 26;
        const g = a.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, 'rgba(255,255,255,.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        a.fillStyle = g;
        a.beginPath();
        a.arc(x, y, rr, 0, TAU);
        a.fill();
      }
    }),
    // yumuşak leke: duman, gelin arabasının altındaki ışık
    leke: dokuYap(128, 128, (a) => {
      const g = a.createRadialGradient(64, 64, 0, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      a.fillStyle = g;
      a.fillRect(0, 0, 128, 128);
    }),
    // dükkân tabelaları: kasabanın dükkân adları (izleyici metni değil, sabit sözcükler)
    tabela: dokuYap(1024, 512, (a) => {
      const ad = ['BAKKAL', 'BERBER', 'FIRIN', 'ECZANE', 'KIRTASİYE', 'KASAP', 'NALBUR', 'ÇAY OCAĞI', 'MANAV', 'TERZİ', 'BÜFE', 'LOKANTA', 'KUAFÖR', 'SAATÇİ', 'ELEKTRİK', 'PASTANE'];
      const zem = ['#c0392b', '#1f6f8b', '#2d8f4e', '#f2b632', '#7a3e9d', '#d35400', '#264653', '#b03a48'];
      for (let i = 0; i < 16; i++) {
        const x = (i % 2) * 512, y = Math.floor(i / 2) * 64;
        a.fillStyle = zem[i % zem.length];
        a.fillRect(x, y, 512, 64);
        a.fillStyle = 'rgba(255,255,255,.18)';
        a.fillRect(x, y, 512, 6);
        a.fillStyle = i % zem.length === 3 ? '#2a1c10' : '#fff8ea';
        a.font = '700 40px Rubik, system-ui, sans-serif';
        a.textAlign = 'center';
        a.textBaseline = 'middle';
        a.fillText(ad[i], x + 256, y + 34);
      }
    })
  };
}

/* ---- malzemeler ---- */
let MALZ = null;
// Rüzgârda dalgalanan malzeme (bayraklar, tül): köşeler vuruşla yana savrulur. uB her karede B'yi taşır.
const DALGA = { value: 0 };
function dalgaliYap(m, genlik) {
  m.onBeforeCompile = s => {
    s.uniforms.uB = DALGA;
    s.vertexShader = 'uniform float uB;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvec4 dw = modelMatrix * vec4(position, 1.0);\ntransformed += vec3(0.0, 0.0, 1.0) * ' + genlik.toFixed(3) +
      ' * sin(uB * 6.2832 + dw.x * 0.9 + dw.z * 0.7) * clamp(-position.y * 3.0, 0.0, 1.0);');
  };
  return m;
}
function malzemeleriHazirla() {
  MALZ = {
    renkli: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
    renkliCift: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
    asfalt: new THREE.MeshStandardMaterial({ map: DOKU.asfalt, roughness: 0.95, metalness: 0 }),
    cizgi: new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    kaldirim: new THREE.MeshStandardMaterial({ map: DOKU.kaldirim, roughness: 0.9 }),
    zemin: new THREE.MeshStandardMaterial({ map: DOKU.zemin, roughness: 1 }),
    tabela: new THREE.MeshStandardMaterial({ map: DOKU.tabela, roughness: 0.6, emissive: '#ffffff', emissiveMap: DOKU.tabela, emissiveIntensity: 0.12 }),
    bayrak: dalgaliYap(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), 0.12)
  };
  // Pencere camları gökyüzünü yansıtır gibi parlasın: vertex rengi koyu mavi, düşük pürüz.
  MALZ.camli = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.3 });
}

/* ---- kurulum ---- */
function dunyaKur() {
  if (DUNYA.r || DUNYA.yok)
    return;
  // WebGL yoksa (eski bilgisayar, kapalı ekran kartı hızlandırması) three.js hiç kurulmaz: konsola hata düşmesin.
  // Oyun yine çalışır (kurallar, sıralama, yazılar); sahnede ne olduğunu söyleyen bir yazı çıkar (oyunZemin).
  let r = null;
  try {
    const dene = document.createElement('canvas');
    if (dene.getContext('webgl2') || dene.getContext('webgl'))
      r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  }
  catch (e) { r = null; }
  if (!r) {
    DUNYA.yok = true;
    return;
  }
  DUNYA.r = r;
  r.setPixelRatio(1);
  r.setSize(tuval.width, tuval.height, false);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.12;
  r.domElement.setAttribute('aria-hidden', 'true');
  r.domElement.id = 'tuval-3b';
  tuval.parentNode.insertBefore(r.domElement, tuval);
  try {
    const g = r.getContext(), e = g.getExtension('WEBGL_debug_renderer_info');
    DUNYA.gpu = e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'bilinmiyor';
  }
  catch (e) { DUNYA.gpu = 'bilinmiyor'; }
  dokulariHazirla();
  malzemeleriHazirla();
  const sahne = DUNYA.sahne = new THREE.Scene();
  sahne.fog = new THREE.Fog(GOK.sis, 110, 560);
  sahne.background = new THREE.Color(GOK.ufuk);
  DUNYA.kamera = new THREE.PerspectiveCamera(50, GW / GH, 0.3, 1400);
  // ışık: gökten ve yerden dolgu, ikindi güneşi (sıcak, alçak) yumuşak gölgeli
  sahne.add(new THREE.HemisphereLight('#d8eaff', '#bfa577', 1.45));
  const gunes = DUNYA.gunes = new THREE.DirectionalLight('#ffe4bd', 2.7);
  gunes.castShadow = true;
  gunes.shadow.mapSize.set(2048, 2048);
  gunes.shadow.bias = -0.0004;
  gunes.shadow.normalBias = 0.04;
  gunes.shadow.camera.near = 1;
  gunes.shadow.camera.far = 400;
  sahne.add(gunes, gunes.target);
  gokKur();
  // zemin: kameranın altında kayan büyük düzlem; dokusu dünyaya sabit kalsın diye 50 metrelik adımlarla kayar
  const zg = new THREE.PlaneGeometry(1600, 1600);
  zg.rotateX(-HP);
  DOKU.zemin.repeat.set(8, 8);
  DUNYA.zemin = new THREE.Mesh(zg, MALZ.zemin);
  DUNYA.zemin.position.y = -0.03;
  DUNYA.zemin.receiveShadow = true;
  sahne.add(DUNYA.zemin);
  arabalariKur();
  efektleriKur();
  kokenAyarla(true);
  for (let i = 0; i < 40; i++)
    if (!parcalariUret(99))
      break;
}
function gokKur() {
  const g = new THREE.SphereGeometry(1100, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { ust: { value: new THREE.Color(GOK.ust) }, orta: { value: new THREE.Color(GOK.orta) }, ufuk: { value: new THREE.Color(GOK.ufuk) }, gunes: { value: new THREE.Color(GOK.gunes) }, gy: { value: GUNES_YON } },
    vertexShader: 'varying vec3 vY; void main(){ vY = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 ust; uniform vec3 orta; uniform vec3 ufuk; uniform vec3 gunes; uniform vec3 gy; varying vec3 vY;\n' +
      'void main(){ float h = vY.y; vec3 c = mix(ufuk, orta, smoothstep(-0.02, 0.16, h)); c = mix(c, ust, smoothstep(0.16, 0.7, h));\n' +
      ' float d = max(dot(normalize(vY), gy), 0.0); c += gunes * (pow(d, 600.0) * 1.6 + pow(d, 18.0) * 0.28);\n' +
      ' gl_FragColor = vec4(c, 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}'
  });
  DUNYA.gok = new THREE.Mesh(g, m);
  DUNYA.gok.renderOrder = -10;
  DUNYA.gok.frustumCulled = false;
  DUNYA.sahne.add(DUNYA.gok);
  // birkaç bulut: kamerayla birlikte gezer (sonsuz uzakta gibi)
  DUNYA.bulutlar = new THREE.Group();
  const r = rastgeleUret(91);
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOKU.bulut, color: '#ffffff', fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    const a = i / 9 * TAU + r() * 0.5, uz = 700 + r() * 250;
    sp.position.set(Math.sin(a) * uz, 140 + r() * 160, Math.cos(a) * uz);
    sp.scale.set(260 + r() * 200, 90 + r() * 60, 1);
    DUNYA.bulutlar.add(sp);
  }
  DUNYA.sahne.add(DUNYA.bulutlar);
  // ufukta tepeler: iki halka, uzaktaki pusa karışmış mavimsi, yakındaki zeytinlik yeşili; kamerayla gezer
  const Y = new Yigin(), rt = rastgeleUret(5);
  for (const [R, hMin, hMax, alt, ust] of [[900, 40, 130, '#c4cfd2', '#aebdc6'], [700, 18, 70, '#b9c39a', '#93a77a']]) {
    const n = 160, faz = [rt() * 6, rt() * 6, rt() * 6], p = [], c = [], idx = [], ca = new THREE.Color(alt), cu = new THREE.Color(ust);
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, yuk = hMin + (hMax - hMin) * (0.5 + 0.25 * Math.sin(a * 3 + faz[0]) + 0.17 * Math.sin(a * 7 + faz[1]) + 0.08 * Math.sin(a * 17 + faz[2]));
      p.push(Math.sin(a) * R, -6, Math.cos(a) * R, Math.sin(a) * R, yuk, Math.cos(a) * R);
      c.push(ca.r, ca.g, ca.b, cu.r, cu.g, cu.b);
      if (i) {
        const b = (i - 1) * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -5;
    DUNYA.bulutlar.add(m);
  }
}

/* ---- köken: çizim koordinatlarını küçük tut ---- */
const KOKEN_ADIM = 400;
function kokenAyarla(ilk) {
  const s0 = Math.floor(D.yol / KOKEN_ADIM) * KOKEN_ADIM, kz = s0, kx = Math.round(yolX(s0));
  if (!ilk && kx === DUNYA.kx && kz === DUNYA.kz)
    return false;
  const dx = kx - DUNYA.kx, dz = kz - DUNYA.kz;
  DUNYA.kx = kx;
  DUNYA.kz = kz;
  for (const p of DUNYA.parcalar.values())
    p.grup.position.set(p.wx - kx, 0, p.wz - kz);
  if (!ilk && DUNYA.kamera) {
    DUNYA.kamera.position.x -= dx;
    DUNYA.kamera.position.z -= dz;
  }
  return true;
}

/* ---- yol parçaları ---- */
const GERI = 300, ILERI = 480;
// Konvoyun arkasından önüne kadar eksik parçaları üretir (karede en çok "sinir" tane), uzaktakileri siler.
function parcalariUret(sinir) {
  const a = Math.floor((D.yol - GERI) / PARCA), b = Math.floor((D.yol + ILERI) / PARCA);
  for (const [i, p] of DUNYA.parcalar)
    if (i < a - 1 || i > b + 1) {
      DUNYA.sahne.remove(p.grup);
      p.grup.traverse(o => { if (o.geometry)
        o.geometry.dispose(); });
      DUNYA.parcalar.delete(i);
    }
  let yapildi = 0;
  // Önce konvoyun bulunduğu yerin yakını, sonra uzağı.
  const sira = [];
  for (let i = a; i <= b; i++)
    if (!DUNYA.parcalar.has(i))
      sira.push(i);
  sira.sort((x, y) => Math.abs(x * PARCA - D.yol) - Math.abs(y * PARCA - D.yol));
  for (const i of sira) {
    if (yapildi >= sinir)
      return true;
    parcaKur(i);
    yapildi++;
  }
  return false;
}
// Yolun s noktasındaki çerçeve (parçanın kökenine göre): orta nokta, ileri ve sol yön.
function cerceve(s, ox, oz) {
  const e = yolEgim(s), n = 1 / Math.sqrt(1 + e * e);
  return { x: yolX(s) - ox, z: s - oz, ix: e * n, iz: n, lx: n, lz: -e * n };
}
// Parçanın kökenine göre yerel bir çerçeve matrisi: s noktasında, yandan l, yükseklik y; yerel +x yolun ilerisi,
// yerel +z yola doğru (sol yandaki bina için -sol), yön yolun yönü.
function cerceveMatris(s, l, y, ox, oz, yolaBak, out) {
  const f = cerceve(s, ox, oz), x = f.x + f.lx * l, z = f.z + f.lz * l;
  if (yolaBak) {
    // yerel z yola doğru (sol yandakinde -sol, sağ yandakinde +sol), yerel x = y × z
    const yan = l >= 0 ? 1 : -1, zx = -yan * f.lx, zz = -yan * f.lz;
    return out.set(zz, 0, zx, x, 0, 1, 0, y, -zx, 0, zz, z, 0, 0, 0, 1);
  }
  // yerel x ileri, yerel z sağ (sağ el kuralı: x × y = z): arabanın kendi çerçevesiyle aynı
  return out.set(f.ix, 0, -f.lx, x, 0, 1, 0, y, f.iz, 0, -f.lz, z, 0, 0, 0, 1);
}
function parcaKur(i) {
  const s0 = i * PARCA, s1 = s0 + PARCA, ox = yolX(s0), oz = s0;
  const grup = new THREE.Group(), r = rastgeleUret(ozet('parca' + i));
  grup.position.set(ox - DUNYA.kx, 0, oz - DUNYA.kz);
  const ekle = (geo, malz, golgeAt, golgeAl) => {
    const m = new THREE.Mesh(geo, malz);
    m.castShadow = !!golgeAt;
    m.receiveShadow = golgeAl !== false;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    grup.add(m);
    return m;
  };
  // asfalt, şerit çizgileri, kaldırım (dokulu şeritler)
  const asf = [], kal = [], adim = 2, vKok = Math.floor(s0 / 1000) * 1000;
  const serit = (l0, l1, y0, y1, uOlcek, dizi, vOlcek) => {
    const p = [], u = [], idx = [];
    for (let s = s0, j = 0; s <= s1 + 0.001; s += adim, j++) {
      const f = cerceve(s, ox, oz);
      p.push(f.x + f.lx * l0, y0, f.z + f.lz * l0, f.x + f.lx * l1, y1, f.z + f.lz * l1);
      u.push(l0 / uOlcek, (s - vKok) / (vOlcek || uOlcek), l1 / uOlcek, (s - vKok) / (vOlcek || uOlcek));
      if (j) {
        const a = (j - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // sargı yönü yola göre değişebilir: normaller hep yukarı baksın
    const N = g.attributes.normal;
    if (N.getY(0) < 0) {
      for (let k = 0; k < idx.length; k += 3) {
        const t = idx[k + 1];
        idx[k + 1] = idx[k + 2];
        idx[k + 2] = t;
      }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    dizi.push(g);
  };
  serit(-YOL_YARI, YOL_YARI, 0, 0, 4, asf);
  serit(YOL_YARI + 0.2, KALDIRIM, KALDIRIM_Y, KALDIRIM_Y, 1, kal);
  serit(-KALDIRIM, -YOL_YARI - 0.2, KALDIRIM_Y, KALDIRIM_Y, 1, kal);
  for (const g of asf)
    ekle(g, MALZ.asfalt);
  for (const g of kal)
    ekle(g, MALZ.kaldirim);
  // çizgiler: kesik orta çizgi, sürekli kenar çizgileri (asfaltın hemen üstünde, polygonOffset ile)
  const cz = [];
  for (const l of [-YOL_YARI + 0.35, YOL_YARI - 0.35])
    serit(l - 0.07, l + 0.07, 0.004, 0.004, 1, cz);
  const cizY = new Yigin();
  for (let s = Math.ceil(s0 / 6) * 6; s < s1; s += 6) {
    const f = cerceve(s + 1.5, ox, oz);
    _m4.makeRotationY(Math.atan2(f.ix, f.iz));
    _m4.setPosition(f.x, 0.004, f.z);
    _m4.scale(_s.set(0.13, 0.008, 3));
    cizY.geo(KALIP.kutu, _m4, '#ffffff');
  }
  for (const g of cz)
    ekle(g, MALZ.cizgi, false);
  ekle(cizY.bitir(), MALZ.cizgi, false);
  // bordür: kırmızı beyaz boyalı, metrede bir renk değişir
  const K = new Yigin(), M = new THREE.Matrix4();
  for (let s = s0; s < s1; s += 1)
    for (const yan of [-1, 1]) {
      cerceveMatris(s + 0.5, yan * (YOL_YARI + 0.1), 0, ox, oz, false, M);
      parcaEkle(K, M, 'kutu', 0, 0.09, 0, 1, 0.18, 0.2, (Math.floor(s) & 1) ? '#d8392b' : '#f3efe6');
    }
  // kaldırımın dış kenarı (alçak taş)
  for (let s = s0; s < s1; s += 3)
    for (const yan of [-1, 1]) {
      cerceveMatris(s + 1.5, yan * (KALDIRIM + 0.05), 0, ox, oz, false, M);
      parcaEkle(K, M, 'kutu', 0, 0.08, 0, 3.02, 0.16, 0.12, '#a59f93');
    }
  ekle(K.bitir(), MALZ.renkli, false);
  // yol kenarı ve kasaba
  const kenar = { '-1': new Yigin(), '1': new Yigin() }, bina = new Yigin(), cam = new Yigin(), tabela = new Yigin(true), bayrak = new Yigin(), park = new Yigin(), uzak = new Yigin();
  kenarDiz(i, s0, s1, ox, oz, kenar, bayrak, r);
  binaDiz(i, s0, s1, ox, oz, bina, cam, tabela, r, uzak);
  parkDiz(i, s0, s1, ox, oz, park);
  // ağaç ve direk sırası her yanda ayrı parça: alçak kamera o yanın ağaç sırasına girince o sıra gizlenir (reji)
  const kenarM = {};
  for (const yan of ['-1', '1'])
    if (!kenar[yan].bos())
      kenarM[yan] = ekle(kenar[yan].bitir(), MALZ.renkli, true);
  if (!bina.bos())
    ekle(bina.bitir(), MALZ.renkli, true);
  if (!cam.bos())
    ekle(cam.bitir(), MALZ.camli, false);
  if (!tabela.bos())
    ekle(tabela.bitir(), MALZ.tabela, false);
  if (!bayrak.bos())
    ekle(bayrak.bitir(), MALZ.bayrak, false, false);
  let parkMesh = null;
  if (!park.bos()) {
    parkMesh = ekle(park.bitir(), MALZ.renkli, true);
    parkMesh.userData.park = true;
  }
  DUNYA.sahne.add(grup);
  // arka sıralar, bahçeler, cami: kalite düşünce (zayıf ekran kartı) gizlenir
  const uzakMesh = uzak.bos() ? null : ekle(uzak.bitir(), MALZ.renkli, false);
  DUNYA.parcalar.set(i, { grup, wx: ox, wz: oz, s0, park: parkMesh, kenar: kenarM, uzak: uzakMesh });
}

/* ---- yol kenarı: ağaçlar, direkler, bayraklı ipler ---- */
// Yol kenarındaki yuvalar 8 metrede bir; ne olduğu yuvanın numarasından türer. reji kenar kamerasını boş yuvaya koyar.
const YUVA = 8;
function yuvaNe(n, yan) {
  if (n % 3 === 0)
    return 'direk';
  const r = rastgeleUret(ozet('yuva' + n + ':' + yan))();
  return r < 0.42 ? 'cinar' : r < 0.62 ? 'selvi' : 'bos';
}
function kenarDiz(pi, s0, s1, ox, oz, YY, BY, r) {
  const M = new THREE.Matrix4();
  for (let n = Math.ceil(s0 / YUVA); n * YUVA < s1; n++) {
    const s = n * YUVA;
    for (const yan of [-1, 1]) {
      const ne = yuvaNe(n, yan), rr = rastgeleUret(ozet('k' + n + yan)), Y = YY[String(yan)];
      cerceveMatris(s, yan * AGAC_L, KALDIRIM_Y, ox, oz, true, M);
      if (ne === 'direk') {
        // sokak lambası: gri boru direk, yola uzanan kol, lamba başı
        parcaEkle(Y, M, 'silindir8', 0, 3.3, 0, 0.16, 6.6, 0.16, '#7d8288');
        parcaEkle(Y, M, 'silindir8', 0, 0.35, 0, 0.3, 0.7, 0.3, '#5f646b');
        parcaEkle(Y, M, 'kutu', 0, 6.5, 0.8, 0.08, 0.08, 1.7, '#7d8288');
        parcaEkle(Y, M, 'kutu', 0, 6.42, 1.62, 0.32, 0.16, 0.6, '#5f646b');
        parcaEkle(Y, M, 'kutu', 0, 6.33, 1.62, 0.26, 0.04, 0.5, '#fff3c4');
      }
      else if (ne === 'cinar') {
        // çınar: kalın, açık kabuklu gövde, birkaç iri yeşil öbekten taç
        const boy = 0.85 + rr() * 0.4;
        parcaEkle(Y, M, 'silindir8', 0, 1.5 * boy, 0, 0.42, 3 * boy, 0.42, '#8e8270');
        parcaEkle(Y, M, 'silindir8', 0, 0.06, 0, 1.1, 0.12, 1.1, '#6e5a44');
        const yes = ['#5f8f3a', '#6f9e43', '#4f7d33', '#7aa64a'];
        for (let j = 0; j < 6; j++) {
          const a = j / 6 * TAU + rr(), u = j ? 1.3 + rr() * 0.6 : 0;
          const b = (j ? 2.2 : 2.9) * boy * (0.85 + rr() * 0.3);
          parcaEkle(Y, M, 'top', Math.cos(a) * u, (4.6 + rr() * 1.2) * boy, Math.sin(a) * u * 0.8, b * 1.15, b * 0.9, b, yes[j % yes.length]);
        }
      }
      else if (ne === 'selvi') {
        // servi: ince uzun koyu yeşil koni
        const boy = 0.9 + rr() * 0.35;
        parcaEkle(Y, M, 'silindir8', 0, 0.4, 0, 0.22, 0.8, 0.22, '#6d5a45');
        parcaEkle(Y, M, 'top', 0, 2.6 * boy, 0, 1.25, 3.4 * boy, 1.25, '#2f5a32');
        parcaEkle(Y, M, 'koni', 0, 5.4 * boy, 0, 1.0, 3.0 * boy, 1.0, '#2c5530');
      }
    }
    // Bayraklı ip: iki karşılıklı direğin arasına, her ikinci direkte. Sarkan ip ve üstünde üçgen bayraklar.
    if (n % 6 === 0)
      ipDiz(s, ox, oz, BY);
  }
}
const BAYRAK_RENK = ['#e23d2f', '#ffd166', '#2fb8a8', '#3d5bd0', '#f6ecd9', '#e86a9a', '#4fae6c'];
function ipDiz(s, ox, oz, Y) {
  const f = cerceve(s, ox, oz), n = 22, a = AGAC_L - 0.2, y0 = 6.1;
  const nok = t => {
    const l = lerp(-a, a, t);
    return [f.x + f.lx * l, y0 - 1.25 * 4 * t * (1 - t), f.z + f.lz * l];
  };
  const M = new THREE.Matrix4(), yon = Math.atan2(-f.lz, f.lx);
  for (let i = 0; i < n; i++) {
    const p = nok(i / n), q = nok((i + 1) / n);
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], uz = Math.hypot(dx, dy, dz);
    // ip parçası
    _q.setFromUnitVectors(_v.set(0, 1, 0), _s.set(dx / uz, dy / uz, dz / uz));
    M.compose(_v.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2), _q, _s.set(0.025, uz, 0.025));
    Y.geo(KALIP.kutu, M, '#4a3b30');
    // üçgen bayrak: ipten aşağı sarkar (iki üçgen yüzlü ince kutu yerine düz üçgen)
    {
      const g = BAYRAK_UCGEN;
      _e.set(0, yon, 0);
      _q.setFromEuler(_e);
      M.compose(_v.set(p[0] + dx / 2, p[1] + dy / 2 - 0.02, p[2] + dz / 2), _q, _s.set(uz * 0.85, 0.55, 1));
      Y.geo(g, M, BAYRAK_RENK[(i + Math.floor(s)) % BAYRAK_RENK.length]);
    }
  }
}
const BAYRAK_UCGEN = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('boya', new THREE.Float32BufferAttribute([0, 0, 1], 1));
  return g;
})();

/* ---- kasaba: apartmanlar, dükkânlar, uzakta cami ---- */
const SIVA = ['#f1e2c4', '#ecc9a2', '#f3d5c5', '#e2e7d6', '#f1e3a6', '#e9b99c', '#ddd3c2', '#f7efe2', '#cfe0e6', '#f0cfa0'];
const TENTE = [['#d83a2c', '#f7f1e6'], ['#2f8f55', '#f7f1e6'], ['#2765a8', '#f7f1e6'], ['#e48a1f', '#fff3d6'], ['#a33a6b', '#f7f1e6']];
// Ara sokak: her ikinci parçada, parçanın ortasında yoldan dik ayrılan bir sokak (iki yanda da). Binalar ona boşluk bırakır.
function araSokak(pi) { return pi % 2 === 0 ? pi * PARCA + 30 : null; }
const SOKAK_YARI = 4.6;
function binaDiz(pi, s0, s1, ox, oz, Y, CY, TY, r, UY) {
  const M = new THREE.Matrix4(), sokak = araSokak(pi);
  const bos = (a, b) => sokak === null || b < sokak - SOKAK_YARI || a > sokak + SOKAK_YARI;
  for (const yan of [-1, 1]) {
    // ön sıra: aralıklı apartmanlar; parça sınırında taşmasın diye her bina kendi orta noktasının parçasında kurulur
    let s = Math.floor(s0 / 4) * 4;
    const rs = rastgeleUret(ozet('bina' + pi + ':' + yan));
    while (s < s1) {
      const w = 9 + Math.floor(rs() * 4) * 2, bosluk = rs() < 0.12 ? 5 + rs() * 4 : 0.6 + rs() * 1.2;
      const orta = s + w / 2;
      if (orta >= s0 && orta < s1 && bos(s, s + w)) {
        cerceveMatris(orta, yan * (BINA_L + rs() * 0.8), 0, ox, oz, true, M);
        apartman(Y, CY, TY, M, w, rs);
      }
      else
        rs(), rs();
      s += w + bosluk;
    }
    // ara sokağın asfaltı ve iki yanındaki kaldırım (kasabanın içine doğru uzanır)
    if (sokak !== null) {
      cerceveMatris(sokak, yan * 55, 0, ox, oz, true, M);
      parcaEkle(Y, M, 'kutu', 0, 0.012, 0, SOKAK_YARI * 2 - 1.6, 0.024, 95.6, '#5f5e64');
      for (const q of [-1, 1])
        parcaEkle(Y, M, 'kutu', q * (SOKAK_YARI - 0.4), 0.08, 0, 1.6, 0.16, 95.6, '#c4bdb1');
    }
    // arka sıralar: kiremit çatılı evler, aralarında bahçe ağaçları; üç sıra, uzaklaştıkça daha sık ve basit
    for (const [l0, l1, ad] of [[22, 38, 'a'], [42, 62, 'b'], [66, 96, 'c']]) {
      const Y2 = ad === 'a' ? Y : UY;
      const ra = rastgeleUret(ozet('arka' + ad + pi + ':' + yan));
      for (let s2 = s0 + ra() * 6; s2 < s1; s2 += 9 + ra() * 6) {
        const l = yan * (l0 + ra() * (l1 - l0 - 8)), w = 7 + ra() * 5, d = 7 + ra() * 4, h = 4 + Math.floor(ra() * (ad === 'a' ? 4 : 3)) * 3;
        if (!bos(s2 - w / 2 - 1, s2 + w / 2 + 1))
          continue;
        cerceveMatris(s2, l, 0, ox, oz, true, M);
        if (ra() < 0.22) {
          // bahçe: iki üç ağaç öbeği
          for (let q = 0; q < 3; q++)
            parcaEkle(Y2, M, 'top', (ra() - 0.5) * w, 3 + ra() * 2, -d / 2 + (ra() - 0.5) * d, 4 + ra() * 2, 3.5 + ra() * 1.5, 4 + ra() * 2, ra() < 0.5 ? '#5f8f3a' : '#4f7d33');
          continue;
        }
        parcaEkle(Y2, M, 'kutu', 0, h / 2, -d / 2, w, h, d, SIVA[Math.floor(ra() * SIVA.length)]);
        parcaEkle(Y2, M, 'piramit', 0, h + 1.2, -d / 2, w * 1.08, 2.4, d * 1.1, ra() < 0.8 ? '#b5533a' : '#9a4a36');
        if (ad === 'a')
          for (let k = 0; k < Math.floor(h / 3); k++)
            for (let q = -1; q <= 1; q++)
              parcaEkle(CY, M, 'kutu', q * w / 3.2, 1.8 + k * 3, 0.03, 1.1, 1.3, 0.08, '#4a6378');
      }
    }
    // uzakta cami: kubbe ve tek şerefeli minare
    const rc = rastgeleUret(ozet('cami' + pi + ':' + yan));
    if (rc() < 0.22) {
      cerceveMatris(s0 + 20 + rc() * 20, yan * (100 + rc() * 40), 0, ox, oz, true, M);
      caminin(UY, M);
    }
  }
}
function apartman(Y, CY, TY, M, w, r) {
  const kat = 2 + Math.floor(r() * 4), kh = 3, d = 11, renk = SIVA[Math.floor(r() * SIVA.length)], dukkan = r() < 0.7;
  const h = kat * kh + (dukkan ? 0.6 : 0);
  // gövde ve zemin katı (dükkân sırası koyu kaplama)
  parcaEkle(Y, M, 'kutu', 0, h / 2, -d / 2, w, h, d, renk);
  parcaEkle(Y, M, 'kutu', 0, h + 0.3, -d / 2, w + 0.2, 0.6, d + 0.2, renkKat(renk, '#ffffff', 0.25));
  // kat silmeleri
  for (let k = 1; k < kat; k++)
    parcaEkle(Y, M, 'kutu', 0, k * kh + (dukkan ? 0.6 : 0), 0.05, w + 0.06, 0.18, 0.12, renkKat(renk, '#7a6a55', 0.25));
  const pencereSay = Math.max(2, Math.floor(w / 2.7));
  if (dukkan) {
    // dükkân vitrini, kapısı, tentesi, tabelası
    parcaEkle(Y, M, 'kutu', 0, 1.7, 0.02, w, 3.4, 0.06, '#5c4a3b');
    const vit = Math.max(1, Math.floor(w / 4.2));
    for (let v = 0; v < vit; v++) {
      const x = (v + 0.5 - vit / 2) * (w / vit);
      parcaEkle(CY, M, 'kutu', x, 1.45, 0.07, w / vit - 1.0, 2.1, 0.06, '#5f7f95');
      parcaEkle(Y, M, 'kutu', x, 0.25, 0.08, w / vit - 0.9, 0.5, 0.08, '#d9cdb8');
    }
    const t = TENTE[Math.floor(r() * TENTE.length)], seritSay = Math.round(w / 0.6);
    for (let k = 0; k < seritSay; k++) {
      const x = (k + 0.5 - seritSay / 2) * (w / seritSay);
      parcaEkle(Y, M, 'kutu', x, 2.95, 0.9, w / seritSay + 0.005, 0.05, 1.85, t[k & 1], 0, 0.42);
      parcaEkle(Y, M, 'kutu', x, 2.58, 1.78, w / seritSay + 0.005, 0.32, 0.03, t[k & 1]);
    }
    // tabela (atlas dokudan rastgele bir dükkân adı)
    const ti = Math.floor(r() * 16), tw = Math.min(w - 1, 5.2), u0 = (ti % 2) * 0.5, v0 = 1 - (Math.floor(ti / 2) + 1) / 8;
    tabelaEkle(TY, M, 0, 3.55, 0.08, tw, 0.62, u0, v0, u0 + 0.5, v0 + 1 / 8);
  }
  // pencereler ve balkonlar (Türk apartmanı: her katta yola bakan balkon, demir korkuluk)
  const balkonlu = r() < 0.75, korkuluk = r() < 0.5 ? '#3b3f46' : '#f3f0e8';
  for (let k = dukkan ? 1 : 0; k < kat; k++) {
    const y0 = k * kh + (dukkan ? 0.6 : 0);
    for (let p = 0; p < pencereSay; p++) {
      const x = (p + 0.5 - pencereSay / 2) * (w / pencereSay);
      parcaEkle(Y, M, 'kutu', x, y0 + 1.55, 0.04, 1.36, 1.66, 0.08, '#f5f2ea');
      parcaEkle(CY, M, 'kutu', x, y0 + 1.55, 0.09, 1.16, 1.46, 0.04, (p + k) % 3 ? '#4f6c84' : '#6a8aa3');
    }
    if (balkonlu && k > 0) {
      parcaEkle(Y, M, 'kutu', 0, y0 + 0.08, 0.6, w * 0.82, 0.16, 1.2, '#d8d2c6');
      parcaEkle(Y, M, 'kutu', 0, y0 + 0.62, 1.18, w * 0.82, 0.06, 0.05, korkuluk);
      const ck = Math.round(w * 0.82 / 0.22);
      for (let q = 0; q <= ck; q++)
        parcaEkle(Y, M, 'kutu', (q / ck - 0.5) * w * 0.82, y0 + 0.36, 1.18, 0.03, 0.52, 0.03, korkuluk);
      // balkonda çiçek saksıları
      if (r() < 0.6)
        for (let q = 0; q < 3; q++)
          parcaEkle(Y, M, 'top', (r() - 0.5) * w * 0.7, y0 + 0.82, 1.1, 0.35, 0.28, 0.3, r() < 0.5 ? '#d8432f' : '#6aa646');
    }
  }
  // çatıda güneş enerjisi paneli ve su deposu (yalnız bazılarında)
  if (r() < 0.55) {
    parcaEkle(Y, M, 'kutu', -w * 0.2, h + 1.2, -d * 0.55, 2.2, 0.08, 1.4, '#2b3b5e', 0, -0.7);
    parcaEkle(Y, M, 'silindir', -w * 0.2, h + 1.6, -d * 0.55 - 0.9, 0.55, 2, 0.55, '#e8e8e8', 0, 0, HP);
  }
}
function tabelaEkle(Y, M, x, y, z, w, h, u0, v0, u1, v1) {
  const g = TABELA_GEO;
  const uv = g.attributes.uv;
  uv.setXY(0, u0, v1);
  uv.setXY(1, u1, v1);
  uv.setXY(2, u0, v0);
  uv.setXY(3, u1, v0);
  _m4.compose(_v.set(x, y, z), _q.identity(), _s.set(w, h, 1)).premultiply(M);
  Y.geo(g, _m4, '#ffffff');
}
const TABELA_GEO = new THREE.PlaneGeometry(1, 1);
function caminin(Y, M) {
  parcaEkle(Y, M, 'kutu', 0, 4, -6, 14, 8, 14, '#efe8da');
  parcaEkle(Y, M, 'silindir', 0, 8.3, -6, 12, 0.6, 12, '#e4dccb');
  parcaEkle(Y, M, 'kubbe', 0, 8.6, -6, 11, 7, 11, '#8e9aa6');
  parcaEkle(Y, M, 'koni', 0, 13, -6, 0.3, 2, 0.3, '#d4b24a');
  // minare: ince gövde, şerefe, kurşun külah
  const mx = 9, mz = -1;
  parcaEkle(Y, M, 'silindir', mx, 1.5, mz, 2.2, 3, 2.2, '#e6dfd0');
  parcaEkle(Y, M, 'silindir', mx, 12, mz, 1.5, 21, 1.5, '#f3eee4');
  parcaEkle(Y, M, 'silindir', mx, 19.5, mz, 2.3, 0.5, 2.3, '#ded6c4');
  parcaEkle(Y, M, 'silindir', mx, 23.5, mz, 1.3, 7, 1.3, '#f3eee4');
  parcaEkle(Y, M, 'koni', mx, 29.8, mz, 1.5, 5.6, 1.5, '#7f8b97');
  parcaEkle(Y, M, 'koni', mx, 33.1, mz, 0.12, 1.2, 0.12, '#d4b24a');
}
// Sol kaldırımın dibinde park etmiş arabalar (seyrek). Yan kameranın önüne düşerse reji onları gizler.
function parkDiz(pi, s0, s1, ox, oz, Y) {
  const r = rastgeleUret(ozet('park' + pi)), M = new THREE.Matrix4();
  for (let s = s0 + 4 + r() * 6; s < s1 - 3; s += 9 + r() * 14) {
    if (r() < 0.45)
      continue;
    cerceveMatris(s, PARK_L, 0, ox, oz, false, M);
    parkArabasi(Y, M, r);
  }
}
