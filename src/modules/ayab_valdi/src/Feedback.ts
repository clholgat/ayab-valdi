import { Output } from "state_machine/src/Output";
import { AudioFeedbackSink, maybePlayAudio } from "./AudioFeedback";

export type FeedbackLevel = "info" | "success" | "error" | "blocking";

export interface FeedbackMessage {
  text: string;
  level: FeedbackLevel;
}

/** Shown when the shield speaks an unsupported API / firmware version. */
export const WRONG_FIRMWARE_MESSAGE =
  "Wrong Arduino firmware version. Update the shield firmware with " +
  "ayab-desktop (Tools → Load AYAB firmware), then reconnect.";

/** Maps engine Output to user-visible messages (desktop FeedbackHandler parity). */
export class Feedback {
  static forOutput(output: Output): FeedbackMessage | null {
    switch (output) {
      case Output.NONE:
        return null;
      case Output.ERROR_INVALID_SETTINGS:
        return { text: "Invalid settings.", level: "error" };
      case Output.ERROR_SERIAL_PORT:
        return { text: "Error opening serial port.", level: "error" };
      case Output.CONNECTING_TO_MACHINE:
        return { text: "Connecting to machine...", level: "info" };
      case Output.DISCONNECTING_FROM_MACHINE:
        return { text: "Disconnecting from machine...", level: "info" };
      case Output.INITIALIZING_FIRMWARE:
        return { text: "Initializing firmware...", level: "info" };
      case Output.ERROR_INITIALIZING_FIRMWARE:
        return { text: "Error initializing firmware.", level: "error" };
      case Output.WAIT_FOR_INIT:
        return {
          text:
            "Please start machine. Set the carriage to mode KC-I or KC-II " +
            "and move the carriage over the left turn mark.",
          level: "info",
        };
      case Output.ERROR_WRONG_API:
        return {
          text: WRONG_FIRMWARE_MESSAGE,
          level: "blocking",
        };
      case Output.PLEASE_KNIT:
        return { text: "Please knit.", level: "info" };
      case Output.DEVICE_NOT_READY:
        return { text: "Device not ready, try again.", level: "blocking" };
      case Output.NEXT_LINE:
        return null;
      case Output.KNITTING_FINISHED:
        return {
          text: "Pattern completed",
          level: "success",
        };
      default:
        return null;
    }
  }

  static notifyOutput(
    output: Output,
    options?: { quietMode?: boolean; audio?: AudioFeedbackSink },
  ): FeedbackMessage | null {
    maybePlayAudio(output, {
      quietMode: options?.quietMode,
      sink: options?.audio,
    });
    return Feedback.forOutput(output);
  }
}
