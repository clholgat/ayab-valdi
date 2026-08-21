import {
  KnitoutAnalysis,
  KnitoutBed,
  KnitoutDiagnostic,
  KnitoutDocument,
  KnitoutNeedle,
  KnitoutOperation,
} from "./KnitoutTypes";

function operationNeedles(operation: KnitoutOperation): KnitoutNeedle[] {
  if (
    operation.opcode === "knit" ||
    operation.opcode === "tuck" ||
    operation.opcode === "miss" ||
    operation.opcode === "drop" ||
    operation.opcode === "amiss"
  ) {
    return [operation.needle];
  }
  if (operation.opcode === "split" || operation.opcode === "xfer") {
    return [operation.needle, operation.target];
  }
  return [];
}

function operationCarriers(operation: KnitoutOperation): string[] {
  if (
    operation.opcode === "in" ||
    operation.opcode === "inhook" ||
    operation.opcode === "releasehook" ||
    operation.opcode === "out" ||
    operation.opcode === "outhook" ||
    operation.opcode === "knit" ||
    operation.opcode === "tuck" ||
    operation.opcode === "miss" ||
    operation.opcode === "split"
  ) {
    return operation.carriers;
  }
  return [];
}

export function analyzeKnitout(
  document: KnitoutDocument,
  parserDiagnostics: KnitoutDiagnostic[] = [],
): KnitoutAnalysis {
  const diagnostics = parserDiagnostics.slice();
  const opcodeCounts: Record<string, number> = {};
  const carriers: string[] = [];
  const beds: KnitoutBed[] = [];
  const needleIndices: number[] = [];
  let candidatePasses = 0;
  let previousKnitDirection: string | undefined;
  let previousWasKnit = false;

  for (const operation of document.operations) {
    opcodeCounts[operation.opcode] = (opcodeCounts[operation.opcode] ?? 0) + 1;
    for (const carrier of operationCarriers(operation)) {
      if (!carriers.includes(carrier)) carriers.push(carrier);
      if (
        document.declaredCarriers.length > 0 &&
        !document.declaredCarriers.includes(carrier)
      ) {
        diagnostics.push({
          severity: "warning",
          code: "undeclaredCarrier",
          message: `Carrier '${carrier}' is used but not declared by ';;Carriers:'.`,
          line: operation.line,
        });
      }
    }
    for (const needle of operationNeedles(operation)) {
      needleIndices.push(needle.index);
      if (!beds.includes(needle.bed)) beds.push(needle.bed);
    }
    if (operation.opcode === "knit") {
      if (!previousWasKnit || previousKnitDirection !== operation.direction) {
        candidatePasses++;
      }
      previousWasKnit = true;
      previousKnitDirection = operation.direction;
    } else {
      previousWasKnit = false;
      previousKnitDirection = undefined;
    }
  }

  for (const header of document.headers) {
    if (header.name.toLowerCase().startsWith("x-")) {
      diagnostics.push({
        severity: "warning",
        code: "extensionHeader",
        message: `Extension header '${header.name}' requires AYAB compatibility review.`,
        line: header.line,
      });
    }
  }
  return {
    operationCount: document.operations.length,
    candidatePasses,
    carriers,
    usedBeds: beds,
    minNeedle: needleIndices.length > 0 ? Math.min(...needleIndices) : undefined,
    maxNeedle: needleIndices.length > 0 ? Math.max(...needleIndices) : undefined,
    opcodeCounts,
    diagnostics,
  };
}
