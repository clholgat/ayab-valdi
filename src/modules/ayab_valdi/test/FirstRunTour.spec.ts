import "jasmine/src/jasmine";
import {
  FIRST_RUN_TOUR_STEP_COUNT,
  getFirstRunTourStep,
  nextTourStepIndex,
  previousTourStepIndex,
  canTourGoBack,
  tourHighlightActive,
  tourTargetChrome,
} from "ayab_valdi/src/FirstRunTour";

describe("FirstRunTour", () => {
  it("defines five onboarding steps", () => {
    expect(FIRST_RUN_TOUR_STEP_COUNT).toBe(5);
    expect(getFirstRunTourStep(0)?.id).toBe("machine");
    expect(getFirstRunTourStep(4)?.id).toBe("knit");
  });

  it("highlights the active tour target", () => {
    expect(tourHighlightActive("checklist-target-machine", "checklist-target-machine")).toBe(
      true,
    );
    expect(tourHighlightActive("checklist-target-machine", "checklist-target-knit")).toBe(
      false,
    );
    expect(tourTargetChrome("checklist-target-machine", "checklist-target-machine").borderWidth).toBe(
      2,
    );
  });

  it("advances and retreats tour step indices", () => {
    expect(nextTourStepIndex(0)).toBe(1);
    expect(nextTourStepIndex(FIRST_RUN_TOUR_STEP_COUNT - 1)).toBe("complete");
    expect(previousTourStepIndex(2)).toBe(1);
    expect(previousTourStepIndex(0)).toBe(0);
    expect(canTourGoBack(0)).toBe(false);
    expect(canTourGoBack(1)).toBe(true);
  });
});
