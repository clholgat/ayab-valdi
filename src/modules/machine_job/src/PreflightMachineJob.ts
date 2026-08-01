import { MachineCapabilities } from "./MachineCapabilities";
import { MachineJob, MachinePass, OperatorPrompt } from "./MachineJobTypes";

export type MachineJobPreflightIssueCode =
  | "needleBounds"
  | "colorCapacity"
  | "selectionEncoding"
  | "direction"
  | "technique"
  | "carriageRole"
  | "accessory";

export interface MachineJobPreflightIssue {
  code: MachineJobPreflightIssueCode;
  path: string;
  message: string;
  rowNumber?: number;
  passId?: string;
}

export interface MachineJobPreflightSummary {
  logicalRows: number;
  passes: number;
  yarns: number;
  prompts: number;
  minNeedle: number;
  maxNeedle: number;
}

export interface MachineJobPreflightResult {
  compatible: boolean;
  summary: MachineJobPreflightSummary;
  issues: MachineJobPreflightIssue[];
}

function supports(values: string[], required: string): boolean {
  return values.includes(required);
}

function promptCount(prompts: OperatorPrompt[]): number {
  return prompts.length;
}

function addPassIssue(
  issues: MachineJobPreflightIssue[],
  code: MachineJobPreflightIssueCode,
  path: string,
  message: string,
  rowNumber: number,
  pass: MachinePass,
): void {
  issues.push({ code, path, message, rowNumber, passId: pass.passId });
}

export function summarizeMachineJob(job: MachineJob): MachineJobPreflightSummary {
  let passes = 0;
  let prompts = 0;
  for (const row of job.rows) {
    passes += row.passes.length;
    prompts += promptCount(row.promptsBefore) + promptCount(row.promptsAfter);
  }
  return {
    logicalRows: job.rows.length,
    passes,
    yarns: job.yarns.length,
    prompts,
    minNeedle: job.requirements.minNeedle,
    maxNeedle: job.requirements.maxNeedle,
  };
}

export function preflightMachineJob(
  job: MachineJob,
  machine: MachineCapabilities,
): MachineJobPreflightResult {
  const issues: MachineJobPreflightIssue[] = [];
  const requirements = job.requirements;

  if (
    requirements.minNeedle < machine.minNeedle ||
    requirements.maxNeedle > machine.maxNeedle
  ) {
    issues.push({
      code: "needleBounds",
      path: "$.requirements",
      message:
        `Job requires needles ${requirements.minNeedle}..${requirements.maxNeedle}; ` +
        `${machine.displayName} supports ${machine.minNeedle}..${machine.maxNeedle}.`,
    });
  }

  if (
    requirements.maxColors !== undefined &&
    requirements.maxColors > machine.maxColorsPerPass
  ) {
    issues.push({
      code: "colorCapacity",
      path: "$.requirements.maxColors",
      message:
        `Job requires ${requirements.maxColors} colors per pass; ` +
        `${machine.displayName} supports ${machine.maxColorsPerPass}.`,
    });
  }

  for (const technique of requirements.techniques ?? []) {
    if (!supports(machine.techniques, technique)) {
      issues.push({
        code: "technique",
        path: "$.requirements.techniques",
        message: `${machine.displayName} does not support technique '${technique}'.`,
      });
    }
  }
  for (const carriage of requirements.carriageRoles ?? []) {
    if (!supports(machine.carriageRoles, carriage)) {
      issues.push({
        code: "carriageRole",
        path: "$.requirements.carriageRoles",
        message: `${machine.displayName} does not provide carriage role '${carriage}'.`,
      });
    }
  }
  for (const accessory of requirements.accessories ?? []) {
    if (!supports(machine.accessories, accessory)) {
      issues.push({
        code: "accessory",
        path: "$.requirements.accessories",
        message: `${machine.displayName} does not provide accessory '${accessory}'.`,
      });
    }
  }

  job.rows.forEach((row, rowIndex) => {
    row.passes.forEach((pass, passIndex) => {
      const path = `$.rows[${rowIndex}].passes[${passIndex}]`;
      if (
        pass.activeNeedles.left < machine.minNeedle ||
        pass.activeNeedles.right > machine.maxNeedle
      ) {
        addPassIssue(
          issues,
          "needleBounds",
          `${path}.activeNeedles`,
          `Pass uses needles ${pass.activeNeedles.left}..${pass.activeNeedles.right}; ` +
            `${machine.displayName} supports ${machine.minNeedle}..${machine.maxNeedle}.`,
          row.rowNumber,
          pass,
        );
      }
      if (pass.yarnIds.length > machine.maxColorsPerPass) {
        addPassIssue(
          issues,
          "colorCapacity",
          `${path}.yarnIds`,
          `Pass uses ${pass.yarnIds.length} colors; ` +
            `${machine.displayName} supports ${machine.maxColorsPerPass}.`,
          row.rowNumber,
          pass,
        );
      }
      if (!supports(machine.selectionEncodings, pass.selection.encoding)) {
        addPassIssue(
          issues,
          "selectionEncoding",
          `${path}.selection.encoding`,
          `${machine.displayName} does not support '${pass.selection.encoding}' selections.`,
          row.rowNumber,
          pass,
        );
      }
      if (
        pass.direction !== "either" &&
        !supports(machine.directions, pass.direction)
      ) {
        addPassIssue(
          issues,
          "direction",
          `${path}.direction`,
          `${machine.displayName} does not support direction '${pass.direction}'.`,
          row.rowNumber,
          pass,
        );
      }
      if (!supports(machine.techniques, pass.technique)) {
        addPassIssue(
          issues,
          "technique",
          `${path}.technique`,
          `${machine.displayName} does not support technique '${pass.technique}'.`,
          row.rowNumber,
          pass,
        );
      }
      if (pass.carriage !== undefined && !supports(machine.carriageRoles, pass.carriage)) {
        addPassIssue(
          issues,
          "carriageRole",
          `${path}.carriage`,
          `${machine.displayName} does not provide carriage role '${pass.carriage}'.`,
          row.rowNumber,
          pass,
        );
      }
    });
  });

  return {
    compatible: issues.length === 0,
    summary: summarizeMachineJob(job),
    issues,
  };
}
