/** Процедурні звуки: паровоз, гудок, правильно/неправильно */
window.GameAudio = (() => {
  let ctx = null;
  let unlocked = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  async function unlock() {
    const c = getCtx();
    if (c.state === "suspended") await c.resume();
    unlocked = true;
  }

  function tone(freq, start, dur, type = "sine", gain = 0.12) {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  function noiseBurst(start, dur, gain = 0.08) {
    const c = getCtx();
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(start);
    src.stop(start + dur);
  }

  /** Чух-чух паровоза під час руху */
  function playChug(durationMs = 2200) {
    if (!unlocked) return;
    const c = getCtx();
    const t0 = c.currentTime;
    const beats = Math.floor(durationMs / 180);
    for (let i = 0; i < beats; i++) {
      const t = t0 + i * 0.18;
      noiseBurst(t, 0.1, 0.07 + (i % 2) * 0.03);
      tone(90 + (i % 2) * 20, t, 0.08, "triangle", 0.06);
    }
    // гудок
    tone(440, t0 + 0.05, 0.35, "sawtooth", 0.05);
    tone(554, t0 + 0.05, 0.35, "sawtooth", 0.04);
    tone(440, t0 + durationMs / 1000 - 0.4, 0.3, "sawtooth", 0.045);
  }

  function playCorrect() {
    if (!unlocked) return;
    const c = getCtx();
    const t0 = c.currentTime;
    tone(523, t0, 0.12, "sine", 0.1);
    tone(659, t0 + 0.12, 0.12, "sine", 0.1);
    tone(784, t0 + 0.24, 0.22, "sine", 0.12);
  }

  function playWrong() {
    if (!unlocked) return;
    const c = getCtx();
    const t0 = c.currentTime;
    tone(220, t0, 0.18, "square", 0.07);
    tone(180, t0 + 0.16, 0.28, "square", 0.06);
  }

  function playClick() {
    if (!unlocked) return;
    const c = getCtx();
    tone(660, c.currentTime, 0.06, "sine", 0.05);
  }

  return { unlock, playChug, playCorrect, playWrong, playClick };
})();
