import { ImageSettings } from "image_settings/src/ImageSettingsComponent";
import { Preferences } from "app_settings/src/Preferences";
import { Token } from "constants/src/SerialConstants";
import { KnitSession } from "./KnitSession";
import { HardwareTestSession } from "./HardwareTestSession";
import { FeedbackMessage } from "./Feedback";
import { ValueNotifier } from "./ValueNotifier";
import { AudioFeedbackSink } from "./AudioFeedback";
import { getMissingImageKnitMessage } from "./AppUiState";

export const KNIT_FINISHED_MESSAGE: FeedbackMessage = {
  text: "Pattern completed",
  level: "success",
};

export interface RunAppKnitParams {
  settings?: ImageSettings;
  isKnitting: boolean;
  imageBits?: Uint8Array[][];
  imageWidth?: number;
  imageHeight?: number;
  preferences: Preferences;
  serialPort?: string;
  audio: AudioFeedbackSink;
}

export interface RunAppKnitCallbacks {
  onValidationError: (message: FeedbackMessage) => void;
  onKnitStarted: (session: KnitSession) => void;
  onStatusVersion: (version: number) => void;
  onFeedback: (message: FeedbackMessage) => void;
  onKnitFinished: () => void;
  onKnitRuntimeError: () => void;
  isDestroyed: () => boolean;
}

let activeKnitRun: Promise<void> | undefined;

export async function runAppKnit(
  params: RunAppKnitParams,
  callbacks: RunAppKnitCallbacks,
): Promise<void> {
  if (activeKnitRun) {
    await activeKnitRun;
    // The caller (e.g. App) may have been destroyed while we were waiting
    // for the previous knit run to finish - bail out before touching any of
    // its callbacks (they'd otherwise setState on a destroyed component).
    if (callbacks.isDestroyed()) {
      return;
    }
  }

  const { settings, isKnitting } = params;
  if (!settings || isKnitting) {
    return;
  }

  const missingImageMessage = getMissingImageKnitMessage({
    imageBits: params.imageBits,
    imageWidth: params.imageWidth,
    imageHeight: params.imageHeight,
  });
  if (missingImageMessage) {
    callbacks.onValidationError({ text: missingImageMessage, level: "error" });
    return;
  }

  const imageBits = params.imageBits!;
  const imageWidth = params.imageWidth!;
  const imageHeight = params.imageHeight!;

  const startResult = KnitSession.tryStart({
    imageBits,
    imageWidth,
    imageHeight,
    settings,
    preferences: params.preferences,
    serialPort: params.serialPort,
  });

  if (!startResult.ok) {
    callbacks.onValidationError({
      text: startResult.message,
      level: "error",
    });
    return;
  }

  const knitSession = startResult.session;
  callbacks.onStatusVersion(0);
  callbacks.onKnitStarted(knitSession);

  const runPromise = knitSession
    .run({
      onStatusVersion: callbacks.onStatusVersion,
      isDestroyed: callbacks.isDestroyed,
      onFeedback: callbacks.onFeedback,
      quietMode: params.preferences.quietMode,
      audio: params.audio,
    })
    .then((result) => {
      if (result === "finished" && !callbacks.isDestroyed()) {
        callbacks.onKnitFinished();
      }
    })
    .catch((error) => {
      console.error("Error starting knitting:", error);
      if (!callbacks.isDestroyed()) {
        callbacks.onKnitRuntimeError();
      }
    });

  activeKnitRun = runPromise;
  try {
    await runPromise;
  } finally {
    if (activeKnitRun === runPromise) {
      activeKnitRun = undefined;
    }
  }
}

export function awaitActiveKnitRun(): Promise<void> {
  return activeKnitRun ?? Promise.resolve();
}

export interface RunAppHardwareTestParams {
  isKnitting: boolean;
  isHardwareTesting: boolean;
  preferences: Preferences;
  serialPort?: string;
}

export interface RunAppHardwareTestCallbacks {
  onSessionStarted: (session: HardwareTestSession) => void;
  onOutput: (text: string) => void;
  onReady: () => void;
  onFeedback: (message: FeedbackMessage) => void;
  onRuntimeError: () => void;
  isDestroyed: () => boolean;
}

export async function runAppHardwareTest(
  params: RunAppHardwareTestParams,
  callbacks: RunAppHardwareTestCallbacks,
): Promise<void> {
  if (params.isKnitting || params.isHardwareTesting) {
    return;
  }

  const session = HardwareTestSession.start({
    preferences: params.preferences,
    serialPort: params.serialPort,
  });

  callbacks.onSessionStarted(session);

  await scheduleNextFrame();

  try {
    await session.run({
      onOutput: callbacks.onOutput,
      onReady: callbacks.onReady,
      onFeedback: callbacks.onFeedback,
      isDestroyed: callbacks.isDestroyed,
      quietMode: params.preferences.quietMode,
    });
  } catch (error) {
    console.error("Hardware test error:", error);
    if (!callbacks.isDestroyed()) {
      callbacks.onRuntimeError();
    }
  }
}

export function resetHardwareTestNotifiers(
  logNotifier: ValueNotifier<string>,
  readyNotifier: ValueNotifier<boolean>,
): void {
  logNotifier.set("");
  readyNotifier.set(false);
}

export function closeAppHardwareTest(
  session: HardwareTestSession | undefined,
  logNotifier: ValueNotifier<string>,
  readyNotifier: ValueNotifier<boolean>,
): void {
  session?.cancel();
  resetHardwareTestNotifiers(logNotifier, readyNotifier);
}

export function sendAppHardwareTestCommand(
  session: HardwareTestSession | undefined,
  logNotifier: ValueNotifier<string>,
  token: Token,
  payload: number[] = [],
): void {
  session?.sendCommand(token, payload);
  const label = Token[token]?.toString().replace(/Cmd$/, "") ?? "cmd";
  logNotifier.update((log) => `${log}\n> ${label}\n`);
}

function scheduleNextFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    const setTimeoutFn =
      (
        globalThis as {
          __originalTimingFunctions__?: { setTimeout: typeof setTimeout };
        }
      ).__originalTimingFunctions__?.setTimeout || setTimeout;
    setTimeoutFn(() => resolve(), 0);
  });
}
