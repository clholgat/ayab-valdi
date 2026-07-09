import { Mode } from "constants/src/StateMachineConstants";

export interface KnitConfigParams {
  portname: string;
  mode: Mode;
  numColors: number;
  startRow: number;
  patternHeight: number;
  startNeedle: number;
  stopNeedle: number;
}

export type ValidateKnitConfigResult =
  | { ok: true }
  | { ok: false; message: string };

/** Mirrors ayab-desktop Engine.validate() + OptionsTab.validate(). */
export function validateKnitConfig(
  params: KnitConfigParams,
): ValidateKnitConfigResult {
  if (params.startRow > params.patternHeight) {
    return { ok: false, message: "Start row is larger than the image." };
  }

  if (!params.portname || params.portname.trim() === "") {
    return { ok: false, message: "Please choose a valid port." };
  }

  if (params.startNeedle > params.stopNeedle) {
    return { ok: false, message: "Invalid needle start and end." };
  }

  if (params.mode === Mode.SINGLEBED && params.numColors >= 3) {
    return {
      ok: false,
      message: "Single bed knitting currently supports only 2 colors.",
    };
  }

  if (params.mode === Mode.CIRCULAR_RIBBER && params.numColors >= 3) {
    return {
      ok: false,
      message: "Circular knitting supports only 2 colors.",
    };
  }

  return { ok: true };
}
