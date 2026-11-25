/* KONVOY HAREKETİ — arabaların yerine sürülmesi, şerit salınımı, turbo, düğün şovu, yolun akması, fişek, duman,
 * konfeti parçaları. Gelin Konvoyu'nun (oyunlar/konvoy/js/20-hareket.js) hareketinden uyarlandı.
 * arabaHareket(k, dt): yerine sür, çık, turbo, şov · Kancalar: oyunGuncelle(dt), oyunKamera().
 * Arabanın çizim konumu: k.x + k.ox, k.z + k.oz, yükseklik k.oy0; yönü k.yonG (π: kameraya doğru gider).
 */
function arabaHareket(k, dt) {
  const ar = k.ar;
  let hx = k.hedefX, hz = k.hedefZ;
  const yildiz = D.sov && D.sov.k === k;
  if (k.cikiyor) {
    // Çıkan arabanın hızı düşer, kenara çekip geride kalır.
    if (k.cikX === undefined)
      k.cikX = (k.x >= 0 ? 1 : -1) * (D.yolW + 4);
    hx = k.cikX;
    hz = k.z + 3;
  }
  else if (yildiz) {
    // Şov yapan, açılan koridordan (x = 0) gelin arabasının önüne geçer; gelin arabası o sırada yana yol verir.
    hx = 0;
    hz = SOV_Z;
  }
  const dx = hx - k.x, dz = hz - k.z, uz = Math.hypot(dx, dz);
  if (uz > 0.002) {
    const adim = Math.min(uz, (3.2 + uz * 1.5) * dt);
    k.x += dx / uz * adim;
    k.z += dz / uz * adim;
  }
  const yerinde = uz < 0.2 && !k.cikiyor;
  k.yer += ((yerinde ? 1 : 0) - k.yer) * Math.min(1, dt * 6);
  if (k.cikiyor)
    k.gitti = Math.abs(k.x) > D.yolW + 3.2;

  // Şeritte hafif salınım (her arabanın kendi evresiyle). Coşku yükseldikçe salınım büyür: konvoy oynar.
  let ox = azHareket ? 0 : (0.05 + 0.07 * D.cosku) * Math.sin(TAU * B / 8 + ar.faz * TAU) * k.yer, oz = 0;
  // Şovda öteki arabalar iki yana açılır: ortada şov yapanın koridoru kalır.
  if (D.sov && !yildiz && !k.cikiyor)
    ox += (k.hedefX > 0.01 ? 1 : k.hedefX < -0.01 ? -1 : k.sn % 2 ? 1 : -1) * 1.1;
  // Turbo: araba önce geri çöker, sonra ileri fırlar ve yerine yavaşça döner (öndekine çarpmayacak kadar).
  if (turboVar(k) && !k.cikiyor && !yildiz) {
    const u = (B - k.turbo) / TURBO_V;
    oz = u < 0.12 ? 0.25 * (u / 0.12) : -0.75 * Math.sin(Math.PI * clamp((u - 0.12) / 0.88, 0, 1)) * (u < 0.3 ? (u - 0.12) / 0.18 : 1);
  }
  k.ox += (ox - k.ox) * Math.min(1, dt * (D.sov ? 4 : 10));
  k.oz += (oz - k.oz) * Math.min(1, dt * 12);
  // Yön: kameraya doğru (π); yer değiştirirken gittiği yana kırılır.
  let yon = Math.PI + (uz > 0.25 && !k.cikiyor ? clamp(-dx * 0.35, -0.5, 0.5) : 0) + (k.cikiyor ? -Math.sign(k.cikX) * 0.35 : 0);
  if (yildiz && yerinde && !azHareket) {
    // Şov: dört vuruşun ikisinde yerinde tam tur döner (küçük bir daire çizerek), ikisinde poz verir.
    const su = B - D.sov.bas;
    if (su >= 0) {
      const u = su % 4, t = u < 2 ? yumusak(u / 2) : 1, a = TAU * t;
      yon = Math.PI + a;
      k.ox = 0.6 * Math.sin(a);
      k.oz = 0.35 * (1 - Math.cos(a));
      if (u < 2 && D.duman.length < 70 && Math.random() < dt * 30)
        D.duman.push({ x: k.x + k.ox + (Math.random() - 0.5) * 0.8, z: k.z + k.oz + (Math.random() - 0.5) * 0.8, b0: B, r: 0.25 + Math.random() * 0.2 });
    }
  }
  // Turbonun egzozundan duman
  if (turboVar(k) && !azHareket && D.duman.length < 70 && Math.random() < dt * 18)
    D.duman.push({ x: k.x + k.ox + (Math.random() - 0.5) * 0.4, z: k.z + k.oz + 0.9 * (k.olcek || 1), b0: B, r: 0.15 + Math.random() * 0.12 });
  k.yonG = k.yonG === undefined ? yon : k.yonG + aciFark(k.yonG, yon) * Math.min(1, dt * (yildiz ? 20 : 7));
  k.yon = k.yonG;
  const fx = Math.sin(k.yonG), fz = Math.cos(k.yonG);
  k.f[0] = fx;
  k.f[1] = 0;
  k.f[2] = fz;
  k.l[0] = -fz;
  k.l[1] = 0;
  k.l[2] = fx;
  // Yükseklik: her vuruşta süspansiyon yaylanır (sıra arkaya doğru gecikir), hediye sevincinde araba zıplar.
  const yay = 0.5 + 0.5 * Math.cos(TAU * (B - (k.hedefZ - LIDER_Z) * 0.04));
  let zip = 0;
  if (B >= k.zip0 && B < k.zip1)
    zip = (yildiz ? 0.12 : 0.22) * Math.abs(Math.sin(Math.PI * (B - k.zip0)));
  k.oy0 = (0.025 + 0.02 * D.cosku) * yay + zip;
  // Lider biraz büyük; şov yapan araba şov boyunca iki katına çıkar ve sahneyi alır.
  k.olcek = lerp(k.olcek || 1, yildiz ? SOV_OLCEK : k === D.lider && !k.cikiyor ? LIDER_OLCEK : 1, Math.min(1, dt * 4));
}

function oyunGuncelle(dt) {
  // Yol konvoyun altından akar: hız vuruşa bağlı, coşku arttıkça hızlanır. B geri gitmez.
  const db = clamp(B - D.sonB, 0, 1);
  D.sonB = B;
  D.kayma += db * (1.4 + 3.4 * D.cosku);
  D.yolW += (Math.max(2.4, kam.son.enX + 1.25) - D.yolW) * Math.min(1, dt * 1.5);
  // şov: sırası gelen gelin arabasının önüne geçer, 16 vuruş döner
  if (D.sov && (B > D.sov.bas + SOV_V || D.sov.k.cikiyor || !D.oy.has(D.sov.k.id))) {
    const k = D.sov.k;
    k.yildiz = k.guler = false;
    D.sov = null;
  }
  if (!D.sov && D.sovKuyruk.length) {
    const k = D.sovKuyruk.shift();
    if (!k.cikiyor && D.oy.has(k.id)) {
      k.yildiz = k.guler = true;
      D.sov = { k, bas: Math.ceil(B) + 1 };
      kornaCal(k);
    }
  }
  if (D.bayrakUcus && B - D.bayrakUcus.b0 > D.bayrakUcus.sure)
    D.bayrakUcus = null;
  // havai fişek: şov sürerken her vuruşta bir yenisi atılır
  if (B < D.fisekBit && Math.floor(B) !== Math.floor(B - db))
    fisekAt(1);
  for (let i = D.fisekler.length - 1; i >= 0; i--)
    if (B - D.fisekler[i].b0 > 4)
      D.fisekler.splice(i, 1);
  for (let i = D.duman.length - 1; i >= 0; i--)
    if (B - D.duman[i].b0 > 2.5)
      D.duman.splice(i, 1);
  // Konfeti parçaları: yukarı fırlar, yerçekimiyle düşer, iki vuruşta söner; sahibi çıktıysa onunla gider.
  for (let i = D.kirpinti.length - 1; i >= 0; i--) {
    const p = D.kirpinti[i];
    if (B - p.b0 > 2.2 || (p.k !== GELIN && !D.oy.has(p.k.id)))
      D.kirpinti.splice(i, 1);
  }
  muzik.sov = B < D.sovBit;
  gelinGuncelle(dt);
  for (const k of D.oy.values()) {
    arabaHazir(k);
    arabaHareket(k, dt);
  }
}
// Gökte bir havai fişek: önce yükselir, sonra açılır. Göğün sağ yarısında patlar (sol üstte sıralama kutusu var);
// y ufkun kaç piksel üstünde açılacağıdır. Görünümü süs olduğu için Math.random kullanır.
function fisekAt(n) {
  for (let i = 0; i < n && D.fisekler.length < 14; i++)
    D.fisekler.push({ x: 280 + Math.random() * 380, y: 70 + Math.random() * 150, b0: B + i * 0.35, renk: KUMAS[Math.floor(Math.random() * KUMAS.length)], renk2: Math.random() < 0.5 ? '#ffd166' : '#f6ecd9', n: 22 + Math.floor(Math.random() * 10), aci: Math.random() * TAU });
}

// Kadraja girmesi gerekenler: gelin arabası (hep), her arabanın önü ve arkası, şov yeri. Kamera konvoyun yalnız
// ön KADRAJ_Z metresini sığdırır; kuyruk ufka doğru küçülerek uzar (sığdırılsaydı öndekiler karıncaya dönerdi).
const KADRAJ_Z = 9.5;
function oyunKamera() {
  const ac = D.sov ? 1.1 : 0, n = [[0.95 * GELIN_OLCEK, GELIN_Z - 0.8 * GELIN_OLCEK], [0.95 * GELIN_OLCEK, GELIN_Z + 0.8 * GELIN_OLCEK]];
  for (const k of D.sira) {
    const x = Math.abs(k.hedefX) + 0.15 + ac, z = Math.min(k.hedefZ, GELIN_Z + KADRAJ_Z);
    n.push(k.hedefZ < GELIN_Z + KADRAJ_Z ? [x, z - 0.75] : [0, z], [k.hedefZ < GELIN_Z + KADRAJ_Z ? x : 0, z + 0.75]);
  }
  if (D.sov)
    n.push([1.1 * SOV_OLCEK, SOV_Z - 0.85 * SOV_OLCEK], [1.1 * SOV_OLCEK, SOV_Z + 0.5]);
  return n;
}
