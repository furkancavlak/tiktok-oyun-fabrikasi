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
const kokPaket = JSON.parse(fs.readFileSync(path.join(KOK, 'package.json'), 'utf8').replace(/^﻿/, ''));
const surum = (kokPaket.dependencies || {})['tiktok-live-connector'];
if (!surum) dur('Kök package.json içinde tiktok-live-connector bağımlılığı bulunamadı.');
for (const y of [kopruYol, baslatYol]) if (!fs.existsSync(y)) dur('Eksik dosya: ' + y);

const hedef = path.join(KOK, 'dist', ad);
fs.mkdirSync(hedef, { recursive: true });

const yazilan = [];
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
// Oyunun içine gömülü kitaplıkların lisansı pakette de durur (oyun.json "kitaplik": ["three"] → kitaplik/LICENSE-three.txt).
for (const k of Array.isArray(bilgi.kitaplik) ? bilgi.kitaplik : []) {
  const lisans = path.join(KOK, 'kitaplik', 'LICENSE-' + k + '.txt');
  if (fs.existsSync(lisans))
    kopyala(lisans, 'LICENSE-' + k + '.txt');
}

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
  '  1. Windows bilgisayar ve Node.js (https://nodejs.org adresinden LTS sürümü).',
  '  2. TikTok LIVE Studio erişimi olan bir hesap.',
  '',
  'Başlatma',
  '  1. BASLAT.bat dosyasına çift tıkla.',
  '  2. İlk seferde kütüphane iner; internet gerekir. Bu bir kez olur.',
  '  3. TikTok kullanıcı adını yaz (başında @ olmadan), Enter.',
  '  4. Oyun tarayıcıda açılır. Yayın açıksa yorumlar oyuna akmaya başlar.',
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
  '  - "Node.js bulunamadı": Node.js kur, BASLAT.bat dosyasını yeniden aç.',
  '  - 403 hatası: bu klasörde komut satırı aç ve şunu çalıştır:',
  '      npm install tiktok-live-connector@latest',
  '  - Kapı dolu: köprü zaten açık olabilir. Pencereyi kapat ya da --port 9000 ekle.',
  '',
  'Kodu çalıştıran yazılım TikTok ile bağlantılı değildir; resmî olmayan bir kütüphane kullanır.',
  ''
].join('\r\n');
yaz('OKU.txt', oku);

console.log('\nPaket hazır: ' + hedef + '\n');
for (const y of yazilan) console.log('  yazıldı  ' + y);
console.log('\nToplam ' + yazilan.length + ' dosya. Hiçbir şey silinmedi; yeniden çalıştırırsan üstüne yazılır.\n');
