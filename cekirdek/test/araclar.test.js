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

fs.rmSync(GECICI, { recursive: true, force: true });
process.exit(raporla(sonuc) ? 1 : 0);
