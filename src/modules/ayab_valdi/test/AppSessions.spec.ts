import "jasmine/src/jasmine";
import { Preferences } from "app_settings/src/Preferences";
import { Token } from "constants/src/SerialConstants";
import {
  closeAppHardwareTest,
  KNIT_FINISHED_MESSAGE,
  resetHardwareTestNotifiers,
  runAppKnit,
  sendAppHardwareTestCommand,
} from "ayab_valdi/src/AppSessions";
import { ValueNotifier } from "ayab_valdi/src/ValueNotifier";
import { NullAudioFeedback } from "ayab_valdi/src/AudioFeedback";
import { ImageSettings } from "image_settings/src/ImageSettingsComponent";
import { Mode, Alignment } from "constants/src/StateMachineConstants";

function makeSettings(): ImageSettings {
  return {
    mode: Mode.SINGLEBED,
    numColors: 2,
    startRow: 0,
    infRepeat: false,
    startNeedle: 10,
    stopNeedle: 90,
    alignment: Alignment.CENTER,
    autoMirror: false,
  };
}

describe("AppSessions", () => {
  it("reports missing image before starting knit", async () => {
    const onValidationError = jasmine.createSpy("onValidationError");
    await runAppKnit(
      {
        settings: makeSettings(),
        isKnitting: false,
        preferences: new Preferences(),
        audio: new NullAudioFeedback(),
      },
      {
        onValidationError,
        onKnitStarted: () => fail("should not start"),
        onStatusVersion: () => {},
        onFeedback: () => {},
        onKnitFinished: () => fail("should not finish"),
        onKnitRuntimeError: () => fail("should not error"),
        isDestroyed: () => false,
      },
    );
    expect(onValidationError).toHaveBeenCalledWith({
      text: "Load a pattern before knitting.",
      level: "error",
    });
  });

  it("skips knit when already knitting", async () => {
    const onKnitStarted = jasmine.createSpy("onKnitStarted");
    await runAppKnit(
      {
        settings: makeSettings(),
        isKnitting: true,
        preferences: new Preferences(),
        audio: new NullAudioFeedback(),
      },
      {
        onValidationError: () => fail("should not validate"),
        onKnitStarted,
        onStatusVersion: () => {},
        onFeedback: () => {},
        onKnitFinished: () => fail("should not finish"),
        onKnitRuntimeError: () => fail("should not error"),
        isDestroyed: () => false,
      },
    );
    expect(onKnitStarted).not.toHaveBeenCalled();
  });

  it("exposes knit finished message text", () => {
    expect(KNIT_FINISHED_MESSAGE.level).toBe("success");
    expect(KNIT_FINISHED_MESSAGE.text).toBe("Pattern completed");
  });

  it("resets hardware test notifiers", () => {
    const log = new ValueNotifier("hello");
    const ready = new ValueNotifier(true);
    resetHardwareTestNotifiers(log, ready);
    expect(log.get()).toBe("");
    expect(ready.get()).toBe(false);
  });

  it("appends command labels to hardware test log", () => {
    const log = new ValueNotifier("");
    sendAppHardwareTestCommand(undefined, log, Token.beepCmd);
    expect(log.get()).toContain("beep");
  });

  it("closes hardware test session and clears notifiers", () => {
    const log = new ValueNotifier("x");
    const ready = new ValueNotifier(true);
    closeAppHardwareTest(undefined, log, ready);
    expect(log.get()).toBe("");
    expect(ready.get()).toBe(false);
  });
});
