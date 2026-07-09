import "jasmine/src/jasmine";
import { Output } from "state_machine/src/Output";
import { Feedback } from "ayab_valdi/src/Feedback";
import { NullAudioFeedback } from "ayab_valdi/src/AudioFeedback";

describe("Feedback audio", () => {
  it("plays please_knit cue unless quietMode", () => {
    const audio = new NullAudioFeedback();
    Feedback.notifyOutput(Output.PLEASE_KNIT, { audio });
    expect(audio.played).toEqual(["please_knit"]);
  });

  it("skips audio when quietMode is enabled", () => {
    const audio = new NullAudioFeedback();
    Feedback.notifyOutput(Output.PLEASE_KNIT, { quietMode: true, audio });
    expect(audio.played).toEqual([]);
  });

  it("plays next_line cue", () => {
    const audio = new NullAudioFeedback();
    Feedback.notifyOutput(Output.NEXT_LINE, { audio });
    expect(audio.played).toEqual(["next_line"]);
  });

  it("plays knitting_finished cue", () => {
    const audio = new NullAudioFeedback();
    Feedback.notifyOutput(Output.KNITTING_FINISHED, { audio });
    expect(audio.played).toEqual(["knitting_finished"]);
  });
});
