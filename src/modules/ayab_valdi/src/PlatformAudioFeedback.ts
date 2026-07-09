import { Device } from "valdi_core/src/Device";
import { AudioCue, AudioFeedbackSink } from "./AudioFeedback";

/** Play short tones on web; no-op recording sink elsewhere. */
export class PlatformAudioFeedback implements AudioFeedbackSink {
  private context: AudioContext | null = null;

  play(cue: AudioCue): void {
    if (!Device.isWeb()) {
      return;
    }
    try {
      const AudioContextCtor =
        (globalThis as typeof globalThis & { AudioContext?: typeof AudioContext })
          .AudioContext ??
        (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      if (!this.context) {
        this.context = new AudioContextCtor();
      }
      const ctx = this.context;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      if (cue === "please_knit") {
        oscillator.frequency.value = 880;
        gain.gain.value = 0.08;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.12);
      } else if (cue === "next_line") {
        oscillator.frequency.value = 660;
        gain.gain.value = 0.05;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.05);
      } else {
        oscillator.frequency.value = 523;
        gain.gain.value = 0.08;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio unavailable — ignore.
    }
  }
}
