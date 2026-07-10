import "jasmine/src/jasmine";
import { Preferences } from "app_settings/src/Preferences";
import { StateMachineState, Operation } from "constants/src/StateMachineConstants";
import { Token } from "constants/src/SerialConstants";
import { HardwareTestCommunicationMock } from "serial/src/HardwareTestCommunicationMock";
import { HardwareTestSession } from "ayab_valdi/src/HardwareTestSession";
import { Output } from "state_machine/src/Output";

describe("HardwareTestSession", () => {
  it("start uses Simulation port and HardwareTestCommunicationMock", () => {
    const session = HardwareTestSession.start({
      preferences: new Preferences(),
      serialPort: "Simulation",
    });
    expect(session.control.portname).toBe("Simulation");
    expect(session.control.com).toEqual(jasmine.any(HardwareTestCommunicationMock));
  });

  it("sendCommand forwards help output through control", () => {
    const session = HardwareTestSession.start({
      preferences: new Preferences(),
      serialPort: "Simulation",
    });
    const lines: string[] = [];
    session.control.onTestOutput = (text) => lines.push(text);

    session.control.state = StateMachineState.RUN_TEST;
    session.sendCommand(Token.helpCmd);

    expect(lines.join("")).toContain("Called help");
    expect(lines.join("")).toContain("setSingle");
  });

  it("run reaches RUN_TEST on simulation", async () => {
    const session = HardwareTestSession.start({
      preferences: new Preferences(),
      serialPort: "Simulation",
    });
    let ready = false;
    const runPromise = session.run({
      onOutput: () => {},
      onReady: () => {
        ready = true;
      },
      onFeedback: () => {},
      isDestroyed: () => false,
    });

    for (let i = 0; i < 100 && !ready; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(ready).toBe(true);
    expect(session.control.state).toBe(StateMachineState.RUN_TEST);
    session.cancel();
    await runPromise;
  });

  it("sync simulation pump reaches RUN_TEST without operate_async", () => {
    const session = HardwareTestSession.start({
      preferences: new Preferences(),
      serialPort: "Simulation",
    });
    for (let i = 0; i < 12; i++) {
      session.control.operate(Operation.TEST);
      if (session.control.state === StateMachineState.RUN_TEST) {
        break;
      }
    }
    expect(session.control.state).toBe(StateMachineState.RUN_TEST);
  });

  it("cancel stops control and finishes state", () => {
    const session = HardwareTestSession.start({
      preferences: new Preferences(),
      serialPort: "Simulation",
    });
    session.cancel();
    expect(session.control.state).toBe(StateMachineState.FINISHED);
  });

  it("does not emit feedback from an operate_async call that resolves after cancel()", async () => {
    // A non-"Simulation" port routes nextOutput() through the async
    // control.operate_async() path (Simulation uses a synchronous pump and
    // never hits this race).
    const session = HardwareTestSession.start({
      preferences: new Preferences(),
      serialPort: "fake-hardware-port",
    });

    let resolveOperate: ((output: Output) => void) | undefined;
    (session.control as any).operate_async = () =>
      new Promise<Output>((resolve) => {
        resolveOperate = resolve;
      });

    const feedbackMessages: string[] = [];
    const runPromise = session.run({
      onOutput: () => {},
      onFeedback: (message) => {
        feedbackMessages.push(message.text);
      },
      isDestroyed: () => false,
    });

    for (let i = 0; i < 40 && !resolveOperate; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(resolveOperate).toBeDefined();

    session.cancel();
    // Any output that Feedback.forOutput maps to a non-null message works
    // here; ERROR_WRONG_API maps to a real (blocking) feedback message.
    resolveOperate!(Output.ERROR_WRONG_API);

    await runPromise;

    expect(feedbackMessages).toEqual([]);
  });
});
