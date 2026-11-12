#!/usr/bin/env node
/* Bütün testler: bir oyun için (node araclar/test.js <ad>) ya da oyunlar/ altındaki her oyun için.
 * Her oyunda sırayla: derleme güncel mi (derle.js --denetle), çekirdek testleri (cekirdek/test/cekirdek.test.js),
 * varsa oyunun kendi testi (oyunlar/<ad>/test.js). En sonda bir kez köprü testi (cekirdek/test/kopru.test.js; kapısı
 * KOPRU_TEST_PORT ile seçilir, öntanım 8791), müzik testi (cekirdek/test/muzik.test.js: bütün oyunların müziği düzgün ve
 * birbirinden farklı mı; dinleme önizlemesi yazar) ve araç testi (cekirdek/test/araclar.test.js: yeni-oyun, derle, kare-cek).
 * --yalniz ile bölümlerin yalnız bir kısmı çalışır (kullanım metni aşağıda). Her bölümün süresi yazılır.
 * Biri bile kalırsa 1 koduyla çıkar. Tarayıcı: CHROME_PATH ya da playwright'ın Chromium'u (cekirdek/test/ortak.js).
 */
'use strict';
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..');
const BOLUMLER = ['derle', 'cekirdek', 'oyun', 'kopru', 'muzik', 'araclar'];
const KULLANIM = `Kullanım: node araclar/test.js [<oyun>] [--yalniz <bölümler>]

  <oyun>               yalnız bu oyun (verilmezse oyunlar/ altındaki bütün oyunlar). Köprü, müzik ve araç
                       testleri oyun verilse de bir kez çalışır; istemiyorsan --yalniz kullan.
  --yalniz <liste>     yalnız bu bölümler, virgülle ayrılır:
                         derle     derleme güncel mi (her oyun)
                         cekirdek  çekirdek testleri (her oyun)
                         oyun      oyunun kendi testi (her oyun, varsa)
                         kopru     köprü testleri (bir kez)
                         muzik     müzik testleri, bütün oyunlar birlikte (bir kez)
                         araclar   araç testleri (bir kez)
                       örnek: node araclar/test.js halay --yalniz cekirdek,oyun
  --yardim             bu metin`;
function kullanim(hata) {
  if (hata) console.error(hata + '\n');
  console.error(KULLANIM);
  process.exit(2);
}

const args = process.argv.slice(2);
let istenen = null, yalniz = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--yardim' || a === '--help' || a === '-h') { console.log(KULLANIM); process.exit(0); }
  else if (a === '--yalniz') { yalniz = args[++i]; if (yalniz === undefined || yalniz.startsWith('--')) kullanim('--yalniz bir bölüm listesi ister.'); }
  else if (a.startsWith('--yalniz=')) yalniz = a.slice('--yalniz='.length);
  else if (a.startsWith('--')) kullanim('Bilinmeyen seçenek: ' + a);
  else if (istenen === null) istenen = a;
  else kullanim('Fazla bağımsız değişken: ' + a);
}
let secili = null;
if (yalniz !== null) {
  secili = new Set(yalniz.split(',').map(s => s.trim()).filter(Boolean));
  const bilinmeyen = [...secili].filter(s => !BOLUMLER.includes(s));
  if (!secili.size || bilinmeyen.length) kullanim('Bilinmeyen bölüm: ' + (bilinmeyen.join(', ') || '(boş liste)'));
}
const ister = b => !secili || secili.has(b);

const oyunlar = istenen ? [istenen] : fs.readdirSync(path.join(KOK, 'oyunlar')).filter(a => fs.existsSync(path.join(KOK, 'oyunlar', a, 'js', '00-ayar.js'))).sort();
const sn = ms => (ms / 1000).toFixed(1);
const sonuc = [], bas = Date.now();
function calistir(ad, dosya, ...argv) {
  console.log('\n==== ' + ad + ' ====');
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(KOK, dosya), ...argv], { cwd: KOK, stdio: 'inherit' });
  const d = r.status === 0 ? 'GEÇTİ' : 'KALDI', ms = Date.now() - t0;
  sonuc.push([d, ad, ms]);
  console.log('---- ' + ad + ': ' + d + ', ' + sn(ms) + ' sn');
}
for (const ad of oyunlar) {
  if (ister('derle')) calistir(ad + ': derleme güncel', 'araclar/derle.js', '--denetle', ad);
  if (ister('cekirdek')) calistir(ad + ': çekirdek testleri', 'cekirdek/test/cekirdek.test.js', ad);
  if (ister('oyun') && fs.existsSync(path.join(KOK, 'oyunlar', ad, 'test.js')))
    calistir(ad + ': oyun testleri', 'oyunlar/' + ad + '/test.js', ad);
}
if (ister('kopru')) calistir('köprü testleri', 'cekirdek/test/kopru.test.js', oyunlar.includes('halay') ? 'halay' : oyunlar[0]);
// Müzik: her zaman bütün oyunlar birlikte (oyunların müziği birbirinden farklı mı, ancak hepsine bakınca anlaşılır).
// Önizlemeler: test/cikti/<ad>/muzik-onizleme.wav
if (ister('muzik')) calistir('müzik testleri (bütün oyunlar)', 'cekirdek/test/muzik.test.js');
if (ister('araclar')) calistir('araç testleri', 'cekirdek/test/araclar.test.js');
console.log('\n==== ÖZET ====');
for (const [d, ad, ms] of sonuc)
  console.log(d, '|', ad, '|', sn(ms), 'sn');
const kalan = sonuc.filter(s => s[0] === 'KALDI').length;
if (!sonuc.length) console.log('\nSeçilen bölümlerden bu oyunda çalışacak bir şey yok.');
console.log('Toplam süre: ' + sn(Date.now() - bas) + ' sn');
console.log(kalan ? '\n' + kalan + ' bölüm kaldı.' : '\nHepsi geçti.');
process.exit(kalan ? 1 : 0);
