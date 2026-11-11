/* ARABALAR — her izleyicinin arabası (gerçek 3B), sürücüsü, plakası, farları; gelin arabasının süsü.
 * arabaUret(id): kasa tipi, renk, yolcu kimlikten türer (aynı izleyici her yayında aynı arabayla gelir)
 * arabaHazir(k): oyuncu kaydına araba alanlarını bir kez ekler
 * kasaGeo(tip): kasanın geometrisi. Yan silüet (tekerlek kemerleri oyulmuş) yuvarlak kenarlı EXTRUDE ile çekilir;
 *   cam kabini (direkler, tavan) silüetten ayrı kurulur, yukarı doğru içe daralır; camlar ayrı ve yarı saydamdır.
 *   Tampon, ızgara, yan bant, ayna, kapı kolu, iç taraf (torpido, koltuk, direksiyon) tek geometride birleşir;
 *   "boya" özniteliği boyalı yüzeyi işaretler: izleyicinin rengi örnek rengi (instanceColor) olarak yalnız oraya düşer.
 * Bütün arabalar tip başına TEK InstancedMesh ile çizilir (gövde, cam); tekerlek, far, baş, saç, göz, plaka da
 * birer InstancedMesh: kalabalık 36 arabada da birkaç düzine çizim çağrısıdır.
 * arabalariKur(): bir kez · arabalariYerlestir(): her kare (konum, yatma, zıplama, tekerlek dönüşü, ışıklar)
 * Arabanın yerel ekseni: +x ileri, +y yukarı, +z sağ. Sürücü solda (yerel -z) oturur.
 */
const TEKER_R = 0.31;
const ARABA_RENK = ['#f2efe6', '#b8322a', '#27406b', '#d8c49a', '#3f7a4a', '#4f86c6', '#7a2430', '#9aa0a6', '#d9772b', '#25262a', '#9cc7e0', '#6b4a32', '#e8c547', '#2e8c86'];
const KURDELE = ['#e23d2f', '#ffd166', '#f6ecd9', '#22b8a7', '#e86a9a'];
const KASA_TIP = ['sedan', 'hatch', 'kombi', 'van', 'pikap'];
// Kasa ölçüleri (metre). alt: gövdenin yan silüetinin üst çizgisi (arka alttan öne alta), ev: cam kabininin yan
// silüeti (arka taban, arka tavan, ön tavan, ön taban), cam: yan camların x aralıkları (aralarında direk kalır).
const KASA = {
  sedan: { W: 1.66, r: 0.31, sil: 0.27, teker: [1.3, -1.2],
    alt: [[-2.12, 0.3], [-2.17, 0.56], [-2.13, 0.86], [-1.36, 0.9], [0.98, 0.93], [2.02, 0.83], [2.16, 0.75], [2.18, 0.5], [2.14, 0.3]],
    ev: [[-1.36, 0.9], [-0.92, 1.34], [0.34, 1.37], [0.98, 0.93]], cam: [[-1.3, -0.4], [-0.32, 1.0]],
    tampon: { on: 2.24, arka: -2.22, y: 0.42, renk: '#d4d7dc' }, far: { x: 2.17, y: 0.66, z: 0.5, w: 0.32, h: 0.15 }, stop: { x: -2.16, y: 0.69, z: 0.53, w: 0.36, h: 0.15 },
    plaka: { on: [2.31, 0.42], arka: [-2.15, 0.56] }, surucu: { x: -0.18, y: 1.16 } },
  hatch: { W: 1.62, r: 0.3, sil: 0.27, teker: [1.18, -1.18],
    alt: [[-1.84, 0.3], [-1.88, 0.58], [-1.86, 0.9], [0.92, 0.93], [1.72, 0.84], [1.86, 0.76], [1.88, 0.5], [1.84, 0.3]],
    ev: [[-1.84, 0.9], [-1.7, 1.36], [0.28, 1.39], [0.92, 0.93]], cam: [[-1.75, -0.44], [-0.36, 0.95]],
    tampon: { on: 1.94, arka: -1.93, y: 0.42, renk: '#2a2b2f' }, far: { x: 1.87, y: 0.67, z: 0.48, w: 0.3, h: 0.15 }, stop: { x: -1.87, y: 0.72, z: 0.56, w: 0.22, h: 0.26 },
    plaka: { on: [2.01, 0.42], arka: [-1.95, 0.48] }, surucu: { x: -0.22, y: 1.17 } },
  kombi: { W: 1.68, r: 0.31, sil: 0.27, teker: [1.32, -1.28],
    alt: [[-2.18, 0.3], [-2.22, 0.58], [-2.2, 0.9], [1.0, 0.93], [2.04, 0.83], [2.18, 0.75], [2.2, 0.5], [2.16, 0.3]],
    ev: [[-2.19, 0.9], [-2.12, 1.38], [0.36, 1.39], [1.0, 0.93]], cam: [[-2.08, -1.3], [-1.18, -0.38], [-0.3, 1.02]],
    tampon: { on: 2.26, arka: -2.27, y: 0.42, renk: '#d4d7dc' }, far: { x: 2.19, y: 0.66, z: 0.5, w: 0.32, h: 0.15 }, stop: { x: -2.21, y: 0.74, z: 0.6, w: 0.2, h: 0.28 },
    plaka: { on: [2.33, 0.42], arka: [-2.34, 0.42] }, surucu: { x: -0.16, y: 1.17 } },
  van: { W: 1.82, r: 0.33, sil: 0.3, teker: [1.45, -1.45],
    alt: [[-2.25, 0.32], [-2.28, 0.62], [-2.27, 1.05], [1.55, 1.07], [2.12, 0.98], [2.26, 0.82], [2.28, 0.52], [2.24, 0.32]],
    ev: [[-2.26, 1.05], [-2.25, 1.98], [1.05, 2.0], [1.62, 1.08]], cam: [[-2.12, -1.0], [-0.88, 0.2], [0.32, 1.52]],
    tampon: { on: 2.34, arka: -2.33, y: 0.44, renk: '#8f949b' }, far: { x: 2.27, y: 0.76, z: 0.56, w: 0.3, h: 0.18 }, stop: { x: -2.28, y: 0.86, z: 0.74, w: 0.14, h: 0.36 },
    plaka: { on: [2.41, 0.44], arka: [-2.29, 0.62] }, surucu: { x: 0.55, y: 1.47 } },
  pikap: { W: 1.72, r: 0.32, sil: 0.29, teker: [1.42, -1.45],
    alt: [[-2.3, 0.32], [-2.33, 0.6], [-2.32, 0.97], [1.05, 0.98], [2.14, 0.88], [2.3, 0.76], [2.32, 0.5], [2.28, 0.32]],
    ev: [[-0.62, 0.97], [-0.56, 1.46], [0.42, 1.48], [1.05, 0.98]], cam: [[-0.5, 0.97]],
    tampon: { on: 2.38, arka: -2.38, y: 0.44, renk: '#d4d7dc' }, far: { x: 2.29, y: 0.68, z: 0.52, w: 0.32, h: 0.16 }, stop: { x: -2.33, y: 0.72, z: 0.7, w: 0.14, h: 0.3 },
    plaka: { on: [2.45, 0.44], arka: [-2.34, 0.45] }, surucu: { x: -0.12, y: 1.25 }, kasa: [-2.24, -0.7] }
};
function arabaUret(id) {
  const r = rastgeleUret(ozet('araba:' + id)), sec2 = a => a[Math.floor(r() * a.length)];
  const z = r(), tip = z < 0.42 ? 'sedan' : z < 0.62 ? 'hatch' : z < 0.75 ? 'kombi' : z < 0.88 ? 'van' : 'pikap';
  return { tip, renk: new THREE.Color(sec2(ARABA_RENK)), kurdele: sec2(KURDELE), faz: r(), yolcu: r() < 0.55, yolcuG: gorunumUret(id + '#yolcu') };
}
function arabaHazir(k) {
  if (k.ar)
    return;
  k.ar = arabaUret(k.id);
  k.gs = k.hedefS || 0;
  k.gl = k.hedefL || 0;
  k.os = 0;
  k.ox = 0;
  k.oy0 = 0;
  k.zipY = 0;
  k.yonO = 0;
  k.yalpa = 0;
  k.bas = 0;
  k.teker = 0;
  k.hizM = 0;
  k.korna = -99;
  k.far = -99;
}

/* ---- kasa geometrisi ---- */
// Dışbükey çokgeni d kadar içe büzer (her kenar içe kayar, komşu kenarların kesişimi yeni köşe olur).
function iceBuz(p, d) {
  let alan = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    alan += a[0] * b[1] - b[0] * a[1];
  }
  const yon = alan > 0 ? 1 : -1, cizgi = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const nx = -dy / l * yon, ny = dx / l * yon;
    cizgi.push([a[0] + nx * d, a[1] + ny * d, dx, dy]);
  }
  return cizgi.map((c1, i) => {
    const c0 = cizgi[(i + cizgi.length - 1) % cizgi.length], det = c0[2] * c1[3] - c0[3] * c1[2];
    const t = ((c1[0] - c0[0]) * c1[3] - (c1[1] - c0[1]) * c1[2]) / det;
    return [c0[0] + c0[2] * t, c0[1] + c0[3] * t];
  });
}
// Çokgeni a ≤ x ≤ b şeridiyle kırpar (Sutherland–Hodgman).
function xKirp(p, a, b) {
  const kes = (q, sinir, ic) => {
    const o = [];
    for (let i = 0; i < q.length; i++) {
      const c1 = q[i], c2 = q[(i + 1) % q.length], i1 = ic(c1[0]), i2 = ic(c2[0]);
      if (i1)
        o.push(c1);
      if (i1 !== i2) {
        const t = (sinir - c1[0]) / (c2[0] - c1[0]);
        o.push([sinir, c1[1] + (c2[1] - c1[1]) * t]);
      }
    }
    return o;
  };
  return kes(kes(p, a, x => x >= a), b, x => x <= b);
}
// Bir 2B şekli (x, y) kabinin yan yüzüne (z = yan × yarı genişlik(y)) giydirir; dışa baksın diye sargıyı düzeltir.
function yanaGiydir(g, yan, hw) {
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++)
    P.setZ(i, yan * hw(P.getY(i)));
  yuzYonla(g, new THREE.Vector3(0, 0, yan));
  return g;
}
function yuzYonla(g, beklenen) {
  g.computeVertexNormals();
  const N = g.attributes.normal;
  let t = 0;
  for (let i = 0; i < N.count; i++)
    t += N.getX(i) * beklenen.x + N.getY(i) * beklenen.y + N.getZ(i) * beklenen.z;
  if (t < 0) {
    const I = g.index.array;
    for (let i = 0; i < I.length; i += 3) {
      const x = I[i + 1];
      I[i + 1] = I[i + 2];
      I[i + 2] = x;
    }
    g.computeVertexNormals();
  }
  return g;
}
// Eğik bir yüz (ön cam, arka cam): a tabandaki, b tavandaki kenar noktası [x, y]; yüz z = ±hw boyunca uzanır.
// cerceveli: dış çerçeve (boyalı) ve içteki cam ayrı geometriler.
function egikYuz(a, b, hw, kalinlik, disari) {
  const hwa = hw(a[1]), hwb = hw(b[1]), p = kalinlik;
  const dis = new THREE.Shape([new THREE.Vector2(-hwa, 0), new THREE.Vector2(hwa, 0), new THREE.Vector2(hwb, 1), new THREE.Vector2(-hwb, 1)]);
  const ic = [new THREE.Vector2(-hwa + p, 0.07), new THREE.Vector2(hwa - p, 0.07), new THREE.Vector2(hwb - p, 0.9), new THREE.Vector2(-hwb + p, 0.9)];
  dis.holes.push(new THREE.Path(ic));
  const yerlestir = g => {
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const z = P.getX(i), t = P.getY(i);
      P.setXYZ(i, lerp(a[0], b[0], t), lerp(a[1], b[1], t), z);
    }
    return yuzYonla(g, disari);
  };
  const camG = yerlestir(new THREE.ShapeGeometry(new THREE.Shape(ic)));
  // cam bir parmak içeride dursun: çerçeveyle aynı düzlemde titreşmesin
  camG.translate(-disari.x * 0.012, -disari.y * 0.012, 0);
  return { cerceve: yerlestir(new THREE.ShapeGeometry(dis)), cam: camG };
}
const KASA_GEO = {};
function kasaGeo(tip) {
  if (KASA_GEO[tip])
    return KASA_GEO[tip];
  const K = KASA[tip], W = K.W, R = K.r + 0.075, sil = K.sil, A = K.alt;
  // 1) gövde: yan silüet, tekerlek kemerleri oyulmuş; yuvarlak kenarlı extrude
  const sh = new THREE.Shape();
  sh.moveTo(A[0][0], A[0][1]);
  for (let i = 1; i < A.length; i++)
    sh.lineTo(A[i][0], A[i][1]);
  const son = A[A.length - 1];
  sh.lineTo(son[0], sil);
  const t0 = Math.asin(clamp((sil - K.r) / R, -1, 1));
  for (const xc of K.teker) {
    sh.lineTo(xc + R * Math.cos(t0), sil);
    sh.absarc(xc, K.r, R, t0, Math.PI - t0, false);
  }
  sh.lineTo(A[0][0], sil);
  sh.closePath();
  const bt = 0.08, bs = 0.07;
  const govde = new THREE.ExtrudeGeometry(sh, { depth: W - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelOffset: -bs, bevelSegments: 4, curveSegments: 14 });
  govde.translate(0, 0, -(W - 2 * bt) / 2);
  // 2) cam kabini: yukarı doğru içe daralır
  const G = K.ev, yb = G[0][1], yr = Math.max(G[1][1], G[2][1]);
  const hw = y => (W / 2 - 0.05) * (1 - 0.14 * clamp((y - yb) / (yr - yb), 0, 1));
  const icG = iceBuz(G, 0.075), camlar = K.cam.map(([a, b]) => xKirp(icG, a, b)).filter(p => p.length >= 3);
  const Y = new Yigin(), C = new Yigin(), BIR = new THREE.Matrix4();
  Y.geo(govde, BIR, '#ffffff', 1);
  for (const yan of [-1, 1]) {
    const cer = new THREE.Shape(G.map(p => new THREE.Vector2(p[0], p[1])));
    for (const p of camlar)
      cer.holes.push(new THREE.Path(p.map(q => new THREE.Vector2(q[0], q[1]))));
    Y.geo(yanaGiydir(new THREE.ShapeGeometry(cer), yan, hw), BIR, '#ffffff', 1);
    for (const p of camlar) {
      const cg = yanaGiydir(new THREE.ShapeGeometry(new THREE.Shape(p.map(q => new THREE.Vector2(q[0], q[1])))), yan, y => hw(y) - 0.012);
      C.geo(cg, BIR, '#ffffff');
    }
  }
  const on = egikYuz(G[3], G[2], hw, 0.075, new THREE.Vector3(G[2][1] - G[3][1], G[3][0] - G[2][0], 0).normalize());
  const arka = egikYuz(G[0], G[1], hw, 0.075, new THREE.Vector3(G[0][1] - G[1][1], G[1][0] - G[0][0], 0).normalize());
  Y.geo(on.cerceve, BIR, '#ffffff', 1);
  Y.geo(arka.cerceve, BIR, '#ffffff', 1);
  C.geo(on.cam, BIR, '#ffffff');
  C.geo(arka.cam, BIR, '#ffffff');
  // tavan: ince, kenarları yuvarlak levha
  const tv = new THREE.Shape([new THREE.Vector2(G[1][0] - 0.015, G[1][1] + 0.012), new THREE.Vector2(G[2][0] + 0.015, G[2][1] + 0.012), new THREE.Vector2(G[2][0] + 0.02, G[2][1] - 0.05), new THREE.Vector2(G[1][0] - 0.02, G[1][1] - 0.05)]);
  const tw = hw(yr) * 2 + 0.02, tavan = new THREE.ExtrudeGeometry(tv, { depth: tw - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelOffset: -0.022, bevelSegments: 3 });
  tavan.translate(0, 0, -(tw - 0.06) / 2);
  Y.geo(tavan, BIR, '#ffffff', 1);
  // 3) ayrıntılar (boyasız): tampon, ızgara, yan bant, ayna, kapı kolu, kemer içi, iç taraf
  const tp = K.tampon, tpS = new THREE.Shape();
  tpS.moveTo(-0.07, -0.075);
  tpS.lineTo(0.07, -0.075);
  tpS.lineTo(0.07, 0.075);
  tpS.lineTo(-0.07, 0.075);
  tpS.closePath();
  const tampon = new THREE.ExtrudeGeometry(tpS, { depth: W - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelOffset: -0.03, bevelSegments: 3 });
  tampon.translate(0, 0, -(W - 0.06) / 2);
  for (const x of [tp.on - 0.07, tp.arka + 0.07])
    Y.geo(tampon, _m4.makeTranslation(x, tp.y, 0), tp.renk, 0);
  const F = K.far, S = K.stop, koyu = '#1d1e22', krom = '#cfd3d8';
  parcaEkle(Y, null, 'kutu', F.x - 0.01, F.y, 0, 0.04, F.h + 0.03, 2 * (F.z - F.w / 2) - 0.04, koyu, 0, 0, 0, 0);
  for (const dy of [-0.045, 0, 0.045])
    parcaEkle(Y, null, 'kutu', F.x + 0.012, F.y + dy, 0, 0.012, 0.014, 2 * (F.z - F.w / 2) - 0.08, krom, 0, 0, 0, 0);
  // farların ve stopların yuvası (koyu çerçeve; ışığın kendisi ayrı, yanıp sönen örneklerdir)
  for (const s of [-1, 1]) {
    parcaEkle(Y, null, 'kutu', F.x - 0.005, F.y, s * F.z, 0.05, F.h + 0.04, F.w + 0.04, koyu, 0, 0, 0, 0);
    parcaEkle(Y, null, 'kutu', S.x + 0.005, S.y, s * S.z, 0.05, S.h + 0.04, S.w + 0.04, koyu, 0, 0, 0, 0);
    // stopun yanında beyaz geri vites lambası: arka lamba iki renkli
    parcaEkle(Y, null, 'kutu', S.x - 0.006, S.y, s * (S.z - S.w / 2 - 0.05), 0.03, S.h * 0.8, 0.07, '#f2efe6', 0, 0, 0, 0);
  }
  const x0 = A[0][0] + 0.35, x1 = son[0] - 0.45;
  for (const s of [-1, 1]) {
    // yan bant (seksenlerin kauçuk şeridi) ve kapı kolları
    parcaEkle(Y, null, 'kutu', (x0 + x1) / 2, yb - 0.33, s * (W / 2 + 0.004), x1 - x0, 0.055, 0.03, '#26272b', 0, 0, 0, 0);
    // ince krem yan çizgi (boyanın üstünde ikinci ton) ve cam altında krom pervaz
    parcaEkle(Y, null, 'kutu', (x0 + x1) / 2, yb - 0.17, s * (W / 2 + 0.002), x1 - x0 - 0.2, 0.022, 0.02, '#efe6cf', 0, 0, 0, 0);
    parcaEkle(Y, null, 'kutu', (G[0][0] + G[3][0]) / 2, yb + 0.012, s * (hw(yb) + 0.004), G[3][0] - G[0][0] - 0.05, 0.022, 0.02, krom, 0, 0, 0, 0);
    for (const [a] of K.cam.slice(-2))
      parcaEkle(Y, null, 'kutu', a + 0.05, yb - 0.1, s * (W / 2 + 0.008), 0.16, 0.035, 0.03, krom, 0, 0, 0, 0);
    // ayna
    parcaEkle(Y, null, 'kutu', G[3][0] - 0.12, yb + 0.1, s * (W / 2 + 0.11), 0.07, 0.11, 0.17, koyu, 0, 0, 0, 0);
    parcaEkle(Y, null, 'kutu', G[3][0] - 0.12, yb + 0.06, s * (W / 2 + 0.03), 0.04, 0.03, 0.12, koyu, 0, 0, 0, 0);
  }
  // tekerlek kemerlerinin içi koyu: lastik ile kemer arasındaki aralık boş görünmesin
  for (const xc of K.teker) {
    _m4.makeRotationX(HP).setPosition(xc, K.r, 0);
    _m4.scale(_s.set(R * 2 - 0.03, W - 0.22, R * 2 - 0.03));
    Y.geo(KALIP.silindir, _m4, '#121214', 0);
  }
  // iç taraf: torpido, koltuk arkalıkları, direksiyon (camdan görünür)
  const su = K.surucu;
  parcaEkle(Y, null, 'kutu', G[3][0] - 0.26, yb + 0.07, 0, 0.42, 0.14, hw(yb) * 2 - 0.1, '#2a2624', 0, 0, 0, 0);
  for (const s of [-1, 1])
    parcaEkle(Y, null, 'kutu', su.x - 0.27, yb + 0.12, s * 0.38, 0.12, 0.42, 0.46, '#4a3631', 0, 0, 0, 0);
  if (tip !== 'pikap' && tip !== 'van')
    parcaEkle(Y, null, 'kutu', G[0][0] + 0.55, yb + 0.12, 0, 0.14, 0.4, hw(yb) * 2 - 0.15, '#4a3631', 0, 0, 0, 0);
  const dir = new THREE.TorusGeometry(0.15, 0.022, 6, 16);
  _q.setFromEuler(_e.set(0, HP, 0.5));
  Y.geo(dir, _m4.compose(_v.set(su.x + 0.34, su.y - 0.1, -0.38), _q, _s.set(1, 1, 1)), '#1b1b1e', 0);
  // pikabın kasası: üstü açık (koyu taban), kenar kılıfları boyalı, içinde birkaç sandık
  if (K.kasa) {
    const [k0, k1] = K.kasa;
    parcaEkle(Y, null, 'kutu', (k0 + k1) / 2, yb + 0.004, 0, k1 - k0, 0.01, W - 0.16, '#2b2622', 0, 0, 0, 0);
    parcaEkle(Y, null, 'kutu', (k0 + k1) / 2 - 0.3, yb + 0.16, -0.25, 0.5, 0.32, 0.5, '#b07a42', 0.2, 0, 0, 0);
    parcaEkle(Y, null, 'kutu', (k0 + k1) / 2 + 0.25, yb + 0.12, 0.3, 0.45, 0.24, 0.45, '#9c6a38', -0.3, 0, 0, 0);
  }
  const g = Y.bitir(), cam = C.bitir();
  return (KASA_GEO[tip] = { govde: g, cam, hw, yb, yr, R });
}

/* ---- örnekli çizim ---- */
// Aynı anda en çok kaç araba çizilir: sahnedeki kapasite (36) ve çıkmakta olanlar. Kalabalık bir yayında bir anda
// çok kişi girerse çıkan arabalar birikir (sahneden düşen her araba 1,7 sn daha yaşar); sınır aşılırsa önce en eski
// çıkanlar çizilmez (cizimSirasi). Gelin arabası ve kameranın konusu hiçbir zaman düşmez. Her havuz bu sayıya göre.
const KAP_ARABA = 64;
let GOVDE = null, CAM = null, TEKER = null, LAMBA = null, BASLAR = null, SACLAR = null, GOZLER = null, GOVDE_INSAN = null, PLAKA = null;
// Gövde malzemesi: "boya" özniteliği 1 olan köşeler izleyicinin rengini alır, parlak cila gibi düşük pürüzlü olur.
function boyaliMalzeme() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
  m.onBeforeCompile = s => {
    s.vertexShader = 'attribute float boya;\nvarying float vBoya;\n' + s.vertexShader.replace('vColor.xyz *= instanceColor.xyz;', 'vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, boya);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBoya = boya;');
    s.fragmentShader = 'varying float vBoya;\n' + s.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.62, 0.26, vBoya);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(0.05, 0.18, vBoya);');
  };
  return m;
}
function ornekli(geo, malz, kap, golge) {
  const m = new THREE.InstancedMesh(geo, malz, kap);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.castShadow = !!golge;
  m.receiveShadow = true;
  m.count = 0;
  DUNYA.sahne.add(m);
  return m;
}
function arabalariKur() {
  const boyali = boyaliMalzeme(), camM = new THREE.MeshStandardMaterial({ color: '#2b4560', emissive: '#7fa6c9', emissiveIntensity: 0.18, transparent: true, opacity: 0.58, roughness: 0.08, metalness: 0.5, depthWrite: false, side: THREE.DoubleSide });
  GOVDE = {};
  CAM = {};
  for (const tip of KASA_TIP) {
    const kg = kasaGeo(tip);
    GOVDE[tip] = ornekli(kg.govde, boyali, KAP_ARABA, true);
    GOVDE[tip].instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(KAP_ARABA * 3).fill(1), 3);
    CAM[tip] = ornekli(kg.cam, camM, KAP_ARABA, false);
    CAM[tip].renderOrder = 2;
  }
  // tekerlek: lastik sırtı + iki yanda jant (dokunun sağ yarısı); kollar döndükçe dönüş görünür
  const ty = new Yigin(true), lastik = new THREE.CylinderGeometry(1, 1, 1, 22, 1, true);
  const uv = lastik.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setX(i, uv.getX(i) * 0.5);
  ty.geo(lastik, new THREE.Matrix4().makeRotationX(HP).scale(_s.set(TEKER_R, 0.2, TEKER_R)), '#ffffff');
  const kapak = new THREE.CircleGeometry(TEKER_R * 0.99, 22), ku = kapak.attributes.uv;
  for (let i = 0; i < ku.count; i++)
    ku.setX(i, 0.5 + ku.getX(i) * 0.5);
  ty.geo(kapak, new THREE.Matrix4().makeTranslation(0, 0, 0.1), '#ffffff');
  ty.geo(kapak, new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, -0.1), '#ffffff');
  TEKER = ornekli(ty.bitir(), new THREE.MeshStandardMaterial({ map: DOKU.teker, roughness: 0.7, metalness: 0.1 }), KAP_ARABA * 4, true);
  // ışıklar: far, stop, sinyal; renkleri her karede (yanıp sönme) örnek rengiyle verilir
  LAMBA = ornekli(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), KAP_ARABA * 8, false);
  LAMBA.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(KAP_ARABA * 8 * 3), 3);
  // sürücüler ve yolcular: iri baş (burunlu), saç, iki göz, gövde
  const bas = new Yigin();
  bas.geo(new THREE.SphereGeometry(0.15, 18, 12), new THREE.Matrix4(), '#ffffff');
  bas.geo(new THREE.SphereGeometry(0.035, 8, 6), new THREE.Matrix4().makeTranslation(0.148, -0.005, 0), '#ffffff');
  for (const s of [-1, 1])
    bas.geo(new THREE.SphereGeometry(0.03, 8, 6), new THREE.Matrix4().makeTranslation(0, -0.01, s * 0.148), '#ffffff');
  const deri = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  BASLAR = ornekli(bas.bitir(), deri, KAP_ARABA * 2 + 2, false);
  BASLAR.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((KAP_ARABA * 2 + 2) * 3), 3);
  const sac = new THREE.SphereGeometry(0.162, 18, 10, 0, TAU, 0, Math.PI * 0.56);
  sac.rotateZ(0.45);
  SACLAR = ornekli(sac, new THREE.MeshStandardMaterial({ roughness: 0.85 }), KAP_ARABA * 2 + 2, false);
  SACLAR.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((KAP_ARABA * 2 + 2) * 3), 3);
  const goz = new Yigin();
  for (const s of [-1, 1]) {
    goz.geo(new THREE.SphereGeometry(0.03, 10, 8), new THREE.Matrix4().makeTranslation(0.128, 0.035, s * 0.058), '#ffffff');
    goz.geo(new THREE.SphereGeometry(0.017, 8, 6), new THREE.Matrix4().makeTranslation(0.152, 0.035, s * 0.06), '#15131a');
  }
  GOZLER = ornekli(goz.bitir(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), KAP_ARABA * 2 + 2, false);
  const gv = new THREE.CapsuleGeometry(0.17, 0.2, 4, 10);
  gv.scale(0.8, 1, 1.15);
  GOVDE_INSAN = ornekli(gv, new THREE.MeshStandardMaterial({ roughness: 0.8 }), KAP_ARABA * 2 + 2, false);
  GOVDE_INSAN.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((KAP_ARABA * 2 + 2) * 3), 3);
  plakaKur();
  gelinSusuKur();
}

/* ---- plakalar: izleyicinin adı plakada (tuvale fillText; HTML yok) ---- */
// Plaka atlası: 4 × 32 hücre. Her çizilen arabanın kaydına bir hücre bağlanır (kimliğe değil: aynı kişi çıkarken
// yeniden yazarsa çekirdek yeni bir kayıt açar). Son hücre boş plakadır: hücre kalmazsa kimsenin adı yerine o çizilir.
const PLAKA_SUTUN = 4, PLAKA_SATIR = 32, PLAKA_BOS = PLAKA_SUTUN * PLAKA_SATIR - 1;
let plakaTuval = null, plakaDoku = null, plakaUv = null;
const plakaBos = [];
function plakaKur() {
  plakaTuval = document.createElement('canvas');
  plakaTuval.width = 1024;
  plakaTuval.height = 2048;
  plakaSifirla();
  plakaDoku = new THREE.CanvasTexture(plakaTuval);
  plakaDoku.colorSpace = THREE.SRGBColorSpace;
  plakaDoku.anisotropy = 4;
  const g = new THREE.PlaneGeometry(0.52, 0.115);
  plakaUv = new THREE.InstancedBufferAttribute(new Float32Array(KAP_ARABA * 2 * 2), 2);
  plakaUv.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('plakaUv', plakaUv);
  const m = new THREE.MeshStandardMaterial({ map: plakaDoku, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = s => {
    s.vertexShader = 'attribute vec2 plakaUv;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = uv * vec2(' + (1 / PLAKA_SUTUN).toFixed(4) + ', ' + (1 / PLAKA_SATIR).toFixed(5) + ') + plakaUv;');
  };
  PLAKA = ornekli(g, m, KAP_ARABA * 2, false);
}
// Boş plaka hücresini çizer, bütün hücreleri boşa çıkarır (açılışta ve "boşalt"ta).
function plakaSifirla() {
  plakaBos.length = 0;
  for (let i = PLAKA_BOS - 1; i >= 0; i--)
    plakaBos.push(i);
  for (const k of plakaSahipleri)
    k.plakaYuva = undefined;
  plakaSahipleri = [];
  const a = plakaTuval.getContext('2d');
  a.clearRect(0, 0, plakaTuval.width, plakaTuval.height);
  plakaZemin(a, (PLAKA_BOS % PLAKA_SUTUN) * 256, Math.floor(PLAKA_BOS / PLAKA_SUTUN) * 64);
  if (plakaDoku)
    plakaDoku.needsUpdate = true;
}
function plakaZemin(a, x, y) {
  a.fillStyle = '#16181f';
  a.fillRect(x, y, 256, 64);
  a.fillStyle = '#f7f6f1';
  a.fillRect(x + 3, y + 3, 250, 58);
  a.fillStyle = '#1f4fb0';
  a.fillRect(x + 3, y + 3, 30, 58);
  a.fillStyle = '#ffffff';
  a.font = '700 15px Rubik, system-ui, sans-serif';
  a.textAlign = 'center';
  a.textBaseline = 'middle';
  a.fillText('TR', x + 18, y + 47);
}
function plakaYaz(k) {
  if (k.plakaYuva !== undefined && k.plakaAd === k.ad)
    return;
  if (k.plakaYuva === undefined) {
    if (!plakaBos.length)
      return;
    k.plakaYuva = plakaBos.pop();
  }
  k.plakaAd = k.ad;
  const a = plakaTuval.getContext('2d'), c0 = k.plakaYuva % PLAKA_SUTUN, r0 = Math.floor(k.plakaYuva / PLAKA_SUTUN), x = c0 * 256, y = r0 * 64;
  a.clearRect(x, y, 256, 64);
  plakaZemin(a, x, y);
  a.fillStyle = '#16181f';
  let punto = 40;
  // ad yazıldığı gibi (büyük harfe çevrilmez: "mike" İ'li olmasın); hücrenin dışına taşan işaret komşuya geçmesin
  const metin = kisalt(String(k.ad), 16);
  a.font = '700 ' + punto + 'px Rubik, system-ui, sans-serif';
  while (punto > 18 && a.measureText(metin).width > 210) {
    punto -= 2;
    a.font = '700 ' + punto + 'px Rubik, system-ui, sans-serif';
  }
  a.save();
  a.beginPath();
  a.rect(x + 36, y + 4, 216, 56);
  a.clip();
  a.fillText(metin, x + 144, y + 34, 210);
  a.restore();
  plakaDoku.needsUpdate = true;
}
function plakaBirak(k) {
  if (k.plakaYuva !== undefined) {
    plakaBos.push(k.plakaYuva);
    k.plakaYuva = undefined;
  }
}

/* ---- gelin arabasının süsü ---- */
// Kaputta kocaman kırmızı fiyonk, köşelerden tavana beyaz pembe kurdeleler, ön camın dibinde ve tavanda çiçekler,
// tavandan arkaya uçuşan tül, aynalara bağlı balonlar, yolcu koltuğunda duvaklı gelin, yerde vuruşla atan altın hale.
// Süs kasa tipine göre bir kez kurulur; gelin arabası kim olursa onun örnek matrisini izler.
const GELIN = { gruplar: {}, aktif: null, hale: null, balonlar: [] };
function gelinSusuKur() {
  const h = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: DOKU.leke, color: '#ffc531', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  h.rotation.x = -HP;
  h.renderOrder = 1;
  const halka = new THREE.Mesh(new THREE.RingGeometry(0.47, 0.5, 48), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  halka.rotation.x = -HP;
  GELIN.hale = new THREE.Group();
  GELIN.hale.add(h, halka);
  GELIN.hale.visible = false;
  DUNYA.sahne.add(GELIN.hale);
}
function gelinSusu(tip) {
  if (GELIN.gruplar[tip])
    return GELIN.gruplar[tip];
  const K = KASA[tip], kg = kasaGeo(tip), G = K.ev, A = K.alt, son = A[A.length - 1];
  const grup = new THREE.Group();
  grup.matrixAutoUpdate = false;
  const ic = new THREE.Group();
  grup.add(ic);
  const malz = r => new THREE.MeshStandardMaterial({ color: r, roughness: 0.55 });
  const kirmizi = malz('#d21f3c'), koyuKirmizi = malz('#a3122b'), beyaz = malz('#fbf6ef'), pembe = malz('#f07aa6'), yesil = malz('#3f8a3e');
  // kaputun üstü: alt silüette ön camın tabanından burna giden kısım
  const kaputX = son[0] - 0.42 - (son[0] - G[3][0]) * 0.12, kaputY = G[3][1] + (A[A.length - 4][1] - G[3][1]) * 0.5;
  // fiyonk: iki ilmek, düğüm, iki kuyruk
  const fy = new THREE.Group();
  for (const s of [-1, 1]) {
    const ilmek = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 10, 22), kirmizi);
    ilmek.scale.set(1.5, 0.95, 0.75);
    ilmek.position.set(0, 0.06, s * 0.24);
    ilmek.rotation.set(0, HP, s * 0.35);
    fy.add(ilmek);
    const kuyruk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.11), koyuKirmizi);
    kuyruk.position.set(0.16, -0.02, s * 0.1);
    kuyruk.rotation.set(0, s * 0.5, -0.15);
    fy.add(kuyruk);
  }
  const dugum = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), koyuKirmizi);
  dugum.position.y = 0.06;
  fy.add(dugum);
  fy.position.set(kaputX, kaputY + 0.03, 0);
  fy.rotation.z = -0.25;
  fy.scale.setScalar(1.05);
  fy.traverse(o => { o.castShadow = true; });
  ic.add(fy);
  // kurdeleler: kaputun iki köşesinden tavanın önüne, tavanın arkasından bagajın iki köşesine
  const kurdele = (a, b, c, m, r) => {
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, b, c), 20, r || 0.028, 6), m);
    t.castShadow = true;
    ic.add(t);
  };
  const tavanY = Math.max(G[1][1], G[2][1]) + 0.03, w2 = K.W / 2 - 0.08;
  for (const s of [-1, 1]) {
    for (const [m, dz] of [[beyaz, 0], [pembe, 0.05]]) {
      kurdele(new THREE.Vector3(son[0] - 0.25, A[A.length - 3][1] + 0.02, s * (w2 - dz)), new THREE.Vector3((G[3][0] + G[2][0]) / 2 + 0.5, tavanY + 0.25, s * (0.5 - dz)), new THREE.Vector3(G[2][0] - 0.05, tavanY, s * 0.06), m);
      kurdele(new THREE.Vector3(G[1][0] + 0.05, tavanY, s * 0.06), new THREE.Vector3(G[1][0] - 0.5, tavanY + 0.2, s * (0.45 - dz)), new THREE.Vector3(A[0][0] + 0.25, A[2][1] + 0.02, s * (w2 - dz)), m);
    }
  }
  // çiçekler: ön camın dibinde bir sıra, tavanın ortasında büyük demet
  const cicek = (x, y, z, r, i) => {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), [kirmizi, beyaz, pembe][i % 3]);
    c.position.set(x, y, z);
    ic.add(c);
  };
  for (let i = 0; i < 9; i++)
    cicek(G[3][0] + 0.06, G[3][1] + 0.05, (i - 4) * 0.15, 0.065, i);
  const rd = rastgeleUret(7);
  const demetX = (G[1][0] + G[2][0]) / 2;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU * 2, u = 0.05 + (i / 16) * 0.22;
    cicek(demetX + Math.cos(a) * u * 1.3, tavanY + 0.1 + rd() * 0.12 + (0.22 - u) * 0.5, Math.sin(a) * u, 0.07 + rd() * 0.03, i);
  }
  for (let i = 0; i < 6; i++) {
    const y = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), yesil);
    const a = i / 6 * TAU;
    y.position.set(demetX + Math.cos(a) * 0.3, tavanY + 0.08, Math.sin(a) * 0.24);
    y.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    ic.add(y);
  }
  // tül: tavanın arkasından arkaya doğru uçuşan iki şerit (dalgalanır)
  const tulM = dalgaliYap(new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.72, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false }), 0.09);
  for (const s of [-1, 1]) {
    const tg = new THREE.PlaneGeometry(1.5, 0.32, 12, 1);
    tg.rotateX(-HP);
    const P = tg.attributes.position, boya = [];
    for (let i = 0; i < P.count; i++) {
      const u = (P.getX(i) + 0.75) / 1.5;
      P.setY(i, -u * 0.35 + Math.sin(u * 5) * 0.05);
      boya.push(1 - u);
    }
    tg.setAttribute('boya', new THREE.Float32BufferAttribute(boya, 1));
    tg.computeVertexNormals();
    const t = new THREE.Mesh(tg, tulM);
    t.position.set(G[1][0] - 0.75, tavanY + 0.05, s * 0.3);
    t.rotation.y = s * 0.12;
    t.renderOrder = 3;
    ic.add(t);
  }
  // balonlar: iki aynaya bağlı, ipleriyle
  const balonlar = [];
  for (const [s, renk] of [[-1, '#e8253a'], [1, '#ffffff'], [1, '#f07aa6']]) {
    const b = new THREE.Group(), top3 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: renk, roughness: 0.25, metalness: 0.05 }));
    top3.scale.set(1, 1.18, 1);
    top3.position.y = 0.95;
    top3.castShadow = true;
    const ip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.8, 4), malz('#eeeeee'));
    ip.position.y = 0.42;
    b.add(top3, ip);
    b.position.set(G[3][0] - 0.12 - (balonlar.length === 2 ? 0.25 : 0), G[0][1] + 0.12, s * (K.W / 2 + 0.12));
    ic.add(b);
    balonlar.push(b);
  }
  // duvaklı gelin: yolcu koltuğunda (yerel +z), beyaz duvak başın üstünden arkaya iner
  const su = K.surucu, gelinBas = new THREE.Group();
  const yuz = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12), malz('#f2c9a0'));
  const duvak = new THREE.Mesh(new THREE.SphereGeometry(0.165, 18, 10, 0, TAU, 0, Math.PI * 0.55), beyaz);
  duvak.rotation.z = 0.5;
  const etek = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  etek.position.set(-0.08, -0.12, 0);
  const tac = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 16), malz('#ffd23f'));
  tac.rotation.x = HP;
  tac.position.y = 0.13;
  gelinBas.add(yuz, duvak, etek, tac);
  for (const s of [-1, 1]) {
    const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), malz('#15131a'));
    g2.position.set(0.13, 0.03, s * 0.055);
    gelinBas.add(g2);
  }
  gelinBas.position.set(su.x, su.y, 0.38);
  ic.add(gelinBas);
  grup.userData = { ic, fy, balonlar, gelinBas };
  grup.visible = false;
  DUNYA.sahne.add(grup);
  return (GELIN.gruplar[tip] = grup);
}

/* ---- her karede: örnek matrisleri ve ışıklar ---- */
const _arM = new THREE.Matrix4(), _arM2 = new THREE.Matrix4(), _arQ = new THREE.Quaternion(), _arE = new THREE.Euler(0, 0, 0, 'YZX'), _arP = new THREE.Vector3(), _arS = new THREE.Vector3(1, 1, 1), _arC = new THREE.Color();
const LAMBA_RENK = { far: [0.95, 0.9, 0.74], farYan: [3, 2.9, 2.4], stop: [0.34, 0.03, 0.03], stopYan: [1.6, 0.08, 0.05], sinyal: [0.42, 0.2, 0.03], sinyalYan: [1.8, 0.75, 0.05] };
// Arabanın yerel matrisi: yolda (gs + os, gl + ox), yola göre sapma yonO, viraja yatma, fren eğilmesi, zıplama.
// yaySiz: tekerleklerin çerçevesi (yolda, zıplamada kalkar, yaylanmaz, yatmaz); değilse gövdenin çerçevesi (üstüne
// süspansiyonun yaylanması, yatması ve eğilmesi eklenir; sınırları 20-hareket.js'te).
function arabaMatris(k, yaySiz, out) {
  const s = D.yol + k.gs + k.os;
  yolNokta(s, k.gl + k.ox, k.zipY + (yaySiz ? 0 : k.yayY || 0), _arP);
  _arE.set(yaySiz ? 0 : k.yalpaC || 0, yolYon(s) + k.yonO, yaySiz ? 0 : k.basC || 0);
  _arQ.setFromEuler(_arE);
  return out.compose(_arP, _arQ, _arS);
}
const SAYAC = {};
let gorunenArabalar = [];
function arabalariYerlestir() {
  for (const tip of KASA_TIP)
    SAYAC[tip] = 0;
  let nt = 0, nl = 0, nb = 0, np = 0;
  const lc = LAMBA.instanceColor.array, bc = BASLAR.instanceColor.array, sc = SACLAR.instanceColor.array, gc = GOVDE_INSAN.instanceColor.array;
  const yanar = (B % 1) < 0.5, kamP = DUNYA.kamera.position;
  gorunenArabalar = cizimSirasi();
  for (const k of gorunenArabalar) {
    const tip = k.ar.tip, K = KASA[tip], i = SAYAC[tip]++;
    arabaMatris(k, false, _arM);
    k._cizKare = kareSay;
    k._M = k._M || new THREE.Matrix4();
    k._M.copy(_arM);
    GOVDE[tip].setMatrixAt(i, _arM);
    CAM[tip].setMatrixAt(i, _arM);
    const r = k.ar.renk;
    GOVDE[tip].instanceColor.setXYZ(i, r.r, r.g, r.b);
    // tekerlekler: yay yok (gövde onların üstünde yaylanır), zıplamada onlar da kalkar
    arabaMatris(k, true, _arM2);
    for (const xc of K.teker)
      for (const s of [-1, 1]) {
        _arQ.setFromAxisAngle(_v.set(0, 0, 1), -k.teker);
        _m4.compose(_v.set(xc, K.r, s * (K.W / 2 - 0.13)), _arQ, _arS).premultiply(_arM2);
        TEKER.setMatrixAt(nt++, _m4);
        tekerOlc(k, K, xc, _m4);
      }
    // ışıklar: korna çalınca selektör (farlar yanıp söner), dörtlüler vuruşla yanar, fren yaparken ve her ölçünün
    // ilk vuruşunda stoplar parlar
    const sel = B >= k.far && B < k.far + 3 && ((B - k.far) * 2 % 1) < 0.55, fren = k.bas > 0.012 || (B % 4) < 0.35;
    const F = K.far, S = K.stop;
    const lamba = (x, y, z, sx, sy, sz, renk) => {
      _m4.compose(_v.set(x, y, z), _arQ.identity(), _s.set(sx, sy, sz)).premultiply(_arM);
      LAMBA.setMatrixAt(nl, _m4);
      lc[nl * 3] = renk[0];
      lc[nl * 3 + 1] = renk[1];
      lc[nl * 3 + 2] = renk[2];
      nl++;
    };
    for (const s of [-1, 1]) {
      lamba(F.x + 0.01, F.y, s * F.z, 0.03, F.h, F.w, sel ? LAMBA_RENK.farYan : LAMBA_RENK.far);
      lamba(S.x - 0.012, S.y, s * S.z, 0.03, S.h, S.w, fren ? LAMBA_RENK.stopYan : LAMBA_RENK.stop);
      lamba(F.x - 0.04, F.y - F.h / 2 - 0.06, s * (F.z + F.w / 2 - 0.04), 0.06, 0.05, 0.1, yanar ? LAMBA_RENK.sinyalYan : LAMBA_RENK.sinyal);
      lamba(S.x - 0.012, S.y - S.h / 2 - 0.05, s * (S.z - 0.02), 0.03, 0.05, S.w * 0.6, yanar ? LAMBA_RENK.sinyalYan : LAMBA_RENK.sinyal);
    }
    // plakalar (iki yüz aynı adı taşır)
    plakaYaz(k);
    const yuva = k.plakaYuva === undefined ? PLAKA_BOS : k.plakaYuva, pu = (yuva % PLAKA_SUTUN) / PLAKA_SUTUN, pv = 1 - (Math.floor(yuva / PLAKA_SUTUN) + 1) / PLAKA_SATIR;
    _arQ.setFromAxisAngle(_v.set(0, 1, 0), HP);
    _m4.compose(_v.set(K.plaka.on[0], K.plaka.on[1], 0), _arQ, _arS).premultiply(_arM);
    PLAKA.setMatrixAt(np, _m4);
    plakaUv.setXY(np++, pu, pv);
    _arQ.setFromAxisAngle(_v.set(0, 1, 0), -HP);
    _m4.compose(_v.set(K.plaka.arka[0], K.plaka.arka[1], 0), _arQ, _arS).premultiply(_arM);
    PLAKA.setMatrixAt(np, _m4);
    plakaUv.setXY(np++, pu, pv);
    // sürücü (ve varsa yolcu): baş kameraya yakınsa ona doğru döner; kornada ve sevinçte vuruşla sallanır
    const su = K.surucu, sevinc = kornaCaliyor(k) || (B >= k.zip0 && B < k.zip1) || k.yildiz;
    const kisiler = [[k.g, -0.38]];
    if (k !== D.lider && k.ar.yolcu)
      kisiler.push([k.ar.yolcuG, 0.38]);
    _arP.setFromMatrixPosition(_arM);
    const uzak = _arP.distanceTo(kamP);
    for (const [g, z] of kisiler) {
      if (nb >= BASLAR.instanceMatrix.count)
        break;
      const sal = sevinc ? 0.03 * Math.sin(TAU * B * 2 + z * 5) : 0.012 * Math.sin(TAU * B + k.ar.faz * 6 + z);
      _v.set(su.x, su.y + sal, z).applyMatrix4(_arM);
      let bak = 0;
      if (uzak < 14) {
        // kameraya doğru dönen baş (en çok 70 derece): izleyici yakın çekimde sürücünün yüzünü görür
        const yerel = _s.copy(kamP).applyMatrix4(_m4.copy(_arM).invert());
        bak = clamp(Math.atan2(-(yerel.z - z), yerel.x - su.x), -1.2, 1.2) * (1 - clamp((uzak - 9) / 5, 0, 1));
      }
      _arQ.setFromAxisAngle(_s.set(0, 1, 0), bak + (sevinc ? 0.15 * Math.sin(TAU * B) : 0));
      _arM2.compose(_v, _arQ.premultiply(_q.setFromRotationMatrix(_arM)), _arS);
      BASLAR.setMatrixAt(nb, _arM2);
      SACLAR.setMatrixAt(nb, _arM2);
      GOZLER.setMatrixAt(nb, _arM2);
      _arC.set(g.ten);
      bc[nb * 3] = _arC.r;
      bc[nb * 3 + 1] = _arC.g;
      bc[nb * 3 + 2] = _arC.b;
      _arC.set(g.kadin && g.baslik === 'yazma' ? g.baslikRenk : g.sac);
      sc[nb * 3] = _arC.r;
      sc[nb * 3 + 1] = _arC.g;
      sc[nb * 3 + 2] = _arC.b;
      _m4.compose(_v.set(su.x - 0.03, su.y - 0.37, z), _q.identity(), _arS).premultiply(_arM);
      GOVDE_INSAN.setMatrixAt(nb, _m4);
      _arC.set(g.gomlek);
      gc[nb * 3] = _arC.r;
      gc[nb * 3 + 1] = _arC.g;
      gc[nb * 3 + 2] = _arC.b;
      if (z < 0) {
        k._bas = k._bas || new THREE.Vector3();
        k._bas.set(su.x, su.y + 0.15, z).applyMatrix4(_arM);
      }
      nb++;
    }
  }
  for (const tip of KASA_TIP) {
    GOVDE[tip].count = CAM[tip].count = Math.min(SAYAC[tip], GOVDE[tip].instanceMatrix.count);
    GOVDE[tip].instanceMatrix.needsUpdate = CAM[tip].instanceMatrix.needsUpdate = true;
    GOVDE[tip].instanceColor.needsUpdate = true;
  }
  TEKER.count = Math.min(nt, TEKER.instanceMatrix.count);
  LAMBA.count = Math.min(nl, LAMBA.instanceMatrix.count);
  PLAKA.count = Math.min(np, PLAKA.instanceMatrix.count);
  BASLAR.count = SACLAR.count = GOZLER.count = GOVDE_INSAN.count = Math.min(nb, BASLAR.instanceMatrix.count);
  for (const m of [TEKER, LAMBA, PLAKA, BASLAR, SACLAR, GOZLER, GOVDE_INSAN])
    m.instanceMatrix.needsUpdate = true;
  LAMBA.instanceColor.needsUpdate = BASLAR.instanceColor.needsUpdate = SACLAR.instanceColor.needsUpdate = GOVDE_INSAN.instanceColor.needsUpdate = true;
  plakaUv.needsUpdate = true;
  // bu karede çizilmeyen kayıtların (silinen, yerine yenisi açılan ya da sınır yüzünden düşen) plaka hücresi boşalır
  const cizilen = new Set(gorunenArabalar);
  for (const k of plakaSahipleri)
    if (!cizilen.has(k))
      plakaBirak(k);
  plakaSahipleri = gorunenArabalar.slice();
  ORNEK.araba = gorunenArabalar.length;
  ORNEK.teker = nt;
  ORNEK.plaka = np;
  const yuvalar = plakaSahipleri.filter(k => k.plakaYuva !== undefined);
  ORNEK.yuva = yuvalar.length;
  ORNEK.yuvaCakisma = yuvalar.length - new Set(yuvalar.map(k => k.plakaYuva)).size;
  ORNEK.adYanlis = yuvalar.filter(k => k.plakaAd !== k.ad).length;
  ORNEK.bosYuva = plakaBos.length;
  ORNEK.dusen = cizimDisi;
  gelinSusuYerlestir();
}
let plakaSahipleri = [], cizimDisi = 0;
// Tekerlek denetimi: tekerleğin merkezi gövdenin kendi ekseninde nerede? Kemerin tepesi ile lastiğin tepesi arası
// (kemer) hep artı, lastiğin altı gövdenin eşiğinin altında (esik artı) kalmalı. En küçük değerler kasa tipine göre
// D.tekerOlc'ta birikir (test sıfırlayıp okur).
const _toM = new THREE.Matrix4(), _toV = new THREE.Vector3();
function tekerOlc(k, K, xc, M) {
  _toV.setFromMatrixPosition(M).applyMatrix4(_toM.copy(k._M).invert());
  const R = K.r + 0.075, dx = _toV.x - xc, kemer = K.r + Math.sqrt(Math.max(0, R * R - dx * dx)) - (_toV.y + K.r), esik = K.sil - (_toV.y - K.r);
  const o = D.tekerOlc[k.ar.tip] || (D.tekerOlc[k.ar.tip] = { kemer: Infinity, esik: Infinity, n: 0 });
  o.kemer = Math.min(o.kemer, kemer);
  o.esik = Math.min(o.esik, esik);
  o.n++;
}
const ORNEK = { araba: 0, teker: 0, plaka: 0, yuva: 0, dusen: 0, yuvaCakisma: 0, adYanlis: 0, bosYuva: 0, etiket: null };
// Çizilecek arabalar: sahnedekiler (gelin arabası, konu, drift atan önce), sonra çıkmakta olanlar en yenisinden;
// toplam KAP_ARABA'yı geçmez. Çizilmeyen çıkan araba zaten birkaç kare sonra silinecektir.
function cizimSirasi() {
  const ana = [], cikan = [], konu = D.reji && D.reji.konu, yildiz = D.drift && D.drift.k;
  for (const k of D.oy.values()) {
    if (!k.ar)
      continue;
    (k.cikiyor ? cikan : ana).push(k);
  }
  const once = k => k === D.lider || k === konu || k === yildiz ? 1 : 0;
  ana.sort((a, b) => once(b) - once(a));
  cikan.sort((a, b) => b.cikis - a.cikis);
  const hepsi = ana.concat(cikan);
  cizimDisi = Math.max(0, hepsi.length - KAP_ARABA);
  return hepsi.slice(0, KAP_ARABA);
}
function gelinSusuYerlestir() {
  const L = D.lider && D.lider.ar && !D.lider.cikiyor ? D.lider : null;
  for (const [tip, g] of Object.entries(GELIN.gruplar))
    g.visible = !!L && L.ar.tip === tip;
  GELIN.hale.visible = !!L;
  if (!L)
    return;
  const g = gelinSusu(L.ar.tip);
  g.visible = true;
  g.matrix.copy(L._M);
  g.matrixWorldNeedsUpdate = true;
  // Lider yeni değiştiyse süs büyüyerek açılır (yaklaşık bir vuruş)
  const ku = D.kurdeleUcus, u = ku && ku.kime === L ? clamp((B - ku.b0) / 1.1, 0, 1) : 1;
  const ac = u < 1 ? yumusak(u) * (1 + 0.35 * Math.sin(Math.PI * u)) : 1;
  const ud = g.userData;
  ud.ic.scale.setScalar(Math.max(0.001, ac));
  ud.fy.rotation.x = Math.sin(TAU * B) * 0.08;
  ud.fy.scale.setScalar(1.05 * (1 + 0.06 * calgi.dumP));
  ud.balonlar.forEach((b, i) => { b.rotation.set(Math.sin(TAU * B / 2 + i) * 0.12, 0, -0.18 + Math.cos(TAU * B / 2 + i * 2) * 0.1); });
  // altın hale yolda, arabanın altında vuruşla atar
  arabaMatris(L, true, _arM2);
  GELIN.hale.position.setFromMatrixPosition(_arM2);
  GELIN.hale.position.y = 0.02;
  const n = 1 + 0.07 * Math.sin(B * TAU);
  GELIN.hale.scale.set(5.6 * n, 1, 5.6 * n);
  GELIN.hale.rotation.y = yolYon(D.yol + L.gs);
}

/* ---- park etmiş arabalar (yol kenarının parçası, tek geometride birleşir) ---- */
function parkArabasi(Y, M, r) {
  const tip = KASA_TIP[Math.floor(r() * 3)], K = KASA[tip], kg = kasaGeo(tip);
  Y.geoBoyali(kg.govde, M, ARABA_RENK[Math.floor(r() * ARABA_RENK.length)]);
  Y.geo(kg.cam, M, '#2c3946');
  for (const xc of K.teker)
    for (const s of [-1, 1])
      parcaEkle(Y, M, 'silindir', xc, K.r, s * (K.W / 2 - 0.13), K.r * 2, 0.2, K.r * 2, '#1e1e22', 0, HP, 0);
}
