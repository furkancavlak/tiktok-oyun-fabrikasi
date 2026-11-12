/* Bağımlılıksız ZIP yazıcı (araclar/surum.js ve araclar/paket.js kullanır).
 *
 * Neden kendi yazıcımız: Windows'ta dosya sisteminde "çalıştırılabilir" biti yoktur; Explorer ya da tar.exe ile
 * sıkıştırılan paket Mac'e BASLAT.command'ın çalıştırma izni olmadan gider ve çift tıklama reddedilir. Bu yazıcı her
 * girdinin Unix izinlerini arşivin içine kendisi yazar (BASLAT.command / BASLAT.sh 0755, gerisi 0644), adları UTF-8
 * işaretiyle saklar, içeriği zlib ile sıkıştırır (deflate). ZIP64 yoktur: arşiv 4 GB'tan, girdi sayısı 65535'ten küçük
 * olmalıdır (paket ~100 MB, birkaç bin dosya).
 *
 *   zipYaz(hedef, kaynakKlasor, ustAd, { calistirilabilir: ['BASLAT.command', 'BASLAT.sh'], yalniz: [...] })
 *     kaynakKlasor'un içi arşivde ustAd/ altına yazılır. calistirilabilir: ustAd'a göre yollar.
 *   zipOku(dosya) → [{ ad, mod, boyut, sikisik }]  (merkezi dizinden; testler için)
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');

function dosDate(t) {
  const d = new Date(t);
  return {
    saat: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    tarih: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}
function gez(kl, onek, cikti) {
  for (const e of fs.readdirSync(kl, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const y = path.join(kl, e.name), ad = onek + e.name;
    if (e.isDirectory()) { cikti.push({ ad: ad + '/', yol: y, klasor: true }); gez(y, ad + '/', cikti); }
    else if (e.isFile()) cikti.push({ ad, yol: y, klasor: false });
  }
  return cikti;
}
function zipYaz(hedef, kaynak, ustAd, sec = {}) {
  const calis = new Set((sec.calistirilabilir || []).map(x => ustAd + '/' + x.replace(/\\/g, '/')));
  let girdiler = [{ ad: ustAd + '/', yol: kaynak, klasor: true }, ...gez(kaynak, ustAd + '/', [])];
  // yalniz: yalnız bu dosyalar (ustAd'a göre yollar) ve onları içeren klasörler girer; klasörde başka ne durursa dursun.
  if (sec.yalniz) {
    const dosyalar = new Set(sec.yalniz.map(x => ustAd + '/' + x.replace(/\\/g, '/'))), klasorler = new Set([ustAd + '/']);
    for (const d of dosyalar) { const p = d.split('/'); for (let i = 1; i < p.length; i++) klasorler.add(p.slice(0, i).join('/') + '/'); }
    girdiler = girdiler.filter(g => g.klasor ? klasorler.has(g.ad) : dosyalar.has(g.ad));
  }
  if (girdiler.length > 65535) throw new Error('ZIP: girdi sayısı 65535\'i geçiyor (ZIP64 desteklenmiyor).');
  const fd = fs.openSync(hedef, 'w'), merkez = [];
  let konum = 0;
  const yaz = b => { fs.writeSync(fd, b); konum += b.length; };
  try {
    for (const g of girdiler) {
      const adB = Buffer.from(g.ad, 'utf8'), st = fs.statSync(g.yol), { saat, tarih } = dosDate(st.mtimeMs);
      let veri = Buffer.alloc(0), ham = 0, crc = 0, yontem = 0;
      if (!g.klasor) {
        const icerik = fs.readFileSync(g.yol);
        ham = icerik.length; crc = zlib.crc32(icerik) >>> 0;
        const s = zlib.deflateRawSync(icerik, { level: 9 });
        if (s.length < ham) { veri = s; yontem = 8; } else { veri = icerik; yontem = 0; }
      }
      if (konum + veri.length > 0xffffffff) throw new Error('ZIP: arşiv 4 GB\'ı geçiyor (ZIP64 desteklenmiyor).');
      const mod = g.klasor ? 0o40755 : (calis.has(g.ad) ? 0o100755 : 0o100644);
      const yerel = Buffer.alloc(30);
      yerel.writeUInt32LE(0x04034b50, 0); yerel.writeUInt16LE(20, 4); yerel.writeUInt16LE(0x0800, 6); yerel.writeUInt16LE(yontem, 8);
      yerel.writeUInt16LE(saat, 10); yerel.writeUInt16LE(tarih, 12); yerel.writeUInt32LE(crc, 14);
      yerel.writeUInt32LE(veri.length, 18); yerel.writeUInt32LE(ham, 22); yerel.writeUInt16LE(adB.length, 26); yerel.writeUInt16LE(0, 28);
      const bas = konum;
      yaz(yerel); yaz(adB); if (veri.length) yaz(veri);
      const m = Buffer.alloc(46);
      m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE((3 << 8) | 20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(0x0800, 8); m.writeUInt16LE(yontem, 10);
      m.writeUInt16LE(saat, 12); m.writeUInt16LE(tarih, 14); m.writeUInt32LE(crc, 16); m.writeUInt32LE(veri.length, 20); m.writeUInt32LE(ham, 24);
      m.writeUInt16LE(adB.length, 28); m.writeUInt16LE(0, 30); m.writeUInt16LE(0, 32); m.writeUInt16LE(0, 34); m.writeUInt16LE(0, 36);
      // Dış öznitelik: üst 16 bit Unix izinleri, alt bitte MS-DOS klasör işareti (0x10).
      m.writeUInt32LE(((mod << 16) | (g.klasor ? 0x10 : 0)) >>> 0, 38); m.writeUInt32LE(bas, 42);
      merkez.push(Buffer.concat([m, adB]));
    }
    const mBas = konum, mVeri = Buffer.concat(merkez);
    yaz(mVeri);
    const son = Buffer.alloc(22);
    son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(0, 4); son.writeUInt16LE(0, 6); son.writeUInt16LE(merkez.length, 8); son.writeUInt16LE(merkez.length, 10);
    son.writeUInt32LE(mVeri.length, 12); son.writeUInt32LE(mBas, 16); son.writeUInt16LE(0, 20);
    yaz(son);
  } finally { fs.closeSync(fd); }
  return { girdi: girdiler.length, boyut: fs.statSync(hedef).size };
}
function zipOku(dosya) {
  const b = fs.readFileSync(dosya);
  let i = b.length - 22;
  while (i >= 0 && b.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) throw new Error('ZIP sonu bulunamadı');
  const n = b.readUInt16LE(i + 10), liste = [];
  let p = b.readUInt32LE(i + 16);
  for (let k = 0; k < n; k++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('merkezi dizin bozuk');
    const adU = b.readUInt16LE(p + 28), ekU = b.readUInt16LE(p + 30), yorumU = b.readUInt16LE(p + 32);
    liste.push({ ad: b.toString('utf8', p + 46, p + 46 + adU), mod: b.readUInt32LE(p + 38) >>> 16, sikisik: b.readUInt32LE(p + 20), boyut: b.readUInt32LE(p + 24), yapan: b.readUInt16LE(p + 4) >> 8 });
    p += 46 + adU + ekU + yorumU;
  }
  return liste;
}
module.exports = { zipYaz, zipOku };
