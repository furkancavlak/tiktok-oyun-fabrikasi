/* SES EFEKTLERİ — korna, motor, turbo, kutlama. Hepsi Web Audio ile üretilir (depoda ses dosyası yok) ve
 * çekirdeğin efekt yoluna (muzik.ses.efektYol) bağlanır: masanın "Sesi kapat" düğmesi ve düzey kaydırıcısı bunları
 * da susturur / kısar, YouTube şarkısı çalarken de duyulurlar (docs/MUZIK.md "İki yol").
 * Ses kapalıyken (muzik.acik yanlış) hiçbir şey çalmaz. Kalabalıkta sesler üst üste binmesin diye her türün en kısa
 * arası var (SES_ARA): yüz kişi aynı anda korna çalsa da birkaç korna duyulur.
 * sesKorna(guc) · sesMotor() · sesTurbo() · sesKutlama(guc)
 */
const SES_ARA = { korna: 0.12, motor: 0.5, turbo: 0.4, kutlama: 0.8 };
const sesSon = { korna: -9, motor: -9, turbo: -9, kutlama: -9 };
function sesHazir(tur) {
  if (!muzik.acik || !muzik.ses || !muzik.ctx)
    return null;
  const t = muzik.ctx.currentTime;
  if (t - sesSon[tur] < SES_ARA[tur])
    return null;
  sesSon[tur] = t;
  return t + 0.01;
}
// Tek bir ton: dalga, frekans (başta ve sonda), düzey, süre; alçak geçiren süzgeçten efekt yoluna.
function sesTon(t, dalga, f0, f1, duzey, sure, lp) {
  const x = muzik.ctx, o = x.createOscillator(), f = x.createBiquadFilter(), g = x.createGain();
  o.type = dalga;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sure);
  f.type = 'lowpass';
  f.frequency.value = lp;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(duzey, t + 0.015);
  g.gain.setValueAtTime(duzey, t + sure * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
  o.connect(f);
  f.connect(g);
  g.connect(muzik.ses.efektYol);
  o.start(t);
  o.stop(t + sure + 0.05);
}
// Süzülmüş gürültü (turbo üfürmesi, alkış tıkırtısı).
function sesGurultu(t, f0, f1, q, duzey, sure) {
  const x = muzik.ctx, n = Math.ceil(x.sampleRate * sure), buf = x.createBuffer(1, n, x.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++)
    d[i] = Math.random() * 2 - 1;
  const k = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain();
  k.buffer = buf;
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + sure);
  g.gain.setValueAtTime(duzey, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
  k.connect(f);
  f.connect(g);
  g.connect(muzik.ses.efektYol);
  k.start(t);
}
// Korna: iki sesli (araba kornası gibi küçük üçlü aralık), kısa iki vuruş "düt düüt".
function sesKorna(guc) {
  const t = sesHazir('korna');
  if (t === null)
    return;
  const d = 0.05 * (guc || 1), f = 392 + Math.random() * 30;
  for (const [b, s] of [[0, 0.12], [0.18, 0.28]]) {
    sesTon(t + b, 'square', f, f, d, s, 1400);
    sesTon(t + b, 'square', f * 1.26, f * 1.26, d * 0.8, s, 1400);
  }
}
// Motor: katılan arabanın kısa kükremesi (perdesi yükselip düşen alçak testere).
function sesMotor() {
  const t = sesHazir('motor');
  if (t === null)
    return;
  sesTon(t, 'sawtooth', 55, 120, 0.05, 0.35, 500);
  sesTon(t + 0.33, 'sawtooth', 120, 70, 0.04, 0.4, 420);
}
// Turbo: yükselen üfürme ve yükselen motor.
function sesTurbo() {
  const t = sesHazir('turbo');
  if (t === null)
    return;
  sesGurultu(t, 600, 4200, 1.2, 0.18, 0.9);
  sesTon(t, 'sawtooth', 80, 320, 0.05, 0.9, 900);
}
// Kutlama: yukarı çıkan parlak arpej ve dağınık alkış tıkırtısı.
function sesKutlama(guc) {
  const t = sesHazir('kutlama');
  if (t === null)
    return;
  const g = guc || 1;
  [523.3, 659.3, 784, 1046.5].forEach((f, i) => sesTon(t + i * 0.09, 'triangle', f, f, 0.06 * g, 0.35, 4000));
  for (let i = 0; i < Math.round(10 * g); i++)
    sesGurultu(t + 0.1 + Math.random() * 0.9, 1800, 1500, 2, 0.12 * g, 0.06);
}
