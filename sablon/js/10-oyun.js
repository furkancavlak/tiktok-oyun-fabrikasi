/* ŞABLON OYUN — çekirdeğin istediği her kancanın en yalın hâli. Yeni oyuna buradan başla.
 *
 * Ne olur: yorum yazan izleyici yandan koşarak gelir ve sıralara dizilir; herkes kameraya bakar, müziğin
 * vuruşuyla sallanır. En çok hediye atan (lider) en önde, ortada durur; ayağının altında altın bir halka atar.
 * Hediye atan zıplar; büyük hediyede iki kat yükseğe zıplar ve konfeti yağar. Zemin düz bir gece.
 *
 * Nasıl çalışır (ayrıntı docs/KANCALAR.md):
 *   - Çekirdek bütün olayları (yorum, beğeni, hediye, takip) kendisi işler: kim sahnede, kim lider, coşku.
 *     Oyun yalnız aşağıdaki kancaları yazar. Kancalar İŞLEV BİLDİRİMİ olmalı (function ad() {}), ok işlevi değil.
 *   - Hareket ve süreler vuruşla (B) ölçülür, saniyeyle değil: müzik hızlanınca oyun da hızlanır.
 *   - Dünya ekseni: x sağa, y yukarı, z kameradan uzağa (öndeki küçük z). Birim metre; insan boyu ~1.
 *   - Ekranın üst kısmı sahne yazılarına, alt kısmı (1024. satırdan sonrası) TikTok'un yorum alanına ayrılmıştır;
 *     kamera oyunKamera()'nın verdiği noktaları aradaki şeride kendisi sığdırır.
 *   - Halay oyunu (oyunlar/halay/) aynı kancaların zengin hâlidir: el ele tutuşma, solo, çalgıcılar, dekor.
 */

/* ---- yerleşim ---- */
const SIRA_BASI = 7;     // bir sırada kaç kişi
const ARA_X = 0.74;      // yan yana iki kişi arası (metre)
const ARA_Z = 1.05;      // iki sıra arası (metre)
const LIDER_Z = -1.4;    // lider bu kadar önde durur

// Sıra her değiştiğinde (biri girdi, çıktı, hediye attı) çekirdek çağırır: herkesin hedef yerini hesapla.
// D.sira jetona göre azalan dizidir; D.sira[0] liderdir.
function oyunYerlesim() {
  D.sira.forEach((k, i) => {
    if (i === 0) {
      k.hedefX = 0;
      k.hedefZ = LIDER_Z;
      return;
    }
    // Lider dışındakiler arkada sıra sıra dizilir; tek sıralar yarım adım kayar ki arkadakinin yüzü görünsün.
    const s = Math.floor((i - 1) / SIRA_BASI), n = Math.min(SIRA_BASI, D.sira.length - 1 - s * SIRA_BASI), yer = (i - 1) % SIRA_BASI;
    k.hedefX = (yer - (n - 1) / 2) * ARA_X + (s % 2 ? ARA_X / 2 : 0);
    k.hedefZ = s * ARA_Z;
  });
}
// Yeni izleyici katılınca çekirdek çağırır (oyunYerlesim'den sonra): sahneye dışarıdan, yerinin yanından girsin.
function oyunGiris(k) {
  k.x = (k.hedefX >= 0 ? 1 : -1) * 6;
  k.z = k.hedefZ;
}

/* ---- olaylar ---- */
// Hediye sayıldıktan sonra çağrılır. kademe = OYUN.kademe'den eşleşen kayıt. Zıplama süresini çekirdek
// kendisi kurar (k.zip0 – k.zip1 vuruşları arası); burada yalnız ne kadar yükseğe zıplayacağını seçiyoruz.
// hediye: hangi hediye geldi, { id, ad } ya da bilinmiyorsa null (docs/KANCALAR.md). Ad düz metindir: yalnız fillText.
// Örnek: if (hediye && hediye.id === 'deneme-gul') { … }  Deneme düğmeleri sahte kimlik yollar (en küçük kademe Gül).
function oyunHediye(k, jeton, kademe, hediye) {
  k.buyukZip = kademe.tip === 'buyuk';
  if (k.buyukZip) {
    konfeti(60, 0.7);
    D.sarsinti = 0.5;
  }
}
// Lider değişince çağrılır (eski ve yeni oyuncu kaydı).
function oyunLiderDegisti(eski, yeni) {
  pankart('Yeni lider', yeni.ad);
  konfeti(60, 0.8);
}
// Açılışta, tohum kalabalık D.sira'ya girdikten sonra: herkesi koşturmadan yerine koy.
function oyunBaslat() {
  for (const k of D.sira) {
    k.x = k.hedefX;
    k.z = k.hedefZ;
    k.yer = 1;
    k.yon = Math.PI;
    k.yeni = -9;
  }
}
// Paneldeki "boşalt" düğmesi: oyuncular silindikten sonra oyunun kendi durumunu sıfırla. Bu şablonun ayrıca
// tuttuğu bir durum yok.
function oyunBosalt() { }

/* ---- her kare ---- */
// Hareket: hedefe yürü, kameraya dön, eklemleri kur.
function oyunGuncelle(dt) {
  for (const k of D.oy.values()) {
    // çıkan, girdiği yandan sahneyi terk eder; yeterince uzaklaşınca k.gitti der, çekirdek siler
    const hx = k.cikiyor ? (k.x >= 0 ? 1 : -1) * 7 : k.hedefX, hz = k.cikiyor ? k.z : k.hedefZ;
    const dx = hx - k.x, dz = hz - k.z, uz = Math.hypot(dx, dz);
    if (uz > 0.002) {
      const adim = Math.min(uz, (2.4 + uz * 1.4) * dt);
      k.x += dx / uz * adim;
      k.z += dz / uz * adim;
    }
    k.yer += ((uz < 0.16 && !k.cikiyor ? 1 : 0) - k.yer) * Math.min(1, dt * 7);
    if (k.cikiyor)
      k.gitti = Math.abs(k.x) > 6;
    // yüz kameraya dönük (yürürken gittiği yöne biraz kırılır)
    const bak = Math.atan2(kam.C[0] - k.x + (uz > 0.3 ? dx / uz : 0), kam.C[2] - k.z);
    k.yon += aciFark(k.yon, bak) * Math.min(1, dt * 8);
    // poz: vuruşla sallanan bekleme pozu + hediye zıplaması
    const poz = pozBekle(k);
    const zipla = B >= k.zip0 && B < k.zip1 ? (k.buyukZip ? 0.6 : 0.3) * Math.abs(Math.sin(Math.PI * (B - k.zip0))) : 0;
    poz.hipY += zipla;
    poz.aS[2] += zipla * 0.8;
    poz.aL[2] += zipla * 0.8;
    const W = iskeletKur(k, poz);
    // eller: yanlarda; zıplarken havaya kalkar
    k.j.haR = W(-0.2 - zipla * 0.3, poz.hipY + 0.06 + zipla * 1.2, 0.05);
    k.j.haL = W(0.2 + zipla * 0.3, poz.hipY + 0.06 + zipla * 1.2, 0.05);
    kolKur(k);
  }
}
// Kadraja girmesi gereken yer noktaları [x, z]: herkesin hedef yeri.
function oyunKamera() {
  const n = [[1.5, LIDER_Z], [1.5, 0]];
  for (const k of D.sira)
    n.push([k.hedefX, k.hedefZ]);
  return n;
}
// Arka plan ve zemin: düz gece, gölgeler, liderin altın halkası. Doğrudan c ile çizilir (720×1280 sanal ölçek).
let zeminBoya = null;
function oyunZemin() {
  if (!zeminBoya) {
    zeminBoya = c.createLinearGradient(0, 0, 0, GH);
    zeminBoya.addColorStop(0, RENK.zemin);
    zeminBoya.addColorStop(0.45, RENK.zemin2);
    zeminBoya.addColorStop(1, RENK.zemin);
  }
  c.fillStyle = zeminBoya;
  c.fillRect(0, 0, GW, GH);
  for (const k of D.oy.values())
    golge(k.x, k.z, 0.25 * k.g.boy, 0.13 * k.g.boy);
  if (D.lider) {
    const g = pr([D.lider.x, 0, D.lider.z]);
    if (g.ok) {
      const n = 1 + 0.08 * Math.sin(B * TAU);
      c.strokeStyle = RENK.vurgu;
      c.lineWidth = Math.max(2, g.s * 0.03);
      c.beginPath();
      c.ellipse(g.x, g.y, 0.37 * g.s * n, 0.2 * g.s * n, 0, 0, TAU);
      c.stroke();
    }
  }
}
// Sahnedeki her şey çizim listesine: çekirdek uzaktan yakına sıralayıp çizer, sonra ad etiketlerini koyar.
function oyunCiz() {
  for (const k of D.oy.values())
    insanEkle(k);
}

/* ---- isteğe bağlı kancalar (gerekirse aç) ----
 * function oyunUst(dt) { }        liste çizildikten sonra, etiketlerden önce: uçan nesne, ışık
 * function oyunEkAdlar() { }      izleyici olmayan, etiketi olacak oyuncular: [{ ad, et, ozel: true, … }]
 * function oyunDurum(d) { }       CanliOyun.durum()'a oyuna özgü alan ekler (testler için)
 */
