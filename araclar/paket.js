#!/usr/bin/env node
/*
 * Yayıncı paketi hazırlar: dist/<ad>/ klasörü.
 *
 *   node araclar/paket.js <ad>
 *
 * Önce `node araclar/derle.js <ad>` ile oyunlar/<ad>/oyun.html üretilmiş olmalı.
 * Araç hiçbir şey silmez; yeniden çalıştırınca aynı dosyaların üstüne yazar.
 * Çıktı zip'lenmez: klasörü istediğin gibi paketle.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '..');
const ad = process.argv[2];

function dur(ileti) {
  console.error('\n' + ileti + '\n');
  process.exit(1);
}

if (!ad || ad.startsWith('-')) dur('Kullanım: node araclar/paket.js <oyun adı>\nÖrnek:    node araclar/paket.js halay');
if (!/^[a-z0-9][a-z0-9-]*$/.test(ad)) dur('Oyun adı yalnız küçük harf, rakam ve tire içerebilir: "' + ad + '"');

const oyunKlasor = path.join(KOK, 'oyunlar', ad);
if (!fs.existsSync(oyunKlasor)) dur('"' + ad + '" adında oyun yok: ' + oyunKlasor + ' bulunamadı.');

const jsonYol = path.join(oyunKlasor, 'oyun.json');
if (!fs.existsSync(jsonYol)) dur(oyunKlasor + ' içinde oyun.json yok.');
let bilgi;
try { bilgi = JSON.parse(fs.readFileSync(jsonYol, 'utf8').replace(/^﻿/, '')); }
catch (h) { dur('oyun.json okunamadı: ' + h.message); }

const gorunenAd = String(bilgi.ad || ad);
const paketAdi = String(bilgi.paket || ad).replace(/[^A-Za-z0-9._-]/g, '-');

const html = path.join(oyunKlasor, 'oyun.html');
if (!fs.existsSync(html)) {
  dur('oyunlar/' + ad + '/oyun.html yok. Önce oyunu derle:\n\n    node araclar/derle.js ' + ad);
}

const kopruYol = path.join(KOK, 'kopru.js');
const baslatYol = path.join(KOK, 'BASLAT.bat');
const macYol = path.join(KOK, 'BASLAT.command'), linuxYol = path.join(KOK, 'BASLAT.sh'); // macOS ve Linux başlatıcıları
const anaSayfaYol = path.join(KOK, 'cekirdek', 'ana-sayfa.html'); // BASLAT.bat bunu açar: tek oyunlu ana sayfa
const nodeYokYol = path.join(KOK, 'cekirdek', 'node-yok.html'); // Node.js kurulu değilse BASLAT.bat bu yardım sayfasını açar
const kokPaket = JSON.parse(fs.readFileSync(path.join(KOK, 'package.json'), 'utf8').replace(/^﻿/, ''));
const surum = (kokPaket.dependencies || {})['tiktok-live-connector'];
if (!surum) dur('Kök package.json içinde tiktok-live-connector bağımlılığı bulunamadı.');
for (const y of [kopruYol, baslatYol, macYol, linuxYol, anaSayfaYol, nodeYokYol]) if (!fs.existsSync(y)) dur('Eksik dosya: ' + y);

const hedef = path.join(KOK, 'dist', ad);
fs.mkdirSync(hedef, { recursive: true });

const yazilan = [];
const { zipYaz } = require('./zip');
function kopyala(kaynak, ad2) {
  fs.copyFileSync(kaynak, path.join(hedef, ad2));
  yazilan.push(ad2);
}
function yaz(ad2, icerik) {
  fs.writeFileSync(path.join(hedef, ad2), icerik);
  yazilan.push(ad2);
}
function klasorKopyala(kaynak, hedefKlasor, onek) {
  fs.mkdirSync(hedefKlasor, { recursive: true });
  for (const e of fs.readdirSync(kaynak, { withFileTypes: true })) {
    const k = path.join(kaynak, e.name);
    const h = path.join(hedefKlasor, e.name);
    if (e.isDirectory()) klasorKopyala(k, h, onek + e.name + '/');
    else { fs.copyFileSync(k, h); yazilan.push(onek + e.name); }
  }
}

kopyala(html, 'oyun.html');
kopyala(kopruYol, 'kopru.js');
kopyala(baslatYol, 'BASLAT.bat');
// Paket bir klasördür (arşiv yazılmaz). macOS / Linux başlatıcıları çalıştırılabilir kalsın diye izinleri açıkça
// verilir (Windows'ta etkisizdir; klasör orada sıkıştırılırsa bu bit arşive girmeyebilir, OKU.txt Terminal yolunu anlatır).
for (const [kaynak, ad2] of [[macYol, 'BASLAT.command'], [linuxYol, 'BASLAT.sh']]) {
  kopyala(kaynak, ad2);
  try { fs.chmodSync(path.join(hedef, ad2), 0o755); } catch (e) { }
}
kopyala(anaSayfaYol, 'ana-sayfa.html');
kopyala(nodeYokYol, 'node-yok.html');
// Ana sayfadaki kartın adı ve tek cümlesi. vitrin ayarı pakete geçmez: paket her zaman kendi tek oyununu gösterir.
yaz('oyun.json', JSON.stringify({ ad: gorunenAd, paket: paketAdi, aciklama: String(bilgi.aciklama || '') }, null, 2) + '\n');

yaz('package.json', JSON.stringify({
  name: paketAdi,
  version: '1.0.0',
  private: true,
  description: gorunenAd + ' için TikTok yayın paketi',
  engines: { node: '>=18' },
  dependencies: { 'tiktok-live-connector': surum }
}, null, 2) + '\n');

const muzik = path.join(oyunKlasor, 'muzik');
if (fs.existsSync(muzik) && fs.statSync(muzik).isDirectory()) {
  klasorKopyala(muzik, path.join(hedef, 'muzik'), 'muzik/');
}

const oku = [
  gorunenAd + ' - Yayın paketi',
  '',
  'Bu oyun, TikTok canlı yayınındaki yorum, beğeni ve hediyelerle oynanır.',
  'Şifre istemez: köprü yayını yalnızca okur.',
  '',
  'Gerekenler',
  '  1. Windows, Mac ya da Linux bilgisayar ve Node.js (https://nodejs.org adresinden LTS sürümü).',
  '  2. TikTok LIVE Studio erişimi olan bir hesap.',
  '',
  'Başlatma',
  '  1. Windows: BASLAT.bat dosyasına çift tıkla.',
  '     Mac: BASLAT.command dosyasına çift tıkla; açılmazsa Terminal\'i aç, cd ile bu klasöre gir ve',
  '     sh BASLAT.command yaz (iki yol da aynı işi yapar).',
  '     Linux: terminalde bu klasöre gir ve sh BASLAT.sh yaz.',
  '     Mac ilk açılışta: internetten inen bir betiği macOS ilk seferde engelleyebilir. macOS engellerse',
  '     Sistem Ayarları > Gizlilik ve Güvenlik altında "Yine de Aç" düğmesini ara (eski sürümlerde dosyaya',
  '     sağ tıklayıp "Aç"). Her zaman çalışan yol: Terminal\'i aç, cd ile bu klasöre gir ve sh BASLAT.command yaz.',
  '  2. Tarayıcıda bir açılış ekranı gelir. İlk seferde TikTok kütüphanesi orada iner',
  '     (yaklaşık bir dakika, internet gerekir; bir kez olur). Beklerken "Beklemeden dene"',
  '     ile oyunu sahte izleyicilerle açabilirsin.',
  '  3. Sonra tek kabinli ana sayfa açılır: oyunun canlı önizlemesi ve iki düğme. Siyah pencere',
  '     (Mac ve Linux\'ta Terminal penceresi) oyunun motorudur: açık kalsın, kapatınca oyun durur.',
  '  4. Denemek için sarı "Dene" düğmesine bas: TikTok\'a bağlanmadan, sahte izleyicilerle açılır.',
  '  5. Yayında oynatmak için sağ üstteki bilete TikTok kullanıcı adını yaz ve "Kaydet"e',
  '     (ya da Enter\'a) bas. Kırmızı "Yayın" düğmesi yanar; ona bas. Oyun sayfasındaki',
  '     Bağlantı kutusu "Canlı" yazınca yorumlar akıyor; "Yayın yok" yazıyorsa TikTok\'ta',
  '     yayın henüz açık değil. "Durdur" oyunu kapatır.',
  '     Oyundan ana sayfaya dönmek için masanın üstündeki "← Oyunlar" bağlantısına bas.',
  '',
  'Yayına alma',
  '  1. Tarayıcıdaki adresin sonuna #yayin ekle ve Enter. Yalnız sahne görünür.',
  '  2. Oyun sayfasında bir kez tıkla (ses tarayıcı kuralı gereği ancak tıklayınca açılır).',
  '  3. TikTok LIVE Studio içinde "Pencere yakalama" kaynağı ekle ve bu tarayıcı penceresini seç.',
  '     Tarayıcı kaynağı boş görünebilir; pencere yakalama kullan.',
  '',
  'Güvenlik',
  '  Yorumlar ekranda olduğu gibi görünür. Konuşma balonlarını kapat ya da',
  '  yasaklı kelime listesini doldur (ikisi de oyundaki panelde).',
  '',
  'Sorun olursa',
  '  - "Node.js bulunamadı": tarayıcıda açılan yardım sayfasındaki adımları izle',
  '    (https://nodejs.org, LTS sürümü), sonra başlatıcıyı (BASLAT.bat, BASLAT.command ya da BASLAT.sh) yeniden aç.',
  '  - Açılış ekranı "İndirilemedi" diyor: internet bağlantını kontrol et, "Yeniden dene"ye bas.',
  '  - 403 hatası: bu klasörde komut satırı aç ve şunu çalıştır:',
  '      npm install tiktok-live-connector@latest',
  '  - "Zaten açık": başlatıcı iki kez açıldı. Tarayıcıdaki sayfayı kullan.',
  '  - Kapı dolu: başka bir program aynı kapıyı tutuyor. O programı kapatıp yeniden dene.',
  '',
  'Kodu çalıştıran yazılım TikTok ile bağlantılı değildir; resmî olmayan bir kütüphane kullanır.',
  ''
].join('\r\n');
yaz('OKU.txt', oku);

console.log('\nPaket hazır: ' + hedef + '\n');
// Paketin ZIP'i: Mac'e çalıştırma izni kaybolmadan gitsin diye BASLAT.command ve BASLAT.sh arşivde 0755 saklanır
// (Windows'ta klasörü Explorer ile sıkıştırınca bu izin kaybolur). Yayıncıya bu ZIP verilir.
const zipYolu = path.join(KOK, 'dist', ad + '.zip');
// Yalnız bu çalıştırmada yazılan dosyalar girer: klasörde önceden kalan (kilit dosyası, node_modules, notlar) girmez.
zipYaz(zipYolu, hedef, ad, { calistirilabilir: ['BASLAT.command', 'BASLAT.sh'], yalniz: yazilan });
for (const y of yazilan) console.log('  yazıldı  ' + y);
console.log('  ZIP      ' + path.relative(KOK, zipYolu) + '  (yayıncıya bunu ver: Mac başlatıcısının çalıştırma izni içinde saklı)');
console.log('\nToplam ' + yazilan.length + ' dosya. Hiçbir şey silinmedi; yeniden çalıştırırsan üstüne yazılır.\n');
