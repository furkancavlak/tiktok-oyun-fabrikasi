// Araç testleri: yeni-oyun.js, derle.js'in ad çakışması denetimi, kare-cek.js'in ölçüm ve hareket çıktısı.
// Deponun bir kopyası (araclar, cekirdek, sablon) geçici klasörde kurulur; depodaki oyunlara dokunulmaz.
// Çalıştırma: node cekirdek/test/araclar.test.js   (node araclar/test.js en sonda bir kez çalıştırır)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const { KOK, raporla, kontrolcu } = require('./ortak');
const { sonuc, kontrol } = kontrolcu();
const GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-araclar-'));
const kopyala = (a, b) => fs.cpSync(path.join(KOK, a), path.join(GECICI, b || a), { recursive: true, filter: k => !/[\\/](oyun\.html)$/.test(k) || k.includes('sablon') });
for (const d of ['araclar', 'cekirdek', 'sablon'])
  kopyala(d);
const calis = (dosya, ...args) => spawnSync(process.execPath, [path.join(GECICI, dosya), ...args], { cwd: GECICI, encoding: 'utf8', env: { ...process.env, NODE_PATH: path.join(KOK, 'node_modules') } });

// yeni-oyun: üretilen 10-oyun.js açıkça "senin dosyan" der, oyun derlenir
const y = calis('araclar/yeni-oyun.js', 'deneme-oyun', 'Deneme Oyunu');
const oyunJs = path.join(GECICI, 'oyunlar/deneme-oyun/js/10-oyun.js'), ilk = fs.existsSync(oyunJs) ? fs.readFileSync(oyunJs, 'utf8').slice(0, 600) : '';
kontrol('yeni-oyun: oyun kurulur ve derlenir', y.status === 0 && fs.existsSync(path.join(GECICI, 'oyunlar/deneme-oyun/oyun.html')), (y.stderr || '').slice(0, 200));
kontrol('yeni-oyun: üretilen js/10-oyun.js en başta bunun oyunun kendi dosyası olduğunu, üstüne yazılacağını söyler', /BU DOSYA ARTIK SENİN OYUNUN/.test(ilk) && /SİLİP BAŞTAN YAZ/.test(ilk) && /yalnız BİR dosyada/.test(ilk), ilk.split('\n').slice(0, 3).join(' / '));
kontrol('yeni-oyun: şablon klasöründeki asıl dosya değişmez', !/BU DOSYA ARTIK/.test(fs.readFileSync(path.join(GECICI, 'sablon/js/10-oyun.js'), 'utf8')));
kontrol('yeni-oyun: komutun çıktısı 10-oyun.js\'in üstüne yazılacağını söyler', /SENİN DOSYAN/.test(y.stdout), y.stdout.split('\n').filter(s => /10-oyun/.test(s)).join(' / '));
// Ana sayfadaki kartın tek cümlesi: oyun.json'a aciklama alanı yazılır, komut onu oyuna göre yazmayı hatırlatır
const yBilgi = (() => { try { return JSON.parse(fs.readFileSync(path.join(GECICI, 'oyunlar/deneme-oyun/oyun.json'), 'utf8')); } catch (e) { return {}; } })();
kontrol('yeni-oyun: oyun.json ana sayfa kartı için aciklama alanıyla gelir, çıktı onu yazmayı hatırlatır', yBilgi.ad === 'Deneme Oyunu' && typeof yBilgi.aciklama === 'string' && yBilgi.aciklama.length > 0 && /aciklama/.test(y.stdout), yBilgi);

// derle: çekirdekteki adla aynı işlev uyarı verir, aynı adla const sayfayı açtırmayacağı için derlemeyi durdurur
const ek = path.join(GECICI, 'oyunlar/deneme-oyun/js/90-cakisma.js');
fs.writeFileSync(ek, 'function kutuCiz() { }\n');
const d1 = calis('araclar/derle.js', 'deneme-oyun');
kontrol('derle: oyundaki işlev çekirdektekiyle aynı adı taşıyınca uyarır (derleme sürer)', d1.status === 0 && /kutuCiz/.test(d1.stderr) && /eziyor/.test(d1.stderr), d1.stderr.trim().slice(0, 160));
fs.writeFileSync(ek, 'const ETIKET = 1;\n');
const d2 = calis('araclar/derle.js', 'deneme-oyun');
kontrol('derle: çekirdekteki adla const tanımlanınca adını söyleyip durur', d2.status === 1 && /ETIKET/.test(d2.stderr), d2.stderr.trim().slice(0, 160));
fs.unlinkSync(ek);
calis('araclar/derle.js', 'deneme-oyun');

// müzik: şablondan kurulan oyun takımını seçmeye zorlanır; bildirimi olmayan, takımı bilinmeyen ya da havası boş
// oyunda derleme uyarır (derleme sürer). Her oyunun kendi müziği olur (docs/MUZIK.md).
const ayarYol = path.join(GECICI, 'oyunlar/deneme-oyun/js/00-ayar.js'), ayarIlk = fs.readFileSync(ayarYol, 'utf8');
kontrol('yeni-oyun: şablon müziği seçtirir (takim "SEC"), derleme takımın seçilmediğini ve takımları söyler', /muzik:\s*\{\s*takim:\s*'SEC'/.test(ayarIlk) && /UYARI deneme-oyun: OYUN\.muzik\.takim "SEC" bilinmiyor.*davul-zurna, dugun, mac/.test(y.stderr) && /MÜZİK/.test(y.stdout), (y.stderr.match(/UYARI deneme-oyun: OYUN\.muzik[^\n]*/) || ['uyarı yok'])[0].slice(0, 160));
const muzikDene = metin => { fs.writeFileSync(ayarYol, metin); return calis('araclar/derle.js', 'deneme-oyun'); };
const mYok = muzikDene(ayarIlk.replace(/\n\s*muzik:\s*\{[^\n]*\}/, '')), mBos = muzikDene(ayarIlk.replace("takim: 'SEC'", "takim: 'dugun'")), mTam = muzikDene(fs.readFileSync(path.join(KOK, 'oyunlar/konvoy/js/00-ayar.js'), 'utf8'));
kontrol('derle: OYUN.muzik bildirmeyen oyun için uyarır (öntanım davul zurna), derleme sürer', mYok.status === 0 && /UYARI deneme-oyun: OYUN\.muzik yok/.test(mYok.stderr), mYok.stderr.trim().slice(0, 160));
kontrol('derle: takım seçilip hava yazılmayınca uyarır; kendi havaları olan oyunda müzik uyarısı yok', mBos.status === 0 && /havalar boş/.test(mBos.stderr) && mTam.status === 0 && !/OYUN\.muzik/.test(mTam.stderr), [mBos.stderr.trim().slice(0, 100), mTam.stderr.trim().slice(0, 100)]);
muzikDene(ayarIlk);

// kare-cek: şablondan kurulan oyunda ölçüm dosyaları, hareket şeridi; önerilen ayarlarla ad sıralama kutusuna girmez
const k = calis('araclar/kare-cek.js', 'deneme-oyun');
const ck = path.join(GECICI, 'test/cikti/deneme-oyun'), json = e => { try { return JSON.parse(fs.readFileSync(path.join(ck, 'kare-' + e + '.json'), 'utf8')); } catch (err) { return null; } };
const o9 = json('9'), od = json('dolu');
kontrol('kare-cek: her kare için ölçüm (yüz yarıçapı, ad kutusu, sahne yazıları) yazar', k.status === 0 && o9 && od && o9.kisiler.length === 9 && o9.kisiler.every(x => x.bas && x.bas.r > 5) && o9.kisiler.filter(x => x.etiket).length >= 5 && o9.kutular.sira, (k.stdout + k.stderr).trim().split('\n').slice(-6).join(' / ').slice(0, 300));
kontrol('kare-cek: hareket şeridi (kare-hareket.png, 8 kare) yazar', fs.existsSync(path.join(ck, 'kare-hareket.png')) && fs.statSync(path.join(ck, 'kare-hareket.png')).size > 50000);
const kesis = (a, b) => a && b && a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
const girenler = od ? od.kisiler.filter(x => kesis(x.etiket, od.kutular.sira)).map(x => x.ad) : ['ölçüm yok'];
kontrol('Şablonun önerilen ayarlarıyla (etiket.ustSinir) tam kalabalıkta hiçbir ad sıralama kutusuna girmez', girenler.length === 0 && !/sıralama kutusuna/.test(k.stdout), girenler);

// Node.js yoksa açılan yardım sayfası: depoda ve yayıncı paketinde
const nodeYok = path.join(KOK, 'cekirdek', 'node-yok.html'), nyMetin = fs.existsSync(nodeYok) ? fs.readFileSync(nodeYok, 'utf8') : '';
kontrol('Node.js yardım sayfası depoda var: nodejs.org bağlantısı, LTS, BASLAT.bat yeniden; dış betik yok', /href="https:\/\/nodejs\.org"/.test(nyMetin) && /LTS/.test(nyMetin) && /BASLAT\.bat/.test(nyMetin) && !/<script[^>]*\ssrc=/i.test(nyMetin));
for (const d of ['kopru.js', 'BASLAT.bat', 'BASLAT.command', 'BASLAT.sh', 'package.json']) fs.copyFileSync(path.join(KOK, d), path.join(GECICI, d));
const pk = calis('araclar/paket.js', 'deneme-oyun'), pkKl = path.join(GECICI, 'dist', 'deneme-oyun');
const pkDosya = fs.existsSync(pkKl) ? fs.readdirSync(pkKl).sort() : [];
kontrol('paket: BASLAT.bat, köprü, ana sayfa ve Node.js yardım sayfası pakette; OKU.txt açılış ekranını anlatır', pk.status === 0 && ['BASLAT.bat', 'ana-sayfa.html', 'kopru.js', 'node-yok.html', 'oyun.html', 'oyun.json'].every(d => pkDosya.includes(d)) && /açılış ekranı/.test(fs.readFileSync(path.join(pkKl, 'OKU.txt'), 'utf8')), { kod: pk.status, dosyalar: pkDosya, hata: (pk.stderr || '').slice(0, 200) });

// BASLAT.bat (yalnız Windows): yolunda boşluk, Türkçe harf, parantez, & ve % olan klasörde; sahte node.cmd ile ve node
// hiç yokken. Hiçbir şey açılmaz: sahte node yalnız çağrıyı yazar, node yokken FABRIKA_TEST_ACMA sayfayı açtırmaz.
const bat = fs.readFileSync(path.join(KOK, 'BASLAT.bat'), 'latin1');
kontrol('BASLAT.bat yalnız ASCII ve CRLF; soru sormaz, kütüphane kurmaz, motoru ana sayfa kipinde penceresiz (--gizli) açar', !/[^\x00-\x7f]/.test(bat) && !/[^\r]\n/.test(bat) && !/set \/p/i.test(bat) && !/npm/i.test(bat.replace(/^rem .*$/gim, '')) && /node kopru\.js --ana-sayfa --ac --gizli\r\n/.test(bat));
if (process.platform === 'win32') {
  const batKok = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-bat-'));
  const sys = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'), stub = path.join(batKok, 'sahte-node');
  fs.mkdirSync(stub);
  fs.writeFileSync(path.join(stub, 'node.cmd'), '@echo ARGS %*> "%~dp0cagri.txt"\r\n@cd>> "%~dp0cagri.txt"\r\n@exit /b 0\r\n');
  const batCalis = (kl, yol, ek) => {
    const env = { ...process.env, ...ek }; delete env.PATH; delete env.Path; env.Path = yol;
    return spawnSync('cmd.exe', ['/d', '/s', '/c', '""' + path.join(kl, 'BASLAT.bat') + '""'], { windowsVerbatimArguments: true, cwd: os.tmpdir(), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
  };
  // depo düzeni: yardım sayfası cekirdek/ içinde
  const depo = path.join(batKok, 'Oyun (deneme) & 100% şarkı');
  fs.mkdirSync(path.join(depo, 'cekirdek'), { recursive: true });
  fs.copyFileSync(path.join(KOK, 'BASLAT.bat'), path.join(depo, 'BASLAT.bat'));
  fs.writeFileSync(path.join(depo, 'kopru.js'), '// test: gerçek depoda köprü burada durur\n');
  fs.copyFileSync(nodeYok, path.join(depo, 'cekirdek', 'node-yok.html'));
  const v = batCalis(depo, stub + ';' + sys, {}), cagri = fs.existsSync(path.join(stub, 'cagri.txt')) ? fs.readFileSync(path.join(stub, 'cagri.txt'), 'utf8') : '';
  kontrol('BASLAT.bat zor adlı klasörde (boşluk, ş, parantez, &, %) node bulunca soru sormadan "node kopru.js --ana-sayfa --ac --gizli" çalıştırır, klasörü doğru bulur', v.status === 0 && /ARGS kopru\.js --ana-sayfa --ac --gizli\s*$/m.test(cagri) && cagri.includes(depo), { kod: v.status, cagri, cikti: (v.stdout + v.stderr).slice(0, 200) });
  const y2 = batCalis(depo, sys, { FABRIKA_TEST_ACMA: '1' });
  kontrol('BASLAT.bat node yokken düz bir ileti yazar, depodaki yardım sayfasını açacağını söyler, hatayla biter (pencere pause ile bekler)', y2.status === 1 && /Node\.js bulunamadi/.test(y2.stdout) && y2.stdout.includes('ACILACAK: "' + path.join(depo, 'cekirdek', 'node-yok.html') + '"') && /Press any key|Devam etmek/.test(y2.stdout), y2.stdout.slice(0, 400));
  // paket düzeni: yardım sayfası BASLAT.bat'ın yanında
  const y3 = fs.existsSync(pkKl) ? batCalis(pkKl, sys, { FABRIKA_TEST_ACMA: '1' }) : { status: -1, stdout: 'paket yok' };
  kontrol('BASLAT.bat pakette node yokken paketin kendi yardım sayfasını bulur', y3.status === 1 && y3.stdout.includes('ACILACAK: "' + path.join(pkKl, 'node-yok.html') + '"'), y3.stdout.slice(0, 300));
  fs.rmSync(batKok, { recursive: true, force: true });
}

// ==== BAŞLATICILAR: BASLAT.bat yardım sayfası yokken (G), BASLAT.command / BASLAT.sh (Mac / Linux) — başı ====
{
  // G: yardım sayfası yoksa "açılıyor" demez, yalnız kısa nodejs.org tarifi yazar
  if (process.platform === 'win32') {
    const gk = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-bat-g-')), sys = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
    fs.copyFileSync(path.join(KOK, 'BASLAT.bat'), path.join(gk, 'BASLAT.bat'));
    fs.writeFileSync(path.join(gk, 'kopru.js'), '// test: gerçek depoda köprü burada durur\n');
    const env = { ...process.env, FABRIKA_TEST_ACMA: '1' }; for (const a of Object.keys(env)) if (a.toUpperCase() === 'PATH') delete env[a]; env.Path = sys;
    const g = spawnSync('cmd.exe', ['/d', '/s', '/c', '""' + path.join(gk, 'BASLAT.bat') + '""'], { windowsVerbatimArguments: true, cwd: os.tmpdir(), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    kontrol('G: BASLAT.bat yardım sayfası bulunmayınca "açılıyor" demez, kısa nodejs.org tarifini yazar, hatayla biter', g.status === 1 && /Node\.js bulunamadi/.test(g.stdout) && !/aciliyor/.test(g.stdout) && !/ACILACAK/.test(g.stdout) && /Kurulum: https:\/\/nodejs\.org/.test(g.stdout), g.stdout.slice(0, 400));
    fs.rmSync(gk, { recursive: true, force: true });
  }
  // Mac / Linux başlatıcıları: biçim denetimi (Windows'ta da çalışır)
  const sh = { mac: 'BASLAT.command', linux: 'BASLAT.sh' };
  for (const [ad, dosya] of Object.entries(sh)) {
    const ham = fs.readFileSync(path.join(KOK, dosya)), metin = ham.toString('utf8'), kod = metin.split('\n').filter(x => !/^\s*#/.test(x)).join('\n');
    const bashizm = [/\[\[/, /\bfunction\s/, /^\s*local\s/m, /^\s*source\s/m, /\$'/, /<<</, /echo\s+-e/, /=\(/, /\$\{[^}]*\/\//, /\bpushd\b/, /&>/, /\$RANDOM/, /\[ [^\]]*==/].filter(r => r.test(kod)).map(String);
    kontrol(ad + ': ' + dosya + ' LF, BOM\'suz UTF-8, #!/bin/sh ile başlar, bash\'e özgü yazım yok, npm çağırmaz, motoru "--ana-sayfa --ac" ile açar', !metin.includes('\r') && !(ham[0] === 0xef && ham[1] === 0xbb) && Buffer.from(metin, 'utf8').equals(ham) && metin.startsWith('#!/bin/sh\n') && bashizm.length === 0 && !/npm/.test(kod) && /^\s*node kopru\.js --ana-sayfa --ac$/m.test(kod) && /cd "\$\(dirname "\$0"\)"/.test(kod), { bashizm });
  }
  const mod = spawnSync('git', ['ls-files', '-s', 'BASLAT.command', 'BASLAT.sh'], { cwd: KOK, encoding: 'utf8' }).stdout.trim().split('\n').map(x => x.split(/\s+/)[0] + ' ' + x.split('\t')[1]);
  kontrol('Mac / Linux: git iki başlatıcıyı çalıştırılabilir (100755) kaydeder', JSON.stringify(mod) === JSON.stringify(['100755 BASLAT.command', '100755 BASLAT.sh']), mod);
  // sh ile gerçekten çalıştır (Windows'ta Git'in sh'ı): sahte node yalnız çağrıyı ve klasörü yazar; node yokken yardım sayfası
  const shYol = process.platform === 'win32' ? ['C:\\Program Files\\Git\\usr\\bin\\sh.exe', 'C:\\Program Files\\Git\\bin\\sh.exe'].find(y => fs.existsSync(y)) : '/bin/sh';
  if (shYol) {
    const shKok = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-sh-')), stub = path.join(shKok, 'sahte-node'), araclarBin = path.dirname(shYol);
    fs.mkdirSync(stub);
    fs.writeFileSync(path.join(stub, 'node'), '#!/bin/sh\necho "ARGS $*" > "$(dirname "$0")/cagri.txt"\npwd >> "$(dirname "$0")/cagri.txt"\nexit 0\n');
    try { fs.chmodSync(path.join(stub, 'node'), 0o755); } catch (e) { }
    const depo = path.join(shKok, 'Oyun (deneme) & 100% şarkı');
    fs.mkdirSync(path.join(depo, 'cekirdek'), { recursive: true });
    fs.copyFileSync(path.join(KOK, 'cekirdek', 'node-yok.html'), path.join(depo, 'cekirdek', 'node-yok.html'));
    const shCalis = (dosya, yol, ek) => {
      const env = { ...process.env, ...ek }; for (const a of Object.keys(env)) if (a.toUpperCase() === 'PATH') delete env[a]; env.PATH = yol;
      // Çift tıklama gibi: çalışma klasörü ev klasörü değil, başka bir yer; betik kendi klasörüne geçmeli
      return spawnSync(shYol, [path.join(depo, dosya)], { cwd: os.tmpdir(), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    };
    for (const dosya of Object.values(sh)) {
      fs.copyFileSync(path.join(KOK, dosya), path.join(depo, dosya));
      try { fs.unlinkSync(path.join(stub, 'cagri.txt')); } catch (e) { }
      const v = shCalis(dosya, stub + path.delimiter + araclarBin, {}), cagri = fs.existsSync(path.join(stub, 'cagri.txt')) ? fs.readFileSync(path.join(stub, 'cagri.txt'), 'utf8') : '';
      kontrol(dosya + ' sh ile, zor adlı klasörde (boşluk, ş, parantez, &, %) ve başka çalışma klasöründen: node bulunca tam olarak "node kopru.js --ana-sayfa --ac" çalıştırır, kendi klasöründe', v.status === 0 && /^ARGS kopru\.js --ana-sayfa --ac\n/.test(cagri) && /\/Oyun \(deneme\) & 100% şarkı\n?$/.test(cagri.split('\n').slice(1).join('\n').trim() + '\n'), { kod: v.status, cagri, hata: (v.stderr || '').slice(0, 200) });
      const y = shCalis(dosya, araclarBin, { FABRIKA_TEST_ACMA: '1' });
      const beklenen = path.join(depo, 'cekirdek', 'node-yok.html').replace(/\\/g, '/'), gelen = (/ACILACAK: "([^"]*)"/.exec(y.stdout) || [])[1] || '';
      kontrol(dosya + ' node yokken düz bir ileti yazar, yardım sayfasının yolunu verir (test anahtarı açtırmaz), Enter bekler, hatayla biter', y.status === 1 && /Node\.js bulunamadı/.test(y.stdout) && new RegExp(dosya.replace('.', '[.]')).test(y.stdout) && /cekirdek\/node-yok\.html$/.test(gelen) && gelen.endsWith(beklenen.slice(beklenen.indexOf('Oyun ('))) && /Enter tuşuna bas/.test(y.stdout), { kod: y.status, cikti: y.stdout.slice(0, 400) });
    }
    fs.rmSync(path.join(depo, 'cekirdek'), { recursive: true, force: true });
    const z = shCalis('BASLAT.command', araclarBin, { FABRIKA_TEST_ACMA: '1' });
    kontrol('BASLAT.command yardım sayfası yokken "açılıyor" demez, kısa nodejs.org tarifini yazar', z.status === 1 && !/açılıyor/.test(z.stdout) && /Kurulum: https:\/\/nodejs\.org/.test(z.stdout), z.stdout.slice(0, 300));
    fs.rmSync(shKok, { recursive: true, force: true });
  } else kontrol('Mac / Linux başlatıcıları sh ile çalıştırılamadı: bu bilgisayarda sh yok (Git for Windows kur)', false);
  // paket: iki başlatıcı da pakette, çalıştırılabilir; OKU.txt Mac başlatmasını ve ilk açılış engelini anlatır
  const oku = fs.existsSync(path.join(pkKl, 'OKU.txt')) ? fs.readFileSync(path.join(pkKl, 'OKU.txt'), 'utf8') : '';
  const izin = d => { try { return process.platform === 'win32' || (fs.statSync(path.join(pkKl, d)).mode & 0o111) !== 0; } catch (e) { return false; } };
  kontrol('paket: BASLAT.command ve BASLAT.sh pakette (Windows dışında çalıştırılabilir); OKU.txt Mac / Linux başlatmasını ve "macOS engellerse" Terminal yolunu anlatır', ['BASLAT.command', 'BASLAT.sh'].every(d => pkDosya.includes(d) && izin(d)) && /BASLAT\.command/.test(oku) && /sh BASLAT\.sh/.test(oku) && /macOS engellerse/.test(oku) && /sh BASLAT\.command/.test(oku), pkDosya);
}
// ==== BAŞLATICILAR — sonu ====
// ==== HAZIR PAKET (araclar/surum.js), ZIP izinleri, BASLAT.bat paket Node'u — başı ====
// Ağa çıkılmaz: Node arşivi yerine bu bilgisayardaki node.exe'nin kopyasıyla kurulmuş sahte bir arşiv, npm yerine sahte
// bir kütüphane kullanılır. Gerçek indirme ve npm yalnız bakımcının elle çalıştırdığı "node araclar/surum.js"te olur.
{
  const { zipYaz, zipOku } = require(path.join(KOK, 'araclar', 'zip.js')), surum = require(path.join(KOK, 'araclar', 'surum.js'));
  const sabit = JSON.parse(fs.readFileSync(path.join(KOK, 'araclar', 'surum-node.json'), 'utf8'));
  // Sabit sürüm her yerde aynı: surum-node.json, BASLAT.bat ve yardım sayfasındaki .msi adresi
  kontrol('Hazır paket: sabit Node sürümü tek yerde (surum-node.json: v24, sha256 64 hane, resmî adres) ve BASLAT.bat ile yardım sayfası aynı .msi adresini gösterir', /^24\.\d+\.\d+$/.test(sabit.surum) && /^[0-9a-f]{64}$/.test(sabit.sha256) && sabit.url === 'https://nodejs.org/dist/v' + sabit.surum + '/node-v' + sabit.surum + '-win-x64.zip' && sabit.msi === 'https://nodejs.org/dist/v' + sabit.surum + '/node-v' + sabit.surum + '-x64.msi' && fs.readFileSync(path.join(KOK, 'BASLAT.bat'), 'latin1').includes(sabit.msi) && fs.readFileSync(path.join(KOK, 'cekirdek', 'node-yok.html'), 'utf8').includes(sabit.msi) && /\.msi uzantılı kurulum dosyası/.test(fs.readFileSync(path.join(KOK, 'cekirdek', 'node-yok.html'), 'utf8')) && /github\.com\/furkancavlak\/tiktok-oyun-fabrikasi\/releases/.test(fs.readFileSync(path.join(KOK, 'cekirdek', 'node-yok.html'), 'utf8')), sabit);
  const hk = fs.mkdtempSync(path.join(os.tmpdir(), 'canli-surum-'));
  // SHA-256 denetimi: doğru değer geçer, yanlış değer reddedilir
  const fx = path.join(hk, 'ornek.bin'); fs.writeFileSync(fx, 'tiktok oyun fabrikası');
  const dogru = require('crypto').createHash('sha256').update(fs.readFileSync(fx)).digest('hex');
  let reddetti = false; try { surum.hashDogrula(fx, '0'.repeat(64)); } catch (e) { reddetti = /SHA-256 tutmuyor/.test(e.message); }
  kontrol('Hazır paket: SHA-256 denetimi doğru değeri kabul eder, yanlış değeri reddeder', surum.hashDogrula(fx, dogru) === dogru && reddetti);
  if (process.platform === 'win32') {
    // Sahte Node arşivi: içinde bu bilgisayardaki node.exe'nin kopyası ve LICENSE
    const v = process.version.slice(1), ic = 'node-v' + v + '-win-x64', arsivKl = path.join(hk, 'arsiv', ic);
    fs.mkdirSync(arsivKl, { recursive: true });
    fs.copyFileSync(process.execPath, path.join(arsivKl, 'node.exe')); fs.writeFileSync(path.join(arsivKl, 'LICENSE'), 'Node.js lisansı (test kopyası)');
    const arsiv = path.join(hk, ic + '.zip'); zipYaz(arsiv, arsivKl, ic);
    const sahte = { surum: v, dosya: ic + '.zip', url: 'https://ornek.invalid/' + ic + '.zip', sha256: surum.sha256Dosya(arsiv) };
    const jDogru = path.join(hk, 'dogru.json'), jYanlis = path.join(hk, 'yanlis.json');
    fs.writeFileSync(jDogru, JSON.stringify(sahte)); fs.writeFileSync(jYanlis, JSON.stringify({ ...sahte, sha256: 'f'.repeat(64) }));
    const mod = path.join(hk, 'moduller', 'tiktok-live-connector'); fs.mkdirSync(mod, { recursive: true });
    fs.writeFileSync(path.join(mod, 'package.json'), JSON.stringify({ name: 'tiktok-live-connector', version: '0.0.0-deneme', main: 'index.js' })); fs.writeFileSync(path.join(mod, 'index.js'), 'module.exports = {};');
    // Geçici git deposu: bu çalışma ağacının şimdiki dosyaları (izlenen + izlenmeyen, yoksayılanlar hariç) tek işlemede.
    // surum.js yalnız işlenmiş ağacı (git archive HEAD) paketler; testin deposu bu yüzden işlenmiş olmalı.
    const depo = path.join(hk, 'depo'), git = (...a) => spawnSync('git', a, { cwd: depo, encoding: 'utf8' });
    fs.mkdirSync(depo); git('init', '-q');
    for (const y of spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: KOK, encoding: 'utf8' }).stdout.split('\0').filter(Boolean)) {
      const a = path.join(KOK, y); if (!fs.existsSync(a) || !fs.statSync(a).isFile()) continue;
      fs.mkdirSync(path.dirname(path.join(depo, y)), { recursive: true }); fs.copyFileSync(a, path.join(depo, y));
    }
    git('add', '-A'); git('-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'test');
    const kur = (json, cikti, ...ek) => spawnSync(process.execPath, [path.join(KOK, 'araclar', 'surum.js'), '--surum-json', json, '--node-zip', arsiv, '--moduller', path.join(hk, 'moduller'), '--cikti', cikti, '--zipsiz', '--depo', depo, ...ek], { cwd: KOK, encoding: 'utf8', timeout: 300000 });
    const yanlisCikti = path.join(hk, 'cikti-yanlis'), y = kur(jYanlis, yanlisCikti);
    const yanlisIc = fs.existsSync(yanlisCikti) ? fs.readdirSync(yanlisCikti).map(d => fs.existsSync(path.join(yanlisCikti, d, 'tiktok-oyun-fabrikasi', 'node'))) : [];
    kontrol('Hazır paket: Node arşivinin SHA-256\'sı tutmazsa araç durur, hiçbir şey paketlenmez (node klasörü yok)', y.status === 1 && /SHA-256 tutmuyor/.test(y.stderr) && yanlisIc.every(x => !x), { kod: y.status, hata: (y.stderr || '').slice(0, 300) });
    const iyiCikti = path.join(hk, 'cikti-iyi'), g = kur(jDogru, iyiCikti);
    const kokAd = fs.existsSync(iyiCikti) ? fs.readdirSync(iyiCikti)[0] : '', pk2 = path.join(iyiCikti, kokAd || 'yok', 'tiktok-oyun-fabrikasi');
    const sorun = fs.existsSync(pk2) ? surum.paketDenetle(pk2) : ['paket yok'];
    const surumTxt = fs.existsSync(path.join(pk2, 'SURUM.txt')) ? fs.readFileSync(path.join(pk2, 'SURUM.txt'), 'utf8') : '';
    kontrol('Hazır paket düzeni: node\\node.exe + LICENSE, node_modules\\tiktok-live-connector, üç oyun, başlatıcılar, node-yok.html, SURUM.txt; geliştirme bağımlılığı, test/cikti, .git, dist, npm yok', g.status === 0 && sorun.length === 0 && ['halay', 'konvoy', 'vur-duzelsin'].every(o => fs.existsSync(path.join(pk2, 'oyunlar', o, 'oyun.html'))) && !fs.existsSync(path.join(pk2, '.git')) && !fs.existsSync(path.join(pk2, 'test', 'cikti')) && !fs.existsSync(path.join(pk2, 'node_modules', 'playwright')) && new RegExp('Node\\.js: +' + v.replace(/\./g, '\\.')).test(surumTxt) && /tiktok-live-connector: 0\.0\.0-deneme/.test(surumTxt) && /Git işlemesi: +[0-9a-f]{40}/.test(surumTxt), { kod: g.status, sorun, hata: (g.stderr || '').slice(-300), surumTxt });
    // Node arşivi önbelleği (ağa çıkmadan): önbellekte doğru arşiv varsa indirmeden onu kullanır; önbellekteki arşiv
    // bozuksa (sha256 tutmuyor) kullanmaz, yeniden indirmeye kalkar (adres .invalid: indirme düşer, araç durur, hiçbir şey
    // paketlenmez) ve bozuk dosyanın üstüne doğrulanmamış bir şey yazmaz.
    const obKl = path.join(hk, 'onbellek'), obYol = surum.onbellekYolu(sahte, obKl);
    fs.mkdirSync(obKl, { recursive: true }); fs.copyFileSync(arsiv, obYol);
    const kurOb = cikti => spawnSync(process.execPath, [path.join(KOK, 'araclar', 'surum.js'), '--surum-json', jDogru, '--onbellek', obKl, '--moduller', path.join(hk, 'moduller'), '--cikti', cikti, '--zipsiz', '--depo', depo], { cwd: KOK, encoding: 'utf8', timeout: 300000 });
    const obCikti = path.join(hk, 'cikti-onbellek'), ob1 = kurOb(obCikti);
    const obPk = path.join(obCikti, fs.existsSync(obCikti) ? fs.readdirSync(obCikti)[0] : 'yok', 'tiktok-oyun-fabrikasi');
    kontrol('Hazır paket: önbellekte sha256\'sı tutan Node arşivi varsa indirmeden onu kullanır (adı sürüm + sha256\'nın ilk 12 hanesi), paket tamam', ob1.status === 0 && /önbellekten alındı/.test(ob1.stdout) && !/indiriliyor/.test(ob1.stdout) && path.basename(obYol) === ic + '-' + sahte.sha256.slice(0, 12) + '.zip' && fs.existsSync(path.join(obPk, 'node', 'node.exe')), { kod: ob1.status, cikti: (ob1.stdout || '').split('\n').filter(s => /Node|önbellek/i.test(s)).join(' / '), hata: (ob1.stderr || '').slice(-300) });
    fs.writeFileSync(obYol, 'bozuk arşiv');
    const obCikti2 = path.join(hk, 'cikti-onbellek-bozuk'), ob2 = kurOb(obCikti2);
    const obIc2 = fs.existsSync(obCikti2) ? fs.readdirSync(obCikti2).map(d => fs.existsSync(path.join(obCikti2, d, 'tiktok-oyun-fabrikasi', 'node'))) : [];
    kontrol('Hazır paket: önbellekteki arşivin sha256\'sı tutmazsa kullanılmaz, yeniden indirilir (indirilemeyince araç durur, node klasörü yok), önbelleğe doğrulanmamış dosya yazılmaz', ob2.status === 1 && /SHA-256'sı tutmuyor/.test(ob2.stdout) && /Yeniden indiriliyor/.test(ob2.stdout) && /Node indiriliyor/.test(ob2.stdout) && obIc2.every(x => !x) && fs.readFileSync(obYol, 'utf8') === 'bozuk arşiv', { kod: ob2.status, cikti: (ob2.stdout || '').slice(-400), hata: (ob2.stderr || '').slice(0, 300) });
    // Kirli ağaç: izlenmeyen dosya (.env.local, notlarim.txt) ve işlenmemiş değişiklik varken araç durur; --kirli-izin ile
    // yalnız işlenmiş ağaç paketlenir (izlenmeyen dosyalar girmez, değişen dosya işlendiği hâliyle girer), SURUM.txt bunu yazar.
    fs.writeFileSync(path.join(depo, '.env.local'), 'GIZLI=1\n'); fs.writeFileSync(path.join(depo, 'notlarim.txt'), 'özel not\n');
    const readmeIslenmis = fs.readFileSync(path.join(depo, 'README.md'), 'utf8'); fs.appendFileSync(path.join(depo, 'README.md'), '\nİŞLENMEMİŞ SATIR\n');
    const kirliCikti = path.join(hk, 'cikti-kirli'), kd = kur(jDogru, kirliCikti);
    kontrol('Hazır paket: çalışma ağacında izlenmeyen dosya ya da işlenmemiş değişiklik varken araç durur (paket yok), nedenini yazar', kd.status === 1 && /Çalışma ağacı temiz değil/.test(kd.stderr) && /--kirli-izin/.test(kd.stderr) && !fs.existsSync(kirliCikti), { kod: kd.status, hata: (kd.stderr || '').slice(0, 300) });
    const izinCikti = path.join(hk, 'cikti-izin'), ki = kur(jDogru, izinCikti, '--kirli-izin');
    const pk3 = path.join(izinCikti, fs.existsSync(izinCikti) ? fs.readdirSync(izinCikti)[0] : 'yok', 'tiktok-oyun-fabrikasi');
    const s3 = fs.existsSync(path.join(pk3, 'SURUM.txt')) ? fs.readFileSync(path.join(pk3, 'SURUM.txt'), 'utf8') : '';
    kontrol('Hazır paket --kirli-izin: yalnız işlenmiş ağaç girer (.env.local ve notlarim.txt yok, README işlendiği hâliyle), SURUM.txt kirli ağaçtan yapıldığını söyler', ki.status === 0 && !fs.existsSync(path.join(pk3, '.env.local')) && !fs.existsSync(path.join(pk3, 'notlarim.txt')) && fs.readFileSync(path.join(pk3, 'README.md'), 'utf8') === readmeIslenmis && /--kirli-izin/.test(s3), { kod: ki.status, hata: (ki.stderr || '').slice(-300), surum: s3.slice(0, 400) });
    // Paketten, paketin kendi Node'uyla açılan motor: kapısında yanıt verir, kütüphane hazır, üç oyun listede
    if (fs.existsSync(path.join(pk2, 'node', 'node.exe'))) {
      const kp = (parseInt(process.env.KOPRU_TEST_PORT, 10) || 8791) + 12;
      const m = require('child_process').spawn(path.join(pk2, 'node', 'node.exe'), ['kopru.js', '--ana-sayfa', '--port', String(kp)], { cwd: pk2, stdio: ['ignore', 'pipe', 'pipe'] });
      // Bu dosya eşzamanlı çalışır: yoklama ayrı bir node sürecinde (en çok 15 sn), motor kendi sürecinde yaşar.
      const yok = spawnSync(process.execPath, ['-e', "const h=require('http');let n=0;(function d(){h.get({host:'127.0.0.1',port:" + kp + ",path:'/api/oyunlar',headers:{host:'127.0.0.1:" + kp + "'}},r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>console.log(s));}).on('error',()=>{if(++n<60)setTimeout(d,250);else console.log('null');});})();"], { encoding: 'utf8', timeout: 30000 });
      let api = null; try { api = JSON.parse(yok.stdout); } catch (e) { }
      m.kill();
      kontrol('Hazır paket: motor paketin kendi node\\node.exe\'siyle açılır, /api/oyunlar yanıt verir, kütüphane "hazir", üç oyun listede (canlı bağlantı açılmaz)', !!api && api.kutuphane.durum === 'hazir' && JSON.stringify(api.oyunlar.map(o => o.id)) === JSON.stringify(['halay', 'konvoy', 'vur-duzelsin']), api && { kutuphane: api.kutuphane, oyunlar: api.oyunlar.map(o => o.id) });
    }
    // BASLAT.bat: yanında node\node.exe varsa onu çalıştırır (yoldaki node'u değil); ZIP'ten çıkarılmadan açılınca uyarır
    const bk = path.join(hk, 'bat-paket'); fs.mkdirSync(path.join(bk, 'node'), { recursive: true });
    fs.copyFileSync(path.join(KOK, 'BASLAT.bat'), path.join(bk, 'BASLAT.bat'));
    try { fs.linkSync(process.execPath, path.join(bk, 'node', 'node.exe')); } catch (e) { fs.copyFileSync(process.execPath, path.join(bk, 'node', 'node.exe')); }
    fs.writeFileSync(path.join(bk, 'kopru.js'), "require('fs').writeFileSync(require('path').join(__dirname, 'hangi.txt'), process.execPath + '\\n' + process.argv.slice(2).join(' '));");
    const yolNode = path.join(hk, 'yol-node'); fs.mkdirSync(yolNode);
    fs.writeFileSync(path.join(yolNode, 'node.cmd'), '@echo YOLDAKI> "%~dp0cagri.txt"\r\n@exit /b 0\r\n');
    const sys = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
    const bat = (kl, yol, ek) => { const env = { ...process.env, ...ek }; for (const a of Object.keys(env)) if (a.toUpperCase() === 'PATH') delete env[a]; env.Path = yol; return spawnSync('cmd.exe', ['/d', '/s', '/c', '""' + path.join(kl, 'BASLAT.bat') + '""'], { windowsVerbatimArguments: true, cwd: os.tmpdir(), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }); };
    const pb = bat(bk, yolNode + ';' + sys, {}), hangi = fs.existsSync(path.join(bk, 'hangi.txt')) ? fs.readFileSync(path.join(bk, 'hangi.txt'), 'utf8').split('\n') : [];
    kontrol('BASLAT.bat yanında node\\node.exe varsa onu kullanır (yoldaki node çağrılmaz), "kopru.js --ana-sayfa --ac --gizli" ile', pb.status === 0 && (hangi[0] || '').toLowerCase() === path.join(bk, 'node', 'node.exe').toLowerCase() && hangi[1] === '--ana-sayfa --ac --gizli' && !fs.existsSync(path.join(yolNode, 'cagri.txt')), { kod: pb.status, hangi, cikti: (pb.stdout || '').slice(0, 200) });
    const yalniz = path.join(hk, 'zip-icinden'); fs.mkdirSync(yalniz); fs.copyFileSync(path.join(KOK, 'BASLAT.bat'), path.join(yalniz, 'BASLAT.bat'));
    const zb = bat(yalniz, yolNode + ';' + sys, {});
    kontrol('BASLAT.bat ZIP\'ten çıkarılmadan açılınca (yanında kopru.js yok) tek düz satırla önce klasöre çıkarmayı söyler, hatayla biter, node çalıştırmaz', zb.status === 1 && /Once ZIP'i bir klasore cikar \(sag tik, Tumunu ayikla\), sonra BASLAT\.bat'a cift tikla\./.test(zb.stdout) && !fs.existsSync(path.join(yolNode, 'cagri.txt')), zb.stdout.slice(0, 300));
  }
  // ZIP yazıcı: Mac başlatıcıları 0755, gerisi 0644, tek üst klasör; paket.js'in ZIP'i de böyle; Windows'un açıcısı açar
  // Paket klasöründe önceki bir denemeden kalanlar (kilit, node_modules, not): paket.js yeniden çalışınca ZIP'e girmemeli
  if (fs.existsSync(pkKl)) {
    fs.writeFileSync(path.join(pkKl, '.kurulum-kilidi.json'), '{"bitti":true}'); fs.writeFileSync(path.join(pkKl, 'notlarim.txt'), 'not');
    fs.mkdirSync(path.join(pkKl, 'node_modules', 'artik'), { recursive: true }); fs.writeFileSync(path.join(pkKl, 'node_modules', 'artik', 'index.js'), '');
    calis('araclar/paket.js', 'deneme-oyun');
  }
  const pkZip = path.join(GECICI, 'dist', 'deneme-oyun.zip'), girdi = fs.existsSync(pkZip) ? zipOku(pkZip) : [];
  kontrol('paket.js ZIP\'i yalnız bu çalıştırmada yazılan dosyaları içerir: klasörde kalan kilit dosyası, node_modules ve notlar girmez', girdi.length > 5 && !girdi.some(x => /\.kurulum-kilidi\.json$|notlarim\.txt$|node_modules\//.test(x.ad)), girdi.map(x => x.ad).filter(a => /kilid|notlar|node_modules/.test(a)));
  const modu = ad => (girdi.find(x => x.ad === ad) || {}).mod;
  kontrol('paket.js ZIP\'i: tek üst klasör deneme-oyun/, BASLAT.command ve BASLAT.sh 0755 (Unix), kopru.js 0644; OKU.txt Mac\'te çift tıklama ile Terminal yolunu eşit yol olarak anlatır', girdi.length > 5 && girdi.every(x => x.ad.startsWith('deneme-oyun/')) && modu('deneme-oyun/BASLAT.command') === 0o100755 && modu('deneme-oyun/BASLAT.sh') === 0o100755 && modu('deneme-oyun/kopru.js') === 0o100644 && /açılmazsa Terminal'i aç, cd ile bu klasöre gir/.test(fs.readFileSync(path.join(pkKl, 'OKU.txt'), 'utf8')), girdi.slice(0, 6).map(x => x.ad + ' ' + x.mod.toString(8)));
  if (process.platform === 'win32' && fs.existsSync(pkZip)) {
    const acKl = path.join(hk, 'zip-acik'), ex = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath "' + pkZip + '" -DestinationPath "' + acKl + '"'], { encoding: 'utf8', timeout: 120000 });
    kontrol('ZIP Windows\'un kendi açıcısıyla (Expand-Archive) açılır, klasör düzeni korunur', ex.status === 0 && fs.existsSync(path.join(acKl, 'deneme-oyun', 'BASLAT.command')) && fs.existsSync(path.join(acKl, 'deneme-oyun', 'kopru.js')), (ex.stderr || '').slice(0, 200));
  }
  // Bu bloğun kendi kurduğu geçici klasör (yaklaşık 390 MB: node.exe kopyası) her koşuda birikmesin.
  try { fs.rmSync(hk, { recursive: true, force: true }); } catch (e) { }
}
// ==== HAZIR PAKET — sonu ====


fs.rmSync(GECICI, { recursive: true, force: true });
process.exit(raporla(sonuc) ? 1 : 0);
