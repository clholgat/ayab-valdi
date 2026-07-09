import "jasmine/src/jasmine";
import { Output } from "state_machine/src/Output";
import { Feedback } from "ayab_valdi/src/Feedback";

describe("Feedback", () => {
  it("maps WAIT_FOR_INIT to carriage instructions", () => {
    const msg = Feedback.forOutput(Output.WAIT_FOR_INIT);
    expect(msg).not.toBeNull();
    expect(msg!.text.toLowerCase()).toContain("carriage");
    expect(msg!.level).toBe("info");
  });

  it("maps ERROR_WRONG_API to blocking recovery guidance", () => {
    const msg = Feedback.forOutput(Output.ERROR_WRONG_API);
    expect(msg).not.toBeNull();
    expect(msg!.level).toBe("blocking");
    expect(msg!.text.toLowerCase()).toContain("firmware");
    expect(msg!.text).toContain("ayab-desktop");
    expect(msg!.text).toContain("Load AYAB firmware");
  });

  it("maps PLEASE_KNIT to info message", () => {
    const msg = Feedback.forOutput(Output.PLEASE_KNIT);
    expect(msg).not.toBeNull();
    expect(msg!.text).toBe("Please knit.");
  });

  it("maps KNITTING_FINISHED to pattern sent confirmation", () => {
    const msg = Feedback.forOutput(Output.KNITTING_FINISHED);
    expect(msg).not.toBeNull();
    expect(msg!.text).toBe("Pattern completed");
    expect(msg!.level).toBe("success");
  });

  it("returns null for NONE and NEXT_LINE", () => {
    expect(Feedback.forOutput(Output.NONE)).toBeNull();
    expect(Feedback.forOutput(Output.NEXT_LINE)).toBeNull();
  });

  it("notifyOutput skips audio when quiet mode is enabled", () => {
    const audio = { play: jasmine.createSpy("play") };
    const msg = Feedback.notifyOutput(Output.PLEASE_KNIT, {
      quietMode: true,
      audio,
    });
    expect(msg?.text).toBe("Please knit.");
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("notifyOutput plays audio when quiet mode is off", () => {
    const audio = { play: jasmine.createSpy("play") };
    Feedback.notifyOutput(Output.KNITTING_FINISHED, {
      quietMode: false,
      audio,
    });
    expect(audio.play).toHaveBeenCalledWith("knitting_finished");
  });
});
