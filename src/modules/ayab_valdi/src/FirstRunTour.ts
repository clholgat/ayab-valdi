export type TourAnchor = "sidebar" | "preview";

export interface FirstRunTourStep {
  id: string;
  title: string;
  body: string;
  targetId: string;
  anchor: TourAnchor;
}

export const FIRST_RUN_TOUR_STEPS: FirstRunTourStep[] = [
  {
    id: "machine",
    title: "Welcome — select your machine",
    body:
      "Follow this short tour to knit your first pattern. " +
      "In Settings, choose the Brother model that matches your knitting machine.",
    targetId: "checklist-target-machine",
    anchor: "sidebar",
  },
  {
    id: "connection",
    title: "Connect or simulate",
    body:
      "Simulation lets you practice without hardware. " +
      "When ready, pick your USB device and tap Refresh.",
    targetId: "checklist-target-connection",
    anchor: "sidebar",
  },
  {
    id: "pattern",
    title: "Load a pattern",
    body:
      "Click Choose file… to open a black-and-white PNG or .pat file. " +
      "The preview shows how stitches align on the needle bed.",
    targetId: "checklist-target-pattern",
    anchor: "preview",
  },
  {
    id: "needles",
    title: "Set needle range",
    body:
      "Match start and stop needles to your cast-on — " +
      "for example Left 30 – Right 30 means both at 30.",
    targetId: "checklist-target-needles",
    anchor: "sidebar",
  },
  {
    id: "knit",
    title: "Start knitting",
    body:
      "Tap Knit, set the carriage to KC-I or KC-II, " +
      "then follow the on-screen prompts at the machine.",
    targetId: "checklist-target-knit",
    anchor: "sidebar",
  },
];

export const FIRST_RUN_TOUR_STEP_COUNT = FIRST_RUN_TOUR_STEPS.length;

export function getFirstRunTourStep(index: number): FirstRunTourStep | undefined {
  if (index < 0 || index >= FIRST_RUN_TOUR_STEPS.length) {
    return undefined;
  }
  return FIRST_RUN_TOUR_STEPS[index];
}

export function nextTourStepIndex(current: number): number | "complete" {
  if (current >= FIRST_RUN_TOUR_STEPS.length - 1) {
    return "complete";
  }
  return current + 1;
}

export function previousTourStepIndex(current: number): number {
  return Math.max(0, current - 1);
}

export function canTourGoBack(current: number): boolean {
  return current > 0;
}

export function tourHighlightActive(
  activeTargetId: string | undefined,
  targetId: string,
): boolean {
  return activeTargetId != null && activeTargetId === targetId;
}

export function tourTargetChrome(
  activeTargetId: string | undefined,
  targetId: string,
): { borderWidth: number; borderColor: string } {
  const highlighted = tourHighlightActive(activeTargetId, targetId);
  return {
    borderWidth: highlighted ? 2 : 0,
    borderColor: highlighted ? "#2563EB" : "transparent",
  };
}
