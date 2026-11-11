#!/usr/bin/env node
/* Ses eşitliği: çekirdeğin müzik dosyasını değiştirince bir oyunun müziği değişti mi? (örnek örnek)
 *
 *   node araclar/ses-esitlik.js <ad>                      şimdiki oyun.html ile son işlemedeki (HEAD) oyun.html
 *   node araclar/ses-esitlik.js <ad> --taban <git-ref>    ... ile o işlemedeki oyun.html
 *   node araclar/ses-esitlik.js <ad> --html <yol>         ... ile diskteki başka bir oyun.html
 *
 * İki sayfada da oyunun müziği aynı biçimde, sesi dosyaya yazan (OfflineAudioContext) bir bağlamda üretilir:
 * her hava tek başına (24 sn), en yüksek düzey + en hızlı tempo + şov (16 sn), havaların kendiliğinden sırayla
 * dönüşü (230 sn). İki şey karşılaştırılır:
 *   1. ÇAĞRI KAYDI: sayfanın ses motoruna verdiği her emir (düğüm kurma, bağlama, her parametre değeri ve zaman
 *      çizelgesi, başlat / durdur, tampon ve eğri içerikleri) sırasıyla kaydedilir. Kayıtlar birebir aynıysa iki sayfa
 *      motordan tıpatıp aynı sesi istemiştir. Aracın sonucu (çıkış kodu) buna bakar.
 *   2. ÖRNEKLER: üretilen sesin iki kanalının bütün 32 bitlik örnekleri. Chrome aynı sayfayı iki kez ürettiğinde bile
 *      son basamaklarda oynayabiliyor (aynı dosyayla dene: --yeni <aynı yol>); burada yalnız fark büyüklüğü yazılır.
 * Fark yoksa 0, varsa 1 koduyla çıkar. Çekirdekteki müzik değişikliğinden sonra her oyun (kendi müziği değişmediyse) aynı çalmalı.
 */
'use strict';
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url'), { execFileSync } = require('child_process');
const kok = path.join(__dirname, '..'), args = process.argv.slice(2), ad = args[0];
if (!ad || !/^[\w-]+$/.test(ad)) { console.error('Kullanım: node araclar/ses-esitlik.js <ad> [--taban <git-ref> | --html <yol>]'); process.exit(2); }
const deger = b => { const i = args.indexOf(b); return i > 0 ? args[i + 1] : null; };
const cikti = path.join(kok, 'test', 'cikti', ad);
fs.mkdirSync(cikti, { recursive: true });
// --yeni <yol>: şimdiki oyun.html yerine başka bir dosya (aracın kendi tutarlılığını ölçmek için aynı dosyayı ver)
const yeni = deger('--yeni') || path.join(kok, 'oyunlar', ad, 'oyun.html');
let eski = deger('--html');
if (!eski) {
  const ref = deger('--taban') || 'HEAD';
  eski = path.join(cikti, 'ses-esitlik-taban.html'); // depoya girmez (test/cikti)
  fs.writeFileSync(eski, execFileSync('git', ['show', ref + ':oyunlar/' + ad + '/oyun.html'], { cwd: kok, maxBuffer: 64 << 20 }));
}
let playwright;
try { playwright = require('playwright'); }
catch (e) { console.error('playwright gerekli:\n  npm install'); process.exit(2); }

// Sayfa açılmadan kurulur: ses motoruna verilen her emri window.__kayit'e yazar (düğümler kuruluş sırasıyla numaralanır).
function kaydedici() {
  const kayit = [], dugum = new WeakMap(), param = new WeakMap();
  let sayac = 0;
  window.__kayit = kayit;
  const ozet = d => { let h = 2166136261; const u = new Uint32Array(d.buffer, d.byteOffset, d.length); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; return d.length + ':' + h.toString(16); };
  const ad = x => {
    if (x instanceof AudioParam) return param.get(x) || 'param?';
    if (x instanceof AudioNode) return dugum.get(x) || 'dugum?';
    if (x instanceof AudioBuffer) { const p = []; for (let k = 0; k < x.numberOfChannels; k++) p.push(ozet(x.getChannelData(k))); return 'tampon[' + x.sampleRate + ' ' + p.join(' ') + ']'; }
    if (x instanceof Float32Array) return 'f32[' + ozet(x) + ']';
    if (typeof x === 'number') return Object.is(x, -0) ? '-0' : String(x);
    return x === undefined ? 'undefined' : JSON.stringify(x);
  };
  const yaz = (...a) => { if (window.__kayitAcik) kayit.push(a.map(ad).join(' ')); };
  const sar = (proto, adi, fn) => { const eski = proto[adi]; if (typeof eski === 'function') proto[adi] = function (...a) { return fn.call(this, eski, a); }; };
  const ozellik = (proto, adi) => { const d = Object.getOwnPropertyDescriptor(proto, adi); if (!d || !d.set) return; Object.defineProperty(proto, adi, { ...d, set(v) { yaz(this, '.' + adi + '=', v); d.set.call(this, v); } }); };
  for (const adi of Object.getOwnPropertyNames(BaseAudioContext.prototype))
    if (adi.startsWith('create'))
      sar(BaseAudioContext.prototype, adi, function (eski, a) {
        const r = eski.apply(this, a);
        if (r instanceof AudioNode) {
          dugum.set(r, 'n' + sayac++);
          for (const k in r) { try { if (r[k] instanceof AudioParam) param.set(r[k], dugum.get(r) + '.' + k); } catch (e) { } }
          yaz(adi, r, ...a);
        }
        return r;
      });
  for (const adi of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime'])
    sar(AudioParam.prototype, adi, function (eski, a) { yaz(this, adi, ...a); return eski.apply(this, a); });
  ozellik(AudioParam.prototype, 'value');
  for (const adi of ['connect', 'disconnect'])
    sar(AudioNode.prototype, adi, function (eski, a) { yaz(this, adi, ...a); return eski.apply(this, a); });
  for (const adi of ['start', 'stop'])
    sar(AudioScheduledSourceNode.prototype, adi, function (eski, a) { yaz(this, adi, ...a); return eski.apply(this, a); });
  for (const [proto, adlar] of [[OscillatorNode.prototype, ['type']], [BiquadFilterNode.prototype, ['type']], [AudioBufferSourceNode.prototype, ['buffer', 'loop', 'loopStart', 'loopEnd']], [ConvolverNode.prototype, ['buffer', 'normalize']], [WaveShaperNode.prototype, ['curve', 'oversample']]])
    for (const adi of adlar) ozellik(proto, adi);
}

// Sayfanın içinde çalışır: her senaryoyu üretir, sonucu window.__ses'te tutar, özetini (FNV-1a) ve düzeyini döndürür.
// o.kuru: yankı kolu kısılır (yankı düğümü ayrı bir iş parçacığında hesaplanabildiği için çalıştırmadan
// çalıştırmaya son basamakta oynayabilir; kuru seste iki çalıştırma birebir aynı olmalı).
async function uret(o) {
  const { Muzik, HAVALAR } = CanliOyun._test, SR = 44100, cik = [];
  window.__ses = {};
  const ozetle = buf => {
    let h = 2166136261, kare = 0, n = 0;
    for (let k = 0; k < buf.numberOfChannels; k++) {
      const d = buf.getChannelData(k), u = new Uint32Array(d.buffer, d.byteOffset, d.length);
      for (let i = 0; i < u.length; i++) { h = Math.imul(h ^ u[i], 16777619) >>> 0; kare += d[i] * d[i]; }
      n += d.length;
    }
    return { ozet: h.toString(16), rms: +Math.sqrt(kare / n).toFixed(6) };
  };
  const isle = async (etiket, hi, sn, ayar) => {
    window.__kayit.length = 0;
    window.__kayitAcik = true;
    const oc = new OfflineAudioContext(2, SR * sn, SR), m = new Muzik();
    m.hava = HAVALAR[hi];
    m.sirayla = false;
    ayar && ayar(m);
    m.sesKur(oc);
    if (o.kuru)
      m.ses.yanki.value = 0;
    m.acik = true;
    m.sonraki = 0.05;
    let adim = 0;
    while (m.sonraki < sn - 0.6) { m.adimCal(); adim++; }
    window.__kayitAcik = false;
    const kayit = window.__kayit.slice();
    window.__kayitlar = window.__kayitlar || {};
    window.__kayitlar[etiket] = kayit;
    const buf = await oc.startRendering();
    window.__ses[etiket] = [buf.getChannelData(0), buf.getChannelData(1)];
    let kh = 2166136261;
    for (const x of kayit) { for (let i = 0; i < x.length; i++) kh = Math.imul(kh ^ x.charCodeAt(i), 16777619) >>> 0; kh = Math.imul(kh ^ 10, 16777619) >>> 0; }
    cik.push({ etiket, adim, emir: kayit.length, kayitOzet: kh.toString(16), ...ozetle(buf) });
  };
  for (let hi = 0; hi < HAVALAR.length; hi++) {
    await isle(HAVALAR[hi].id, hi, 24);
    await isle(HAVALAR[hi].id + '-sov', hi, 16, m => { m.duzey = 0.7; m.sov = true; m.cosku = 1; m.carpan = 1.38; });
  }
  if (!o.kisa)
    await isle('sirayla', 0, 230, m => { m.sirayla = true; });
  return cik;
}
// Bir senaryonun bir kanalından bir dilim, ham 32 bitlik örnekler (base64).
function dilim([etiket, k, a, b]) {
  const d = window.__ses[etiket][k].subarray(a, b), u8 = new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return btoa(s);
}

(async () => {
  const b = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const ac = async yol => {
    const p = await b.newPage();
    await p.route(/fonts.(googleapis|gstatic).com/, r => r.abort());
    await p.addInitScript(() => { window.OYUN_MUZIK_KAPALI = true; });
    await p.addInitScript(kaydedici);
    await p.goto(pathToFileURL(yol).href);
    await p.waitForTimeout(300);
    return p;
  };
  const secenek = { kuru: args.includes('--kuru'), kisa: args.includes('--kisa') };
  const pe = await ac(eski), py = await ac(yeni);
  const a = await pe.evaluate(uret, secenek), y = await py.evaluate(uret, secenek);
  const tablo = [];
  let ilkFark = null;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], z = y[i] || {}, satir = { senaryo: x.etiket, adim: x.adim + (z.adim === x.adim ? '' : '/' + z.adim), emir: x.emir + (z.emir === x.emir ? '' : '/' + z.emir), kayitAyni: z.kayitOzet === x.kayitOzet, rmsEski: x.rms, rmsYeni: z.rms, farkliOrnek: 0, enBuyukFark: 0, ilkFarkSn: null };
    if (z.etiket === x.etiket && z.ozet !== x.ozet) {
      const n = await pe.evaluate(e => window.__ses[e][0].length, x.etiket), adim = 44100 * 10;
      for (let k = 0; k < 2; k++)
        for (let s0 = 0; s0 < n; s0 += adim) {
          const al = async p => { const t = Buffer.from(await p.evaluate(dilim, [x.etiket, k, s0, Math.min(n, s0 + adim)]), 'base64'); return new Float32Array(t.buffer, t.byteOffset, t.length / 4); };
          const da = await al(pe), dy = await al(py);
          for (let j = 0; j < da.length; j++) if (da[j] !== dy[j]) { satir.farkliOrnek++; satir.enBuyukFark = Math.max(satir.enBuyukFark, Math.abs(da[j] - dy[j])); if (satir.ilkFarkSn === null || (s0 + j) / 44100 < satir.ilkFarkSn) satir.ilkFarkSn = +((s0 + j) / 44100).toFixed(4); }
        }
      satir.enBuyukFark = +satir.enBuyukFark.toExponential(2);
    }
    satir.ornekAyni = z.etiket === x.etiket && z.ozet === x.ozet;
    if (!satir.kayitAyni && !ilkFark) {
      const ka = await pe.evaluate(e => window.__kayitlar[e], x.etiket), ky = await py.evaluate(e => window.__kayitlar[e], x.etiket);
      let j = 0;
      while (j < ka.length && ka[j] === ky[j]) j++;
      ilkFark = { senaryo: x.etiket, sira: j, eski: ka.slice(Math.max(0, j - 2), j + 3), yeni: ky.slice(Math.max(0, j - 2), j + 3) };
    }
    tablo.push(satir);
  }
  await b.close();
  console.table(tablo);
  if (ilkFark) console.log('İlk farklı emir:', JSON.stringify(ilkFark, null, 1));
  const fark = tablo.filter(x => !x.kayitAyni).length + Math.abs(a.length - y.length), ornek = tablo.filter(x => !x.ornekAyni).length;
  console.log((secenek.kuru ? '(yankı kolu kısık) ' : '') + (fark ? 'FARK VAR: ' + fark + ' senaryoda ses motoruna verilen emirler aynı değil.' : 'Bütün senaryolarda (' + tablo.length + ') ses motoruna verilen emirler birebir aynı (' + tablo.reduce((t, x) => t + parseInt(x.emir, 10), 0) + ' emir).'));
  console.log(ornek ? 'Üretilen örnekler ' + ornek + ' senaryoda son basamaklarda oynuyor (en büyük fark ' + Math.max(...tablo.map(x => x.enBuyukFark)) + '); aynı dosyayı iki kez üretince de oynuyorsa (--yeni ile dene) bu motorun kendisidir.' : 'Üretilen örnekler de birebir aynı.');
  process.exit(fark ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
