#!/usr/bin/env node
/*
 * Windows hazır paketi: içinde kendi Node'u ve TikTok kütüphanesi olan, hiçbir şey kurmadan çalışan sürüm.
 * Yalnız bakımcı çalıştırır (yayıncının bilgisayarında değil):
 *
 *   node araclar/surum.js                          indirir, doğrular, paketi ve ZIP'i dist/ altında yeni bir klasöre yazar
 *   node araclar/surum.js --node-zip <yol>         Node arşivini indirmek yerine daha önce indirileni kullanır
 *                                                  (yine sha256 denetlenir)
 *
 * Çıktı: dist/surum-<tarih>-<işleme>/tiktok-oyun-fabrikasi/ (paketin kendisi) ve yanında
 * tiktok-oyun-fabrikasi-<node sürümü>-windows-x64.zip (içinde tek üst klasör: tiktok-oyun-fabrikasi/).
 * Paketin içi:
 *   - deponun son işlemesinin (HEAD) ağacı, tam olarak "git archive HEAD" verdiği gibi: klasörde duran izlenmeyen
 *     dosyalar (.env, notlar) ve işlenmemiş değişiklikler pakete GİRMEZ. Çalışma ağacı temiz değilse (işlenmemiş
 *     değişiklik ya da izlenmeyen dosya varsa) araç durur; --kirli-izin verilirse yine yalnız HEAD paketlenir ve SURUM.txt
 *     bunu yazar;
 *   - node\node.exe ve node\LICENSE: araclar/surum-node.json'da sabitlenmiş resmî Node arşivinden; arşivin sha256'sı
 *     tutmazsa araç durur, hiçbir şey paketlenmez. npm pakete girmez;
 *   - node_modules\: yalnız üretim bağımlılıkları, deponun package-lock.json'uyla paketin kendi kopyasında kurulur
 *     (npm ci --omit=dev; npm yalnız o klasörde çalışır, kendi package.json'u olduğu için üst klasöre tırmanmaz);
 *   - SURUM.txt: Node sürümü, kütüphane sürümü, tarih, git işlemesi.
 * Araç hiçbir şey silmez: her çalıştırma yeni bir klasöre yazar, eskiler kalır (dist/ depoya girmez).
 *
 * Testler için (ağa çıkmadan): --surum-json <yol> başka bir sabit dosya, --moduller <klasör> npm yerine hazır bir
 * node_modules kopyalanır, --zipsiz ZIP yazılmaz, --cikti <klasör> dist/ yerine o klasörün içine yazılır, --depo <klasör>
 * bu deponun yerine başka bir git deposundan (ör. geçici bir klondan) paketler.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https'), cp = require('child_process');

const KOK = path.join(__dirname, '..');
const { zipYaz } = require('./zip');
const UST = 'tiktok-oyun-fabrikasi';

function sha256Dosya(yol) {
  const h = crypto.createHash('sha256'), fd = fs.openSync(yol, 'r'), tampon = Buffer.alloc(1 << 20);
  try { let n; while ((n = fs.readSync(fd, tampon, 0, tampon.length, null)) > 0) h.update(tampon.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
}
// Dosyanın sha256'sı sabitlenen değerle aynı değilse hata fırlatır (araç orada durur).
function hashDogrula(yol, beklenen) {
  const gercek = sha256Dosya(yol);
  if (!/^[0-9a-f]{64}$/.test(String(beklenen)) || gercek !== beklenen)
    throw new Error('SHA-256 tutmuyor: ' + path.basename(yol) + '\n  beklenen: ' + beklenen + '\n  gelen:    ' + gercek + '\nDosya bozuk ya da değiştirilmiş; paketlenmedi.');
  return gercek;
}
// Paket klasörünün düzeni: gerekenler var mı, olmaması gerekenler yok mu. Eksikleri dizi olarak döndürür.
function paketDenetle(kl) {
  const sorun = [], var_ = y => fs.existsSync(path.join(kl, y));
  for (const y of ['node/node.exe', 'node/LICENSE', 'node_modules/tiktok-live-connector/package.json', 'kopru.js', 'package.json', 'BASLAT.bat', 'BASLAT.command',
    'BASLAT.sh', 'cekirdek/node-yok.html', 'cekirdek/ana-sayfa.html', 'SURUM.txt', 'oyunlar/halay/oyun.html', 'oyunlar/konvoy/oyun.html', 'oyunlar/vur-duzelsin/oyun.html'])
    if (!var_(y)) sorun.push('eksik: ' + y);
  for (const y of ['.git', 'test/cikti', 'dist', 'node_modules/playwright', 'node_modules/playwright-core', 'node/npm', 'node/npm.cmd', 'node/node_modules'])
    if (var_(y)) sorun.push('olmamalı: ' + y);
  // Geliştirme bağımlılıkları (package.json devDependencies) node_modules'a girmemiş olmalı
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(kl, 'package.json'), 'utf8'));
    for (const d of Object.keys(pj.devDependencies || {})) if (var_('node_modules/' + d)) sorun.push('geliştirme bağımlılığı pakette: ' + d);
  } catch (e) { sorun.push('package.json okunamadı'); }
  return sorun;
}
function indir(url, hedef, kalan = 5) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'user-agent': 'tiktok-oyun-fabrikasi-surum' } }, y => {
      if ([301, 302, 303, 307, 308].includes(y.statusCode) && y.headers.location && kalan > 0) { y.resume(); res(indir(new URL(y.headers.location, url).href, hedef, kalan - 1)); return; }
      if (y.statusCode !== 200) { y.resume(); rej(new Error('İndirilemedi (' + y.statusCode + '): ' + url)); return; }
      const toplam = +y.headers['content-length'] || 0, d = fs.createWriteStream(hedef); let gelen = 0, son = 0;
      y.on('data', p => { gelen += p.length; if (Date.now() - son > 5000) { son = Date.now(); process.stdout.write('  ' + Math.round(gelen / 1048576) + (toplam ? ' / ' + Math.round(toplam / 1048576) : '') + ' MB\n'); } });
      y.pipe(d); d.on('finish', () => d.close(() => res(hedef))); d.on('error', rej); y.on('error', rej);
    }).on('error', rej);
  });
}
const calistir = (komut, argv, sec) => {
  const r = cp.spawnSync(komut, argv, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20, ...sec });
  if (r.error || r.status !== 0) throw new Error(komut + ' ' + argv.join(' ') + ' başarısız (' + (r.error ? r.error.message : 'kod ' + r.status) + ')\n' + String(r.stderr || '').slice(-1500));
  return r.stdout;
};
const kopyala = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
function klasorKopyala(a, b) { fs.cpSync(a, b, { recursive: true }); }

async function main() {
  if (process.platform !== 'win32') throw new Error('Bu araç Windows paketini üretir ve Windows\'ta çalışır (Windows Node arşivi tar.exe ile açılır, ZIP Expand-Archive ile denetlenir).');
  const args = process.argv.slice(2), secenek = ad => { const i = args.indexOf(ad); return i >= 0 ? args[i + 1] : null; };
  const sabit = JSON.parse(fs.readFileSync(secenek('--surum-json') || path.join(__dirname, 'surum-node.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(sabit.surum) || !sabit.url || !sabit.dosya) throw new Error('surum-node.json eksik ya da bozuk.');
  const DEPO = path.resolve(secenek('--depo') || KOK);
  const islem = calistir('git', ['rev-parse', 'HEAD'], { cwd: DEPO }).trim();
  if (!/^[0-9a-f]{40}$/.test(islem)) throw new Error('Git işlemesi okunamadı: ' + DEPO);
  // İşlenmemiş değişiklik ya da izlenmeyen dosya (yoksayılanlar hariç) varsa dur: yanlışlıkla neyin yayımlandığı belirsiz kalmasın.
  const durum = calistir('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: DEPO }).trim(), kirli = durum !== '';
  if (kirli && !args.includes('--kirli-izin'))
    throw new Error('Çalışma ağacı temiz değil (işlenmemiş değişiklik ya da izlenmeyen dosya var):\n  ' + durum.split(/\r?\n/).slice(0, 15).join('\n  ') +
      '\nÖnce işle (commit) ya da kaldır. Yine de son işlemeyi (HEAD) paketlemek için: --kirli-izin');
  const zaman = new Date(), damga = zaman.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const kok = path.join(secenek('--cikti') || path.join(KOK, 'dist'), 'surum-' + damga + '-' + islem.slice(0, 7) + '-' + process.pid);
  const paket = path.join(kok, UST), gecici = path.join(kok, '_gecici');
  fs.mkdirSync(paket, { recursive: true }); fs.mkdirSync(gecici, { recursive: true });
  console.log('\n  Paket klasörü: ' + paket);

  // 1. Node arşivi: indir (ya da verileni kullan), sha256'sını sabitlenmiş değerle karşılaştır; tutmazsa dur.
  let arsiv = secenek('--node-zip');
  if (!arsiv) { arsiv = path.join(gecici, sabit.dosya); console.log('  Node indiriliyor: ' + sabit.url); await indir(sabit.url, arsiv); }
  console.log('  Node arşivi denetleniyor (SHA-256)…');
  hashDogrula(arsiv, sabit.sha256);
  console.log('  SHA-256 tuttu: ' + sabit.sha256);

  // 2. Son işlemenin ağacı (git archive HEAD): yalnız işlenmiş dosyalar, işlendiği hâlleriyle
  const tarYol = path.join(gecici, 'kaynak.tar');
  calistir('git', ['archive', '--format=tar', '-o', tarYol, islem], { cwd: DEPO });
  calistir(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', tarYol, '-C', paket]);
  const n = calistir('git', ['ls-tree', '-r', '--name-only', '-z', islem], { cwd: DEPO }).split('\0').filter(Boolean).length;
  console.log('  ' + n + ' depo dosyası (işleme ' + islem.slice(0, 7) + ') açıldı.');

  // 3. node\node.exe ve LICENSE (arşivden; npm alınmaz)
  const ic = sabit.dosya.replace(/\.zip$/, '');
  calistir(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', arsiv, '-C', gecici, ic + '/node.exe', ic + '/LICENSE']);
  kopyala(path.join(gecici, ic, 'node.exe'), path.join(paket, 'node', 'node.exe'));
  kopyala(path.join(gecici, ic, 'LICENSE'), path.join(paket, 'node', 'LICENSE'));
  const surumGercek = calistir(path.join(paket, 'node', 'node.exe'), ['-v']).trim();
  if (surumGercek !== 'v' + sabit.surum) throw new Error('Paketteki node.exe beklenen sürüm değil: ' + surumGercek);

  // 4. node_modules: yalnız üretim bağımlılıkları, paketin kendi kopyasında (kendi package.json + package-lock.json)
  const moduller = secenek('--moduller');
  if (moduller) klasorKopyala(moduller, path.join(paket, 'node_modules'));
  else {
    console.log('  Üretim bağımlılıkları kuruluyor (npm ci --omit=dev, yalnız paket klasöründe)…');
    calistir('npm ci --omit=dev --no-audit --no-fund --ignore-scripts', [], { cwd: paket, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const kutPj = JSON.parse(fs.readFileSync(path.join(paket, 'node_modules', 'tiktok-live-connector', 'package.json'), 'utf8'));
  const yukle = cp.spawnSync(path.join(paket, 'node', 'node.exe'), ['-e', "require('tiktok-live-connector');console.log('tamam')"], { cwd: paket, encoding: 'utf8', windowsHide: true });
  if (!moduller && !/tamam/.test(yukle.stdout)) throw new Error('Paketteki node.exe kütüphaneyi yükleyemedi:\n' + yukle.stderr);

  // 5. SURUM.txt
  fs.writeFileSync(path.join(paket, 'SURUM.txt'), [
    'TikTok Oyun Fabrikası - Windows hazır paketi', '',
    'Node.js:            ' + sabit.surum + ' (node\\node.exe, resmî arşiv ' + sabit.dosya + ', SHA-256 ' + sabit.sha256 + ')',
    'tiktok-live-connector: ' + kutPj.version, 'Paketlendiği tarih:  ' + zaman.toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
    'Git işlemesi:       ' + islem + (kirli ? ' (--kirli-izin: çalışma ağacında işlenmemiş değişiklik ya da izlenmeyen dosya vardı; pakete yalnız bu işleme girdi)' : ''), '',
    'Kurulum gerekmez: klasörü bir yere çıkar, BASLAT.bat dosyasına çift tıkla.', ''
  ].join('\r\n'));

  const sorun = paketDenetle(paket);
  if (sorun.length) throw new Error('Paket düzeni eksik:\n  ' + sorun.join('\n  '));
  console.log('  Paket düzeni denetlendi.');
  if (args.includes('--zipsiz')) { console.log('\n  ZIP yazılmadı (--zipsiz).\n'); return { kok, paket }; }

  // 6. ZIP: kendi yazıcımız (araclar/zip.js; içinde tek üst klasör, BASLAT.command / BASLAT.sh 0755). Sonra Windows'un
  // kendi açıcısıyla (Expand-Archive) yeni bir klasöre açılıp dosya sayısı ve düzeni karşılaştırılır.
  const zip = path.join(kok, UST + '-' + sabit.surum + '-windows-x64.zip');
  console.log('  ZIP yazılıyor…');
  zipYaz(zip, paket, UST, { calistirilabilir: ['BASLAT.command', 'BASLAT.sh'] });
  const acik = path.join(kok, '_zip-dogrulama');
  calistir('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath "' + zip + '" -DestinationPath "' + acik + '"']);
  const say = kl => fs.readdirSync(kl, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? say(path.join(kl, e.name)) : 1), 0);
  const ustler = fs.readdirSync(acik), aSorun = ustler.length === 1 && ustler[0] === UST ? paketDenetle(path.join(acik, UST)) : ['üst klasör: ' + ustler.join(', ')];
  if (aSorun.length || say(path.join(acik, UST)) !== say(paket)) throw new Error('ZIP Windows\'un açıcısıyla açılınca paketle aynı çıkmadı:\n  ' + aSorun.join('\n  '));
  console.log('  ZIP Windows\'un kendi açıcısıyla (Expand-Archive) açıldı: tek üst klasör, ' + say(paket) + ' dosya, düzen aynı (' + acik + ').');
  const boyut = fs.statSync(zip).size, ozet = sha256Dosya(zip);
  console.log('\n  ZIP:     ' + zip + '\n  Boyut:   ' + boyut + ' bayt (' + (boyut / 1048576).toFixed(1) + ' MB)\n  SHA-256: ' + ozet + '\n');
  return { kok, paket, zip, boyut, ozet };
}

module.exports = { sha256Dosya, hashDogrula, paketDenetle };
if (require.main === module) main().catch(e => { console.error('\n  DURDU: ' + e.message + '\n'); process.exit(1); });
