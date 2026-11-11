#!/usr/bin/env node
/* Derleme: çekirdek ile bir oyunun parçalarını tek dosyalık sayfaya (oyunlar/<ad>/oyun.html) birleştirir.
 *
 *   node araclar/derle.js <ad>                 oyunlar/<ad>/oyun.html dosyasını yeniden üretir
 *   node araclar/derle.js --hepsi              oyunlar/ altındaki her oyunu üretir (ad verilmezse de böyle)
 *   node araclar/derle.js --denetle [ad]       üretmez; depodaki oyun.html güncel değilse 1 koduyla çıkar
 *                                              (ad verilmezse her oyun denetlenir)
 *   node araclar/derle.js <ad> --parca YOL     <html>/<head>/<body> etiketleri olmadan, başka bir sayfaya
 *                                              gömülebilecek parça üretir
 *
 * Birleştirme sırası (docs/KANCALAR.md): oyunlar/<ad>/js/00-ayar.js → cekirdek/js/*.js → oyunlar/<ad>/js/ altındaki
 * diğer dosyalar (ada göre). Hepsi tek bir kapalı işlevin içine art arda eklenir; parçalar birbirinin adlarını
 * doğrudan görür. Bağımlılığı yoktur.
 */
'use strict';
const fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..');
const oku = y => fs.readFileSync(path.join(KOK, y), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
const KANCALAR = ['oyunBaslat', 'oyunBosalt', 'oyunGiris', 'oyunYerlesim', 'oyunHediye', 'oyunLiderDegisti', 'oyunGuncelle', 'oyunKamera', 'oyunZemin', 'oyunCiz'];
const YAZI_TIPI = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Paytone+One&family=Rubik:wght@400;500;700&display=swap">';
const kacir = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function oyunlar() {
  const kl = path.join(KOK, 'oyunlar');
  return fs.existsSync(kl) ? fs.readdirSync(kl).filter(a => fs.existsSync(path.join(kl, a, 'js', '00-ayar.js'))).sort() : [];
}
function hata(ileti) { console.error(ileti); process.exit(1); }
// Çekirdekteki çalgı takımlarının adları (cekirdek/js/10-muzik.js: TAKIMLAR['ad'] = … ya da TAKIMLAR.ad = …).
function takimlar() {
  const adlar = [];
  for (const r of oku('cekirdek/js/10-muzik.js').matchAll(/^TAKIMLAR(?:\[['"]([\w-]+)['"]\]|\.([\w$]+))\s*=/gm))
    adlar.push(r[1] || r[2]);
  return adlar;
}
// 00-ayar.js'teki OYUN.muzik bildirimine bakar, uyarıları döndürür (kodu çalıştırmaz, metne bakar).
function muzikUyari(ad, ayar) {
  const liste = takimlar(), yol = 'oyunlar/' + ad + '/js/00-ayar.js';
  if (!/^\s*muzik\s*:/m.test(ayar))
    return ['OYUN.muzik yok: oyun öntanımlı davul zurnayı (halayın müziğini) çalar. Her oyunun kendi müziği olur: ' + yol + ' içine muzik: { takim, havalar } yaz. Takımlar: ' + liste.join(', ') + ' (docs/MUZIK.md).'];
  const t = /\btakim\s*:\s*['"]([^'"]*)['"]/.exec(ayar);
  if (!t || !liste.includes(t[1]))
    return ['OYUN.muzik.takim ' + (t ? '"' + t[1] + '" bilinmiyor' : 'yazılmamış') + '. Takımlar: ' + liste.join(', ') + '; ya da çekirdeğe yenisini ekle (docs/MUZIK.md "Yeni takım"). Sayfa açılınca konsola hata düşer, testler kalır.'];
  if (!/\bhavalar\s*:/.test(ayar) || /\bhavalar\s*:\s*\[\s*\]/.test(ayar))
    return ['OYUN.muzik.havalar boş: takımın hazır havaları çalar. Oyununa en az iki özgün hava yaz (docs/MUZIK.md "Ezgi yazımı").'];
  return [];
}

// Bir oyunun tam sayfasını ve gömülebilir parçasını üretir.
function uret(ad) {
  if (!/^[\w-]+$/.test(ad))
    hata('Oyun adı yalnız harf, rakam, - ve _ içerebilir: ' + ad);
  const ok = 'oyunlar/' + ad, jsKlasor = ok + '/js';
  if (!fs.existsSync(path.join(KOK, jsKlasor, '00-ayar.js')))
    hata(ok + '/js/00-ayar.js bulunamadı. Yeni oyun için: node araclar/yeni-oyun.js <ad>');
  let bilgi = {};
  try { bilgi = JSON.parse(oku(ok + '/oyun.json')); }
  catch (e) { hata(ok + '/oyun.json okunamadı: ' + e.message); }
  const parca = d => '/* ── ' + d + ' ── */\n' + oku(d);
  const cekirdek = fs.readdirSync(path.join(KOK, 'cekirdek/js')).filter(d => d.endsWith('.js')).sort().map(d => 'cekirdek/js/' + d);
  const kendi = fs.readdirSync(path.join(KOK, jsKlasor)).filter(d => d.endsWith('.js') && d !== '00-ayar.js').sort().map(d => jsKlasor + '/' + d);
  const sira = [jsKlasor + '/00-ayar.js', ...cekirdek, ...kendi];
  const oyunJs = [jsKlasor + '/00-ayar.js', ...kendi].map(oku).join('\n');
  const eksik = KANCALAR.filter(k => !new RegExp('\\bfunction\\s+' + k + '\\s*\\(').test(oyunJs));
  if (eksik.length)
    hata(ad + ': şu kancalar işlev bildirimi olarak tanımlanmamış: ' + eksik.join(', ') + ' (docs/KANCALAR.md)');
  // Ad çakışması: hepsi tek kapalı işlevde olduğu için oyunun aynı adla yazdığı işlev çekirdeğinkini sessizce ezer
  // (çekirdekte o adı kullanan her yer oyununkini çağırır); const / let çakışması sayfayı hiç açtırmaz.
  const ustAdlar = metin => {
    const m = new Map();
    for (const r of metin.matchAll(/^(function|const|let|class)\s+([\w$]+)/gm))
      m.set(r[2], r[1]);
    return m;
  };
  const cekAd = ustAdlar(cekirdek.map(oku).join('\n')), cakisan = [];
  for (const [isim, tur] of ustAdlar(oyunJs))
    if (cekAd.has(isim))
      cakisan.push([isim, tur, cekAd.get(isim)]);
  const olumcul = cakisan.filter(([, a, b]) => a !== 'function' || b !== 'function');
  if (olumcul.length)
    hata(ad + ': şu adlar çekirdekte de tanımlı, sayfa açılmaz (SyntaxError): ' + olumcul.map(x => x[0]).join(', ') + '. Oyundaki adı değiştir.');
  if (cakisan.length && !sessiz)
    console.warn('UYARI ' + ad + ': şu işlevler çekirdektekini eziyor (çekirdek de oyununkini çağırır): ' + cakisan.map(x => x[0]).join(', ') + '. Bilerek değilse oyundaki adı değiştir.');
  // Müzik: her oyunun kendi müziği olur (docs/MUZIK.md). Bildirim yoksa ya da takım seçilmemişse uyarılır;
  // derleme sürer (bildirmeyen eski oyunlar öntanımlı davul zurnayla çalışmaya devam eder). Denetimde de yazılır.
  for (const u of muzikUyari(ad, oku(jsKlasor + '/00-ayar.js')))
    console.warn('UYARI ' + ad + ': ' + u);
  const js = sira.map(parca).join('\n\n');
  const betik = '<script>\n(() => {\n\'use strict\';\n' + js + '\n})();\n</script>';
  // Kitaplık (isteğe bağlı): oyun.json "kitaplik": ["three"] → kitaplik/three.js, oyunun betiğinden önce kendi
  // <script>'inde. Kitaplık genel bir ad tanımlar (THREE); oyun onu bu adla kullanır. İstemeyen oyunun çıktısı değişmez.
  const kitaplik = bilgi.kitaplik === undefined ? [] : bilgi.kitaplik;
  if (!Array.isArray(kitaplik) || kitaplik.some(a => typeof a !== 'string' || !/^[\w-]+$/.test(a) || !fs.existsSync(path.join(KOK, 'kitaplik', a + '.js'))))
    hata(ok + '/oyun.json: "kitaplik" kitaplik/ altındaki dosyaların adları olmalı (ör. ["three"]; üretmek için araclar/kitaplik-three.js).');
  const onBetik = kitaplik.map(a => {
    const k = oku('kitaplik/' + a + '.js');
    if (/<\/script/i.test(k))
      hata('kitaplik/' + a + '.js içinde "</script" geçiyor: sayfaya gömülemez.');
    return '<script>\n' + k + '\n</script>\n';
  }).join('');
  const BASLIK = '<title>' + kacir(bilgi.ad || ad) + '</title>';
  const stil = oku('cekirdek/stil.css'), sayfa = oku('cekirdek/sayfa.html');
  const tam = `<!DOCTYPE html>
<!-- BU DOSYA ÜRETİLİR. Elle düzenleme: cekirdek/ ya da oyunlar/${ad}/js/ altını değiştir, sonra "node araclar/derle.js ${ad}" çalıştır. -->
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${BASLIK}
${YAZI_TIPI}
<style>
body{margin:0}[hidden]{display:none!important}
${stil}
</style>
</head>
<body>
${sayfa}

${onBetik}${betik}
</body>
</html>
`;
  const gomulu = `${BASLIK}
<meta name="claude:viewport-fit-sides" content="cover">
${YAZI_TIPI}
<style>
${stil}
</style>

${sayfa}

${onBetik}${betik}
`;
  return { tam, gomulu, hedef: path.join(KOK, ok, 'oyun.html'), goreli: ok + '/oyun.html' };
}

const args = process.argv.slice(2), bayrak = a => args.includes(a), adlar = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--parca');
const sessiz = bayrak('--denetle'); // denetimde ad uyarısı tekrar yazılmaz
if (bayrak('--denetle')) {
  const liste = adlar.length ? adlar : oyunlar();
  let eski = 0;
  for (const ad of liste) {
    const u = uret(ad), var_ = fs.existsSync(u.hedef) ? fs.readFileSync(u.hedef, 'utf8').replace(/\r\n/g, '\n') : '';
    if (var_ !== u.tam) {
      console.error(u.goreli + ' güncel değil. "node araclar/derle.js ' + ad + '" çalıştırıp sonucu da işle (commit).');
      eski++;
    }
    else
      console.log(u.goreli + ' güncel.');
  }
  process.exit(eski ? 1 : 0);
}
if (bayrak('--parca')) {
  const yol = args[args.indexOf('--parca') + 1];
  if (!yol || adlar.length !== 1)
    hata('Kullanım: node araclar/derle.js <ad> --parca yol.html');
  fs.writeFileSync(path.resolve(yol), uret(adlar[0]).gomulu);
  console.log('parça yazıldı:', yol);
}
else {
  const liste = bayrak('--hepsi') || !adlar.length ? oyunlar() : adlar;
  if (!liste.length)
    hata('Derlenecek oyun yok: oyunlar/<ad>/js/00-ayar.js bulunamadı.');
  for (const ad of liste) {
    const u = uret(ad);
    fs.writeFileSync(u.hedef, u.tam);
    console.log(u.goreli + ' yazıldı (' + u.tam.length + ' karakter).');
  }
}
