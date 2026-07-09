import { FeedbackLevel, WRONG_FIRMWARE_MESSAGE } from "./Feedback";

export interface KnitActionBannerContent {
  title: string;
  subtitle?: string;
  level: FeedbackLevel;
}

const TRANSMISSION_FINISHED_PREFIX =
  "Image transmission finished";

/** User-visible knit prompts that belong in the preview action banner. */
export function shouldShowKnitActionBanner(
  isKnitting: boolean,
  message: string | undefined,
): boolean {
  return isKnitting === true && message != null && message.length > 0;
}

export function getKnitActionBannerContent(
  message: string,
  level: FeedbackLevel = "info",
): KnitActionBannerContent {
  if (message === "Please knit.") {
    return {
      title: "Please knit",
      subtitle: "Move the carriage across the needle bed for this row.",
      level,
    };
  }

  if (
    message === "Pattern completed" ||
    message.startsWith(TRANSMISSION_FINISHED_PREFIX)
  ) {
    return {
      title: "Pattern completed",
      subtitle:
        "Knit remaining rows at the machine until you hear the double beep, " +
        "then knit one more row.",
      level: "success",
    };
  }

  if (message.startsWith("Please start machine.")) {
    return {
      title: "Start the machine",
      subtitle: message,
      level,
    };
  }

  if (message === "Connecting to machine...") {
    return {
      title: "Connecting…",
      subtitle: "Waiting for the machine or simulator.",
      level,
    };
  }

  if (message === "Initializing firmware...") {
    return {
      title: "Initializing firmware…",
      subtitle: "The carriage will prompt you when ready.",
      level,
    };
  }

  if (
    message === WRONG_FIRMWARE_MESSAGE ||
    message.toLowerCase().includes("wrong arduino firmware")
  ) {
    return {
      title: "Update AYAB firmware",
      subtitle:
        "This app cannot flash firmware. Use ayab-desktop → Tools → " +
        "Load AYAB firmware, then reconnect and try Knit again.",
      level: "blocking",
    };
  }

  return { title: message, level };
}

export function formatKnitRowLabel(
  currentRow: number | undefined,
  totalRows: number | undefined,
): string | null {
  if (
    currentRow == null ||
    totalRows == null ||
    currentRow < 0 ||
    totalRows <= 0
  ) {
    return null;
  }
  return `Row ${currentRow} of ${totalRows}`;
}
