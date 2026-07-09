import { Output } from "state_machine/src/Output";

export type AudioCue = "please_knit" | "next_line" | "knitting_finished";

export interface AudioFeedbackSink {
  play(cue: AudioCue): void;
}

/** No-op sink for tests and platforms without audio assets. */
export class NullAudioFeedback implements AudioFeedbackSink {
  readonly played: AudioCue[] = [];

  play(cue: AudioCue): void {
    this.played.push(cue);
  }
}

export function audioCueForOutput(output: Output): AudioCue | null {
  switch (output) {
    case Output.PLEASE_KNIT:
      return "please_knit";
    case Output.NEXT_LINE:
      return "next_line";
    case Output.KNITTING_FINISHED:
      return "knitting_finished";
    default:
      return null;
  }
}

export function maybePlayAudio(
  output: Output,
  options: { quietMode?: boolean; sink?: AudioFeedbackSink },
): void {
  if (options.quietMode || options.sink == null) {
    return;
  }
  const cue = audioCueForOutput(output);
  if (cue != null) {
    options.sink.play(cue);
  }
}
