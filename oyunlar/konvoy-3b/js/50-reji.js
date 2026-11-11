/* KAMERA REJİSİ — canlı yayındaki bir yönetmen gibi kameralar arasında keser.
 * CEKIM: adlı çekimler. Her biri konvoyun durumu ve çekimin içindeki zamanın (vuruş) işlevidir; hepsi yavaşça
 * kayar, kalkar, döner: kare hiç donmaz. drone · yan · on · kus · tur · yakin · kenar · vinc, ve olay çekimleri
 * sov (en büyük hediye: gönderenin arabasına geçer, etrafında dönerek yaklaşır) · lider (yeni gelin arabası öne geçer).
 * Kesmeler vuruş saatinin (B) ölçü çizgilerinde olur. Çoğu sert kesmedir; bazı çiftler 2–4 vuruşta yumuşakça
 * birbirine akar (drone alçalıp yan çekime iner gibi). En kısa çekim 8 vuruş; art arda iki çekim aynı yandan ve aynı
 * yükseklikten olmaz. Olay çekimleri programı keser, bitince programa geri verir.
 * TikTok kadrajı: sahne 9:16, sanal ölçü 720×1280; 0–480 çekirdeğin yazıları, 1024 sonrası TikTok'un yorumları. Asıl
 * konu her çekimde 505–1006 satırlarında durur: kameranın ana noktası setViewOffset ile 760. satıra kaydırılır,
 * genişleyen çekimler (drone, kuş) konvoyu bu şeride sığacak kadar uzaklaşır (sigdir).
 * Güvenlik: kamera yerin altına inmez, arabanın ve binanın içine girmez (guvenli), konuyu kadrajdan kaçırmaz.
 * Denetim: 1–8 tuşları çekimi zorlar, 0 otomatiğe döner; D.reji.zorla = 'yan' testlerden aynı işi yapar.
 * Kancalar: rejiGuncelle(dt) (oyunZemin'den), rejiOlay(tur, k), rejiSifirla(); oyunDurum çekimin adını yazar.
 */
const rejiV0 = new THREE.Vector3(), rejiV1 = new THREE.Vector3(), rejiV2 = new THREE.Vector3(), rejiV3 = new THREE.Vector3();
const YAN_SINIR = 9.8; // alçak kameranın yolun ortasından en çok uzaklığı (dükkân vitrinlerinin önü)
const SERIT_UST = 505, SERIT_ALT = 1006, MERKEZ_Y = 760;
const CEKIM_SIRA = ['drone', 'yan', 'on', 'kus', 'tur', 'yakin', 'kenar', 'vinc'];
// Hangi çekimden hangisine yumuşak geçilebilir (2–4 vuruş): yönü ve yüksekliği birbirine akabilen çiftler.
const YUMUSAK = { 'drone>yan': 4, 'drone>on': 4, 'kus>drone': 4, 'vinc>kus': 2, 'kus>vinc': 4, 'tur>on': 2, 'on>tur': 2, 'yan>yakin': 2, 'tur>yakin': 2 };
Object.assign(D, { reji: { cekim: null, gecis: null, zorla: null, olay: null, konu: null, gecmis: [], rnd: rastgeleUret(4242), yakinSira: new Map(), sonKesme: -99 } });
const OLCER = new THREE.PerspectiveCamera(50, GW / GH, 0.3, 1400);

/* ---- konvoyun özeti ---- */
function konvoyOzet() {
  let mn = 0, mx = 0, n = 0;
  for (const k of D.oy.values()) {
    if (!k.ar || k.cikiyor)
      continue;
    mn = Math.min(mn, k.gs + k.os);
    mx = Math.max(mx, k.gs + k.os);
    n++;
  }
  // SL: gelin arabasının o anki yeri (yeni gelin arabası öne geçerken yolun başı değil, arabanın kendisi)
  const L = D.lider && D.lider.ar ? D.lider : null;
  return { SL: D.yol + (L ? L.gs + L.os : 0), ST: D.yol + mn - 2.4, SO: D.yol + mx + 2.4, uzun: mx - mn + 4.8, n, on: onGrup() };
}
// Geniş çekimlerin konusu: gelin arabası ve arkasındaki ilk sıralar (en çok 9 araba). Kuyruk uzağa akabilir.
const ON_GRUP = 9;
function onGrup() {
  return [...D.oy.values()].filter(k => k.ar && !k.cikiyor && k.yer > 0.3).sort((a, b) => (b.gs + b.os) - (a.gs + a.os)).slice(0, ON_GRUP);
}
const yN = (s, l, y) => yolNokta(s, l, y, new THREE.Vector3());
function arabaKonum(k, y, out) { return yolNokta(D.yol + k.gs + k.os, k.gl + k.ox, y, out || new THREE.Vector3()); }
const ileriYon = s => { const e = yolEgim(s), n = 1 / Math.sqrt(1 + e * e); return new THREE.Vector3(e * n, 0, n); };
const solYon = s => { const e = yolEgim(s), n = 1 / Math.sqrt(1 + e * e); return new THREE.Vector3(n, 0, -e * n); };

/* ---- kadraj ölçümü ---- */
// Kameranın ana noktası 760. satır: three.js'te view offset ile görüntü aşağı kaydırılır, bakılan nokta orada durur.
function kameraHazirla(kam, fov, merkezY) {
  const w = DUNYA.r ? DUNYA.r.domElement.width : GW, h = DUNYA.r ? DUNYA.r.domElement.height : GH;
  kam.fov = fov;
  kam.aspect = w / h;
  kam.setViewOffset(w, h, 0, -((merkezY || MERKEZ_Y) - GH / 2) * h / GH, w, h);
  kam.updateProjectionMatrix();
}
// Dünya noktasının sanal tuvaldeki (720×1280) yeri; kameranın arkasındaysa ok: false.
function ekranNokta(kam, v, out) {
  rejiV3.copy(v).project(kam);
  out.x = (rejiV3.x + 1) / 2 * GW;
  out.y = (1 - rejiV3.y) / 2 * GH;
  out.ok = rejiV3.z > -1 && rejiV3.z < 1;
  return out;
}
const _en = { x: 0, y: 0, ok: false };
function kadrajda(kam, noktalar, pay) {
  const p = pay || 0;
  for (const v of noktalar) {
    ekranNokta(kam, v, _en);
    if (!_en.ok || _en.x < 52 + p || _en.x > GW - 52 - p || _en.y < SERIT_UST + 14 + p || _en.y > SERIT_ALT - 16 - p)
      return false;
  }
  return true;
}
// Hedefe yon doğrultusundan bakan kamerayı, bütün noktalar şeride sığacak en yakın uzaklığa koyar (ikiye bölme).
function sigdir(hedef, yon, noktalar, fov, dMin, dMax, merkezY) {
  kameraHazirla(OLCER, fov, merkezY);
  const dene = d => {
    OLCER.position.copy(hedef).addScaledVector(yon, d);
    OLCER.lookAt(hedef);
    OLCER.updateMatrixWorld();
    return kadrajda(OLCER, noktalar);
  };
  if (dene(dMin))
    return dMin;
  let a = dMin, b = dMax;
  if (!dene(b))
    return b;
  for (let i = 0; i < 16; i++) {
    const m = (a + b) / 2;
    if (dene(m))
      b = m;
    else
      a = m;
  }
  return b;
}
// Bir arabanın kadraja girmesi gereken köşeleri (yerden tavanın biraz üstüne).
function arabaKoseleri(k, dizi) {
  const K = KASA[k.ar.tip], L = (K.tampon.on - K.tampon.arka) / 2 + 0.1, w = K.W / 2 + 0.1, ust = Math.max(K.ev[1][1], K.ev[2][1]) + 0.25;
  const s = D.yol + k.gs + k.os, l = k.gl + k.ox;
  for (const ds of [-L, L])
    for (const dl of [-w, w])
      for (const y of [0, ust])
        dizi.push(yN(s + ds, l + dl, y));
  return dizi;
}
// p'den h'ye bakan kamerayı, k arabası şeride sığmıyorsa aynı doğrultuda geri çeker (yalnız uzaklaştırır).
function sigacakKadar(c, p, h, k, fov, merkezY) {
  const yon = rejiV0.subVectors(p, h), d0 = yon.length();
  yon.divideScalar(d0);
  const gerek = Math.max(d0, sigdir(h, yon.clone(), arabaKoseleri(k, []), fov, d0, d0 * 4 + 10, merkezY));
  // dışarı hemen (konu kadrajdan taşmasın), içeri yavaşça
  const d = c.dSig === undefined || gerek > c.dSig ? (c.dSig = gerek) : yakinlas(c, 'dSig', gerek, 2);
  return h.clone().addScaledVector(yon, Math.max(d, d0));
}
const yakinlas = (c, ad, deger, hiz) => (c[ad] = c[ad] === undefined ? deger : lerp(c[ad], deger, Math.min(1, sonDt * (hiz || 2.5))));

/* ---- çekimler ---- */
// Her çekim: taraf ve yükseklik (art arda tekrarı önlemek için), gok (gökyüzü görünür mü; havai fişekte gerekir),
// sure (vuruş), kur(c) (çekim başında bir kez), poz(c, t, z) → { p: kamera, h: bakılan nokta, fov, merkezY }.
const CEKIM = {
  drone: { taraf: 'on', yuk: 'yuksek', gok: true, sure: [12, 16],
    kur(c) { c.yan = c.rnd() < 0.5 ? -1 : 1; },
    poz(c, t, z) {
      // yüksekten, önden çaprazdan: gelin arabası ve ilk sıralar okunur büyüklükte, konvoyun kuyruğu virajla birlikte
      // uzağa akar. Kamera yavaşça yana kayar ve alçalır.
      const u = t / c.sure, el = 0.72 - 0.1 * u, psi = c.yan * (0.22 + 0.2 * u);
      const n = [];
      const grup = z.on.slice(0, 6);
      for (const k of grup)
        arabaKoseleri(k, n);
      const sOrta = grup.length ? (D.yol + grup[grup.length - 1].gs + z.SL) / 2 : z.SL, h = yN(sOrta, 0, 0.6), T = ileriYon(sOrta);
      const yon = T.applyAxisAngle(rejiV0.set(0, 1, 0), psi).multiplyScalar(Math.cos(el));
      yon.y = Math.sin(el);
      const d = yakinlas(c, 'd', sigdir(h, yon, n, 40, 12, 160), 1.5);
      return { p: h.clone().addScaledVector(yon, d), h, fov: 40 };
    } },
  yan: { taraf: 'sag', yuk: 'alcak', gok: true, sure: [12, 16],
    kur(c, z) {
      // konu: sağ şeritteki (tek sırada herhangi) bir araba; kamera onun yanında, tekerlek hizasında, onunla birlikte
      // gider ve çekim boyunca arkadan öne doğru yarım daire çizer: araba yerinde kalır, yol kenarı arkada akar
      const aday = [...D.oy.values()].filter(k => k.ar && !k.cikiyor && k.gl < 0.5 && k !== (D.drift && D.drift.k));
      c.konu = aday.length ? aday[Math.floor(c.rnd() * Math.min(aday.length, 6))] : D.lider;
      c.a0 = -0.55 - c.rnd() * 0.2;
    },
    poz(c, t, z) {
      const k = c.konu && D.oy.has(c.konu.id) && !c.konu.cikiyor ? c.konu : (c.konu = D.lider), s = D.yol + k.gs, u = t / c.sure;
      const merkez = arabaKonum(k, 0.7), a = c.a0 + 1.1 * u, T = ileriYon(s), S = solYon(s);
      const yon = S.multiplyScalar(-Math.cos(a)).addScaledVector(T, Math.sin(a));
      yon.y = 0.025;
      yon.normalize();
      // Kaldırımın ötesi dükkânların önü: kamera oradan uzağa gidemez. Araba o uzaklığa sığmıyorsa kamera yerinde
      // kalır, açısı genişler (uzun minibüs gibi).
      const kose = arabaKoseleri(k, []), yanal = Math.max(0.2, Math.abs(yon.dot(solYon(s)))), dEn = (YAN_SINIR - Math.abs(k.gl)) / yanal;
      let d = sigdir(merkez, yon, kose, 50, 4.5, 14), fov = 50;
      if (d > dEn) {
        d = dEn;
        let a2 = 50, b2 = 84;
        for (let i = 0; i < 10; i++) {
          const m = (a2 + b2) / 2;
          if (sigdir(merkez, yon, kose, m, d, d + 0.01) <= d)
            b2 = m;
          else
            a2 = m;
        }
        fov = b2;
      }
      d = yakinlas(c, 'd', d, 3);
      fov = yakinlas(c, 'fov', fov, 3);
      return { p: merkez.clone().addScaledVector(yon, d), h: merkez, fov };
    } },
  on: { taraf: 'on', yuk: 'alcak', gok: true, sure: [8, 12],
    kur(c) { c.yan = c.rnd() < 0.5 ? -1 : 1; },
    poz(c, t, z) {
      // gelin arabasının önünde, alçakta, geri geri giden kamera: konvoy arkasında kadrajı doldurur
      const s = z.SL + 8.6 + 0.8 * Math.sin(t / 8 * Math.PI), l = c.yan * (0.7 + 0.5 * Math.sin(t / 12 * Math.PI));
      return { p: yN(s, l, 1.05), h: yN(z.SL - 1.2, 0, 0.85), fov: 46 };
    } },
  kus: { taraf: 'ust', yuk: 'tepe', gok: false, sure: [12, 16],
    kur(c) { c.yan = c.rnd() < 0.5 ? -1 : 1; },
    poz(c, t, z) {
      // tepeden: gelin arabası ve ilk sıralar kadrajda, kuyruk kadrajın kenarından akıp gider; kamera yavaşça döner
      // (konvoy ekranda yatay kalsın diye yandan bakar)
      const n = [];
      const grup = z.on.slice(0, 7);
      for (const k of grup)
        arabaKoseleri(k, n);
      const sm = grup.length ? (D.yol + grup[grup.length - 1].gs + z.SL) / 2 : z.SL, h = yN(sm, 0, 0), L = solYon(sm), u = t / c.sure;
      const el = 1.2, psi = 0.5 * (u - 0.5) * c.yan;
      const yon = L.multiplyScalar(c.yan).applyAxisAngle(rejiV0.set(0, 1, 0), psi).multiplyScalar(Math.cos(el));
      yon.y = Math.sin(el);
      const d = yakinlas(c, 'd', sigdir(h, yon, n, 40, 14, 200), 1.5);
      return { p: h.clone().addScaledVector(yon, d), h, fov: 40 };
    } },
  tur: { taraf: 'on', yuk: 'orta', gok: true, sure: [12, 16],
    kur(c) { c.yon = c.rnd() < 0.5 ? -1 : 1; c.a0 = -c.yon * (1.25 + c.rnd() * 0.2); },
    poz(c, t, z) {
      // gelin arabasının çevresinde dönüş: önden yanlara (arkada konvoyun öbür arabaları var, oraya girmez)
      const L = D.lider, a = c.a0 + c.yon * t * TAU / 64, merkez = arabaKonum(L, 0.8), s = D.yol + L.gs;
      const T = ileriYon(s), S = solYon(s), R = 7.8 - 0.6 * Math.sin(t / c.sure * Math.PI);
      const p = merkez.clone().addScaledVector(T, Math.cos(a) * R).addScaledVector(S, Math.sin(a) * R);
      p.y = 2.0 + 0.5 * Math.sin(t / c.sure * Math.PI);
      return { p: sigacakKadar(c, p, merkez, L, 46), h: merkez, fov: 46 };
    } },
  yakin: { taraf: 'yan', yuk: 'orta', gok: true, sure: [8, 8], merkezY: 712,
    kur(c) {
      c.k = yakinSec();
      c.yan = c.k && c.k.gl > 0.3 ? 1 : c.k && c.k.gl < -0.3 ? -1 : -1;
      c.taraf = c.yan > 0 ? 'sol' : 'sag';
      if (c.k) {
        D.reji.yakinSira.set(c.k.id, B);
        D.reji.konu = c.k;
      }
    },
    poz(c, t, z) {
      // sıradan bir izleyicinin arabası, önden dörtte üç, adı büyük: izleyici kendini burada bulur
      const k = c.k && D.oy.has(c.k.id) && !c.k.cikiyor ? c.k : D.lider, s = D.yol + k.gs + k.os, u = t / c.sure;
      const merkez = arabaKonum(k, 0.72), T = ileriYon(s), S = solYon(s);
      const yon = T.clone().multiplyScalar(0.78).addScaledVector(S, c.yan * 0.62).normalize();
      yon.y = 0.22;
      yon.normalize();
      const d = yakinlas(c, 'd', sigdir(merkez, yon, arabaKoseleri(k, []), 42, 4, 14, 712), 3) * (1.13 - 0.09 * yumusak(u));
      return { p: merkez.clone().addScaledVector(yon, d), h: merkez, fov: 42, merkezY: 712 };
    } },
  kenar: { taraf: 'sag', yuk: 'alcak', gok: true, sure: [12, 16],
    kur(c, z) {
      // yol kenarında sabit kamera: konvoyun önünde, sağ kaldırımda iki ağacın arasında
      let n = Math.ceil((z.SL + 24) / YUVA);
      for (let i = 0; i < 4 && yuvaNe(n, -1) === 'direk'; i++)
        n++;
      const s = n * YUVA + YUVA / 2;
      c.s = s;
      const p = yN(s, -5.0, 1.6);
      c.wx = p.x + DUNYA.kx;
      c.wz = p.z + DUNYA.kz;
    },
    poz(c, t, z) {
      // konvoy önünden geçer, kamera başıyla onu izler (önce gelin arabasına, geçince yolun ilerisine bakar)
      // kamera başını çevirerek bir arabayı izler: önce gelin arabasını, o geçince kameranın hizasına yeni gelen arabayı
      const hedefS = Math.min(z.SL - 0.6, c.s + 2);
      let en = null, enU = Infinity;
      for (const k of D.oy.values())
        if (k.ar && !k.cikiyor && Math.abs(D.yol + k.gs - hedefS) < enU) {
          enU = Math.abs(D.yol + k.gs - hedefS);
          en = k;
        }
      c.konu = en;
      const hs = yakinlas(c, 'hs', en ? D.yol + en.gs : hedefS, 3), hl = yakinlas(c, 'hl', en ? en.gl : 0, 3);
      return { p: rejiV2.set(c.wx - DUNYA.kx, 1.6, c.wz - DUNYA.kz).clone(), h: yN(hs, hl, 0.8), fov: 52 };
    },
    bitti(c, z) { return z.ST > c.s + 4; } },
  vinc: { taraf: 'on', yuk: 'yuksek', gok: false, sure: [16, 16],
    kur(c) { c.yan = c.rnd() < 0.5 ? -1 : 1; },
    poz(c, t, z) {
      // vinç: gelin arabasının kaputundan başlar, yükselip geniş bir kadraja açılır
      const u = yumusak(t / c.sure), L = D.lider, sl = D.yol + L.gs;
      const p = yN(sl + lerp(6.8, 30, u), c.yan * lerp(0.6, 7, u), lerp(2.0, 36, u));
      const h = yN(lerp(sl + 1.1, lerp(z.ST, z.SL, 0.55), u), 0, lerp(1.0, 0, u));
      return { p: t < 9 ? sigacakKadar(c, p, h, L, lerp(48, 44, u)) : p, h, fov: lerp(48, 44, u) };
    } },
  // olay çekimleri
  sov: { taraf: 'on', yuk: 'orta', gok: true, sure: [24, 24], merkezY: 720,
    kur(c) { c.yon = c.rnd() < 0.5 ? -1 : 1; },
    poz(c, t, z) {
      const dr = D.drift, k = c.k, s = D.yol + k.gs, merkez = arabaKonum(k, 0.7);
      const T = ileriYon(s), S = solYon(s);
      if (!dr || dr.donus === null) {
        // öne fırlarken: yukarıdan, yanından izler
        const yan = k.gl >= 0 ? 1 : -1;
        const p = merkez.clone().addScaledVector(T, 3).addScaledVector(S, yan * 7.5);
        p.y = 4.6;
        return { p: sigacakKadar(c, p, merkez, k, 46, 720), h: merkez, fov: 46, merkezY: 720 };
      }
      // dönerken: çevresinde dolanır ve yaklaşır
      const u = clamp((B - dr.donus) / DRIFT_V, 0, 1), a = c.yon * (-1.4 + 2.8 * u), R = lerp(10, 6.6, yumusak(u));
      const p = merkez.clone().addScaledVector(T, Math.cos(a) * R).addScaledVector(S, Math.sin(a) * R);
      p.y = lerp(3.0, 2.0, u);
      return { p: sigacakKadar(c, p, merkez, k, 46, 720), h: merkez, fov: 46, merkezY: 720 };
    },
    bitti(c) { return !D.drift || D.drift.k !== c.k; } },
  lider: { taraf: 'on', yuk: 'alcak', gok: true, sure: [16, 16], merkezY: 720,
    kur(c) { c.yan = c.k && c.k.gl > 0 ? 1 : -1; },
    poz(c, t, z) {
      // yeni gelin arabası öne geçer: önden dörtte üç, onunla birlikte giden kamera; araba kadraja sığacak kadar uzakta
      const k = c.k, s = D.yol + k.gs, merkez = arabaKonum(k, 0.75);
      const yon = ileriYon(s).multiplyScalar(0.8).addScaledVector(solYon(s), c.yan * 0.55);
      yon.y = 0.5;
      yon.normalize();
      const d = yakinlas(c, 'd', sigdir(merkez, yon, arabaKoseleri(k, []), 46, 6, 22, 720), 3);
      return { p: merkez.clone().addScaledVector(yon, d), h: merkez, fov: 46, merkezY: 720 };
    },
    bitti(c, z, t) { return !D.oy.has(c.k.id) || c.k !== D.lider || (t > 8 && c.k.yer > 0.9 && Math.abs(c.k.gs) < 1); } }
};
// Yakın çekimin sırası: en son katılan, sonra son yorum yazanlar, sonra en uzun süredir gösterilmeyen.
function yakinSec() {
  let en = null, enP = -Infinity;
  for (const k of D.oy.values()) {
    if (!k.ar || k.cikiyor || k === D.lider || (D.drift && D.drift.k === k))
      continue;
    const goster = D.reji.yakinSira.get(k.id), gecen = goster === undefined ? 999 : B - goster;
    const p = (zaman - k.yeni < 20 && gecen > 40 ? 3000 : 0) + (zaman - k.son < 15 && gecen > 24 ? 1500 - (zaman - k.son) * 20 : 0) + Math.min(gecen, 900) - k.sn * 0.5;
    if (p > enP) {
      enP = p;
      en = k;
    }
  }
  return en;
}

/* ---- program ---- */
function cekimKur(ad, z, ek) {
  const t = CEKIM[ad], r = D.reji.rnd, sure = t.sure[0] + Math.floor(r() * ((t.sure[1] - t.sure[0]) / 4 + 1)) * 4;
  const c = Object.assign({ ad, b0: Math.round(B), sure, rnd: r, taraf: t.taraf, yuk: t.yuk }, ek || {});
  t.kur(c, z);
  return c;
}
function siradakiSec(z) {
  const R = D.reji, son = R.cekim, fisek = B < D.fisekBit;
  const adaylar = [];
  let top = 0;
  for (const ad of CEKIM_SIRA) {
    const t = CEKIM[ad];
    if (son && (ad === son.ad || (t.taraf === son.taraf && t.yuk === son.yuk)))
      continue;
    if (fisek && !t.gok)
      continue;
    if (ad === 'yakin' && !yakinSec())
      continue;
    if ((ad === 'tur' || ad === 'vinc' || ad === 'on') && !D.lider)
      continue;
    let w = { drone: 1, yan: 1, on: 0.9, kus: 0.75, tur: 0.9, yakin: 1.7, kenar: 0.8, vinc: 0.6 }[ad];
    const once = R.gecmis.lastIndexOf(ad);
    if (once >= 0 && R.gecmis.length - once <= 3)
      w *= 0.25;
    if (z.n <= 1 && (ad === 'kus' || ad === 'drone'))
      w *= 0.4;
    adaylar.push([ad, w]);
    top += w;
  }
  let x = R.rnd() * top;
  for (const [ad, w] of adaylar)
    if ((x -= w) <= 0)
      return ad;
  return adaylar.length ? adaylar[adaylar.length - 1][0] : 'drone';
}
function kes(ad, z, ek, yumusakIzin) {
  const R = D.reji, eski = R.cekim, yeni = cekimKur(ad, z, ek);
  const g = eski && yumusakIzin ? YUMUSAK[eski.ad + '>' + ad] : 0;
  R.gecis = g && R.rnd() < 0.55 ? { eski, b0: B, sure: g } : null;
  R.cekim = yeni;
  R.gecmis.push(ad);
  if (R.gecmis.length > 12)
    R.gecmis.shift();
  R.sonKesme = B;
  if (ad !== 'yakin')
    R.konu = null;
}
function rejiOlay(tur, k) {
  const R = D.reji;
  if (!DUNYA.r)
    return;
  // en büyük hediye her şeyden önce gelir; gelin arabası değişimi şov sürerken araya girmez
  if (tur === 'lider' && R.olay && R.olay.tur === 'sov')
    return;
  R.olay = { tur, k, b: B };
}
function rejiSifirla() {
  const R = D.reji;
  R.cekim = R.gecis = R.olay = R.konu = null;
  R.gecmis.length = 0;
}
const OLCU = 4;
function rejiGuncelle(dt) {
  const R = D.reji, z = konvoyOzet();
  if (!D.lider) {
    // boş yol: yolun kendisini gösteren yavaş bir drone
    if (!R.cekim || R.cekim.ad !== 'bos')
      R.cekim = { ad: 'bos', b0: B, sure: 9999, taraf: 'arka', yuk: 'yuksek' };
    const h = yN(D.yol + 10, 0, 0.5), p = yN(D.yol - 14, -3, 7);
    return kameraKoy(p, h, 46, MERKEZ_Y);
  }
  const olcuBasi = Math.floor(B / OLCU) !== Math.floor((R.sonB === undefined ? B : R.sonB) / OLCU);
  R.sonB = B;
  // zorlanan çekim (tuş ya da test): değişince hemen keser, zorla kalktıkça programa döner
  if (R.zorla && CEKIM[R.zorla] && (!R.cekim || R.cekim.ad !== R.zorla || R.cekim.zorlu !== R.zorla)) {
    kes(R.zorla, z, R.zorla === 'sov' || R.zorla === 'lider' ? { k: D.drift ? D.drift.k : D.lider } : null, false);
    R.cekim.zorlu = R.zorla;
    R.cekim.sure = 9999;
    R.gecis = null;
  }
  else if (!R.zorla) {
    if (R.cekim && R.cekim.zorlu)
      R.cekim = null;
    const c = R.cekim, t = c ? B - c.b0 : 0;
    const bittiMi = c && c.ad !== 'bos' && (t >= c.sure || (CEKIM[c.ad].bitti && t >= 8 && CEKIM[c.ad].bitti(c, z, t)) || ((c.ad === 'tur' || c.ad === 'vinc' || c.ad === 'on') && !D.lider));
    if (!c || c.ad === 'bos' || !CEKIM[c.ad])
      kes(siradakiSec(z), z, null, false);
    else if (olcuBasi && R.olay) {
      // olay çekimi: bir sonraki ölçü çizgisinde programı keser
      const o = R.olay;
      R.olay = null;
      if (o.tur === 'sov' && D.drift && D.drift.k === o.k)
        kes('sov', z, { k: o.k }, false);
      else if (o.tur === 'lider' && D.lider === o.k && !(c.ad === 'sov'))
        kes('lider', z, { k: o.k }, false);
    }
    else if (olcuBasi && bittiMi && t >= 8)
      kes(siradakiSec(z), z, null, true);
    else if (olcuBasi && t >= 8 && B < D.fisekBit && !CEKIM[c.ad].gok && c.ad !== 'sov')
      kes(siradakiSec(z), z, null, true);
  }
  const c = R.cekim;
  let poz = CEKIM[c.ad].poz(c, B - c.b0, z);
  // yumuşak geçiş: eski çekim de yürür, ikisi arasında kayılır
  if (R.gecis) {
    const g = R.gecis, u = (B - g.b0) / g.sure;
    if (u >= 1 || !CEKIM[g.eski.ad])
      R.gecis = null;
    else {
      const e = yumusak(u), a = CEKIM[g.eski.ad].poz(g.eski, B - g.eski.b0, z);
      poz = { p: a.p.clone().lerp(poz.p, e), h: a.h.clone().lerp(poz.h, e), fov: lerp(a.fov, poz.fov, e), merkezY: lerp(a.merkezY || MERKEZ_Y, poz.merkezY || MERKEZ_Y, e) };
    }
  }
  // Konunun önüne başka bir araba girerse kamera yavaşça yükselip onun üstünden bakar (engel kalkınca iner).
  const konu0 = konuArabasi(c);
  const engel = konu0 && !R.gecis && engelVar(poz.p, arabaKonum(konu0, 0.8), konu0);
  c.kaldir = lerp(c.kaldir || 0, engel ? 3.2 : 0, Math.min(1, dt * (engel ? 2.5 : 0.8)));
  poz.p.y += c.kaldir;
  guvenli(poz.p, poz.h);
  // Son denetim: güvenlik itmesinden (araba üstünden aşma, bina sınırı) sonra da konu arabası şeride sığsın; sığmıyorsa
  // kamera bakış doğrultusunda geri çekilir (yan ve kenar çekiminde kamera yerinde kalır, onlar kendi açısını ayarlar).
  const konu = konuArabasi(c);
  if (konu && c.ad !== 'yan' && c.ad !== 'kenar' && !R.gecis) {
    const yon = poz.p.clone().sub(poz.h), d0 = yon.length();
    yon.divideScalar(d0);
    const d = sigdir(poz.h, yon, arabaKoseleri(konu, []), poz.fov, d0, d0 * 3 + 10, poz.merkezY || MERKEZ_Y);
    if (d > d0 + 0.01) {
      poz.p = poz.h.clone().addScaledVector(yon, d);
      guvenli(poz.p, poz.h);
    }
  }
  kameraKoy(poz.p, poz.h, poz.fov, poz.merkezY || MERKEZ_Y);
  konuKadraj(c, z);
  // gölge kutusu: geniş çekimde geniş, yakında sıkı (gölge keskin kalsın)
  DUNYA.golgeR = c.ad === 'kus' || c.ad === 'drone' || (c.ad === 'vinc' && B - c.b0 > 6) ? clamp(z.uzun * 0.62 + 18, 34, 120) : 30;
  DUNYA.golgeOdak = poz.h;
}
// Çekimin asıl konusu ekranda nerede (720×1280): testler ve kare betiği her karede şeritte mi diye bakar.
// Geniş çekimlerde (drone, kuş, vinç sonu) bütün konvoy, öbürlerinde konu arabası (köşeleriyle).
function konuArabasi(c) {
  if (c.ad === 'drone' || c.ad === 'kus' || c.ad === 'bos' || (c.ad === 'vinc' && B - c.b0 > 9))
    return null;
  const k = c.ad === 'yakin' || c.ad === 'sov' || c.ad === 'lider' ? c.k : c.ad === 'yan' || c.ad === 'kenar' ? c.konu : D.lider;
  return k && k.ar && D.oy.has(k.id) ? k : null;
}
function konuKadraj(c, z) {
  const kam = DUNYA.kamera, n = [];
  const genis = c.ad === 'drone' || c.ad === 'kus' || (c.ad === 'vinc' && B - c.b0 > 9);
  if (genis) {
    for (const k of z.on.slice(0, c.ad === 'kus' ? 7 : 6))
      n.push(arabaKonum(k, 0.7));
  }
  else {
    const k = konuArabasi(c);
    if (k)
      arabaKoseleri(k, n);
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, gorunmez = 0;
  for (const v of n) {
    ekranNokta(kam, v, _en);
    if (!_en.ok) {
      gorunmez++;
      continue;
    }
    x0 = Math.min(x0, _en.x);
    x1 = Math.max(x1, _en.x);
    y0 = Math.min(y0, _en.y);
    y1 = Math.max(y1, _en.y);
  }
  D.reji.kadraj = n.length && x1 >= x0 ? [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), gorunmez] : null;
}
function kameraKoy(p, h, fov, merkezY) {
  const k = DUNYA.kamera;
  kameraHazirla(k, fov, merkezY);
  k.position.copy(p);
  k.lookAt(h);
  k.updateMatrixWorld();
  DUNYA.bakis.subVectors(h, p).normalize();
  // sis kameranın konuya uzaklığına göre: geniş çekim pusa boğulmasın, yakın çekimde uzak kasaba yumuşasın
  const uz = p.distanceTo(h), sis = DUNYA.sahne.fog;
  sis.near = Math.max(110, uz * 1.3);
  sis.far = Math.max(560, uz * 3.2 + 300);
  DUNYA.merkezY = merkezY;
  if (!DUNYA.golgeOdak)
    DUNYA.golgeOdak = h.clone();
}
// p'den q'ya giden doğru, konu dışındaki bir arabanın kutusundan geçiyor mu (arabanın kendi ekseninde dilim testi).
const _eA = new THREE.Vector3(), _eB = new THREE.Vector3(), _eM = new THREE.Matrix4();
function engelVar(p, q, konu) {
  for (const k of D.oy.values()) {
    if (k === konu || !k.ar || !k._M || k.cikiyor)
      continue;
    const K = KASA[k.ar.tip];
    _eM.copy(k._M).invert();
    _eA.copy(p).applyMatrix4(_eM);
    _eB.copy(q).applyMatrix4(_eM);
    const mn = [K.tampon.arka, 0, -K.W / 2], mx = [K.tampon.on, Math.max(K.ev[1][1], K.ev[2][1]), K.W / 2];
    let t0 = 0.02, t1 = 0.92, ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      const a = _eA.getComponent(i), d = _eB.getComponent(i) - a;
      if (Math.abs(d) < 1e-6) {
        if (a < mn[i] || a > mx[i])
          ok = false;
        continue;
      }
      let ta = (mn[i] - a) / d, tb = (mx[i] - a) / d;
      if (ta > tb)
        [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1)
        ok = false;
    }
    if (ok)
      return true;
  }
  return false;
}
// Kamera yerin altına inmez, binaların içine girmez, arabaların içinden geçmez (yaklaşırsa üstünden aşar).
const _gMat = new THREE.Matrix4(), _gYer = new THREE.Vector3();
function guvenli(p, h) {
  // yolun yerel ekseninde: s ve yanal uzaklık (iki adımda yaklaşık)
  let s = p.z + DUNYA.kz, l = 0;
  for (let i = 0; i < 2; i++) {
    const e = yolEgim(s), n = 1 / Math.sqrt(1 + e * e);
    l = (p.x + DUNYA.kx - yolX(s)) * n;
    s = p.z + DUNYA.kz + l * e * n;
  }
  const al = Math.abs(l);
  const zemin = al > YOL_YARI && al < KALDIRIM ? KALDIRIM_Y : 0;
  if (p.y < zemin + 0.45)
    p.y = zemin + 0.45;
  const sinir = p.y < 2.2 ? YAN_SINIR : BINA_L - 1.4;
  if (al > sinir && p.y < 21) {
    const yeniL = Math.sign(l) * sinir;
    yolNokta(s, yeniL, p.y, _gYer);
    p.x = _gYer.x;
    p.z = _gYer.z;
  }
  for (const k of D.oy.values()) {
    if (!k.ar || !k._M)
      continue;
    const K = KASA[k.ar.tip];
    _gYer.copy(p).applyMatrix4(_gMat.copy(k._M).invert());
    const L = (K.tampon.on - K.tampon.arka) / 2 + 0.55, w = K.W / 2 + 0.55, ust = Math.max(K.ev[1][1], K.ev[2][1]) + 0.6;
    if (Math.abs(_gYer.x) < L && Math.abs(_gYer.z) < w && _gYer.y < ust) {
      // içine girecekti: üstünden geç
      _gYer.y = ust;
      p.copy(_gYer.applyMatrix4(k._M));
    }
  }
}
// Park etmiş arabalar alçak sol kameranın önünü kapatmasın: kameranın yakınındaki parçalarda gizlenir.
// Ağaç ve direk sırası da öyle: alçak kamera bir yanın ağaç sırasının hizasına ya da ötesine geçince (yan çekim,
// yakın çekim, tur) o yanın yakındaki ağaçları gizlenir; kamera bir gövdenin, bir taç yaprağının içinde kalmaz.
function parkGizle() {
  const k = DUNYA.kamera, s = k.position.z + DUNYA.kz, l = (k.position.x + DUNYA.kx - yolX(s)), y = k.position.y;
  for (const p of DUNYA.parcalar.values()) {
    const yakin = Math.abs(p.s0 + PARCA / 2 - s) < 75;
    if (p.park)
      p.park.visible = !(y < 3 && l > 1.5 && yakin);
    for (const yan of ['-1', '1'])
      if (p.kenar[yan])
        p.kenar[yan].visible = !(y < 9.5 && l * +yan > 4.5 && yakin);
  }
}

/* ---- tuşlar: 1–8 çekimi zorlar, 0 otomatik ---- */
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || yaziAlani(e.target))
    return;
  const n = '012345678'.indexOf(e.key);
  if (n < 0)
    return;
  D.reji.zorla = n === 0 ? null : CEKIM_SIRA[n - 1];
  bildir('Kamera', n === 0 ? 'otomatik' : CEKIM_SIRA[n - 1], n === 0 ? 'Reji' : 'Elle çekim');
});
