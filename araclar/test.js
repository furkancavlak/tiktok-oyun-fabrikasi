#!/usr/bin/env node
/* Bütün testler: bir oyun için (node araclar/test.js <ad>) ya da oyunlar/ altındaki her oyun için.
 * Her oyunda sırayla: derleme güncel mi (derle.js --denetle), çekirdek testleri (cekirdek/test/cekirdek.test.js),
 * varsa oyunun kendi testi (oyunlar/<ad>/test.js). En sonda bir kez köprü testi (cekirdek/test/kopru.test.js; kapısı
 * KOPRU_TEST_PORT ile seçilir, verilmezse bu araç boş bir kapı bloğu bulup verir), müzik testi (cekirdek/test/muzik.test.js: bütün oyunların müziği düzgün ve
 * birbirinden farklı mı; dinleme önizlemesi yazar) ve araç testi (cekirdek/test/araclar.test.js: yeni-oyun, derle, kare-cek).
 * --yalniz ile bölümlerin yalnız bir kısmı çalışır, --serit 2 ile iki şerit aynı anda yürür (kullanım metni aşağıda).
 * Her bölümün süresi yazılır. Biri bile kalırsa 1 koduyla çıkar.
 * Tarayıcı: CHROME_PATH ya da playwright'ın Chromium'u (cekirdek/test/ortak.js).
 */
'use strict';
const { spawn, spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const KOK = path.join(__dirname, '..');
const BOLUMLER = ['derle', 'cekirdek', 'oyun', 'kopru', 'muzik', 'araclar'];
const KULLANIM = `Kullanım: node araclar/test.js [<oyun>] [--yalniz <bölümler>] [--serit 1|2]

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
  --serit 2            iki şerit aynı anda: A şeridi oyun başına bölümler (derle, cekirdek, oyun),
                       B şeridi köprü → müzik → araçlar. Her bölümün çıktısı bölüm bitince bütün olarak
                       yazılır. Öntanım 1 şerit (hepsi sırayla). Bilgisayarda başka bir tarayıcı testi
                       çalışıyorsa 1 şerit kullan: iki şerit makineyi yorar, kare süresi ölçümleri kalabilir.
  --hizli              düzenleme döngüsü için: çekirdek testlerindeki uzun dayanıklılık testi (9 × 10 sn)
                       kısa sürümüyle (4 × 10 sn) çalışır; başka hiçbir şey atlanmaz (TEST_KADEME=hizli).
                       Öntanım tam kademedir (TEST_KADEME=tam); sürümden önce bir kez --hizli olmadan çalıştır.
  --yardim             bu metin`;
function kullanim(hata) {
  if (hata) console.error(hata + '\n');
  console.error(KULLANIM);
  process.exit(2);
}

const args = process.argv.slice(2);
let istenen = null, yalniz = null, serit = '1', hizli = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--yardim' || a === '--help' || a === '-h') { console.log(KULLANIM); process.exit(0); }
  else if (a === '--yalniz') { yalniz = args[++i]; if (yalniz === undefined || yalniz.startsWith('--')) kullanim('--yalniz bir bölüm listesi ister.'); }
  else if (a.startsWith('--yalniz=')) yalniz = a.slice('--yalniz='.length);
  else if (a === '--serit') serit = args[++i];
  else if (a.startsWith('--serit=')) serit = a.slice('--serit='.length);
  else if (a === '--hizli') hizli = true;
  else if (a.startsWith('--')) kullanim('Bilinmeyen seçenek: ' + a);
  else if (istenen === null) istenen = a;
  else kullanim('Fazla bağımsız değişken: ' + a);
}
if (serit !== '1' && serit !== '2') kullanim('--serit 1 ya da 2 olur.');
let secili = null;
if (yalniz !== null) {
  secili = new Set(yalniz.split(',').map(s => s.trim()).filter(Boolean));
  const bilinmeyen = [...secili].filter(s => !BOLUMLER.includes(s));
  if (!secili.size || bilinmeyen.length) kullanim('Bilinmeyen bölüm: ' + (bilinmeyen.join(', ') || '(boş liste)'));
}
const ister = b => !secili || secili.has(b);

const oyunlar = istenen ? [istenen] : fs.readdirSync(path.join(KOK, 'oyunlar')).filter(a => fs.existsSync(path.join(KOK, 'oyunlar', a, 'js', '00-ayar.js'))).sort();
// İşler iki şeride ayrılır. A: oyun başına bölümler (yalnız file:// sayfaları açar, kapı kullanmaz).
// B: köprü (KOPRU_TEST_PORT P…P+11), müzik, araçlar (P+12). İki şerit aynı kapıyı tutmaz.
const isler = [];
const ekle = (sr, ad, dosya, ...argv) => isler.push({ no: isler.length, serit: sr, ad, dosya, argv });
for (const ad of oyunlar) {
  if (ister('derle')) ekle('A', ad + ': derleme güncel', 'araclar/derle.js', '--denetle', ad);
  if (ister('cekirdek')) ekle('A', ad + ': çekirdek testleri', 'cekirdek/test/cekirdek.test.js', ad);
  if (ister('oyun') && fs.existsSync(path.join(KOK, 'oyunlar', ad, 'test.js')))
    ekle('A', ad + ': oyun testleri', 'oyunlar/' + ad + '/test.js', ad);
}
if (ister('kopru')) ekle('B', 'köprü testleri', 'cekirdek/test/kopru.test.js', oyunlar.includes('halay') ? 'halay' : oyunlar[0]);
// Müzik: her zaman bütün oyunlar birlikte (oyunların müziği birbirinden farklı mı, ancak hepsine bakınca anlaşılır).
// Önizlemeler: test/cikti/<ad>/muzik-onizleme.wav
if (ister('muzik')) ekle('B', 'müzik testleri (bütün oyunlar)', 'cekirdek/test/muzik.test.js');
if (ister('araclar')) ekle('B', 'araç testleri', 'cekirdek/test/araclar.test.js');

// Kapı: KOPRU_TEST_PORT verildiyse olduğu gibi geçer. Verilmediyse 127.0.0.1'de art arda 16 boş kapı aranır
// (bağlanıp bırakılarak denenir) ve çocuklara verilir: aynı bilgisayarda iki koşu öntanım 8791'de çakışmaz.
// Aralık 20000–39999: bilinen hizmetlerin (8787, 8801 gibi) ve işletim sisteminin geçici kapılarının dışında.
// Başlangıç rastgele: aynı anda başlayan iki koşu aynı bloğu seçmesin.
const KAPI_ADET = 16, KAPI_ALT = 20000, KAPI_UST = 40000;
const kapiDene = p => new Promise(res => {
  const s = require('net').createServer();
  s.once('error', () => res(null));
  s.listen({ port: p, host: '127.0.0.1', exclusive: true }, () => res(s));
});
async function bosKapiBul() {
  const blok = Math.floor((KAPI_UST - KAPI_ALT) / KAPI_ADET), ilk = Math.floor(Math.random() * blok);
  for (let i = 0; i < 200; i++) {
    const p = KAPI_ALT + ((ilk + i) % blok) * KAPI_ADET, tutulan = [];
    let tamam = true;
    for (let k = 0; k < KAPI_ADET && tamam; k++) {
      const s = await kapiDene(p + k);
      if (s) tutulan.push(s); else tamam = false;
    }
    await Promise.all(tutulan.map(s => new Promise(r => s.close(r))));
    if (tamam) return p;
  }
  return null;
}
const env = { ...process.env };
if (hizli) env.TEST_KADEME = 'hizli';
const kademe = env.TEST_KADEME || 'tam';
if (kademe !== 'tam' && kademe !== 'hizli') kullanim('TEST_KADEME "tam" ya da "hizli" olur (verilen: ' + kademe + ').');

const sn = ms => (ms / 1000).toFixed(1);
const sonuc = [];
const bitti = (is, kod, ms) => {
  const d = kod === 0 ? 'GEÇTİ' : 'KALDI';
  sonuc.push({ no: is.no, d, ad: is.ad, ms });
  return '---- ' + is.ad + ': ' + d + ', ' + sn(ms) + ' sn\n';
};
// 1 şerit: çıktı olduğu gibi akar.
function sirayla(is) {
  console.log('\n==== ' + is.ad + ' ====');
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(KOK, is.dosya), ...is.argv], { cwd: KOK, stdio: 'inherit', env });
  process.stdout.write(bitti(is, r.status, Date.now() - t0));
}
// 2 şerit: bölümün çıktısı bir dosyada birikir (dosyaya yazım her işletim sisteminde eşzamanlıdır, çocuk
// process.exit ile çıksa da yarım kalmaz), bölüm bitince bütün olarak yazılır: iki şeridin satırları karışmaz.
async function biriktirerek(is, klasor) {
  const dosya = path.join(klasor, is.no + '.txt'), fd = fs.openSync(dosya, 'w'), t0 = Date.now();
  console.log('» başladı (şerit ' + is.serit + '): ' + is.ad);
  const kod = await new Promise(res => {
    const c = spawn(process.execPath, [path.join(KOK, is.dosya), ...is.argv], { cwd: KOK, stdio: ['ignore', fd, fd], windowsHide: true, env });
    c.on('error', e => { fs.writeSync(fd, 'BAŞLATILAMADI: ' + e.message + '\n'); res(-1); });
    c.on('exit', k => res(k));
  });
  fs.closeSync(fd);
  const metin = fs.readFileSync(dosya, 'utf8');
  fs.unlinkSync(dosya);
  process.stdout.write('\n==== ' + is.ad + ' (şerit ' + is.serit + ') ====\n' + metin + (metin.endsWith('\n') || !metin ? '' : '\n') + bitti(is, kod, Date.now() - t0));
}

(async () => {
  const bas = Date.now();
  console.log('Kademe: ' + (kademe === 'tam' ? 'tam (sürüm öncesi: uzun dayanıklılık testi dahil)' : 'hızlı (uzun dayanıklılık testi kısa; sürümden önce --hizli olmadan bir kez çalıştır)'));
  // Kapı yalnız köprü ve araç testlerine gerekir (müzik testi ve A şeridi kapı açmaz).
  if (isler.some(is => is.dosya === 'cekirdek/test/kopru.test.js' || is.dosya === 'cekirdek/test/araclar.test.js')) {
    if (env.KOPRU_TEST_PORT) console.log('Köprü test kapıları: KOPRU_TEST_PORT=' + env.KOPRU_TEST_PORT + ' (verildiği gibi)');
    else {
      const p = await bosKapiBul();
      if (p) { env.KOPRU_TEST_PORT = String(p); console.log('Köprü test kapıları: ' + p + '–' + (p + KAPI_ADET - 1) + ' (boş bulundu; sabitlemek için KOPRU_TEST_PORT ver)'); }
      else console.log('Köprü test kapıları: art arda ' + KAPI_ADET + ' boş kapı bulunamadı, testlerin öntanımı (8791) kullanılır.');
    }
  }
  if (serit === '1') for (const is of isler) sirayla(is);
  else {
    const klasor = fs.mkdtempSync(path.join(os.tmpdir(), 'test-serit-'));
    const yuru = async sr => { for (const is of isler.filter(x => x.serit === sr)) await biriktirerek(is, klasor); };
    await Promise.all([yuru('A'), yuru('B')]);
    fs.rmdirSync(klasor);
  }
  console.log('\n==== ÖZET ====');
  sonuc.sort((a, b) => a.no - b.no);
  for (const s of sonuc)
    console.log(s.d, '|', s.ad, '|', sn(s.ms), 'sn');
  const kalan = sonuc.filter(s => s.d === 'KALDI').length;
  if (!sonuc.length) console.log('\nSeçilen bölümlerden çalışacak bir şey yok.');
  console.log('Toplam süre: ' + sn(Date.now() - bas) + ' sn' + (serit === '2' ? ' (2 şerit)' : '') + ', kademe ' + kademe);
  console.log(kalan ? '\n' + kalan + ' bölüm kaldı.' : '\nHepsi geçti.');
  process.exit(kalan ? 1 : 0);
})();
