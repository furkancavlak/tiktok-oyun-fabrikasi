#!/usr/bin/env node
/* Yeni oyun başlatır: şablonu oyunlar/<ad>/ altına kopyalar, adlarını yazar, ilk derlemeyi yapar.
 *
 *   node araclar/yeni-oyun.js <ad> "<Görünen Ad>"
 *   node araclar/yeni-oyun.js konvoy "Gelin Konvoyu"
 *
 * <ad>: klasör adı; küçük harf, rakam ve tire (Türkçe harf yok).
 * Var olan bir klasörün üstüne yazmaz.
 */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const kok = path.join(__dirname, '..'), [ad, gorunen] = process.argv.slice(2);
if (!ad || !/^[a-z0-9][a-z0-9-]*$/.test(ad) || !gorunen) {
  console.error('Kullanım: node araclar/yeni-oyun.js <ad> "<Görünen Ad>"\n  <ad> küçük harf, rakam ve tire olmalı (örn. konvoy, at-yarisi).');
  process.exit(2);
}
const kaynak = path.join(kok, 'sablon'), hedef = path.join(kok, 'oyunlar', ad);
if (fs.existsSync(hedef)) { console.error('oyunlar/' + ad + ' zaten var. Başka bir ad seç.'); process.exit(1); }

function kopyala(nereden, nereye) {
  fs.mkdirSync(nereye, { recursive: true });
  for (const g of fs.readdirSync(nereden, { withFileTypes: true })) {
    const a = path.join(nereden, g.name), b = path.join(nereye, g.name);
    if (g.isDirectory()) kopyala(a, b);
    else if (g.name !== 'oyun.html') fs.copyFileSync(a, b);
  }
}
kopyala(kaynak, hedef);

// adları yaz: oyun.json ve 00-ayar.js içindeki ilk id / ad alanları. aciklama, ana sayfadaki kartta görünen tek
// cümledir; şablonunki geçicidir, oyunun kuralları belli olunca oyunun kendi cümlesiyle değiştirilir.
let sablonBilgi = {};
try { sablonBilgi = JSON.parse(fs.readFileSync(path.join(kaynak, 'oyun.json'), 'utf8').replace(/^﻿/, '')); } catch (e) { }
fs.writeFileSync(path.join(hedef, 'oyun.json'), JSON.stringify({ ad: gorunen, paket: ad, aciklama: String(sablonBilgi.aciklama || '') }, null, 2) + '\n');
const ayarYol = path.join(hedef, 'js', '00-ayar.js');
if (fs.existsSync(ayarYol)) {
  const tirnak = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  let s = fs.readFileSync(ayarYol, 'utf8');
  s = s.replace(/\bid:\s*'[^']*'/, 'id: ' + tirnak(ad)).replace(/\bad:\s*'[^']*'/, 'ad: ' + tirnak(gorunen));
  // logo iki parçadır; ikinci parça vurgu rengiyle yazılır
  const kelime = gorunen.trim().split(/\s+/), orta = Math.ceil(kelime.length / 2);
  s = s.replace(/\blogo:\s*\[[^\]]*\]/, 'logo: [' + tirnak(kelime.slice(0, orta).join(' ')) + ', ' + tirnak(kelime.slice(orta).join(' ')) + ']');
  fs.writeFileSync(ayarYol, s);
}
// Üretilen 10-oyun.js'in başına açık bir not: bu dosya artık oyunun kendisidir, üstüne yazılır. (Önceki ajanlar
// şablonu bozmaktan çekinip yanına ikinci bir kanca dosyası açtı; aynı kanca iki kez tanımlanınca sonuncusu geçer.)
const oyunYol = path.join(hedef, 'js', '10-oyun.js');
if (fs.existsSync(oyunYol)) {
  const not = [
    '/* ════════════════════════════════════════════════════════════════════════════════════════════════════',
    ' * BU DOSYA ARTIK SENİN OYUNUN (oyunlar/' + ad + '/js/10-oyun.js). ŞABLON DEĞİL, KORUMAN GEREKMİYOR.',
    ' * İçindeki kancaları oyununa göre DEĞİŞTİR ya da dosyanın tamamını SİLİP BAŞTAN YAZ. Asıl şablon',
    ' * sablon/ klasöründe durur, buradaki değişiklik ona dokunmaz.',
    ' * Büyüyünce konuya göre böl (20-hareket.js, 30-dekor.js, 40-cizim.js); her kanca yalnız BİR dosyada tanımlı kalsın.',
    ' * (Bu notu da silebilirsin.)',
    ' * ════════════════════════════════════════════════════════════════════════════════════════════════════ */',
    ''
  ].join('\n');
  fs.writeFileSync(oyunYol, not + fs.readFileSync(oyunYol, 'utf8'));
}
execFileSync(process.execPath, [path.join(__dirname, 'derle.js'), ad], { stdio: 'inherit' });

console.log('\noyunlar/' + ad + ' hazır. Sırada:');
console.log('  1. oyunlar/' + ad + '/js/00-ayar.js   kurallar, yazılar, hediye kademeleri');
console.log('     ve MÜZİK: OYUN.muzik içinde takımı seç, en az iki özgün hava yaz (docs/MUZIK.md).');
console.log('     Her oyunun kendi müziği olur; seçmeden bırakırsan derleme uyarır, testler kalır.');
console.log('     oyunlar/' + ad + '/oyun.json "aciklama": ana sayfadaki kartın tek cümlesi; kurallara göre yeniden yaz.');
console.log('  2. oyunlar/' + ad + '/js/10-oyun.js   ŞABLONUN KOPYASI, SENİN DOSYAN: üstüne yaz ya da silip baştan yaz');
console.log('     (kancalar docs/KANCALAR.md; sahne ve çizim için yeni dosyalar aç)');
console.log('  3. node araclar/derle.js ' + ad + ' && node araclar/kare-cek.js ' + ad + '   kareye bak');
console.log('  4. node araclar/test.js ' + ad + '      çekirdek testleri');
console.log('  5. node kopru.js --deneme --oyun ' + ad + ' --ac   köprüyle, TikTok\'suz dene');
