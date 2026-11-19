// Sound and Notification manager yang aman, tangguh, dan bebas memory leak

class SoundManager {
  private ctx: AudioContext | null = null;
  private activeTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  private initCtx(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {
          // Kebijakan autoplay browser mungkin menunda audio sebelum interaksi langsung
        });
      }
      return Boolean(this.ctx);
    } catch (e) {
      console.warn('AudioContext gagal diinisialisasi:', e);
      return false;
    }
  }

  private scheduleDisconnect(gain: GainNode, osc: OscillatorNode, delayMs: number): void {
    const timer = setTimeout(() => {
      this.activeTimers.delete(timer);
      try {
        gain.disconnect();
        osc.disconnect();
      } catch {
        // Node sudah terputus
      }
    }, delayMs);
    this.activeTimers.add(timer);
  }

  /**
   * Suara chime lembut saat menyelesaikan target ibadah.
   */
  playSuccess(): void {
    try {
      if (!this.initCtx() || !this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.45);

        this.scheduleDisconnect(gain, osc, 600);
      });
    } catch (e) {
      console.warn('Audio playback not supported or blocked:', e);
    }
  }

  /**
   * Efek ketukan lembut saat tombol ditekan.
   */
  playTap(): void {
    try {
      if (!this.initCtx() || !this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.05);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);

      this.scheduleDisconnect(gain, osc, 120);
    } catch {
      // Abaikan jika Web Audio tidak tersedia
    }
  }

  /**
   * Membersihkan AudioContext dan seluruh timer aktif untuk mencegah memory leak.
   */
  dispose(): void {
    this.activeTimers.forEach((t) => clearTimeout(t));
    this.activeTimers.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {
        // ignore close error
      });
      this.ctx = null;
    }
  }
}

export const soundManager = new SoundManager();

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Gagal meminta izin notifikasi browser:', err);
    return false;
  }
}

export function sendLocalNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Gagal memunculkan notifikasi browser:', e);
    return false;
  }
}
