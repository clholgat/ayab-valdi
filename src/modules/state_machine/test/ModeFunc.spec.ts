import "jasmine/src/jasmine";
import { Mode } from "constants/src/StateMachineConstants";
import { ModeFunc, ModeFuncControl, resolveModeFunc } from "state_machine/src/ModeFunc";

function ctrl(overrides: Partial<ModeFuncControl>): ModeFuncControl {
  return {
    start_row: 0,
    inf_repeat: false,
    pat_height: 3,
    len_pat_expanded: 6,
    num_colors: 2,
    passes_per_row: 1,
    pat_row: 0,
    ...overrides,
  };
}

function run(
  fn: (c: ModeFuncControl, n: number) => ReturnType<typeof ModeFunc.singlebed>,
  control: ModeFuncControl,
  line: number,
) {
  return fn({ ...control }, line);
}

describe("ModeFunc", () => {
  it("singlebed matches desktop test__singlebed", () => {
    const c = ctrl({ pat_height: 3, len_pat_expanded: 6 });
    const fn = ModeFunc.singlebed!;
    expect(run(fn, c, 0)).toEqual([0, 0, false, false]);
    expect(run(fn, c, 1)).toEqual([0, 2, false, false]);
    expect(run(fn, c, 2)).toEqual([0, 4, false, true]);
    c.inf_repeat = true;
    expect(run(fn, c, 3)).toEqual([0, 0, false, false]);
    expect(run(fn, c, 4)).toEqual([0, 2, false, false]);
    c.start_row = 1;
    expect(run(fn, c, 2)).toEqual([0, 0, false, false]);
  });

  it("classicRibber2col matches desktop test__classic_ribber_2col", () => {
    const c = ctrl({ pat_height: 5, len_pat_expanded: 10 });
    const fn = ModeFunc.classicRibber2col!;
    expect(run(fn, c, 0)).toEqual([0, 0, false, false]);
    expect(run(fn, c, 1)).toEqual([1, 1, false, false]);
    expect(run(fn, c, 2)).toEqual([1, 3, false, false]);
    expect(run(fn, c, 3)).toEqual([0, 2, false, false]);
    expect(run(fn, c, 9)).toEqual([1, 9, false, true]);
    c.inf_repeat = true;
    expect(run(fn, c, 10)).toEqual([1, 1, false, false]);
    expect(run(fn, c, 11)).toEqual([0, 0, false, false]);
    c.start_row = 1;
    expect(run(fn, c, 8)).toEqual([1, 1, false, false]);
  });

  it("classicRibberMulticol matches desktop test__classic_ribber_multicol", () => {
    const c = ctrl({
      pat_height: 3,
      len_pat_expanded: 9,
      num_colors: 3,
      passes_per_row: 6,
    });
    const fn = ModeFunc.classicRibberMulticol!;
    expect(run(fn, c, 0)).toEqual([0, 0, false, false]);
    expect(run(fn, c, 1)).toEqual([0, 0, true, false]);
    expect(run(fn, c, 17)).toEqual([2, 8, true, true]);
    c.inf_repeat = true;
    expect(run(fn, c, 18)).toEqual([0, 0, false, false]);
    c.start_row = 1;
    expect(run(fn, c, 12)).toEqual([0, 0, false, false]);
  });

  it("middlecolorstwiceRibber matches desktop test__middlecolorstwice_ribber", () => {
    const c = ctrl({
      pat_height: 5,
      len_pat_expanded: 15,
      num_colors: 3,
      passes_per_row: 4,
    });
    const fn = ModeFunc.middlecolorstwiceRibber!;
    expect(run(fn, c, 0)).toEqual([0, 0, false, false]);
    expect(run(fn, c, 1)).toEqual([2, 2, true, false]);
    expect(run(fn, c, 19)).toEqual([1, 13, false, true]);
    c.inf_repeat = true;
    expect(run(fn, c, 20)).toEqual([1, 1, false, false]);
    expect(run(fn, c, 23)).toEqual([0, 0, false, false]);
    c.start_row = 1;
    expect(run(fn, c, 16)).toEqual([1, 1, false, false]);
  });

  it("heartofplutoRibber matches desktop test__heartofpluto_ribber", () => {
    const c = ctrl({
      pat_height: 5,
      len_pat_expanded: 15,
      num_colors: 3,
      passes_per_row: 4,
    });
    const fn = ModeFunc.heartofplutoRibber!;
    expect(run(fn, c, 0)).toEqual([2, 2, false, false]);
    expect(run(fn, c, 1)).toEqual([1, 1, false, false]);
    expect(run(fn, c, 19)).toEqual([1, 13, false, true]);
    c.inf_repeat = true;
    expect(run(fn, c, 20)).toEqual([1, 1, false, false]);
    expect(run(fn, c, 21)).toEqual([0, 0, false, false]);
    c.start_row = 1;
    expect(run(fn, c, 16)).toEqual([1, 1, false, false]);
  });

  it("circularRibber matches desktop test__circular_ribber", () => {
    const c = ctrl({
      pat_height: 3,
      len_pat_expanded: 9,
      num_colors: 3,
    });
    const fn = ModeFunc.circularRibber!;
    expect(run(fn, c, 0)).toEqual([0, 0, false, false]);
    expect(run(fn, c, 17)).toEqual([2, 8, true, true]);
    c.inf_repeat = true;
    expect(run(fn, c, 18)).toEqual([0, 0, false, false]);
    c.start_row = 1;
    expect(run(fn, c, 12)).toEqual([0, 0, false, false]);
  });

  it("resolveModeFunc selects knit func by mode", () => {
    expect(resolveModeFunc(Mode.SINGLEBED, 2)).toBe(ModeFunc.singlebed);
    expect(resolveModeFunc(Mode.CLASSIC_RIBBER, 2)).toBe(
      ModeFunc.classicRibber2col,
    );
    expect(resolveModeFunc(Mode.CLASSIC_RIBBER, 3)).toBe(
      ModeFunc.classicRibberMulticol,
    );
    expect(resolveModeFunc(Mode.MIDDLECOLORSTWICE_RIBBER, 3)).toBe(
      ModeFunc.middlecolorstwiceRibber,
    );
    expect(resolveModeFunc(Mode.HEARTOFPLUTO_RIBBER, 4)).toBe(
      ModeFunc.heartofplutoRibber,
    );
    expect(resolveModeFunc(Mode.CIRCULAR_RIBBER, 2)).toBe(
      ModeFunc.circularRibber,
    );
  });
});

describe("Mode helpers", () => {
  it("rowMultiplier matches desktop", () => {
    expect(Mode.rowMultiplier(Mode.SINGLEBED, 2)).toBe(1);
    expect(Mode.rowMultiplier(Mode.CLASSIC_RIBBER, 2)).toBe(2);
    expect(Mode.rowMultiplier(Mode.CLASSIC_RIBBER, 3)).toBe(6);
    expect(Mode.rowMultiplier(Mode.MIDDLECOLORSTWICE_RIBBER, 3)).toBe(4);
    expect(Mode.rowMultiplier(Mode.HEARTOFPLUTO_RIBBER, 4)).toBe(6);
    expect(Mode.rowMultiplier(Mode.CIRCULAR_RIBBER, 2)).toBe(4);
  });

  it("goodNColors matches desktop", () => {
    expect(Mode.goodNColors(Mode.SINGLEBED, 2)).toBe(true);
    expect(Mode.goodNColors(Mode.SINGLEBED, 3)).toBe(false);
    expect(Mode.goodNColors(Mode.CLASSIC_RIBBER, 3)).toBe(true);
    expect(Mode.goodNColors(Mode.CIRCULAR_RIBBER, 2)).toBe(true);
    expect(Mode.goodNColors(Mode.CIRCULAR_RIBBER, 3)).toBe(false);
  });

  it("flankingNeedles is true only for color 0", () => {
    expect(Mode.flankingNeedles(0, 2)).toBe(true);
    expect(Mode.flankingNeedles(1, 2)).toBe(false);
    expect(Mode.flankingNeedles(0, 3)).toBe(true);
    expect(Mode.flankingNeedles(2, 3)).toBe(false);
  });
});
