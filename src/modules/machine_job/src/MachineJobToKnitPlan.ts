import { MachineJob, MachinePass, PassDirection } from "./MachineJobTypes";

export interface MachineJobPlanPass {
  rowNumber: number;
  passId: string;
  direction: Exclude<PassDirection, "either">;
  selectionBits: Uint8Array;
  activeNeedles: { left: number; right: number };
}

export interface MachineJobKnitPlan {
  jobId: string;
  title: string;
  leftNeedle: number;
  rightNeedle: number;
  yarnIds: string[];
  passes: MachineJobPlanPass[];
}

export interface MachineJobPlanIssue {
  path: string;
  message: string;
  rowNumber?: number;
  passId?: string;
}

export type MachineJobPlanResult =
  | { ok: true; plan: MachineJobKnitPlan }
  | { ok: false; issues: MachineJobPlanIssue[] };

function reverseDirection(
  direction: Exclude<PassDirection, "either">,
): Exclude<PassDirection, "either"> {
  return direction === "leftToRight" ? "rightToLeft" : "leftToRight";
}

function setBit(bits: Uint8Array, index: number): void {
  const byte = Math.floor(index / 8);
  bits[byte] = (bits[byte] ?? 0) | (1 << (index % 8));
}

function packSelection(
  pass: MachinePass,
  envelopeLeft: number,
  envelopeWidth: number,
): Uint8Array {
  const left = pass.activeNeedles.left;
  const width = envelopeWidth;
  const bits = new Uint8Array(Math.ceil(width / 8));
  if (pass.selection.encoding === "bitmap") {
    for (let index = 0; index < pass.selection.bits.length; index++) {
      if (pass.selection.bits[index] === "1") {
        setBit(bits, left - envelopeLeft + index);
      }
    }
  } else {
    for (const needle of pass.selection.indices) {
      setBit(bits, needle - envelopeLeft);
    }
  }
  return bits;
}

function passIssue(
  issues: MachineJobPlanIssue[],
  path: string,
  message: string,
  rowNumber: number,
  pass: MachinePass,
): void {
  issues.push({ path, message, rowNumber, passId: pass.passId });
}

/**
 * Compiles the deliberately conservative first execution subset:
 * one pass per logical row, knit carriage, <=2 colors,
 * stockinette/fair-isle selection, alternating carriage direction, and only
 * non-blocking informational prompts.
 */
export function machineJobToKnitPlan(job: MachineJob): MachineJobPlanResult {
  const issues: MachineJobPlanIssue[] = [];
  const allPasses = job.rows.flatMap((row) => row.passes);
  const leftNeedle = Math.min(
    ...allPasses.map((pass) => pass.activeNeedles.left),
  );
  const rightNeedle = Math.max(
    ...allPasses.map((pass) => pass.activeNeedles.right),
  );
  const envelopeWidth = rightNeedle - leftNeedle + 1;
  let expectedDirection: Exclude<PassDirection, "either"> =
    job.rows[0]!.passes[0]!.direction === "rightToLeft"
      ? "rightToLeft"
      : "leftToRight";
  const planPasses: MachineJobPlanPass[] = [];

  job.rows.forEach((row, rowIndex) => {
    for (const [promptIndex, prompt] of [
      ...row.promptsBefore,
      ...row.promptsAfter,
    ].entries()) {
      if (prompt.kind !== "info" || prompt.acknowledgementRequired) {
        issues.push({
          path: `$.rows[${rowIndex}].prompts[${promptIndex}]`,
          message: "execution subset supports only non-blocking informational prompts",
          rowNumber: row.rowNumber,
        });
      }
    }
    if (row.passes.length !== 1) {
      issues.push({
        path: `$.rows[${rowIndex}].passes`,
        message: "execution subset requires exactly one pass per logical row",
        rowNumber: row.rowNumber,
      });
      return;
    }
    const pass = row.passes[0]!;
    const path = `$.rows[${rowIndex}].passes[0]`;
    if (pass.technique !== "fairIsle" && pass.technique !== "stockinette") {
      passIssue(
        issues,
        `${path}.technique`,
        "execution subset supports only 'fairIsle' and 'stockinette'",
        row.rowNumber,
        pass,
      );
    }
    if (pass.carriage !== undefined && pass.carriage !== "knit") {
      passIssue(
        issues,
        `${path}.carriage`,
        "execution subset supports only the knit carriage",
        row.rowNumber,
        pass,
      );
    }
    if (pass.yarnIds.length > 2) {
      passIssue(
        issues,
        `${path}.yarnIds`,
        "execution subset supports at most two yarns per pass",
        row.rowNumber,
        pass,
      );
    }
    if (pass.direction !== "either" && pass.direction !== expectedDirection) {
      passIssue(
        issues,
        `${path}.direction`,
        `expected '${expectedDirection}' for alternating carriage passes`,
        row.rowNumber,
        pass,
      );
    }
    planPasses.push({
      rowNumber: row.rowNumber,
      passId: pass.passId,
      direction: expectedDirection,
      selectionBits: packSelection(pass, leftNeedle, envelopeWidth),
      activeNeedles: { ...pass.activeNeedles },
    });
    expectedDirection = reverseDirection(expectedDirection);
  });

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    plan: {
      jobId: job.jobId,
      title: job.title,
      leftNeedle,
      rightNeedle,
      yarnIds: job.yarns.map((yarn) => yarn.id),
      passes: planPasses,
    },
  };
}
