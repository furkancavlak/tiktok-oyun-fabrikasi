// Testlerin ortak parçaları: tarayıcıyı açar, yolları ve sonuç raporunu sağlar.
// Hangi oyun: komut satırının ilk bağımsız değişkeni (node cekirdek/test/cekirdek.test.js <ad>), verilmezse halay.
'use strict';
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); }
catch (e) { console.error('Testler için playwright gerekli:\n  npm install\n  npx playwright install chromium'); process.exit(2); }

const KOK = path.join(__dirname, '..', '..');
const OYUN_AD = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'halay';
if (!/^[\w-]+$/.test(OYUN_AD)) { console.error('Geçersiz oyun adı: ' + OYUN_AD); process.exit(2); }
const OYUN_HTML = path.join(KOK, 'oyunlar', OYUN_AD, 'oyun.html');
const OYUN = OYUN_HTML; // eski ad
const OYUN_URL = pathToFileURL(OYUN_HTML).href;
const CIKTI = path.join(KOK, 'test', 'cikti', OYUN_AD); // ekran görüntüleri ve ses dosyası buraya yazılır (depoya girmez)
fs.mkdirSync(CIKTI, { recursive: true });
if (!fs.existsSync(OYUN_HTML)) { console.error(path.relative(KOK, OYUN_HTML) + ' yok. Önce derle: node araclar/derle.js ' + OYUN_AD); process.exit(2); }
// Test kademesi (TEST_KADEME, node araclar/test.js --hizli bunu "hizli" yapar). "tam" (öntanım): sürüm öncesi her şey.
// "hizli": düzenleme döngüsü için yalnız uzun dayanıklılık testi kısalır (aynı kod yolu, aynı kontroller); başka hiçbir şey atlanmaz.
const KADEME = process.env.TEST_KADEME || 'tam';
if (KADEME !== 'tam' && KADEME !== 'hizli') { console.error('TEST_KADEME "tam" ya da "hizli" olur (verilen: ' + KADEME + ')'); process.exit(2); }

// CHROME_PATH verilirse o tarayıcı, verilmezse playwright'ın indirdiği Chromium kullanılır.
const tarayici = (ek = []) => playwright.chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', ...ek]
});
// Her sayfada bu bilgisayardaki muzik/ klasörü yok sayılır: testler hep üretilen müzikle çalışır. Web yazı tipi
// (Google Fonts) istenmez: bağlantı yavaşsa ya da yoksa sayfanın load olayı 30 sn bekleyip testi düşürüyordu;
// testler yazı tipine bakmaz, yedek yazı tipiyle çalışır.
const muzikKapat = async p => { await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); await p.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; }); };
async function tarayiciAc(ek = []) {
  const b = await tarayici(ek), ac = b.newPage.bind(b), bag = b.newContext.bind(b);
  b.newPage = async (...a) => { const p = await ac(...a); await muzikKapat(p); return p; };
  b.newContext = async (...a) => { const x = await bag(...a), sa = x.newPage.bind(x); x.newPage = async () => { const p = await sa(); await muzikKapat(p); return p; }; return x; };
  return b;
}

function raporla(sonuc) {
  const kalan = sonuc.filter(s => s[0] === 'KALDI').length;
  for (const s of sonuc) console.log(s[0], '|', s[1], s[2] ? '| ' + s[2].slice(0, 330) : '');
  console.log('\nTOPLAM', sonuc.length, 'kontrol,', kalan, 'kaldı');
  return kalan;
}
function kontrolcu() {
  const sonuc = [];
  const kontrol = (ad, kosul, ayrinti) => sonuc.push([kosul ? 'GEÇTİ' : 'KALDI', ad,
    ayrinti === undefined ? '' : typeof ayrinti === 'string' ? ayrinti : JSON.stringify(ayrinti, (x, v) => typeof v === 'bigint' ? v + 'n' : v)]);
  return { sonuc, kontrol };
}
module.exports = { KOK, OYUN_AD, OYUN_HTML, OYUN, OYUN_URL, CIKTI, KADEME, tarayici: tarayiciAc, raporla, kontrolcu };
