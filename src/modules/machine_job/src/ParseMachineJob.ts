import {
  MACHINE_JOB_FORMAT_VERSION,
  MachineJob,
  MachinePass,
  OperatorPrompt,
} from "./MachineJobTypes";

export interface MachineJobValidationIssue {
  path: string;
  message: string;
}

export type ParseMachineJobResult =
  | { ok: true; job: MachineJob }
  | { ok: false; issues: MachineJobValidationIssue[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function issue(
  issues: MachineJobValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function validatePrompt(
  value: unknown,
  path: string,
  issues: MachineJobValidationIssue[],
  promptIds: Set<string>,
  yarnIds: Set<string>,
): void {
  if (!isObject(value)) {
    issue(issues, path, "must be an object");
    return;
  }
  const prompt = value as Partial<OperatorPrompt>;
  if (!isNonEmptyString(prompt.id)) {
    issue(issues, `${path}.id`, "must be a non-empty string");
  } else if (promptIds.has(prompt.id)) {
    issue(issues, `${path}.id`, `duplicate prompt ID '${prompt.id}'`);
  } else {
    promptIds.add(prompt.id);
  }
  const kinds = ["info", "confirm", "yarnChange", "shape", "carriageChange", "manualAction"];
  if (!kinds.includes(prompt.kind as string)) {
    issue(issues, `${path}.kind`, "is not a supported prompt kind");
  }
  if (!["info", "warning", "critical"].includes(prompt.severity as string)) {
    issue(issues, `${path}.severity`, "is not a supported severity");
  }
  if (!isNonEmptyString(prompt.text)) {
    issue(issues, `${path}.text`, "must be a non-empty string");
  }
  if (typeof prompt.acknowledgementRequired !== "boolean") {
    issue(issues, `${path}.acknowledgementRequired`, "must be a boolean");
  }
  if (prompt.yarnId !== undefined && !yarnIds.has(prompt.yarnId)) {
    issue(issues, `${path}.yarnId`, `references unknown yarn '${prompt.yarnId}'`);
  }
}

function validatePass(
  value: unknown,
  path: string,
  issues: MachineJobValidationIssue[],
  passIds: Set<string>,
  yarnIds: Set<string>,
  requirementBounds: { minNeedle: number; maxNeedle: number } | null,
): void {
  if (!isObject(value)) {
    issue(issues, path, "must be an object");
    return;
  }
  const pass = value as Partial<MachinePass>;
  if (!isNonEmptyString(pass.passId)) {
    issue(issues, `${path}.passId`, "must be a non-empty string");
  } else if (passIds.has(pass.passId)) {
    issue(issues, `${path}.passId`, `duplicate pass ID '${pass.passId}'`);
  } else {
    passIds.add(pass.passId);
  }
  if (!["leftToRight", "rightToLeft", "either"].includes(pass.direction as string)) {
    issue(issues, `${path}.direction`, "is not a supported direction");
  }
  if (!isObject(pass.activeNeedles)) {
    issue(issues, `${path}.activeNeedles`, "must be an object");
  } else {
    const left = pass.activeNeedles.left;
    const right = pass.activeNeedles.right;
    if (!isInteger(left)) issue(issues, `${path}.activeNeedles.left`, "must be an integer");
    if (!isInteger(right)) issue(issues, `${path}.activeNeedles.right`, "must be an integer");
    if (isInteger(left) && isInteger(right) && left > right) {
      issue(issues, `${path}.activeNeedles`, "left must not exceed right");
    }
    if (
      isInteger(left) &&
      isInteger(right) &&
      requirementBounds !== null &&
      (left < requirementBounds.minNeedle || right > requirementBounds.maxNeedle)
    ) {
      issue(
        issues,
        `${path}.activeNeedles`,
        "must stay within the declared requirement bounds",
      );
    }
  }
  if (!isObject(pass.selection)) {
    issue(issues, `${path}.selection`, "must be an object");
  } else if (pass.selection.encoding === "indices") {
    if (!Array.isArray(pass.selection.indices) || !pass.selection.indices.every(isInteger)) {
      issue(issues, `${path}.selection.indices`, "must contain only integers");
    } else {
      const indices = pass.selection.indices as number[];
      if (new Set(indices).size !== indices.length) {
        issue(issues, `${path}.selection.indices`, "must not contain duplicates");
      }
      if (
        isObject(pass.activeNeedles) &&
        isInteger(pass.activeNeedles.left) &&
        isInteger(pass.activeNeedles.right) &&
        indices.some(
          (needle) =>
            needle < pass.activeNeedles!.left || needle > pass.activeNeedles!.right,
        )
      ) {
        issue(issues, `${path}.selection.indices`, "must stay within active needles");
      }
    }
  } else if (pass.selection.encoding === "bitmap") {
    if (!isInteger(pass.selection.offset)) issue(issues, `${path}.selection.offset`, "must be an integer");
    if (typeof pass.selection.bits !== "string" || !/^[01]+$/.test(pass.selection.bits)) {
      issue(issues, `${path}.selection.bits`, "must be a non-empty binary string");
    }
    if (
      isInteger(pass.selection.offset) &&
      typeof pass.selection.bits === "string" &&
      isObject(pass.activeNeedles) &&
      isInteger(pass.activeNeedles.left) &&
      isInteger(pass.activeNeedles.right) &&
      (pass.selection.offset !== pass.activeNeedles.left ||
        pass.selection.bits.length !==
          pass.activeNeedles.right - pass.activeNeedles.left + 1)
    ) {
      issue(
        issues,
        `${path}.selection`,
        "bitmap offset and length must exactly cover active needles",
      );
    }
  } else {
    issue(issues, `${path}.selection.encoding`, "must be 'indices' or 'bitmap'");
  }
  if (!Array.isArray(pass.yarnIds) || pass.yarnIds.length === 0) {
    issue(issues, `${path}.yarnIds`, "must be a non-empty array");
  } else {
    pass.yarnIds.forEach((id, index) => {
      if (!isNonEmptyString(id) || !yarnIds.has(id)) {
        issue(issues, `${path}.yarnIds[${index}]`, `references unknown yarn '${String(id)}'`);
      }
    });
  }
  if (!isNonEmptyString(pass.technique)) {
    issue(issues, `${path}.technique`, "must be a non-empty string");
  }
}

export function validateMachineJob(value: unknown): ParseMachineJobResult {
  const issues: MachineJobValidationIssue[] = [];
  if (!isObject(value)) return { ok: false, issues: [{ path: "$", message: "must be an object" }] };

  if (value.formatVersion !== MACHINE_JOB_FORMAT_VERSION) {
    issue(issues, "$.formatVersion", `must equal '${MACHINE_JOB_FORMAT_VERSION}'`);
  }
  if (!isNonEmptyString(value.jobId)) issue(issues, "$.jobId", "must be a non-empty string");
  if (!isNonEmptyString(value.title)) issue(issues, "$.title", "must be a non-empty string");
  if (value.coordinateSystem !== "zeroBasedNeedleIndex") {
    issue(
      issues,
      "$.coordinateSystem",
      "must equal 'zeroBasedNeedleIndex'",
    );
  }

  const yarnIds = new Set<string>();
  if (!Array.isArray(value.yarns) || value.yarns.length === 0) {
    issue(issues, "$.yarns", "must be a non-empty array");
  } else {
    value.yarns.forEach((yarn, index) => {
      const path = `$.yarns[${index}]`;
      if (!isObject(yarn) || !isNonEmptyString(yarn.id)) {
        issue(issues, `${path}.id`, "must be a non-empty string");
      } else if (yarnIds.has(yarn.id)) {
        issue(issues, `${path}.id`, `duplicate yarn ID '${yarn.id}'`);
      } else yarnIds.add(yarn.id);
    });
  }

  let requirementBounds: { minNeedle: number; maxNeedle: number } | null = null;
  if (!isObject(value.requirements)) {
    issue(issues, "$.requirements", "must be an object");
  } else {
    if (!isInteger(value.requirements.minNeedle)) issue(issues, "$.requirements.minNeedle", "must be an integer");
    if (!isInteger(value.requirements.maxNeedle)) issue(issues, "$.requirements.maxNeedle", "must be an integer");
    if (
      isInteger(value.requirements.minNeedle) &&
      value.requirements.minNeedle < 0
    ) {
      issue(
        issues,
        "$.requirements.minNeedle",
        "must be zero or greater for zeroBasedNeedleIndex",
      );
    }
    if (
      isInteger(value.requirements.maxNeedle) &&
      value.requirements.maxNeedle < 0
    ) {
      issue(
        issues,
        "$.requirements.maxNeedle",
        "must be zero or greater for zeroBasedNeedleIndex",
      );
    }
    if (
      value.requirements.maxColors !== undefined &&
      (!isInteger(value.requirements.maxColors) ||
        value.requirements.maxColors < 1)
    ) {
      issue(
        issues,
        "$.requirements.maxColors",
        "must be a positive integer",
      );
    }
    if (isInteger(value.requirements.minNeedle) && isInteger(value.requirements.maxNeedle) && value.requirements.minNeedle > value.requirements.maxNeedle) {
      issue(issues, "$.requirements", "minNeedle must not exceed maxNeedle");
    } else if (
      isInteger(value.requirements.minNeedle) &&
      isInteger(value.requirements.maxNeedle)
    ) {
      requirementBounds = {
        minNeedle: value.requirements.minNeedle,
        maxNeedle: value.requirements.maxNeedle,
      };
    }
  }

  const passIds = new Set<string>();
  const promptIds = new Set<string>();
  const rowNumbers = new Set<number>();
  if (!Array.isArray(value.rows) || value.rows.length === 0) {
    issue(issues, "$.rows", "must be a non-empty array");
  } else {
    value.rows.forEach((row, rowIndex) => {
      const path = `$.rows[${rowIndex}]`;
      if (!isObject(row)) {
        issue(issues, path, "must be an object");
        return;
      }
      if (!isInteger(row.rowNumber) || row.rowNumber < 1) {
        issue(issues, `${path}.rowNumber`, "must be a positive integer");
      } else if (rowNumbers.has(row.rowNumber)) {
        issue(issues, `${path}.rowNumber`, `duplicate row number '${row.rowNumber}'`);
      } else rowNumbers.add(row.rowNumber);
      for (const key of ["promptsBefore", "promptsAfter"] as const) {
        const prompts = row[key];
        if (!Array.isArray(prompts)) issue(issues, `${path}.${key}`, "must be an array");
        else prompts.forEach((prompt, index) => validatePrompt(prompt, `${path}.${key}[${index}]`, issues, promptIds, yarnIds));
      }
      if (!Array.isArray(row.passes) || row.passes.length === 0) {
        issue(issues, `${path}.passes`, "must be a non-empty array");
      } else row.passes.forEach((pass, index) => validatePass(pass, `${path}.passes[${index}]`, issues, passIds, yarnIds, requirementBounds));
    });
  }

  return issues.length === 0
    ? { ok: true, job: value as unknown as MachineJob }
    : { ok: false, issues };
}

export function parseMachineJob(json: string): ParseMachineJobResult {
  try {
    return validateMachineJob(JSON.parse(json));
  } catch (_error) {
    return { ok: false, issues: [{ path: "$", message: "is not valid JSON" }] };
  }
}
