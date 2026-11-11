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
kontrol('Node.js yardım sayfası depoda var: nodejs.org bağlantısı, LTS, BASLAT.bat yeniden; dış betik yok', /href="https:\/\/nodejs\.org"/.test(nyMetin) && /LTS/.test(nyMetin) && /BASLAT\.bat/.test(nyMetin) && !/<script/i.test(nyMetin));
for (const d of ['kopru.js', 'BASLAT.bat', 'package.json']) fs.copyFileSync(path.join(KOK, d), path.join(GECICI, d));
const pk = calis('araclar/paket.js', 'deneme-oyun'), pkKl = path.join(GECICI, 'dist', 'deneme-oyun');
const pkDosya = fs.existsSync(pkKl) ? fs.readdirSync(pkKl).sort() : [];
kontrol('paket: BASLAT.bat, köprü, ana sayfa ve Node.js yardım sayfası pakette; OKU.txt açılış ekranını anlatır', pk.status === 0 && ['BASLAT.bat', 'ana-sayfa.html', 'kopru.js', 'node-yok.html', 'oyun.html', 'oyun.json'].every(d => pkDosya.includes(d)) && /açılış ekranı/.test(fs.readFileSync(path.join(pkKl, 'OKU.txt'), 'utf8')), { kod: pk.status, dosyalar: pkDosya, hata: (pk.stderr || '').slice(0, 200) });

// BASLAT.bat (yalnız Windows): yolunda boşluk, Türkçe harf, parantez, & ve % olan klasörde; sahte node.cmd ile ve node
// hiç yokken. Hiçbir şey açılmaz: sahte node yalnız çağrıyı yazar, node yokken FABRIKA_TEST_ACMA sayfayı açtırmaz.
const bat = fs.readFileSync(path.join(KOK, 'BASLAT.bat'), 'latin1');
kontrol('BASLAT.bat yalnız ASCII ve CRLF; soru sormaz, kütüphane kurmaz, motoru ana sayfa kipinde açar', !/[^\x00-\x7f]/.test(bat) && !/[^\r]\n/.test(bat) && !/set \/p/i.test(bat) && !/npm/i.test(bat.replace(/^rem .*$/gim, '')) && /node kopru\.js --ana-sayfa --ac/.test(bat));
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
  fs.copyFileSync(nodeYok, path.join(depo, 'cekirdek', 'node-yok.html'));
  const v = batCalis(depo, stub + ';' + sys, {}), cagri = fs.existsSync(path.join(stub, 'cagri.txt')) ? fs.readFileSync(path.join(stub, 'cagri.txt'), 'utf8') : '';
  kontrol('BASLAT.bat zor adlı klasörde (boşluk, ş, parantez, &, %) node bulunca soru sormadan "node kopru.js --ana-sayfa --ac" çalıştırır, klasörü doğru bulur', v.status === 0 && /ARGS kopru\.js --ana-sayfa --ac/.test(cagri) && cagri.includes(depo), { kod: v.status, cagri, cikti: (v.stdout + v.stderr).slice(0, 200) });
  const y2 = batCalis(depo, sys, { FABRIKA_TEST_ACMA: '1' });
  kontrol('BASLAT.bat node yokken düz bir ileti yazar, depodaki yardım sayfasını açacağını söyler, hatayla biter (pencere pause ile bekler)', y2.status === 1 && /Node\.js bulunamadi/.test(y2.stdout) && y2.stdout.includes('ACILACAK: "' + path.join(depo, 'cekirdek', 'node-yok.html') + '"') && /Press any key|Devam etmek/.test(y2.stdout), y2.stdout.slice(0, 400));
  // paket düzeni: yardım sayfası BASLAT.bat'ın yanında
  const y3 = fs.existsSync(pkKl) ? batCalis(pkKl, sys, { FABRIKA_TEST_ACMA: '1' }) : { status: -1, stdout: 'paket yok' };
  kontrol('BASLAT.bat pakette node yokken paketin kendi yardım sayfasını bulur', y3.status === 1 && y3.stdout.includes('ACILACAK: "' + path.join(pkKl, 'node-yok.html') + '"'), y3.stdout.slice(0, 300));
  fs.rmSync(batKok, { recursive: true, force: true });
}

fs.rmSync(GECICI, { recursive: true, force: true });
process.exit(raporla(sonuc) ? 1 : 0);
