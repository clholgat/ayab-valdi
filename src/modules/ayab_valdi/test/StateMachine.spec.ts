import "jasmine/src/jasmine";
import {
  Operation,
  StateMachineState,
  Mode,
  Alignment,
} from "constants/src/StateMachineConstants";
import { Machine } from "state_machine/src/Machine";
import { Pattern, PatternImage } from "state_machine/src/Pattern";
import { StateMachine } from "state_machine/src/StateMachine";
import { Output } from "state_machine/src/Output";
import { Control } from "serial/src/Control";
import { Preferences } from "app_settings/src/Preferences";

function makePattern(width: number, height: number): Pattern {
  const black = new Uint8Array([0, 0, 0, 255]);
  const row: Uint8Array[] = [];
  for (let i = 0; i < width; i++) {
    row.push(black);
  }
  const imageRows: Uint8Array[][] = [];
  for (let r = 0; r < height; r++) {
    imageRows.push(row);
  }
  const image = new PatternImage(imageRows, width, height, 2);
  const pattern = new Pattern(image, 2);
  pattern.alignment = Alignment.LEFT;
  pattern.knitStartNeedle = 0;
  pattern.knitEndNeedle = width;
  pattern.calcPatStartEndNeedles();
  pattern.processPatternData(Machine.width(Machine.KH910_KH950), 2, 0, width - 1);
  return pattern;
}

function makeSimulationControl(
  operation: Operation = Operation.KNIT,
  numColors: number = 2,
): Control {
  const control = new Control();
  control.start(
    makePattern(20, 2),
    {
      machine: Machine.KH910_KH950,
      num_colors: numColors,
      start_row: 0,
      mode: Mode.SINGLEBED,
      inf_repeat: false,
      continuous_reporting: true,
      prefs: new Preferences(),
      portname: "Simulation",
    },
    operation,
  );
  return control;
}

describe("StateMachine", () => {
  it("_API6_connect opens Simulation and moves to VERSION_CHECK", () => {
    const control = makeSimulationControl();
    const output = StateMachine._API6_connect(control, Operation.KNIT);
    expect(output).toBe(Output.NONE);
    expect(control.state).toBe(StateMachineState.VERSION_CHECK);
    expect(control.com.isOpen()).toBe(true);
  });

  it("_API6_connect rejects invalid knit settings", () => {
    const control = makeSimulationControl(Operation.KNIT, 4);
    const output = StateMachine._API6_connect(control, Operation.KNIT);
    expect(output).toBe(Output.ERROR_INVALID_SETTINGS);
  });

  it("_API6_version_check accepts supported API version", () => {
    const control = makeSimulationControl();
    StateMachine._API6_connect(control, Operation.KNIT);
    const output = StateMachine._API6_version_check(control, Operation.KNIT);
    expect(output).toBe(Output.NONE);
    expect(control.state).toBe(StateMachineState.INIT);
    expect(control.api_version).toBeGreaterThanOrEqual(6);
  });

  it("_API6_init transitions to REQUEST_START on cnfInit", () => {
    const control = makeSimulationControl();
    StateMachine._API6_connect(control, Operation.KNIT);
    StateMachine._API6_version_check(control, Operation.KNIT);
    const output = StateMachine._API6_init(control, Operation.KNIT);
    expect(output).toBe(Output.NONE);
    expect(control.state).toBe(StateMachineState.REQUEST_START);
  });

  it("_API6_request_start sends reqStart on indState", () => {
    const control = makeSimulationControl();
    StateMachine._API6_connect(control, Operation.KNIT);
    StateMachine._API6_version_check(control, Operation.KNIT);
    StateMachine._API6_init(control, Operation.KNIT);
    const output = StateMachine._API6_request_start(control, Operation.KNIT);
    expect(output).toBe(Output.NONE);
    expect(control.state).toBe(StateMachineState.CONFIRM_START);
  });

  it("_API6_confirm_start returns PLEASE_KNIT when device ready", () => {
    const control = makeSimulationControl();
    StateMachine._API6_connect(control, Operation.KNIT);
    StateMachine._API6_version_check(control, Operation.KNIT);
    StateMachine._API6_init(control, Operation.KNIT);
    StateMachine._API6_request_start(control, Operation.KNIT);
    const output = StateMachine._API6_confirm_start(control, Operation.KNIT);
    expect(output).toBe(Output.PLEASE_KNIT);
    expect(control.state).toBe(StateMachineState.RUN_KNIT);
  });

  it("_API6_request_test moves to CONFIRM_TEST", () => {
    const control = makeSimulationControl(Operation.TEST);
    StateMachine._API6_connect(control, Operation.TEST);
    const output = StateMachine._API6_request_test(control, Operation.TEST);
    expect(output).toBe(Output.NONE);
    expect(control.state).toBe(StateMachineState.CONFIRM_TEST);
  });

  it("_API6_confirm_test enters RUN_TEST on success", () => {
    const control = makeSimulationControl(Operation.TEST);
    StateMachine._API6_connect(control, Operation.TEST);
    StateMachine._API6_version_check(control, Operation.TEST);
    StateMachine._API6_init(control, Operation.TEST);
    StateMachine._API6_request_test(control, Operation.TEST);
    const output = StateMachine._API6_confirm_test(control, Operation.TEST);
    expect(output).toBe(Output.NONE);
    expect(control.state).toBe(StateMachineState.RUN_TEST);
  });
});
