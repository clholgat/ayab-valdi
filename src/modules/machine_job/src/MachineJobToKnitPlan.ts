import {
  MachineJob,
  MachinePass,
  OperatorPrompt,
  PassDirection,
} from "./MachineJobTypes";

export interface MachineJobPlanPass {
  rowNumber: number;
  passId: string;
  direction: Exclude<PassDirection, "either">;
  selectionBits: Uint8Array;
  activeNeedles: { left: number; right: number };
  promptsBefore: OperatorPrompt[];
  promptsAfter: OperatorPrompt[];
  technique: string;
  carriage?: string;
  yarnIds: string[];
}

export interface MachineJobKnitPlan {
  jobId: string;
  title: string;
  leftNeedle: number;
  rightNeedle: number;
  yarnIds: string[];
  carriageRoles: string[];
  accessories: string[];
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
 * physical passes in their declared logical-row order, AYAB knit/ribber modes,
 * and alternating carriage direction.
 * Operator prompts are retained at their safe pass boundaries for the runtime.
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

  const supportedTechniques = [
    "stockinette",
    "fairIsle",
    "classicRibber",
    "middleColorsTwiceRibber",
    "heartOfPlutoRibber",
    "circularRibber",
  ];
  job.rows.forEach((row, rowIndex) => {
    row.passes.forEach((pass, passIndex) => {
    const path = `$.rows[${rowIndex}].passes[${passIndex}]`;
    if (!supportedTechniques.includes(pass.technique)) {
      passIssue(
        issues,
        `${path}.technique`,
        `unsupported AYAB technique '${pass.technique}'`,
        row.rowNumber,
        pass,
      );
    }
    if (pass.carriage !== undefined && pass.carriage !== "knit" && pass.carriage !== "ribber") {
      passIssue(
        issues,
        `${path}.carriage`,
        "execution subset supports only the knit and ribber carriage roles",
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
      promptsBefore: passIndex === 0 ? row.promptsBefore.slice() : [],
      promptsAfter: passIndex === row.passes.length - 1 ? row.promptsAfter.slice() : [],
      technique: pass.technique,
      carriage: pass.carriage,
      yarnIds: pass.yarnIds.slice(),
    });
    expectedDirection = reverseDirection(expectedDirection);
    });
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
      carriageRoles: (job.requirements.carriageRoles ?? []).slice(),
      accessories: (job.requirements.accessories ?? []).slice(),
      passes: planPasses,
    },
  };
}
