/**
 * Knitting mode line selection — port of ayab-desktop engine/mode.py ModeFunc.
 */

import { Mode } from "constants/src/StateMachineConstants";

export interface ModeFuncControl {
  start_row: number;
  inf_repeat: boolean;
  pat_height: number;
  len_pat_expanded: number;
  num_colors: number;
  passes_per_row: number;
  pat_row: number;
}

export type ModeTuple = [
  color: number,
  row_index: number,
  blank_line: boolean,
  last_line: boolean,
];

export type ModeFuncType = (
  control: ModeFuncControl,
  line_number: number,
) => ModeTuple;

function odd(n: number): boolean {
  return n % 2 === 1;
}

function even(n: number): boolean {
  return n % 2 === 0;
}

function singlebed(control: ModeFuncControl, line_number: number): ModeTuple {
  let ln = line_number + control.start_row;
  if (control.inf_repeat) {
    ln %= control.pat_height;
  }
  control.pat_row = ln;
  const color = 0;
  const row_index = 2 * control.pat_row;
  const blank_line = false;
  const last_line = control.pat_row === control.pat_height - 1;
  return [color, row_index, blank_line, last_line];
}

function classicRibber2col(
  control: ModeFuncControl,
  line_number: number,
): ModeTuple {
  let ln = line_number + 2 * control.start_row;
  const i = ln % 4;
  if (control.inf_repeat) {
    ln %= control.len_pat_expanded;
  }
  control.pat_row = Math.floor(ln / 2);
  const color = [0, 1, 1, 0][i]!;
  const row_index =
    (ln + [0, 0, 1, -1][i]! + control.len_pat_expanded) %
    control.len_pat_expanded;
  const blank_line = false;
  const last_line =
    control.pat_row === control.pat_height - 1 && (i === 1 || i === 3);
  return [color, row_index, blank_line, last_line];
}

function classicRibberMulticol(
  control: ModeFuncControl,
  line_number: number,
): ModeTuple {
  const blank_line = odd(line_number);
  let h = Math.floor(line_number / 2);
  h += control.num_colors * control.start_row;
  if (control.inf_repeat) {
    h %= control.len_pat_expanded;
  }
  control.pat_row = Math.floor(h / control.num_colors);
  const color = h % control.num_colors;
  const row_index = control.pat_row * control.num_colors + color;
  const last_line =
    row_index === control.len_pat_expanded - 1 && blank_line;
  return [color, row_index, blank_line, last_line];
}

function middlecolorstwiceRibber(
  control: ModeFuncControl,
  line_number: number,
): ModeTuple {
  let ln = line_number + control.passes_per_row * control.start_row;
  control.pat_row = Math.floor(ln / control.passes_per_row);
  const r = ln % control.passes_per_row;
  const first_col = r === 0;
  const last_col = r === control.passes_per_row - 1;
  let color: number;
  if (first_col || last_col) {
    color = (Number(last_col) + control.pat_row) % 2;
  } else {
    color = Math.floor((r + 3) / 2);
  }
  if (control.inf_repeat) {
    control.pat_row %= control.pat_height;
  }
  const row_index = control.num_colors * control.pat_row + color;
  const blank_line = !first_col && !last_col && odd(ln);
  const last_line =
    control.pat_row === control.pat_height - 1 && last_col;
  return [color, row_index, blank_line, last_line];
}

function heartofplutoRibber(
  control: ModeFuncControl,
  line_number: number,
): ModeTuple {
  let ln = line_number + control.passes_per_row * control.start_row;
  control.pat_row = Math.floor(ln / control.passes_per_row);
  if (control.inf_repeat) {
    control.pat_row %= control.pat_height;
  }
  const r = ln % control.passes_per_row;
  const first_col = r === 0;
  const last_col = r === control.passes_per_row - 1;
  const color =
    control.num_colors -
    1 -
    Math.floor(((ln + 1) % (2 * control.num_colors)) / 2);
  const row_index = control.num_colors * control.pat_row + color;
  const blank_line = !first_col && !last_col && even(ln);
  const last_line =
    control.pat_row === control.pat_height - 1 && last_col;
  return [color, row_index, blank_line, last_line];
}

function circularRibber(
  control: ModeFuncControl,
  line_number: number,
): ModeTuple {
  const blank_line = odd(line_number);
  let h = Math.floor(line_number / 2);
  h += control.num_colors * control.start_row;
  if (control.inf_repeat) {
    h %= control.len_pat_expanded;
  }
  control.pat_row = Math.floor(h / control.num_colors);
  const color = h % control.num_colors;
  const row_index = h;
  const last_line =
    row_index === control.len_pat_expanded - 1 && blank_line;
  return [color, row_index, blank_line, last_line];
}

export const ModeFunc: Record<string, ModeFuncType> = {
  singlebed,
  classicRibber2col,
  classicRibberMulticol,
  middlecolorstwiceRibber,
  heartofplutoRibber,
  circularRibber,
};

export function resolveModeFunc(
  mode: Mode,
  numColors: number,
): ModeFuncType | undefined {
  const { knitFunc } = Mode;
  const name = knitFunc(mode, numColors);
  return ModeFunc[name];
}
