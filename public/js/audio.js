export class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.muted = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
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

  playBounce(intensity = 0.5) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    // Table tennis ball bounce sound: sharp, high-pitched click
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800 + intensity * 600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    filter.type = 'highpass';
    filter.frequency.value = 400;

    gain.gain.setValueAtTime(0.3 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.1);

    // Add a noise burst for the "click" character
    this.addNoiseBurst(0.08 * intensity, 0.03);
  }

  playPaddleHit(intensity = 0.7) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;

    // Paddle hit: deeper thud with rubber character
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300 + intensity * 400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

    gain.gain.setValueAtTime(0.35 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);

    // Rubber slap noise
    this.addNoiseBurst(0.12 * intensity, 0.04);
  }

  playNetHit() {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playScore(isPlayerPoint) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;
    const baseFreq = isPlayerPoint ? 440 : 220;

    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine';
      const freq = isPlayerPoint
        ? baseFreq * (1 + i * 0.25)
        : baseFreq * (1 - i * 0.15);
      osc.frequency.setValueAtTime(freq, now + i * 0.15);

      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);

      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    }
  }

  playGameOver(playerWon) {
    if (!this.initialized || this.muted) return;
    this.ensureResumed();

    const now = this.ctx.currentTime;

    if (playerWon) {
      // Victory fanfare
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.2);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.2 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.4);
        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.4);
      });
    } else {
      // Sad trombone
      const notes = [300, 280, 260, 200];
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.3);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.3 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.3 + 0.5);
        osc.start(now + i * 0.3);
        osc.stop(now + i * 0.3 + 0.5);
      });
    }
  }

  addNoiseBurst(volume, duration) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * duration;
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
    filter.frequency.value = 3000;
    filter.Q.value = 1;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.start(now);
    noise.stop(now + duration);
  }
}
