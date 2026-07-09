import { Control } from "serial/src/Control";
import { HardwareTestCommunicationMock } from "serial/src/HardwareTestCommunicationMock";
import {
  Operation,
  StateMachineState,
} from "constants/src/StateMachineConstants";
import { Token } from "constants/src/SerialConstants";
import { Output } from "state_machine/src/Output";
import { Pattern, PatternImage } from "state_machine/src/Pattern";
import { Preferences } from "app_settings/src/Preferences";
import { defaultKnitPort } from "./SerialPortList";
import { Feedback, FeedbackMessage } from "./Feedback";

export interface HardwareTestStartParams {
  preferences: Preferences;
  serialPort?: string;
}

export interface HardwareTestCallbacks {
  onOutput: (text: string) => void;
  onReady?: () => void;
  onFeedback?: (message: FeedbackMessage) => void;
  isDestroyed: () => boolean;
  quietMode?: boolean;
}

export class HardwareTestSession {
  readonly control: Control;
  private cancelled = false;
  private timerId?: ReturnType<typeof setInterval>;

  private constructor(control: Control) {
    this.control = control;
  }

  static start(params: HardwareTestStartParams): HardwareTestSession {
    const portname = defaultKnitPort(params.serialPort);
    const control = new Control();

    const emptyImage = new PatternImage([[]], 0, 0, 2);
    const pattern = new Pattern(emptyImage, 2);
    control.start(
      pattern,
      {
        machine: params.preferences.machine,
        prefs: params.preferences,
        portname,
      },
      Operation.TEST,
    );
    return new HardwareTestSession(control);
  }

  cancel(): void {
    this.cancelled = true;
    this.stopTimer();
    this.sendQuit();
    this.control.stop();
  }

  async run(callbacks: HardwareTestCallbacks): Promise<"finished" | "cancelled"> {
    this.control.onTestOutput = (text) => {
      if (!callbacks.isDestroyed()) {
        callbacks.onOutput(text);
      }
    };

    let readyNotified = false;

    while (
      !this.cancelled &&
      this.control.state !== StateMachineState.FINISHED
    ) {
      try {
        await this.scheduleFrameDelay(
          this.control.portname === "Simulation" ? 400 : 100,
        );

        const output = await this.nextOutput();

        const message = Feedback.forOutput(output);
        if (message != null && callbacks.onFeedback) {
          callbacks.onFeedback(message);
        }

        if (
          !readyNotified &&
          this.control.state === StateMachineState.RUN_TEST
        ) {
          readyNotified = true;
          if (callbacks.onReady) {
            callbacks.onReady();
          }
          const setTimeoutFn =
            (
              globalThis as {
                __originalTimingFunctions__?: { setTimeout: typeof setTimeout };
              }
            ).__originalTimingFunctions__?.setTimeout || setTimeout;
          setTimeoutFn(() => {
            if (!callbacks.isDestroyed()) {
              this.startSimulationTimer(callbacks);
            }
          }, 0);
        }
      } catch {
        break;
      }
    }

    this.stopTimer();
    this.control.stop();
    return this.cancelled ? "cancelled" : "finished";
  }

  sendCommand(token: Token, payload: number[] = []): void {
    const com = this.control.com;
    if (!this.isSimulationTestMock(com)) {
      return;
    }
    const msg = new Uint8Array([token, ...payload]);
    com.write_API6(msg);
    this.drainTestOutput();
  }

  private isSimulationTestMock(
    com: unknown,
  ): com is HardwareTestCommunicationMock {
    return (
      this.control.portname === "Simulation" &&
      com != null &&
      typeof (com as HardwareTestCommunicationMock).write_API6 === "function"
    );
  }

  private scheduleFrameDelay(ms: number): Promise<void> {
    const setTimeoutFn =
      (
        globalThis as {
          __originalTimingFunctions__?: { setTimeout: typeof setTimeout };
        }
      ).__originalTimingFunctions__?.setTimeout || setTimeout;
    const raf =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame
        : (cb: () => void) => setTimeoutFn(cb, 0);
    return new Promise((resolve) => {
      raf(() => {
        setTimeoutFn(() => resolve(), ms);
      });
    });
  }

  private async nextOutput(): Promise<Output> {
    if (this.control.portname === "Simulation") {
      return this.advanceSimulation();
    }
    try {
      return await this.control.operate_async(Operation.TEST);
    } catch (err) {
      console.error("Error in hardware test operate_async:", err);
      return Output.NONE;
    }
  }

  /** Sync FSM steps — avoids browser hangs in init_async on Operation.TEST. */
  private advanceSimulation(): Output {
    let output = Output.NONE;
    for (let step = 0; step < 16; step++) {
      output = this.control.operate(Operation.TEST);
      if (
        this.control.state === StateMachineState.RUN_TEST ||
        this.control.state === StateMachineState.FINISHED
      ) {
        return output;
      }
    }
    return output;
  }

  private drainTestOutput(): void {
    let batch = "";
    const emit = this.control.onTestOutput;
    this.control.onTestOutput = (text) => {
      batch += text;
    };
    for (let i = 0; i < 64; i++) {
      const [token] = this.control.check_serial_API6();
      if (token === Token.none) {
        break;
      }
    }
    this.control.onTestOutput = emit;
    if (batch.length > 0 && emit) {
      emit(batch);
    }
  }

  sendQuit(): void {
    this.sendCommand(Token.quitCmd);
    this.control.state = StateMachineState.FINISHED;
  }

  private startSimulationTimer(callbacks: HardwareTestCallbacks): void {
    const com = this.control.com;
    if (!this.isSimulationTestMock(com)) {
      return;
    }
    com.setup();
    this.drainTestOutput();
    this.stopTimer();
    this.timerId = setInterval(() => {
      if (this.cancelled || callbacks.isDestroyed()) {
        this.stopTimer();
        return;
      }
      com.timer_event();
      this.drainTestOutput();
    }, 500);
  }

  private stopTimer(): void {
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }
}
