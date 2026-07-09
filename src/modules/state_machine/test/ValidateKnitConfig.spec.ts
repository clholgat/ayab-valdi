import "jasmine/src/jasmine";
import { Mode } from "constants/src/StateMachineConstants";
import { validateKnitConfig } from "state_machine/src/ValidateKnitConfig";

function validParams() {
  return {
    portname: "Simulation",
    mode: Mode.SINGLEBED,
    numColors: 2,
    startRow: 0,
    patternHeight: 10,
    startNeedle: 50,
    stopNeedle: 150,
  };
}

describe("validateKnitConfig", () => {
  it("accepts valid configuration", () => {
    expect(validateKnitConfig(validParams())).toEqual({ ok: true });
  });

  it("rejects empty port", () => {
    const result = validateKnitConfig({ ...validParams(), portname: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Please choose a valid port.");
    }
  });

  it("rejects start needle after stop needle", () => {
    const result = validateKnitConfig({
      ...validParams(),
      startNeedle: 100,
      stopNeedle: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Invalid needle start and end.");
    }
  });

  it("rejects singlebed with 3+ colors", () => {
    const result = validateKnitConfig({
      ...validParams(),
      numColors: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(
        "Single bed knitting currently supports only 2 colors.",
      );
    }
  });

  it("rejects circular ribber with 3+ colors", () => {
    const result = validateKnitConfig({
      ...validParams(),
      mode: Mode.CIRCULAR_RIBBER,
      numColors: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Circular knitting supports only 2 colors.");
    }
  });

  it("rejects start row larger than pattern height", () => {
    const result = validateKnitConfig({
      ...validParams(),
      startRow: 11,
      patternHeight: 10,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Start row is larger than the image.");
    }
  });
});
