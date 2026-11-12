/* MÜZİK — her oyunun kendi müziği burada sentezlenir; ses dosyası yoktur.
 * Her oyun kendi 00-ayar.js'inde hangi çalgı takımının hangi ezgileri çalacağını söyler:
 *   OYUN.muzik = { takim: 'dugun', havalar: [ { id, ad, bpm, … }, … ] }       (yazım: docs/MUZIK.md)
 * TAKIMLAR: çalgı takımları. Takım, davul satırındaki harflerin neye benzeyeceğini, ezgiyi neyin çalacağını,
 *   varsa bas, akor ya da demi belirler. Yeni takım eklemek için docs/MUZIK.md "Yeni takım".
 * HAVALAR: bu oyunun ezgileri · Muzik: zamanlayıcı + ses zinciri · muzik: tek örnek
 * Önemli: oyunun bütün hareketi "vuruş" saatine (B) bağlıdır ve o saat buradan gelir: muzik.beatAt().
 * Ses kapalıyken de saat işler (performance.now ile); ses açılınca AudioContext saatine geçilir (tabanDegistir).
 */
// Nota yazımı: "derece:süre". Derece dizinin kaçıncı sesi (0 = karar), süre adım sayısı.
// ' = üstten çarpma, ~ = tril, - = sus.
function ezgiCoz(yazi) {
  const notalar = [];
  let toplam = 0;
  for (const p of String(yazi || '').split(/\s+/)) {
    if (!p || p === '|')
      continue;
    const [sol, sure] = p.split(':');
    const len = +sure;
    const n = { len, sus: sol === '-', carpma: sol.includes("'"), tril: sol.includes('~'), deg: parseInt(sol, 10) || 0 };
    notalar.push(n);
    toplam += len;
  }
  return { notalar, toplam };
}
// Bir havayı çalınır hâle getirir: bölümleri form sırasıyla adım haritasına yayar (ezgi ve varsa eşlik).
function havaHazirla(h) {
  h.harita = [];
  h.bolumBas = [];
  if (h.eslik)
    h.eslikHarita = [];
  for (const ad of h.form) {
    const b = ezgiCoz(h.bolum[ad]);
    if (b.toplam % h.bar)
      console.warn('Bölüm ölçüye oturmuyor:', h.id, ad, b.toplam);
    h.bolumBas.push({ bas: h.harita.length, uz: b.toplam, ad });
    let i = h.harita.length;
    h.harita.length += b.toplam;
    for (const n of b.notalar) {
      h.harita[i] = n;
      i += n.len;
    }
    if (h.eslik) {
      // eşlik (akor kökleri): ezgiyle aynı yazım; bölümün eşliği yoksa bölüm boyunca karar sesi
      const e = ezgiCoz(h.eslik[ad] || ('0:' + b.toplam)), bas = h.harita.length - b.toplam;
      if (e.toplam !== b.toplam)
        console.warn('Eşlik bölümle aynı uzunlukta değil:', h.id, ad, e.toplam, b.toplam);
      h.eslikHarita.length = h.harita.length;
      let j = bas;
      for (const n of e.notalar) {
        if (j < h.harita.length)
          h.eslikHarita[j] = n;
        j += n.len;
      }
    }
  }
  h.formAdim = h.harita.length;
  // her adımda geçerli akor (eşlik notası ileri doldurulur): ses açılınca ya da saat atlayınca da bas doğru kökte girer
  if (h.eslikHarita) {
    h.akorHarita = [];
    let son = { deg: 0, sus: false };
    for (let i = 0; i < h.formAdim; i++)
      h.akorHarita[i] = son = h.eslikHarita[i] || son;
  }
  h.sent = d => { const o = Math.floor(d / 7), i = ((d % 7) + 7) % 7; return h.dizi[i] + 1200 * o; };
  h.frek = d => h.tonik * Math.pow(2, h.sent(d) / 1200);
  return h;
}

/* ---- ses yapı taşları (yeni takımlar bunları kullanır) ----
 * Hepsi m.ses.davul gibi bir veri yoluna bağlanır; sıkıştırıcı ve yankı ortaktır (sesKur).
 */
// Perdesi düşen tek bir ton: davul gövdesi, tom, ince zil tınısı.
function mzTon(m, t, tur, f0, f1, egim, v, sure, hedef) {
  const c = m.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = tur;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0)
    o.frequency.exponentialRampToValueAtTime(f1, t + egim);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
  o.connect(g);
  g.connect(hedef || m.ses.davul);
  o.start(t);
  o.stop(t + sure + 0.02);
}
// Süzülmüş kısa gürültü: tokmak sesi, el çırpma, zil, hi-hat.
function mzGurultu(m, t, sure, tur, frek, v, q, hedef) {
  const c = m.ctx, k = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  k.buffer = m.ses.gurultu;
  f.type = tur;
  f.frequency.value = frek;
  f.Q.value = q;
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
  k.connect(f);
  f.connect(g);
  g.connect(hedef || m.ses.davul);
  k.start(t, (t * 5.71) % 0.9, sure + 0.02);
}
// Sürekli çalan ezgi sesi (klarnet, bakır nefesli): osilatörler hep açık, nota açıp kapayan bir genlik kapısı.
// o: { dalga: [[tür, düzey, ince ayar sent]], egri (hafif doyma, tanh sürüşü), hp, tepe: [[frek, Q, dB]], lp, lpQ,
//      nefes: [frek, düzey], vibHz, seviye }
function mzEzgiKur(m, ctx, o, hedef) {
  const perde = ctx.createConstantSource();
  perde.offset.value = 0;
  perde.start();
  const lfo = ctx.createOscillator(), vib = ctx.createGain();
  lfo.frequency.value = o.vibHz;
  vib.gain.value = 3;
  lfo.connect(vib);
  lfo.start();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = o.hp;
  let giris = hp;
  if (o.egri) {
    // hafif doyma: tepeleri yuvarlar (sesi sertleştirmeden tepe düzeyini indirir), küçük sinyalde kazanç ~1
    const sek = ctx.createWaveShaper(), egri = new Float32Array(1024), k = o.egri;
    for (let i = 0; i < 1024; i++)
      egri[i] = Math.tanh((i / 511.5 - 1) * k) / k;
    sek.curve = egri;
    sek.connect(hp);
    giris = sek;
  }
  let son = hp;
  for (const [f, q, db] of o.tepe || []) {
    const p = ctx.createBiquadFilter();
    p.type = 'peaking';
    p.frequency.value = f;
    p.Q.value = q;
    p.gain.value = db;
    son.connect(p);
    son = p;
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = o.lp;
  lp.Q.value = o.lpQ || 0.7;
  son.connect(lp);
  const amp = ctx.createGain();
  amp.gain.value = 0;
  const cik = ctx.createGain();
  cik.gain.value = o.seviye;
  lp.connect(amp);
  amp.connect(cik);
  cik.connect(hedef);
  const osc = [];
  for (const [tur, duzey, ince] of o.dalga) {
    const x = ctx.createOscillator(), g = ctx.createGain();
    x.type = tur;
    x.frequency.value = m.hava.tonik;
    x.detune.value = ince || 0;
    g.gain.value = duzey;
    perde.connect(x.detune);
    vib.connect(x.detune);
    x.connect(g);
    g.connect(giris);
    x.start();
    osc.push(x);
  }
  if (o.nefes) {
    // nefes: notayla birlikte açılan, süzülmüş hafif gürültü
    const k = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    k.buffer = m.ses.gurultu;
    k.loop = true;
    f.type = 'bandpass';
    f.frequency.value = o.nefes[0];
    f.Q.value = 0.8;
    g.gain.value = o.nefes[1];
    k.connect(f);
    f.connect(g);
    g.connect(amp);
    k.start();
  }
  return { perde: perde.offset, amp: amp.gain, vib: vib.gain, lp: lp.frequency, osc, cik: cik.gain, o };
}
// Ezgi sesinde bir nota. o.kesik < 1: nota süresinin o kadarında susar (bakır nefeslide kısa, kesik çalış).
// o.filtre = [taban, tepe]: her notada süzgeç tepeye fırlar, tabana iner (bakırın "pat" diye açılışı).
function mzEzgiNota(m, z, n, t, dur) {
  const o = z.o, h = m.hava, uz = n.len * dur;
  if (n.sus) {
    z.amp.setTargetAtTime(0, t, 0.02);
    return;
  }
  const c = h.sent(n.deg), ust = h.sent(n.deg + 1);
  z.amp.setTargetAtTime(o.dip, Math.max(0, t - 0.01), 0.004);
  z.amp.setTargetAtTime(1, t + 0.002, o.atak);
  if (o.kesik < 1)
    z.amp.setTargetAtTime(0, t + uz * o.kesik, 0.025);
  if (o.filtre) {
    z.lp.setTargetAtTime(o.filtre[1], t, 0.012);
    z.lp.setTargetAtTime(o.filtre[0], t + 0.05, 0.14);
  }
  if (n.carpma) {
    z.perde.setValueAtTime(ust, t);
    z.perde.setTargetAtTime(c, t + 0.034, 0.008);
  }
  else
    z.perde.setTargetAtTime(c, t, o.kayma);
  if (n.tril) {
    const ad = Math.min(0.085, dur * 0.5), kac = Math.floor(uz * 0.55 / ad);
    for (let i = 1; i <= kac; i++)
      z.perde.setTargetAtTime(i % 2 ? ust : c, t + i * ad, 0.008);
  }
  z.vib.setTargetAtTime(o.vib[0], t, 0.02);
  if (uz > 0.28)
    z.vib.setTargetAtTime(o.vib[1], t + 0.14, 0.1);
}
// Kısa çalınan bas notası: testere + alt sinüs, süzgeç zarfıyla yuvarlak.
function mzBas(m, f, t, uz, v, o) {
  const c = m.ctx, g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = o.q;
  lp.frequency.setValueAtTime(o.lp[1], t);
  lp.frequency.setTargetAtTime(o.lp[0], t + 0.01, 0.06);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.006);
  g.gain.setTargetAtTime(v * o.surme, t + 0.02, 0.08);
  g.gain.setTargetAtTime(0.0001, t + uz, 0.03);
  for (const [tur, duzey] of o.dalga) {
    const x = c.createOscillator(), d = c.createGain();
    x.type = tur;
    x.frequency.value = f;
    d.gain.value = duzey;
    x.connect(d);
    d.connect(lp);
    x.start(t);
    x.stop(t + uz + 0.25);
  }
  lp.connect(g);
  g.connect(m.ses.bas);
}
// Akor vuruşu (bakır "stab"): üç ses, her biri iki hafif akort farklı testere, süzgeç zarfı.
function mzAkor(m, kok, t, uz, v, o) {
  const c = m.ctx, h = m.hava, g = c.createGain(), lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(o.lp[1], t);
  lp.frequency.setTargetAtTime(o.lp[0], t + 0.02, 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.012);
  g.gain.setTargetAtTime(v * 0.55, t + 0.04, 0.1);
  g.gain.setTargetAtTime(0.0001, t + uz, 0.05);
  for (const d of [0, 2, 4])
    for (const ince of [-6, 6]) {
      const x = c.createOscillator();
      x.type = 'sawtooth';
      x.frequency.value = h.frek(kok + d) * o.oktav;
      x.detune.value = ince;
      x.connect(lp);
      x.start(t);
      x.stop(t + uz + 0.4);
    }
  lp.connect(g);
  g.connect(m.ses.akor);
}
// Bas satırı harfi → derece: 1 kök, 3 üçlü, 5 beşli, 8 oktav (akor kökünün üstünde)
const BAS_ARALIK = { 1: 0, 3: 2, 5: 4, 8: 7 };

/* ---- ÇALGI TAKIMLARI ----
 * harf: davul (ve üst) satırındaki harfin oyuna giden olayı: 'dum' / 'tek' (çalgıcı ve ışıkları oynatır), '' olay yok.
 * dolgu: coşku ve şovda boş adımlara konan harf · satirlar: havanın bu takımda okunan ek satırları
 * havalar: takımın hazır ezgileri (oyun havalar vermezse bunlar çalar)
 * kur(m, ctx): sesleri kurar, m.ses.kanal'ı doldurur · vur(m, harf, t, s, dur): davul / üst satır harfi
 * satir(m, ad, harf, t, dur): bas ve akor satırı · nota(m, n, t, dur): ezgi · havaGecis(m, h, t) · sustur(m, t, iptal)
 */
const TAKIMLAR = {};

// Davul zurna: halayın takımı. Değiştirme: halay bununla örnek örnek aynı çalmalı (cekirdek/test/muzik.test.js).
TAKIMLAR['davul-zurna'] = {
  ad: 'Davul zurna: tokmak + çubuk, kamışlı zurna, alttan dem',
  harf: { D: 'dum', T: 'tek', k: 'tek' },
  dolgu: 'k',
  satirlar: [],
  havalar: [
    { id: 'harman', ad: 'Harman Yeri', bpm: 104, spb: 4, bar: 16, tonik: 415.3,
      dizi: [0, 150, 300, 500, 700, 880, 1000],
      davul: { ana: 'D..kT.k.D.D.T.k.', cesni: 'D..kT.kkD.DkT.T.', gecis: 'D.TkD.TkDkTkTTTT' },
      bolum: {
        A: "4:4 4:2 5':2 4:2 3:2 4:4 | 3:2 4:2 3:2 2:2 3:4 2:4 | 2:2 3:2 4':2 3:2 2:2 1:2 2:4 | 1:2 2:2 1:2 0:2 0~:8",
        B: "4:2 5:2 6:2 7:2 7:4 6:2 7':2 | 8:4 7:2 6:2 7:2 6:2 5:4 | 6':2 5:2 4:2 5:2 4:2 3:2 4:4 | 3:2 2:2 1:2 2:2 0~:8",
        D: "-:16 -:16"
      }, form: 'AABBD' },
    { id: 'toz', ad: 'Toz Duman', bpm: 132, spb: 4, bar: 8, tonik: 392,
      dizi: [0, 120, 390, 500, 700, 800, 1000],
      davul: { ana: 'D.kkT.k.', cesni: 'D.kTT.kk', gecis: 'DkTkTTTT' },
      bolum: {
        A: "4:2 4:1 5:1 4:2 3:2 | 2:2 3:2 4:4 | 4:2 4:1 5:1 4:2 3:2 | 2:2 1:2 0:4 | 0:1 1:1 2:1 3:1 4:2 4:2 | 5':2 4:2 3:2 2:2 | 3:1 2:1 1:2 2:1 1:1 0:2 | 0~:4 0:2 -:2",
        B: "7:2 7:2 6:1 7:1 6:2 | 5:2 6:2 5:4 | 6':2 5:1 6:1 5:2 4:2 | 5:2 4:2 4:4 | 4:1 5:1 6:1 5:1 4:1 3:1 2:2 | 3:2 2:2 1:2 2:2 | 3:1 2:1 1:1 0:1 1:2 0:2 | 0~:6 -:2",
        D: "-:8 -:8 -:8 -:8"
      }, form: 'AABBD' },
    { id: 'cifte', ad: 'Çifte Mendil', bpm: 84, spb: 3, bar: 6, tonik: 404,
      dizi: [0, 140, 300, 500, 700, 800, 1000],
      davul: { ana: 'D.kT.k', cesni: 'D.kTkk', gecis: 'DkkTTT' },
      bolum: {
        A: "4:2 4:1 5':2 4:1 | 3:2 2:1 3:3 | 4:2 3:1 2:2 1:1 | 2:3 2:3 | 3:2 3:1 4':2 3:1 | 2:2 1:1 2:3 | 3:1 2:1 1:1 2:1 1:1 0:1 | 0~:6",
        B: "7:3 6:2 7':1 | 6:2 5:1 6:3 | 5:2 6:1 5:2 4:1 | 5:3 4:3 | 4:1 5:1 6:1 5:1 4:1 3:1 | 4':2 3:1 2:3 | 3:1 2:1 1:1 2:1 1:1 0:1 | 0~:6",
        D: "-:6 -:6 -:6 -:6"
      }, form: 'AABBD' }
  ],
  kur(m, ctx) {
    const s = m.ses;
    const zb = ctx.createGain();
    zb.gain.value = 1;
    zb.connect(s.ana);
    zb.connect(s.yankiDugum);
    const zurnaKur = (seviye, parlak) => {
      const perde = ctx.createConstantSource();
      perde.offset.value = 0;
      perde.start();
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = m.hava.tonik;
      const o2 = ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.value = m.hava.tonik;
      o2.detune.value = 6;
      const g1 = ctx.createGain();
      g1.gain.value = 0.6;
      const g2 = ctx.createGain();
      g2.gain.value = 0.22;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.7;
      const vib = ctx.createGain();
      vib.gain.value = 4;
      lfo.connect(vib);
      for (const o of [o1, o2]) {
        perde.connect(o.detune);
        vib.connect(o.detune);
      }
      const sek = ctx.createWaveShaper(), egri = new Float32Array(1024);
      for (let i = 0; i < 1024; i++)
        egri[i] = Math.tanh((i / 511.5 - 1) * 2.4);
      sek.curve = egri;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 540;
      const f1 = ctx.createBiquadFilter();
      f1.type = 'peaking';
      f1.frequency.value = 1350;
      f1.Q.value = 2.0;
      f1.gain.value = 12;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'peaking';
      f2.frequency.value = 2750;
      f2.Q.value = 2.4;
      f2.gain.value = 11;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = parlak;
      const amp = ctx.createGain();
      amp.gain.value = 0;
      const cik = ctx.createGain();
      cik.gain.value = seviye;
      o1.connect(g1);
      g1.connect(sek);
      o2.connect(g2);
      g2.connect(sek);
      sek.connect(hp);
      hp.connect(f1);
      f1.connect(f2);
      f2.connect(lp);
      lp.connect(amp);
      amp.connect(cik);
      cik.connect(zb);
      o1.start();
      o2.start();
      lfo.start();
      return { perde: perde.offset, amp: amp.gain, vib: vib.gain, o1, o2, cik: cik.gain };
    };
    s.zurna = zurnaKur(0.23, 6800);
    s.dem = zurnaKur(0.055, 3000);
    s.kanal = { davul: s.davul.gain, ezgi: s.zurna.cik, eslik: s.dem.cik, yanki: s.yanki };
  },
  vur(m, ch, t, s) {
    if (ch === 'D')
      m.dum(t, s === 0 ? 1 : 0.8);
    else if (ch === 'T')
      m.tek(t, 0.8);
    else
      m.tek(t, m.sov ? 0.45 : 0.3);
  },
  nota(m, n, t, dur) {
    const z = m.ses.zurna, h = m.hava, uz = n.len * dur;
    m.ses.dem.amp.setTargetAtTime(n.sus && n.len >= h.bar ? 0 : 1, t, n.sus ? 0.06 : 0.25);
    if (n.sus) {
      z.amp.setTargetAtTime(0, t, 0.015);
      return;
    }
    const c = h.sent(n.deg), ust = h.sent(n.deg + 1);
    z.amp.setTargetAtTime(0.3, Math.max(0, t - 0.008), 0.004);
    z.amp.setTargetAtTime(1, t + 0.004, 0.012);
    if (n.carpma) {
      z.perde.setValueAtTime(ust, t);
      z.perde.setTargetAtTime(c, t + 0.034, 0.006);
    }
    else
      z.perde.setTargetAtTime(c, t, 0.007);
    if (n.tril) {
      const ad = Math.min(0.085, dur * 0.5), kac = Math.floor(uz * 0.55 / ad);
      for (let i = 1; i <= kac; i++)
        z.perde.setTargetAtTime(i % 2 ? ust : c, t + i * ad, 0.008);
    }
    z.vib.setTargetAtTime(3, t, 0.02);
    if (uz > 0.28)
      z.vib.setTargetAtTime(20, t + 0.12, 0.09);
  },
  havaGecis(m, h, t) {
    for (const z of [m.ses.zurna, m.ses.dem]) {
      z.o1.frequency.setValueAtTime(h.tonik, t);
      z.o2.frequency.setValueAtTime(h.tonik, t);
    }
  },
  sustur(m, t, iptal) {
    for (const z of [m.ses.zurna, m.ses.dem]) {
      if (iptal)
        z.amp.cancelScheduledValues(t);
      z.amp.setTargetAtTime(0, t, 0.02);
    }
  }
};

// Sürekli ezgi sesli takımlar için ortak parçalar: kurulum, nota, hava geçişi, susturma.
function mzSurekliTakim(tanim) {
  return Object.assign({
    kur(m, ctx) {
      const s = m.ses, T = this;
      const yol = (v, yankiya) => { const g = ctx.createGain(); g.gain.value = v; g.connect(s.ana); if (yankiya) g.connect(s.yankiDugum); return g; };
      const eb = yol(1, true), esl = yol(1, false);
      s.bas = ctx.createGain();
      s.bas.gain.value = T.basDuzey || 0;
      s.bas.connect(esl);
      s.akor = ctx.createGain();
      s.akor.gain.value = T.akorDuzey || 0;
      s.akor.connect(esl);
      s.akor.connect(s.yankiDugum);
      s.ezgi = mzEzgiKur(m, ctx, T.ezgi, eb);
      s.kanal = { davul: s.davul.gain, ezgi: s.ezgi.cik, eslik: esl.gain, yanki: s.yanki };
    },
    nota(m, n, t, dur) { mzEzgiNota(m, m.ses.ezgi, n, t, dur); },
    havaGecis(m, h, t) {
      for (const x of m.ses.ezgi.osc)
        x.frequency.setValueAtTime(h.tonik, t);
    },
    sustur(m, t, iptal) {
      if (iptal)
        m.ses.ezgi.amp.cancelScheduledValues(t);
      m.ses.ezgi.amp.setTargetAtTime(0, t, 0.02);
    },
    satir(m, ad, ch, t, dur) {
      const k = m.akor.sus ? null : m.akor.deg;
      if (k === null)
        return;
      if (ad === 'bas' && ch in BAS_ARALIK)
        mzBas(m, m.hava.frek(k + BAS_ARALIK[ch]) * this.basSes.oktav, t, dur * this.basSes.boy, 0.9, this.basSes);
      else if (ad === 'akor' && (ch === 'x' || ch === 'X'))
        mzAkor(m, k, t, dur * this.akorSes.boy, ch === 'X' ? 0.55 : 0.42, this.akorSes);
    }
  }, tanim);
}

// Düğün / oyun havası: darbuka (düm, tek, ka, parmak trili), def zilleri, klarnet, alttan yumuşak bas.
TAKIMLAR.dugun = mzSurekliTakim({
  ad: 'Düğün oyun havası: darbuka, def zili, klarnet, alttan bas',
  harf: { D: 'dum', T: 'tek', k: 'tek', r: 'tek', z: '' },
  dolgu: 'k',
  satirlar: ['ust', 'bas'],
  davulDuzey: 1.5,
  basDuzey: 0.22,
  // klarnet: kare dalga (tek sayılı harmonikler) + üçgen, yumuşak alçak geçiren, biraz nefes; geniş vibrato, kaygan geçiş
  ezgi: { dalga: [['square', 0.5, 0], ['triangle', 0.5, -5]], hp: 170, tepe: [[1500, 1.1, 4]], lp: 2600, lpQ: 0.6, nefes: [2400, 0.05],
    vibHz: 6.3, seviye: 0.42, dip: 0.25, atak: 0.014, kesik: 0.94, kayma: 0.016, vib: [4, 16] },
  basSes: { dalga: [['triangle', 0.8], ['sine', 0.6]], lp: [500, 1400], q: 0.7, surme: 0.5, oktav: 0.25, boy: 2.6 },
  vur(m, ch, t, s, dur) {
    if (ch === 'D') {
      // düm: derin, kısa perde düşüşlü gövde + yumuşak vuruş
      mzTon(m, t, 'sine', 200, 104, 0.03, s === 0 ? 0.95 : 0.8, 0.32);
      mzGurultu(m, t, 0.03, 'lowpass', 700, 0.22, 0.7);
    }
    else if (ch === 'T') {
      // tek: kenardan, parlak ve çınlayan
      mzGurultu(m, t, 0.04, 'bandpass', 3800, 0.42, 1.1);
      mzTon(m, t, 'triangle', 1180, 930, 0.04, 0.17, 0.07);
    }
    else if (ch === 'k')
      this.ka(m, t, m.sov ? 0.6 : 0.42);
    else if (ch === 'r') {
      // parmak trili: bir adımda üç hafif vuruş
      this.ka(m, t, 0.4);
      this.ka(m, t + dur / 3, 0.3);
      this.ka(m, t + dur * 2 / 3, 0.36);
    }
    else if (ch === 'z') {
      // def zili: iki kısa, ince çıngırak
      mzGurultu(m, t, 0.14, 'bandpass', 7200, 0.16, 3);
      mzGurultu(m, t + 0.013, 0.1, 'bandpass', 9400, 0.1, 3);
    }
  },
  ka(m, t, v) {
    mzGurultu(m, t, 0.028, 'bandpass', 3100, 0.5 * v, 1);
    mzTon(m, t, 'triangle', 1000, 820, 0.03, 0.2 * v, 0.045);
  }
});

// Maç gecesi: seksenler televizyon spor jeneriği. Davul makinesi (bas davul, trampet, el çırpma, hi-hat, tom),
// yuvarlak synth bas, bakır nefesli ezgi ve kısa akor vuruşları.
TAKIMLAR.mac = mzSurekliTakim({
  ad: 'Maç gecesi: seksenler TV spor jeneriği, davul makinesi, synth bas, bakır nefesli',
  harf: { D: 'dum', m: 'dum', T: 'tek', g: 'tek', c: 'tek', h: '', o: '' },
  dolgu: 'g',
  satirlar: ['ust', 'bas', 'akor'],
  davulDuzey: 1.6,
  basDuzey: 0.18,
  akorDuzey: 0.075,
  // bakır: iki hafif akort farklı testere, her notada açılıp kapanan süzgeç, kısa ve kesik çalış
  ezgi: { dalga: [['sawtooth', 0.42, -7], ['sawtooth', 0.42, 7]], hp: 220, tepe: [[1100, 1, 3]], lp: 1300, lpQ: 0.9,
    egri: 1.6, vibHz: 5.4, seviye: 0.9, dip: 0, atak: 0.016, kesik: 0.8, kayma: 0.01, vib: [2, 9], filtre: [1900, 4000] },
  basSes: { dalga: [['sawtooth', 0.55], ['sine', 0.8]], lp: [380, 1100], q: 1.4, surme: 0.6, oktav: 0.25, boy: 1.7 },
  akorSes: { lp: [1300, 3000], oktav: 0.5, boy: 3 },
  vur(m, ch, t, s) {
    if (ch === 'D') {
      mzTon(m, t, 'sine', 135, 48, 0.07, s === 0 ? 0.7 : 0.6, 0.3);
      mzGurultu(m, t, 0.008, 'lowpass', 3000, 0.25, 0.7);
    }
    else if (ch === 'T' || ch === 'g') {
      const v = ch === 'T' ? 1 : m.sov ? 0.32 : 0.26;
      mzGurultu(m, t, 0.15, 'bandpass', 2400, 0.5 * v, 0.6);
      mzGurultu(m, t, 0.07, 'highpass', 6000, 0.12 * v, 0.7);
      mzTon(m, t, 'triangle', 205, 160, 0.05, 0.32 * v, 0.08);
    }
    else if (ch === 'c') {
      // el çırpma: üç kısa çarpma, ardından kısa kuyruk
      for (let i = 0; i < 3; i++)
        mzGurultu(m, t + i * 0.011, 0.013, 'bandpass', 1250, 0.5, 1.3);
      mzGurultu(m, t + 0.033, 0.13, 'bandpass', 1250, 0.36, 1.3);
    }
    else if (ch === 'm') {
      mzTon(m, t, 'sine', 175, 112, 0.1, 0.6, 0.24);
      mzGurultu(m, t, 0.02, 'lowpass', 1200, 0.12, 0.7);
    }
    else if (ch === 'h')
      mzGurultu(m, t, 0.035, 'highpass', 7600, 0.16, 0.7);
    else if (ch === 'o')
      mzGurultu(m, t, 0.2, 'highpass', 7000, 0.11, 0.7);
  }
});

// Oyunun müzik bildirimi (00-ayar.js: OYUN.muzik). Bildirim yoksa eskisi gibi davul zurna ve onun üç havası.
const MUZIK_AYAR = OYUN.muzik || {};
const TAKIM = (() => {
  const ad = MUZIK_AYAR.takim || 'davul-zurna';
  if (TAKIMLAR[ad])
    return TAKIMLAR[ad];
  console.error('OYUN.muzik.takim bilinmiyor: "' + ad + '". Takımlar: ' + Object.keys(TAKIMLAR).join(', ') + ' (docs/MUZIK.md). Şimdilik davul zurna çalar.');
  return TAKIMLAR['davul-zurna'];
})();
// Havanın satırları takıma uyuyor mu: her kalıp bar uzunluğunda, harfler takımın bildiği harfler, form harfleri
// bölümlerde var. Yanlışlar konsola hata olarak düşer (testler kalır); çalarken tanınmayan harf boş adım sayılır.
const SATIR_HARF = { bas: '1358', akor: 'xX' };
function havaDenetle(takim, h) {
  const hata = [];
  for (const ad of ['davul', 'ust', 'bas', 'akor']) {
    const r = h[ad];
    if (!r)
      continue;
    if (ad !== 'davul' && !takim.satirlar.includes(ad)) {
      console.warn('Hava ' + h.id + ': bu takım "' + ad + '" satırını çalmaz (çalınan satırlar: davul' + takim.satirlar.map(x => ', ' + x).join('') + ').');
      continue;
    }
    const izin = '.' + (SATIR_HARF[ad] || Object.keys(takim.harf).join(''));
    for (const [k, v] of Object.entries(r)) {
      if (typeof v !== 'string' || v.length !== h.bar)
        hata.push(ad + '.' + k + ' ' + h.bar + ' karakter olmalı (' + (typeof v === 'string' ? v.length : typeof v) + ')');
      else if ([...v].some(c => !izin.includes(c)))
        hata.push(ad + '.' + k + ' içinde tanınmayan harf: ' + [...new Set([...v].filter(c => !izin.includes(c)))].join('') + ' (izinli: ' + izin + ')');
    }
  }
  for (const b of h.form)
    if (!h.bolum[b])
      hata.push('form "' + h.form + '" içindeki ' + b + ' bölümü yok');
  if (hata.length)
    console.error('Hava ' + h.id + ' (' + (Object.keys(TAKIMLAR).find(k => TAKIMLAR[k] === takim) || '?') + '): ' + hata.join('; ') + ' (docs/MUZIK.md)');
}
// Havalar: kendi ezgilerin (nesne) ya da takımın hazır ezgilerinden birinin id'si.
function havalarKur(takim, liste) {
  const cik = [];
  for (const x of liste && liste.length ? liste : takim.havalar.length ? takim.havalar : TAKIMLAR['davul-zurna'].havalar) {
    const h = typeof x === 'string' ? takim.havalar.find(y => y.id === x) : x;
    if (!h || !h.bolum || !h.form || !h.davul || !h.dizi) {
      console.error('Hava tanımı eksik ya da bulunamadı:', typeof x === 'string' ? x : x && x.id, '(docs/MUZIK.md)');
      continue;
    }
    if (!h.harita) {
      havaDenetle(takim, h);
      havaHazirla(h);
    }
    cik.push(h);
  }
  return cik.length ? cik : TAKIMLAR['davul-zurna'].havalar.map(h => h.harita ? h : havaHazirla(h));
}
const HAVALAR = havalarKur(TAKIM, MUZIK_AYAR.havalar);

class Muzik {
  constructor(takim, havalar) {
    this.takim = takim || TAKIM;
    this.havalar = havalar || HAVALAR;
    this.hava = this.havalar[0];
    this.bekleyen = null;
    this.adim = 0;
    this.beat = 0;
    this.sonraki = null;
    this.iz = [];
    this.olaylar = [];
    this.carpan = 1;
    this.sov = false;
    this.cosku = 0;
    this.ctx = null;
    this.acik = false;
    this.duzey = 0.6;
    this.sirayla = true;
    this.havaSure = 0;
    this.enVurus = 0;
    this.akor = { deg: 0, sus: false };
    // hazır parçalar (isteğe bağlı): oyunun kendi muzik/liste.js'i varsa dolar
    this.parcalar = [];
    this.muzikKok = 'muzik/';
    this.kaynak = 'sentez';
    this.hazirCal = false;
    this.hazirSira = 0;
    this.hz = null;
    this.calar = null;
    this.disSessiz = false; // disSustur: başka bir kaynak (YouTube, 12-youtube.js) çalarken oyunun sesi kısık
  }
  simdi() { return this.acik ? this.ctx.currentTime : performance.now() / 1000; }
  beatAt(t) {
    let v;
    if (this.hazirCal)
      v = this.hazirVurus();
    else {
      const iz = this.iz;
      if (!iz.length)
        return this.beat;
      let e = iz[0];
      for (let i = iz.length - 1; i >= 0; i--)
        if (iz[i].t <= t) {
          e = iz[i];
          break;
        }
      v = e.beat + (t - e.t) / e.bd;
    }
    if (!(v >= this.enVurus))
      return this.enVurus;
    this.enVurus = v;
    return v; // saat asla geri gitmez
  }
  planla(ufuk) {
    if (this.hazirCal) {
      this.hazirPlanla();
      return;
    }
    const t = this.simdi();
    if (this.sonraki === null)
      this.sonraki = t + 0.05;
    else if (this.sonraki < t - 0.4)
      this.atla(t + 0.05);
    let guard = 0;
    while (this.sonraki < t + ufuk && guard++ < 400)
      this.adimCal();
    while (this.iz.length > 2 && this.iz[1].t < t - 0.5)
      this.iz.shift();
  }
  // Ana iş parçacığı uzun süre kilitlenince (olay seli, ağır bir kare) zamanı geçmiş adımlar çalınmaz, ama
  // vuruş sayacı o adımlar kadar ileri alınır. Eskiden yalnız "sonraki" şimdiye çekiliyordu: sayaç geride kaldığı
  // için yeni adımların vuruşu, saatin o ana dek (son kayıttan ileri yürüterek) gösterdiği vuruştan küçük kalıyor,
  // B kilit süresi kadar donuyordu (beatAt geri gitmez, bekler).
  atla(hedef) {
    const h = this.hava, dur = 60 / (h.bpm * this.carpan) / h.spb, n = Math.ceil((hedef - this.sonraki) / dur);
    if (!(n > 0))
      return;
    this.sonraki += n * dur;
    this.beat += n / h.spb;
    this.havaSure += n * dur;
    this.adim = (this.adim + n) % h.formAdim;
  }
  // Satır seçimi (davul, üst, bas, akor): ölçüler sırayla ana / cesni; bölümün son ölçüsü gecis; davul solosunda
  // cesni / gecis. Satırda o kalıp yoksa ana çalar.
  kalip(r, solo, sonOlcu, olcu) {
    const ad = solo ? (olcu % 2 ? 'gecis' : 'cesni') : sonOlcu ? 'gecis' : (olcu % 2 ? 'cesni' : 'ana');
    return r[ad] || r.ana || '';
  }
  adimCal() {
    let h = this.hava;
    const T = this.takim;
    if (this.sirayla && !this.bekleyen && this.adim === 0 && this.havaSure > 100)
      this.bekleyen = this.havalar[(this.havalar.indexOf(h) + 1) % this.havalar.length];
    if (this.bekleyen && this.adim % h.bar === 0) {
      h = this.hava = this.bekleyen;
      this.bekleyen = null;
      this.adim = 0;
      this.havaSure = 0;
      this.akor = { deg: 0, sus: false };
      if (this.ses)
        T.havaGecis(this, h, this.sonraki);
    }
    const t = this.sonraki, dur = 60 / (h.bpm * this.carpan) / h.spb;
    this.iz.push({ t, beat: this.beat, bd: dur * h.spb, adim: this.adim });
    // davul
    const s = this.adim % h.bar, olcu = Math.floor(this.adim / h.bar);
    const bol = h.bolumBas.find(b => this.adim >= b.bas && this.adim < b.bas + b.uz);
    const sonOlcu = bol && this.adim >= bol.bas + bol.uz - h.bar;
    const solo = bol && bol.ad === 'D'; // ezgi ve eşlik susar, davul tek başına çalar
    let ch = this.kalip(h.davul, solo, sonOlcu, olcu)[s];
    if (ch === '.' && (solo || this.sov || (this.cosku > 0.6 && s % 2 === 0)))
      ch = T.dolgu;
    if (ch in T.harf) {
      if (this.acik)
        T.vur(this, ch, t, s, dur);
      if (T.harf[ch])
        this.olaylar.push({ t, tip: T.harf[ch] });
    }
    // takımın ek satırları: üst (zil, hi-hat), bas, akor
    if (T.satirlar.length) {
      if (h.akorHarita)
        this.akor = h.akorHarita[this.adim];
      for (const ad of T.satirlar) {
        const r = h[ad];
        if (!r || (solo && ad !== 'ust'))
          continue;
        const c2 = this.kalip(r, solo, sonOlcu, olcu)[s];
        if (!c2 || c2 === '.')
          continue;
        if (ad === 'ust') {
          if (!(c2 in T.harf))
            continue;
          if (this.acik)
            T.vur(this, c2, t, s, dur);
          if (T.harf[c2]) // ses kapalıyken de: oyunun gördüğü olaylar sesten bağımsız
            this.olaylar.push({ t, tip: T.harf[c2] });
        }
        else if (this.acik)
          T.satir(this, ad, c2, t, dur);
      }
    }
    // ezgi
    const n = h.harita[this.adim];
    if (n) {
      if (this.acik)
        T.nota(this, n, t, dur);
      if (!n.sus)
        this.olaylar.push({ t, tip: 'nota', deg: n.deg });
    }
    this.adim = (this.adim + 1) % h.formAdim;
    this.beat += 1 / h.spb;
    this.sonraki += dur;
    this.havaSure += dur;
  }
  sesKur(ctx) {
    this.ctx = ctx;
    const ana = ctx.createGain();
    ana.gain.value = 0.7;
    const sik = ctx.createDynamicsCompressor();
    sik.threshold.value = -14;
    sik.ratio.value = 5;
    sik.attack.value = 0.004;
    sik.release.value = 0.16;
    const son = ctx.createGain();
    son.gain.value = this.duzey; /* düzey sıkıştırıcıdan sonra ayarlanır */
    ana.connect(sik);
    sik.connect(son);
    son.connect(ctx.destination);
    // açık hava yankısı: sönümlenen gürültüden üretilmiş kısa bir tepki
    const yanki = ctx.createConvolver(), uz = Math.floor(ctx.sampleRate * 1.1), tb = ctx.createBuffer(2, uz, ctx.sampleRate), r = rastgeleUret(7);
    for (let k = 0; k < 2; k++) {
      const d = tb.getChannelData(k);
      for (let i = 0; i < uz; i++)
        d[i] = (r() * 2 - 1) * Math.pow(1 - i / uz, 3.2);
    }
    yanki.buffer = tb;
    const yg = ctx.createGain();
    yg.gain.value = 0.16;
    yanki.connect(yg);
    yg.connect(ana);
    const davul = ctx.createGain();
    davul.gain.value = this.takim.davulDuzey || 1.75;
    davul.connect(ana);
    davul.connect(yanki);
    const gb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), gd = gb.getChannelData(0);
    for (let i = 0; i < gd.length; i++)
      gd[i] = r() * 2 - 1;
    this.ses = { ana, son, davul, yanki: yg.gain, yankiDugum: yanki, gurultu: gb };
    this.takim.kur(this, ctx);
  }
  dum(t, v) {
    if (!this.acik)
      return;
    const c = this.ctx, s = this.ses;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.13);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    o.connect(g);
    g.connect(s.davul);
    o.start(t);
    o.stop(t + 0.46);
    this.fis(t, 0.035, 'lowpass', 900, 0.5 * v);
  }
  tek(t, v) {
    if (!this.acik)
      return;
    const c = this.ctx, s = this.ses;
    this.fis(t, 0.055, 'bandpass', 3300, 0.55 * v);
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(640, t);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.04);
    g.gain.setValueAtTime(0.3 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g);
    g.connect(s.davul);
    o.start(t);
    o.stop(t + 0.07);
  }
  fis(t, sure, tur, frek, v) {
    const c = this.ctx, s = this.ses, k = c.createBufferSource();
    k.buffer = s.gurultu;
    const f = c.createBiquadFilter();
    f.type = tur;
    f.frequency.value = frek;
    f.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    k.connect(f);
    f.connect(g);
    g.connect(s.davul);
    k.start(t, (t * 7.13) % 0.9, sure + 0.02);
  }
  zil(guc) {
    if (!this.acik)
      return;
    const c = this.ctx, t = c.currentTime + 0.01;
    for (const [f, v] of [[1760, 0.12], [2637, 0.07], [3520, 0.04 * guc]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 + 0.3 * guc);
      o.connect(g);
      g.connect(this.ses.ana);
      o.start(t);
      o.stop(t + 1);
    }
  }
  tabanDegistir(ac) {
    const eski = this.simdi(), b = this.beatAt(eski), ileri = this.iz.find(e => e.t > eski), sonBd = this.iz.length ? this.iz[this.iz.length - 1].bd : 0.5;
    this.acik = ac;
    const yeni = this.simdi();
    let bd = sonBd;
    if (ileri) {
      this.adim = ileri.adim;
      this.beat = ileri.beat;
      this.sonraki = yeni + Math.max(0.04, ileri.t - eski);
      if (ileri.beat > b + 1e-6)
        bd = (this.sonraki - yeni) / (ileri.beat - b);
    }
    else
      this.sonraki = yeni + 0.05;
    this.iz = [{ t: yeni, beat: b, bd, adim: -1 }];
    this.olaylar.length = 0; // köprü dilimi: yeni saatte ilk adıma tam vuruşunda varır
  }
  async sesAc(beklemeden) {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC)
        return false;
      this.sesKur(new AC());
    }
    const p = this.ctx.resume();
    if (beklemeden) {
      await Promise.race([p, new Promise(r => setTimeout(r, 500))]);
      if (this.ctx.state !== 'running')
        return false;
    }
    else
      await p;
    if (!this.acik)
      this.tabanDegistir(true);
    this.ses.son.gain.setTargetAtTime(this.disSessiz ? 0 : this.duzey, this.ctx.currentTime, 0.05);
    if (this.kaynak === 'hazir' && !this.hazirCal)
      this.hazirBaslat(this.hz ? this.hz.no : 0);
    return true;
  }
  async sesKapat() {
    if (!this.acik)
      return;
    this.sentezeDon();
    this.takim.sustur(this, this.ctx.currentTime, false);
    this.tabanDegistir(false);
    await this.ctx.suspend();
  }
  duzeyAyarla(v) {
    this.duzey = v;
    if (this.calar)
      this.calar.volume = clamp(v / 0.7, 0, 1);
    if (this.acik && !this.disSessiz)
      this.ses.son.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
  // Oyunun sesini dışarıdan kısar / geri açar (12-youtube.js: YouTube'dan şarkı çalarken). Yalnız duyulan ses değişir:
  // üretilen müzik, hazır parça ve hediye zili sessiz akmaya devam eder; vuruş saati (B), hava, tempo, ses açık /
  // kapalı durumu hiç değişmez. disSustur(false) her şeyi kaldığı hâliyle duyulur kılar.
  disSustur(evet) {
    this.disSessiz = !!evet;
    if (this.calar)
      this.calar.muted = this.disSessiz;
    if (this.acik)
      this.ses.son.gain.setTargetAtTime(this.disSessiz ? 0 : this.duzey, this.ctx.currentTime, 0.05);
  }

  /* ---- hazır parçalar ----
   * Oyunun kendi muzik/ klasöründeki (oyunlar/<ad>/muzik/) kayıtlar bir ses öğesiyle çalınır; vuruş saati o kaydın
   * önceden ölçülmüş vuruşlarından gelir (araclar/muzik-hazirla.py <klasör> <ad>). Ses kapalıyken ya da parça
   * açılamazsa oyunun üretilen müziği sürer.
   */
  hazirKur(liste) {
    this.parcalar = (Array.isArray(liste) ? liste : [])
      .filter(p => p && typeof p.dosya === 'string' && /^[\w.-]+$/.test(p.dosya) && Array.isArray(p.vurus) && p.vurus.length > 8 && p.vurus.every(Number.isFinite))
      .slice(0, 12)
      .map(p => ({ ad: kisalt(temiz(p.ad || p.dosya), 28), dosya: p.dosya, bpm: clamp(+p.bpm || 100, 40, 240), kayma: (p.kayma | 0) & 3, vurus: p.vurus }));
    return this.parcalar.length;
  }
  async kaynakSec(k) {
    this.kaynak = k === 'hazir' && this.parcalar.length ? 'hazir' : 'sentez';
    if (this.kaynak === 'sentez')
      this.sentezeDon();
    else if (this.acik && !this.hazirCal)
      return this.hazirBaslat(this.hz ? this.hz.no : 0);
    return true;
  }
  async hazirBaslat(no) {
    const n = this.parcalar.length;
    if (!n)
      return false;
    no = ((no % n) + n) % n;
    const p = this.parcalar[no], sira = ++this.hazirSira;
    if (!this.calar) {
      const a = this.calar = new Audio();
      a.preload = 'auto';
      a.preservesPitch = true;
      a.addEventListener('ended', () => { if (this.hazirCal)
        this.hazirBaslat(this.hz.no + 1); });
      a.addEventListener('error', () => { if (this.hazirCal)
        this.sentezeDon(); });
    }
    const a = this.calar;
    // Parça yüklenirken dans donmasın: saat, son tempoyla kendi kendine yürür.
    if (this.hazirCal)
      this.hz.bos = { b: this.enVurus, s: performance.now() / 1000, hiz: this.parcalar[this.hz.no].bpm / 60 * a.playbackRate };
    a.src = this.muzikKok + p.dosya;
    a.volume = clamp(this.duzey / 0.7, 0, 1);
    a.muted = this.disSessiz;
    a.playbackRate = clamp(this.carpan, 1, 1.25);
    try {
      await a.play();
    }
    catch (e) {
      if (sira === this.hazirSira)
        this.sentezeDon();
      return false;
    }
    if (sira !== this.hazirSira)
      return false;
    if (this.kaynak !== 'hazir' || !this.acik) {
      a.pause();
      return false;
    }
    // Yeni parçanın ölçü başı, dansın dört vuruşluk döngüsünün başına denk getirilir.
    const once = p.vurus[0] / (p.vurus[1] - p.vurus[0]);
    this.hz = { no, i: 0, taban: Math.ceil((this.enVurus + p.kayma + once) / 4 - 1e-6) * 4, t: a.currentTime, s: performance.now() / 1000, yari: -1, bos: null };
    if (!this.hazirCal) {
      this.hazirCal = true;
      this.takim.sustur(this, this.ctx.currentTime, true);
    }
    this.iz.length = 0;
    this.olaylar.length = 0;
    return true;
  }
  sentezeDon() {
    this.hazirSira++;
    if (this.calar)
      this.calar.pause();
    if (!this.hazirCal)
      return;
    this.hazirCal = false;
    // Üretilen müzik bir sonraki ölçü başında girer; araya kadar saat aynı tempoda yürür.
    const t = this.simdi(), b = this.enVurus, bd = 60 / (this.hava.bpm * this.carpan), nb = Math.ceil(b / 4 + 1e-6) * 4;
    this.iz = [{ t, beat: b, bd, adim: -1 }];
    this.adim = 0;
    this.beat = nb;
    this.sonraki = t + (nb - b) * bd;
    this.havaSure = 0;
    this.olaylar.length = 0;
  }
  hazirSaat() {
    // Ses öğesinin saati kaba adımlarla ilerleyebilir; kendi saatimizi yürütüp ona yumuşakça yaklaştırırız.
    const a = this.calar, hz = this.hz, simdi = performance.now() / 1000;
    let t = hz.t + (a.paused ? 0 : (simdi - hz.s) * a.playbackRate);
    const fark = a.currentTime - t;
    t = Math.abs(fark) > 0.25 ? a.currentTime : t + fark * 0.06;
    hz.t = t;
    hz.s = simdi;
    return t;
  }
  hazirVurus() {
    const hz = this.hz;
    if (hz.bos)
      return hz.bos.b + (performance.now() / 1000 - hz.bos.s) * hz.bos.hiz;
    const p = this.parcalar[hz.no], v = p.vurus, t = this.hazirSaat();
    let i = hz.i;
    while (i < v.length - 2 && v[i + 1] <= t)
      i++;
    while (i > 0 && v[i] > t)
      i--;
    hz.i = i;
    return hz.taban + i - p.kayma + (t - v[i]) / (v[i + 1] - v[i]);
  }
  hazirPlanla() {
    const a = this.calar, hiz = clamp(this.carpan, 1, 1.25);
    if (Math.abs(a.playbackRate - hiz) > 0.004)
      a.playbackRate = hiz;
    // Çalgıcıların eli kolu vuruşla oynasın: her vuruşta düm, arasında tek, ezgiciye gezinen bir perde.
    const yari = Math.floor(this.enVurus * 2), hz = this.hz;
    if (hz.yari >= 0 && yari > hz.yari) {
      const t = this.simdi();
      this.olaylar.push({ t, tip: yari % 2 ? 'tek' : 'dum' }, { t, tip: 'nota', deg: [3, 4, 5, 4, 2, 3, 1, 4][yari % 8] });
    }
    hz.yari = yari;
  }
  calanAd() { return this.hazirCal ? this.parcalar[this.hz.no].ad : this.hava.ad; }
  calanBpm() { return this.hazirCal ? this.parcalar[this.hz.no].bpm * this.calar.playbackRate : this.hava.bpm * this.carpan; }
}
const muzik = new Muzik();
