import { Control } from "serial/src/Control";
import { Pattern, PatternImage } from "state_machine/src/Pattern";
import {
  Operation,
  StateMachineState,
  Alignment,
} from "constants/src/StateMachineConstants";
import { Output } from "state_machine/src/Output";
import { Machine } from "state_machine/src/Machine";
import { prepareImageBitsForKnit } from "state_machine/src/ImageOrientation";
import { defaultKnitPort } from "./SerialPortList";
import { validateKnitConfig } from "state_machine/src/ValidateKnitConfig";
import { Preferences } from "app_settings/src/Preferences";
import { ImageSettings } from "image_settings/src/ImageSettingsComponent";
import { Feedback, FeedbackMessage } from "./Feedback";
import { AudioFeedbackSink } from "./AudioFeedback";

export interface KnitStartParams {
  imageBits: Uint8Array[][];
  imageWidth: number;
  imageHeight: number;
  settings: ImageSettings;
  preferences: Preferences;
  serialPort?: string;
}

export type KnitStartResult =
  | { ok: true; session: KnitSession }
  | { ok: false; message: string };

export interface KnitSessionCallbacks {
  onStatusVersion: (version: number) => void;
  isDestroyed: () => boolean;
  onFeedback?: (message: FeedbackMessage) => void;
  quietMode?: boolean;
  audio?: AudioFeedbackSink;
}

export class KnitSession {
  readonly control: Control;
  private cancelled = false;
  statusVersion = 0;

  private constructor(control: Control) {
    this.control = control;
  }

  static buildPattern(params: KnitStartParams): Pattern {
    const { imageBits, imageWidth, imageHeight, settings, preferences } =
      params;
    const knitBits = prepareImageBitsForKnit(imageBits);
    const patternImage = new PatternImage(
      knitBits,
      imageWidth,
      imageHeight,
      settings.numColors,
    );
    const pattern = new Pattern(patternImage, settings.numColors);
    pattern.mode = settings.mode;

    const machine = preferences.machine;
    const machineWidth = Machine.width(machine);
    pattern.startRow = settings.startRow ?? 0;
    pattern.alignment = settings.alignment ?? Alignment.CENTER;

    const startNeedle = settings.startNeedle ?? 0;
    const stopNeedle = settings.stopNeedle ?? machineWidth - 1;
    if (
      startNeedle < stopNeedle &&
      startNeedle >= 0 &&
      stopNeedle < machineWidth
    ) {
      pattern.knitStartNeedle = startNeedle;
      pattern.knitEndNeedle = stopNeedle + 1;
    } else {
      pattern.knitStartNeedle = 0;
      pattern.knitEndNeedle = machineWidth;
    }

    pattern.calcPatStartEndNeedles();
    return pattern;
  }

  static tryStart(params: KnitStartParams): KnitStartResult {
    const portname = defaultKnitPort(params.serialPort);
    const validation = validateKnitConfig({
      portname,
      mode: params.settings.mode,
      numColors: params.settings.numColors,
      startRow: params.settings.startRow,
      patternHeight: params.imageHeight,
      startNeedle: params.settings.startNeedle,
      stopNeedle: params.settings.stopNeedle,
    });
    if (!validation.ok) {
      return validation;
    }

    const control = new Control();
    const pattern = KnitSession.buildPattern(params);
    const options = {
      machine: params.preferences.machine,
      mode: params.settings.mode,
      num_colors: params.settings.numColors,
      start_row: params.settings.startRow,
      inf_repeat: params.settings.infRepeat,
      start_needle: params.settings.startNeedle,
      stop_needle: params.settings.stopNeedle,
      alignment: params.settings.alignment,
      auto_mirror: params.settings.autoMirror,
      continuous_reporting: false,
      portname,
      prefs: params.preferences,
    };
    control.start(pattern, options, Operation.KNIT);
    return { ok: true, session: new KnitSession(control) };
  }

  /** @deprecated Use tryStart — kept for callers that already validated. */
  static start(params: KnitStartParams): KnitSession {
    const result = KnitSession.tryStart(params);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.session;
  }

  cancel(): void {
    if (this.cancelled) {
      return;
    }
    this.cancelled = true;
    this.control.stop();
    this.control.state = StateMachineState.FINISHED;
  }

  async run(
    callbacks: KnitSessionCallbacks,
  ): Promise<"finished" | "cancelled"> {
    while (
      !this.cancelled &&
      this.control.state !== StateMachineState.FINISHED
    ) {
      try {
        if (this.cancelled) {
          break;
        }
        const delayMs = this.control.portname === "Simulation" ? 400 : 100;
        const setTimeoutFn =
          (globalThis as any).__originalTimingFunctions__?.setTimeout ||
          setTimeout;
        // Do not chain setTimeout after requestAnimationFrame — rAF does not run
        // reliably in headless browsers (Puppeteer E2E) and stalls the knit loop.
        await new Promise<void>(function (resolve) {
          setTimeoutFn(function () {
            resolve();
          }, delayMs);
        });

        if (this.cancelled) {
          break;
        }

        const output = await this.control
          .operate_async(Operation.KNIT)
          .catch(function (err: any) {
            console.error("Error in operate_async:", err);
            return Output.NONE;
          });

        if (this.cancelled) {
          break;
        }

        if (output !== this.control.notification) {
          KnitSession.emitFeedback(output, callbacks);
          this.control.notification = output;
        }

        this.statusVersion += 1;
        if (!callbacks.isDestroyed()) {
          callbacks.onStatusVersion(this.statusVersion);
        }
      } catch (error) {
        console.error("Error in knitting loop:", error);
        break;
      }
    }

    if (!this.cancelled) {
      this.control.stop();
    }
    return this.cancelled ? "cancelled" : "finished";
  }

  private static emitFeedback(
    output: Output,
    callbacks: Pick<KnitSessionCallbacks, "onFeedback" | "quietMode" | "audio">,
  ): void {
    const message = Feedback.notifyOutput(output, {
      quietMode: callbacks.quietMode,
      audio: callbacks.audio,
    });
    if (message != null && callbacks.onFeedback) {
      callbacks.onFeedback(message);
    }
  }
}
