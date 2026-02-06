export class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
    this.masterGain = null;
    this.ambientGain = null;
    this.ambientRunning = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.03;
      this.ambientGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext not available:', e);
    }
  }

  ensureResumed() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : 1.0,
        this.ctx.currentTime,
        0.05
      );
    }
    return this.muted;
  }

  startAmbient() {
    if (!this.initialized || this.ambientRunning) return;
    this.ambientRunning = true;
    this.ensureResumed();

    // Subtle room tone - very low continuous hum
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = 60;
    filter.type = 'lowpass';
    filter.frequency.value = 100;

    osc.connect(filter);
    filter.connect(this.ambientGain);
    osc.start(now);
    this._ambientOsc = osc;
  }

  stopAmbient() {
    if (this._ambientOsc) {
      try { this._ambientOsc.stop(); } catch (e) { /* already stopped */ }
      this._ambientOsc = null;
    }
    this.ambientRunning = false;
  }

  playBounce(intensity = 0.5) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Vary the bounce sound slightly for realism
    const freqBase = 700 + intensity * 600 + (Math.random() - 0.5) * 100;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqBase, now);
    osc.frequency.exponentialRampToValueAtTime(180 + Math.random() * 40, now + 0.08);

    filter.type = 'highpass';
    filter.frequency.value = 350 + Math.random() * 100;

    gain.gain.setValueAtTime(0.25 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);

    // Click character
    this.addNoiseBurst(0.06 * intensity, 0.025 + Math.random() * 0.01);
  }

  playPaddleHit(intensity = 0.7) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;

    // Main hit tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    const freqBase = 280 + intensity * 420 + (Math.random() - 0.5) * 60;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqBase, now);
    osc.frequency.exponentialRampToValueAtTime(70 + Math.random() * 20, now + 0.1);

    gain.gain.setValueAtTime(0.3 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);

    // Rubber slap noise
    this.addNoiseBurst(0.1 * intensity, 0.035 + Math.random() * 0.015);

    // Higher intensity hits get a secondary harmonic
    if (intensity > 0.5) {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freqBase * 2.5, now);
      osc2.frequency.exponentialRampToValueAtTime(100, now + 0.06);
      gain2.gain.setValueAtTime(0.08 * intensity, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc2.start(now);
      osc2.stop(now + 0.06);
    }
  }

  playNetHit() {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);

    // Net rattle noise
    this.addNoiseBurst(0.05, 0.15);
  }

  playScore(isPlayerPoint) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;

    if (isPlayerPoint) {
      // Uplifting ascending notes
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } else {
      // Descending, slightly dissonant
      const notes = [330, 294, 262, 196];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.15;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    }
  }

  playGameOver(playerWon) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;

    if (playerWon) {
      // Victory fanfare with harmonies
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = now + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);

        // Add fifth harmony
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.type = 'sine';
        osc2.frequency.value = freq * 1.5;
        gain2.gain.setValueAtTime(0, t + 0.02);
        gain2.gain.linearRampToValueAtTime(0.08, t + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc2.start(t + 0.02);
        osc2.stop(t + 0.4);
      });
    } else {
      // Sad trombone with vibrato
      const notes = [300, 280, 260, 200];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const t = now + i * 0.3;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    }
  }

  // Whistle-like sound for serve
  playServeWhistle() {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.1);
    osc.frequency.linearRampToValueAtTime(800, now + 0.2);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
    gain.gain.setValueAtTime(0.08, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  addNoiseBurst(volume, duration) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500 + Math.random() * 1500;
    filter.Q.value = 0.8 + Math.random() * 0.5;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.start(now);
    noise.stop(now + duration);
  }
}
