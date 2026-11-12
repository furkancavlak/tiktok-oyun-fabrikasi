/* KARE DÖNGÜSÜ — her karede: müzik saatini oku, oyunu ilerlet, kamerayı ayarla, her şeyi çiz.
 * Sıra (docs/KANCALAR.md): müzik saati (B) → coşkunun sönmesi → boşta kalanı çıkarma → oyunGuncelle →
 * çıkanları silme → kameraSigdir(oyunKamera()) → oyunZemin → oyunCiz → liste → oyunUst → etiketler →
 * konfeti / kalpler → kenar karartması → sahne üstü yazılar.
 */
// İsteğe bağlı kancalar: oyun tanımlamadıysa yok sayılır (typeof, tanımsız adda da hata vermez).
const KANCA_UST = typeof oyunUst === 'function' ? oyunUst : null;
const KANCA_EK_ADLAR = typeof oyunEkAdlar === 'function' ? oyunEkAdlar : null;
let sonKare = 0, kareSay = 0;
// Yalnız testler ve kare-cek için: doluysa B müzikten okunmaz, bu değerde durur (CanliOyun._test.vurusDondur).
let vurusKilit = null;
// Döngü: bir kare hata verse de sonraki kare istenir. Yoksa oyun kodundaki tek bir hata sahneyi sessizce
// dondurur ve neden donduğu görünmez. Hata konsola ve sayfaya (pageerror) bir kez düşer; deneme görünümünde
// sahnenin ortasına da yazılır ki kareye bakan hemen görsün. Yayın görünümünde (#yayin) ekrana yazılmaz.
function kare(simdiMs) {
  try {
    kareIc(simdiMs);
  } catch (e) {
    const ileti = String(e && e.message || e);
    if (kare.hata !== ileti) {
      kare.hata = ileti;
      setTimeout(() => { throw e; });
    }
    if (!document.body.classList.contains('yayin')) {
      c.setTransform(tuval.width / GW, 0, 0, tuval.height / GH, 0, 0);
      c.fillStyle = '#b3261e';
      c.fillRect(0, 560, GW, 150);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '700 30px Rubik, sans-serif';
      c.fillText('Oyun kodunda hata (bu kare çizilemedi)', GW / 2, 605);
      c.font = '500 22px Rubik, sans-serif';
      c.fillText(ileti.slice(0, 58), GW / 2, 648);
      c.fillText(ileti.slice(58, 116), GW / 2, 680);
    }
  }
  requestAnimationFrame(kare);
}
function kareIc(simdiMs) {
  const olcBas = performance.now(), dt = Math.min(0.05, (simdiMs - sonKare) / 1000 || 0.016);
  sonKare = simdiMs;
  zaman += dt;
  kareSay++;
  // müzik saati (oyun muzik.sov'u kendisi açar: doğruysa tempo biraz artar)
  muzik.cosku = D.cosku;
  const hedefCarpan = 1 + 0.3 * D.cosku + (muzik.sov ? 0.08 : 0);
  muzik.carpan += (hedefCarpan - muzik.carpan) * Math.min(1, dt * 1.5);
  muzik.planla(0.2);
  const mt = muzik.simdi();
  B = muzik.beatAt(mt);
  if (vurusKilit !== null)
    B = vurusKilit;
  const ol = muzik.olaylar;
  while (ol.length && ol[0].t <= mt) {
    const e = ol.shift();
    if (e.tip === 'dum')
      calgi.dumP = 1;
    else if (e.tip === 'tek')
      calgi.tekP = 1;
    else
      calgi.hedefPerde = e.deg;
  }
  calgi.dumP *= Math.exp(-dt * 8);
  calgi.tekP *= Math.exp(-dt * 11);
  calgi.perde += ((calgi.hedefPerde ?? 3) - calgi.perde) * Math.min(1, dt * 10);
  // coşku kendiliğinden söner
  D.cosku = Math.max(0, D.cosku - dt * 0.022);
  // Uzun süre sessiz kalan sahneden çıkar (lider ve yıldız hariç). Hediye atanın süresi jetonla uzar.
  if (kareSay % 45 === 0)
    for (const k of D.sira) {
      if (k === D.lider || k.yildiz)
        continue;
      if (zaman - k.son > (D.sira.length > 24 ? 75 : 240) + Math.min(600, k.jeton * 4)) {
        cikar(k);
        break;
      }
    }
  oyunGuncelle(dt);
  // Çıkan oyuncu 1,7 saniye sonra ya da oyun "gitti" (k.gitti) deyince silinir.
  for (const k of D.oy.values())
    if (k.cikiyor && (zaman - k.cikis > 1.7 || k.gitti))
      D.oy.delete(k.id);
  kameraSigdir(oyunKamera(), dt);
  // çizim
  c.setTransform(tuval.width / GW, 0, 0, tuval.height / GH, 0, 0);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  oyunZemin();
  liste.length = 0;
  for (const k of D.oy.values()) {
    k.et = null;
    k.etKutu = null;
  }
  oyunCiz();
  listeCiz();
  if (KANCA_UST)
    KANCA_UST(dt);
  etiketCiz(KANCA_EK_ADLAR ? KANCA_EK_ADLAR() || [] : []);
  parcaCiz(dt);
  kenarKarart();
  // sahne üstü yazılar
  if (D.siraKirli) {
    D.siraKirli = false;
    siraYaz();
  }
  if (kareSay % 6 === 0) {
    gunlukYaz();
    $('cosku-dolu').style.width = Math.round(D.cosku * 100) + '%';
    // Dışarıdan (YouTube) çalan şarkının adı varsa o yazılır; dans o şarkıyı izlemediği için vuruş/dk yazılmaz.
    $('cosku-bilgi').textContent = (muzik.disAd !== null ? muzik.disAd + '\n' : muzik.calanAd() + '\n' + Math.round(muzik.calanBpm()) + ' vuruş/dk · ') + D.sira.length + ' ' + OYUN.yazi.birim;
    const calan = muzik.hazirCal ? muzik.hz.no : -1;
    if (calan !== kare.parca) {
      kare.parca = calan;
      kare.kaynakYaz();
    }
    const secHava = (muzik.bekleyen || muzik.hava).id;
    if (secHava !== kare.hava) {
      kare.hava = secHava;
      for (const x of $('hava-sec').children)
        x.classList.toggle('secili', x.id === 'hava-' + secHava);
    }
  }
  D.kareMs = D.kareMs ? D.kareMs * 0.95 + (performance.now() - olcBas) * 0.05 : performance.now() - olcBas;
}
