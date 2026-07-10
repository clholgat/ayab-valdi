import "jasmine/src/jasmine";
import { Preferences } from "app_settings/src/Preferences";
import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { StateMachineState } from "constants/src/StateMachineConstants";
import { KnitSession } from "ayab_valdi/src/KnitSession";
import { prepareImageBitsForKnit } from "state_machine/src/ImageOrientation";
import { Output } from "state_machine/src/Output";
import { NullAudioFeedback } from "ayab_valdi/src/AudioFeedback";

describe("KnitSession", () => {
  const settings = {
    mode: Mode.SINGLEBED,
    numColors: 2,
    startRow: 0,
    infRepeat: false,
    startNeedle: 80,
    stopNeedle: 120,
    alignment: Alignment.CENTER,
    autoMirror: false,
  };

  it("buildPattern uses vertically flipped image rows", () => {
    const topRow = [new Uint8Array([255, 0, 0, 255])];
    const bottomRow = [new Uint8Array([0, 255, 0, 255])];
    const bits = [topRow, bottomRow];

    const pattern = KnitSession.buildPattern({
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 2,
      settings,
      preferences: new Preferences(),
    });

    expect(pattern.pattern.image[0]).toBe(bottomRow);
    expect(pattern.pattern.image[1]).toBe(topRow);
  });

  it("tryStart rejects invalid configuration", () => {
    const bits = prepareImageBitsForKnit([
      [new Uint8Array([0, 0, 0, 255])],
    ]);
    const result = KnitSession.tryStart({
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 1,
      settings: { ...settings, numColors: 4 },
      preferences: new Preferences(),
      serialPort: "Simulation",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("2 colors");
    }
  });

  it("tryStart returns session for valid simulation config", () => {
    const bits = prepareImageBitsForKnit([
      [new Uint8Array([0, 0, 0, 255])],
    ]);
    const result = KnitSession.tryStart({
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 1,
      settings,
      preferences: new Preferences(),
      serialPort: "Simulation",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.control.portname).toBe("Simulation");
    }
  });

  it("tryStart defaults to Simulation when port is omitted", () => {
    const bits = prepareImageBitsForKnit([
      [new Uint8Array([0, 0, 0, 255])],
    ]);
    const result = KnitSession.tryStart({
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 1,
      settings,
      preferences: new Preferences(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.control.portname).toBe("Simulation");
    }
  });

  it("can restart after cancel during simulation knit", async () => {
    const bits = prepareImageBitsForKnit([
      [new Uint8Array([0, 0, 0, 255])],
    ]);
    const startParams = {
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 1,
      settings,
      preferences: new Preferences(),
      serialPort: "Simulation",
    };

    const firstStart = KnitSession.tryStart(startParams);
    expect(firstStart.ok).toBe(true);
    if (!firstStart.ok) {
      return;
    }

    const firstSession = firstStart.session;
    let pleaseKnit = false;
    const firstRun = firstSession.run({
      onStatusVersion: () => {},
      isDestroyed: () => false,
      onFeedback: (message) => {
        if (message.text === "Please knit.") {
          pleaseKnit = true;
        }
      },
    });

    for (let i = 0; i < 40 && !pleaseKnit; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(pleaseKnit).toBe(true);
    expect(firstSession.control.state).toBe(StateMachineState.RUN_KNIT);

    firstSession.cancel();
    await firstRun;
    expect(firstSession.control.state).toBe(StateMachineState.FINISHED);

    const secondStart = KnitSession.tryStart(startParams);
    expect(secondStart.ok).toBe(true);
    if (!secondStart.ok) {
      return;
    }

    const secondSession = secondStart.session;
    pleaseKnit = false;
    const secondRun = secondSession.run({
      onStatusVersion: () => {},
      isDestroyed: () => false,
      onFeedback: (message) => {
        if (message.text === "Please knit.") {
          pleaseKnit = true;
        }
      },
    });

    for (let i = 0; i < 40 && !pleaseKnit; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    secondSession.cancel();
    await secondRun;
    expect(pleaseKnit).toBe(true);
  });

  it("does not emit feedback from an operate_async call that resolves after cancel()", async () => {
    const bits = prepareImageBitsForKnit([
      [new Uint8Array([0, 0, 0, 255])],
    ]);
    const start = KnitSession.tryStart({
      imageBits: bits,
      imageWidth: 1,
      imageHeight: 1,
      settings,
      preferences: new Preferences(),
      serialPort: "Simulation",
    });
    expect(start.ok).toBe(true);
    if (!start.ok) {
      return;
    }
    const session = start.session;

    // Replace operate_async with a promise we control directly, so we can
    // resolve it only *after* cancel() has already been called - simulating
    // the in-flight-operation-resolves-post-cancel race.
    let resolveOperate: ((output: Output) => void) | undefined;
    (session.control as any).operate_async = () =>
      new Promise<Output>((resolve) => {
        resolveOperate = resolve;
      });

    const feedbackMessages: string[] = [];
    const run = session.run({
      onStatusVersion: () => {},
      isDestroyed: () => false,
      onFeedback: (message) => {
        feedbackMessages.push(message.text);
      },
      quietMode: false,
      audio: new NullAudioFeedback(),
    });

    // Wait for the loop to actually reach the operate_async call.
    for (let i = 0; i < 40 && !resolveOperate; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(resolveOperate).toBeDefined();

    session.cancel();
    // Now resolve the in-flight operate_async call with an output that would
    // normally produce a "Please knit." feedback message.
    resolveOperate!(Output.PLEASE_KNIT);

    await run;

    expect(feedbackMessages).toEqual([]);
  });
});
