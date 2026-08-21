import { OperatorPrompt } from "machine_job/src/MachineJobTypes";
import {
  AYAB_SUPPORTED_KNITOUT_VERSION,
  KnitoutDiagnostic,
  KnitoutDocument,
  KnitoutNeedleOperation,
} from "./KnitoutTypes";

export interface ScheduledKnitoutPass {
  startLine: number;
  endLine: number;
  direction: "+" | "-";
  operations: KnitoutNeedleOperation[];
  carriers: string[];
  leftNeedle: number;
  rightNeedle: number;
  promptsBefore: OperatorPrompt[];
  promptsAfter: OperatorPrompt[];
}

export interface ScheduleKnitoutResult {
  passes: ScheduledKnitoutPass[];
  diagnostics: KnitoutDiagnostic[];
}

function sourceRef(line: number): { row: string } {
  return { row: `line ${line}` };
}

function promptForCarrierOperation(
  opcode: "in" | "inhook" | "releasehook" | "out" | "outhook",
  carriers: string[],
  line: number,
): OperatorPrompt {
  const names = carriers.join(", ");
  let text: string;
  if (opcode === "in") {
    text = `Bring yarn carrier ${names} into action.`;
  } else if (opcode === "inhook") {
    text = `Place yarn carrier ${names} for manual yarn insertion.`;
  } else if (opcode === "releasehook") {
    text = `Release the inserted yarn for carrier ${names}.`;
  } else {
    text = `Remove yarn carrier ${names} from action.`;
  }
  return {
    id: `knitout-line-${line}-${opcode}`,
    kind: "yarnChange",
    severity: "warning",
    text,
    acknowledgementRequired: true,
    yarnId: carriers.length === 1 ? carriers[0] : undefined,
    sourceRef: sourceRef(line),
  };
}

function addError(
  diagnostics: KnitoutDiagnostic[],
  code: string,
  message: string,
  line?: number,
): void {
  diagnostics.push({ severity: "error", code, message, line });
}

function validatePass(
  operations: KnitoutNeedleOperation[],
  expectedDirection: "+" | "-" | undefined,
  diagnostics: KnitoutDiagnostic[],
): Omit<ScheduledKnitoutPass, "promptsBefore" | "promptsAfter"> {
  const first = operations[0]!;
  const carriers: string[] = [];
  const seenNeedles = new Set<number>();
  let previousNeedle: number | undefined;
  for (const operation of operations) {
    if (operation.needle.bed !== "f") {
      addError(
        diagnostics,
        "unsupportedBed",
        `AYAB's executable Knitout profile supports only front-bed needles; found '${operation.needle.token}'.`,
        operation.line,
      );
    }
    if (operation.carriers.length !== 1) {
      addError(
        diagnostics,
        "carrierSetPerNeedle",
        `Each executable knit operation must use exactly one carrier; found ${operation.carriers.length}.`,
        operation.line,
      );
    } else if (!carriers.includes(operation.carriers[0]!)) {
      carriers.push(operation.carriers[0]!);
    }
    if (seenNeedles.has(operation.needle.index)) {
      addError(
        diagnostics,
        "duplicateNeedle",
        `Needle ${operation.needle.token} is knitted more than once in the same pass.`,
        operation.line,
      );
    }
    seenNeedles.add(operation.needle.index);
    if (previousNeedle !== undefined) {
      const monotonic = operation.direction === "+"
        ? operation.needle.index > previousNeedle
        : operation.needle.index < previousNeedle;
      if (!monotonic) {
        addError(
          diagnostics,
          "nonMonotonicPass",
          `Needles in a '${operation.direction}' pass must be strictly monotonic.`,
          operation.line,
        );
      }
    }
    previousNeedle = operation.needle.index;
  }
  if (carriers.length > 2) {
    addError(
      diagnostics,
      "tooManyCarriers",
      `AYAB supports at most two yarn choices in one compiled pass; found ${carriers.length}.`,
      first.line,
    );
  }
  const indices = operations.map((operation) => operation.needle.index);
  const leftNeedle = Math.min(...indices);
  const rightNeedle = Math.max(...indices);
  if (seenNeedles.size !== rightNeedle - leftNeedle + 1) {
    addError(
      diagnostics,
      "nonContiguousPass",
      `Executable passes must knit every needle from ${leftNeedle} through ${rightNeedle}; internal misses are not representable safely.`,
      first.line,
    );
  }
  if (expectedDirection !== undefined && first.direction !== expectedDirection) {
    addError(
      diagnostics,
      "nonAlternatingDirection",
      `Physical carriage passes must alternate; expected '${expectedDirection}' but found '${first.direction}'.`,
      first.line,
    );
  }
  return {
    startLine: first.line,
    endLine: operations[operations.length - 1]!.line,
    direction: first.direction,
    operations,
    carriers,
    leftNeedle,
    rightNeedle,
  };
}

export function scheduleKnitoutPasses(
  document: KnitoutDocument,
): ScheduleKnitoutResult {
  const diagnostics: KnitoutDiagnostic[] = [];
  const passes: ScheduledKnitoutPass[] = [];
  const pendingPrompts: OperatorPrompt[] = [];
  const lifecycleCarrierReferences: Array<{ carrier: string; line: number }> = [];
  let current: KnitoutNeedleOperation[] = [];
  let expectedDirection: "+" | "-" | undefined;

  const flush = (): void => {
    if (current.length === 0) return;
    const validated = validatePass(current, expectedDirection, diagnostics);
    passes.push({
      ...validated,
      promptsBefore: pendingPrompts.splice(0),
      promptsAfter: [],
    });
    expectedDirection = validated.direction === "+" ? "-" : "+";
    current = [];
  };

  if (document.version !== AYAB_SUPPORTED_KNITOUT_VERSION) {
    addError(
      diagnostics,
      "unsupportedExecutionVersion",
      `Hardware execution supports Knitout ${AYAB_SUPPORTED_KNITOUT_VERSION}, not version ${document.version}.`,
      1,
    );
  }
  if (document.declaredCarriers.length === 0) {
    addError(
      diagnostics,
      "missingCarriersHeader",
      "Hardware execution requires a ';;Carriers:' header.",
    );
  }
  for (const header of document.headers) {
    if (header.name.toLowerCase().startsWith("x-")) {
      addError(
        diagnostics,
        "unsupportedExtensionHeader",
        `Extension header '${header.name}' is not supported for AYAB execution.`,
        header.line,
      );
    }
  }

  for (const operation of document.operations) {
    if (operation.opcode === "knit") {
      if (current.length > 0 && current[0]!.direction !== operation.direction) flush();
      current.push(operation);
      continue;
    }
    flush();
    if (
      operation.opcode === "in" ||
      operation.opcode === "inhook" ||
      operation.opcode === "releasehook" ||
      operation.opcode === "out" ||
      operation.opcode === "outhook"
    ) {
      lifecycleCarrierReferences.push(
        ...operation.carriers.map((carrier) => ({ carrier, line: operation.line })),
      );
      pendingPrompts.push(
        promptForCarrierOperation(operation.opcode, operation.carriers, operation.line),
      );
      continue;
    }
    if (operation.opcode === "pause") {
      pendingPrompts.push({
        id: `knitout-line-${operation.line}-pause`,
        kind: "confirm",
        severity: "info",
        text: operation.comment || "Knitout requested an operator pause.",
        acknowledgementRequired: true,
        sourceRef: sourceRef(operation.line),
      });
      continue;
    }
    const extension = operation.opcode.startsWith("x-");
    addError(
      diagnostics,
      extension ? "unsupportedExtensionOpcode" : "unsupportedOpcode",
      `Operation '${operation.opcode}' is parsed but not supported by AYAB's executable Knitout profile.`,
      operation.line,
    );
  }
  flush();

  if (pendingPrompts.length > 0) {
    if (passes.length === 0) {
      addError(
        diagnostics,
        "noExecutablePasses",
        "Knitout contains prompts but no executable knit passes.",
      );
    } else {
      passes[passes.length - 1]!.promptsAfter.push(...pendingPrompts);
    }
  }
  if (passes.length === 0 && !diagnostics.some((diagnostic) => diagnostic.code === "noExecutablePasses")) {
    addError(diagnostics, "noExecutablePasses", "Knitout contains no executable knit passes.");
  }

  const passOperations = passes.flatMap((pass) => pass.operations);
  const usedCarriers = Array.from(new Set(passes.flatMap((pass) => pass.carriers)));
  const allCarrierReferences = passOperations
    .flatMap((operation) => operation.carriers.map((carrier) => ({
      carrier,
      line: operation.line,
    })))
    .concat(lifecycleCarrierReferences);
  for (const carrier of Array.from(new Set(allCarrierReferences.map((entry) => entry.carrier)))) {
    if (!document.declaredCarriers.includes(carrier)) {
      const reference = allCarrierReferences.find((entry) => entry.carrier === carrier);
      addError(
        diagnostics,
        "undeclaredCarrier",
        `Carrier '${carrier}' is used but not declared by ';;Carriers:'.`,
        reference?.line,
      );
    }
  }
  for (const carrier of Array.from(new Set(lifecycleCarrierReferences.map((entry) => entry.carrier)))) {
    if (!usedCarriers.includes(carrier)) {
      const reference = lifecycleCarrierReferences.find((entry) => entry.carrier === carrier)!;
      addError(
        diagnostics,
        "unusedLifecycleCarrier",
        `Carrier '${carrier}' has a lifecycle operation but is not used by an executable knit pass.`,
        reference.line,
      );
    }
  }
  return { passes, diagnostics };
}
