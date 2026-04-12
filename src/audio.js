export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.lastStepAt = 0;
  }

  unlock() {
    if (this.unlocked) {
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.ctx.destination);
    this.unlocked = true;
  }

  beep({ frequency = 440, duration = 0.08, type = "square", volume = 0.25, slide = 0 }) {
    if (!this.ctx || !this.master) {
      return;
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) {
      osc.frequency.linearRampToValueAtTime(frequency + slide, now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  boot() {
    this.beep({ frequency: 280, duration: 0.09, type: "triangle", volume: 0.18, slide: 60 });
    window.setTimeout(() => {
      this.beep({ frequency: 480, duration: 0.18, type: "sine", volume: 0.14, slide: 40 });
    }, 90);
  }

  step(timeMs) {
    if (timeMs - this.lastStepAt < 135) {
      return;
    }
    this.lastStepAt = timeMs;
    this.beep({ frequency: 180, duration: 0.04, type: "square", volume: 0.08, slide: -10 });
  }

  interact() {
    this.beep({ frequency: 360, duration: 0.06, type: "triangle", volume: 0.15, slide: 25 });
  }

  error() {
    this.beep({ frequency: 140, duration: 0.12, type: "sawtooth", volume: 0.12, slide: -40 });
  }

  success() {
    this.beep({ frequency: 360, duration: 0.07, type: "triangle", volume: 0.16, slide: 50 });
    window.setTimeout(() => {
      this.beep({ frequency: 520, duration: 0.12, type: "triangle", volume: 0.16, slide: 80 });
    }, 85);
  }

  zap() {
    this.beep({ frequency: 120, duration: 0.08, type: "sawtooth", volume: 0.15, slide: 220 });
    window.setTimeout(() => {
      this.beep({ frequency: 90, duration: 0.06, type: "square", volume: 0.1, slide: -30 });
    }, 35);
  }
}
