#!/usr/bin/env node
/* three.js kitaplığını oyuna gömülebilir düz betiğe çevirir: kitaplik/three.js (genel THREE nesnesi).
 *
 *   node araclar/kitaplik-three.js <three.module.js yolu>
 *
 * Girdi: three.js r160'ın tek dosyalık ES modülü (import'u yok, sonunda tek bir "export { … };" satırı var).
 * Çıktı: aynı kod bir işlevin içine sarılır, son satırdaki export listesi döndürülen nesneye dönüşür:
 *   var THREE = (function () { … return { ACESFilmicToneMapping, …, sRGBEncoding }; })();
 * Baştaki MIT lisans başlığı korunur. Ağ yok, bağımlılık yok; aynı girdi her seferinde aynı çıktıyı verir.
 * Oyun "kitaplik": ["three"] dediğinde araclar/derle.js bu dosyayı kendi <script>'i olarak oyun.html'e gömer.
 */
'use strict';
const fs = require('fs'), path = require('path');
const KOK = path.join(__dirname, '..');
const girdi = process.argv[2];
if (!girdi || !fs.existsSync(girdi)) {
  console.error('Kullanım: node araclar/kitaplik-three.js <three.module.js yolu>');
  process.exit(2);
}
let kod = fs.readFileSync(girdi, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
const surum = /const REVISION = '(\d+)'/.exec(kod);
if (!surum || surum[1] !== '160')
  console.warn('UYARI: beklenen three.js r160, bulunan ' + (surum ? 'r' + surum[1] : 'bilinmiyor'));
if (/^\s*import\s/m.test(kod) || /import\.meta/.test(kod))
  hata('Girdide import var: tek dosyalık (bağımlılıksız) modül gerekir.');
if (/<\/script/i.test(kod))
  hata('Girdide "</script" geçiyor: sayfaya gömülemez.');
const exportlar = [...kod.matchAll(/^export\s*\{([^}]*)\};?\s*$/gm)];
if (exportlar.length !== 1)
  hata('Girdide tek bir "export { … };" satırı bekleniyordu, ' + exportlar.length + ' bulundu.');
const adlar = exportlar[0][1].split(',').map(s => s.trim()).filter(Boolean);
if (adlar.some(a => !/^[\w$]+$/.test(a)))
  hata('Export listesinde yeniden adlandırma (as) var; bu araç desteklemiyor.');
if (/^export\s/m.test(kod.replace(exportlar[0][0], '')))
  hata('Girdide başka export satırı var.');
// Lisans başlığı en üstte kalır (sarmalayıcının dışında): kim okursa önce onu görür.
const lisans = /^\/\*\*[\s\S]*?\*\/\n/.exec(kod);
if (!lisans || !/@license/.test(lisans[0]) || !/MIT/.test(lisans[0]))
  hata('Girdinin başında MIT lisans başlığı bulunamadı.');
kod = kod.slice(lisans[0].length).replace(exportlar[0][0], 'return { ' + adlar.join(', ') + ' };');
const cikti = lisans[0] +
  '/* Bu dosya üretilir: node araclar/kitaplik-three.js <three.module.js>. three.js r160, genel THREE nesnesi olarak. */\n' +
  'var THREE = (function () {\n\'use strict\';\n' + kod + '\n})();\n';
fs.mkdirSync(path.join(KOK, 'kitaplik'), { recursive: true });
fs.writeFileSync(path.join(KOK, 'kitaplik', 'three.js'), cikti);
console.log('kitaplik/three.js yazıldı (' + cikti.length + ' karakter, ' + adlar.length + ' ad).');

function hata(ileti) { console.error(ileti); process.exit(1); }
