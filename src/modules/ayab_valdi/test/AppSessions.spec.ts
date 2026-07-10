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
import { KnitSession } from "ayab_valdi/src/KnitSession";
import { ValueNotifier } from "ayab_valdi/src/ValueNotifier";
import { NullAudioFeedback } from "ayab_valdi/src/AudioFeedback";
import { ImageSettings } from "image_settings/src/ImageSettingsComponent";
import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { prepareImageBitsForKnit } from "state_machine/src/ImageOrientation";

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

  it("does not invoke callbacks if the caller was destroyed while awaiting a prior active knit run", async () => {
    const bits = prepareImageBitsForKnit([[new Uint8Array([0, 0, 0, 255])]]);
    const params = {
      settings: makeSettings(),
      isKnitting: false,
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 1,
      preferences: new Preferences(),
      serialPort: "Simulation",
      audio: new NullAudioFeedback(),
    };

    // Call #1: starts a real (Simulation) knit run, becoming the module-level
    // activeKnitRun that a second, later call will have to await.
    let firstSession: KnitSession | undefined;
    const firstCall = runAppKnit(params, {
      onValidationError: () => fail("call #1 should not hit a validation error"),
      onKnitStarted: (session) => {
        firstSession = session;
      },
      onStatusVersion: () => {},
      onFeedback: () => {},
      onKnitFinished: () => {},
      onKnitRuntimeError: () => {},
      isDestroyed: () => false,
    });

    // Wait for call #1 to actually start (onKnitStarted is synchronous once
    // tryStart succeeds), then immediately start call #2 - representing a
    // later startKnit() invocation whose caller (e.g. the App component) has
    // since been destroyed.
    for (let i = 0; i < 40 && !firstSession; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(firstSession).toBeDefined();

    let secondValidationError = false;
    let secondKnitStarted = false;
    const secondCall = runAppKnit(params, {
      onValidationError: () => {
        secondValidationError = true;
      },
      onKnitStarted: () => {
        secondKnitStarted = true;
      },
      onStatusVersion: () => {},
      onFeedback: () => {},
      onKnitFinished: () => {},
      onKnitRuntimeError: () => {},
      // Simulates the component being destroyed before call #2's
      // await activeKnitRun resolves.
      isDestroyed: () => true,
    });

    // Let call #1 finish quickly instead of running a full simulated knit.
    firstSession?.cancel();

    await Promise.all([firstCall, secondCall]);

    expect(secondValidationError).toBe(false);
    expect(secondKnitStarted).toBe(false);
  });
});
