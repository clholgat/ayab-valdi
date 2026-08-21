import { MachineCapabilities } from "machine_job/src/MachineCapabilities";
import { machineJobTextChecksum } from "machine_job/src/MachineJobChecksum";
import {
  MachineJob,
  MachineJobYarn,
  MachinePass,
} from "machine_job/src/MachineJobTypes";
import { analyzeKnitout } from "./AnalyzeKnitout";
import { scheduleKnitoutPasses } from "./ScheduleKnitoutPasses";
import {
  AYAB_KNITOUT_COMPILER_VERSION,
  KnitoutAnalysis,
  KnitoutDiagnostic,
  KnitoutDocument,
  KnitoutPlacement,
} from "./KnitoutTypes";

export interface KnitoutCompileOptions {
  machine: MachineCapabilities;
  fileName?: string;
  title?: string;
  placement?: KnitoutPlacement;
  carrierOrder?: string[];
}

export type KnitoutCompileResult =
  | {
      ok: true;
      job: MachineJob;
      canonicalText: string;
      sourceChecksum: string;
      placement: KnitoutPlacement;
      analysis: KnitoutAnalysis;
      diagnostics: KnitoutDiagnostic[];
    }
  | {
      ok: false;
      analysis: KnitoutAnalysis;
      diagnostics: KnitoutDiagnostic[];
    };

function headerValue(document: KnitoutDocument, name: string): string | undefined {
  return document.headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value;
}

export function requestedKnitoutPlacement(document: KnitoutDocument): KnitoutPlacement {
  const value = headerValue(document, "Position")?.trim().toLowerCase();
  if (value === "left" || value === "center" || value === "right" || value === "keep") {
    return value;
  }
  return "center";
}

function titleFromFileName(fileName: string | undefined): string {
  if (!fileName) return "Imported Knitout job";
  return fileName.replace(/\.(k|knitout)$/i, "") || "Imported Knitout job";
}

function yarnForCarrier(document: KnitoutDocument, carrier: string): MachineJobYarn {
  const value = headerValue(document, `Yarn-${carrier}`)?.trim();
  if (!value) return { id: carrier, name: `Carrier ${carrier}` };
  const colorMatch = /(?:^|\s)(#[0-9a-fA-F]{6})(?:\s|$)/.exec(value);
  return {
    id: carrier,
    name: value,
    color: colorMatch?.[1],
  };
}

function calculateOffset(
  sourceLeft: number,
  sourceRight: number,
  placement: KnitoutPlacement,
  machine: MachineCapabilities,
  diagnostics: KnitoutDiagnostic[],
): number {
  const width = sourceRight - sourceLeft + 1;
  const machineWidth = machine.maxNeedle - machine.minNeedle + 1;
  if (width > machineWidth) {
    diagnostics.push({
      severity: "error",
      code: "patternTooWide",
      message: `Knitout requires ${width} needles; ${machine.displayName} provides ${machineWidth}.`,
    });
    return 0;
  }
  if (placement === "keep") {
    if (sourceLeft < machine.minNeedle || sourceRight > machine.maxNeedle) {
      diagnostics.push({
        severity: "error",
        code: "keepPlacementOutOfBounds",
        message: `Kept needle range ${sourceLeft}..${sourceRight} is outside ${machine.minNeedle}..${machine.maxNeedle}.`,
      });
    }
    return 0;
  }
  if (placement === "left") return machine.minNeedle - sourceLeft;
  if (placement === "right") return machine.maxNeedle - sourceRight;
  return machine.minNeedle + Math.floor((machineWidth - width) / 2) - sourceLeft;
}

function canonicalCarrierOrder(
  document: KnitoutDocument,
  usedCarriers: string[],
  requested: string[] | undefined,
  diagnostics: KnitoutDiagnostic[],
): string[] {
  const defaults = document.declaredCarriers.filter((carrier) => usedCarriers.includes(carrier));
  for (const carrier of usedCarriers) {
    if (!defaults.includes(carrier)) defaults.push(carrier);
  }
  if (!requested) return defaults;
  const unique = Array.from(new Set(requested));
  const missing = usedCarriers.filter((carrier) => !unique.includes(carrier));
  const unknown = unique.filter((carrier) => !usedCarriers.includes(carrier));
  if (missing.length > 0 || unknown.length > 0) {
    diagnostics.push({
      severity: "error",
      code: "invalidCarrierOrder",
      message: "Carrier order must contain every used carrier exactly once and no unused carriers.",
    });
    return defaults;
  }
  return unique;
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export function canonicalMachineJobText(job: MachineJob): string {
  return JSON.stringify(job);
}

export function knitoutToMachineJob(
  document: KnitoutDocument,
  options: KnitoutCompileOptions,
): KnitoutCompileResult {
  const analysis = analyzeKnitout(document);
  const scheduled = scheduleKnitoutPasses(document);
  const diagnostics = [...analysis.diagnostics, ...scheduled.diagnostics];
  const sourceNeedles = scheduled.passes.flatMap((pass) => [pass.leftNeedle, pass.rightNeedle]);
  if (sourceNeedles.length === 0) return { ok: false, analysis, diagnostics };

  const sourceLeft = Math.min(...sourceNeedles);
  const sourceRight = Math.max(...sourceNeedles);
  const placement = options.placement ?? requestedKnitoutPlacement(document);
  const offset = calculateOffset(sourceLeft, sourceRight, placement, options.machine, diagnostics);
  const usedCarriers = uniqueValues(scheduled.passes.flatMap((pass) => pass.carriers));
  const carrierOrder = canonicalCarrierOrder(
    document,
    usedCarriers,
    options.carrierOrder,
    diagnostics,
  );
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, analysis, diagnostics };
  }

  const rows = scheduled.passes.map((pass, index) => {
    const orderedPassCarriers = carrierOrder.filter((carrier) => pass.carriers.includes(carrier));
    const firstCarrier = orderedPassCarriers[0]!;
    const byNeedle = new Map<number, string>();
    for (const operation of pass.operations) {
      byNeedle.set(operation.needle.index, operation.carriers[0]!);
    }
    let bits = "";
    for (let needle = pass.leftNeedle; needle <= pass.rightNeedle; needle++) {
      bits += byNeedle.get(needle) === firstCarrier ? "1" : "0";
    }
    const translatedLeft = pass.leftNeedle + offset;
    const translatedRight = pass.rightNeedle + offset;
    const machinePass: MachinePass = {
      passId: `knitout-lines-${pass.startLine}-${pass.endLine}`,
      direction: pass.direction === "+" ? "leftToRight" : "rightToLeft",
      activeNeedles: { left: translatedLeft, right: translatedRight },
      selection: { encoding: "bitmap", offset: translatedLeft, bits },
      yarnIds: orderedPassCarriers,
      technique: orderedPassCarriers.length === 1 ? "stockinette" : "fairIsle",
      carriage: "knit",
      sourceRef: {
        documentId: options.fileName,
        section: pass.startLine === pass.endLine
          ? `line ${pass.startLine}`
          : `lines ${pass.startLine}-${pass.endLine}`,
      },
    };
    return {
      rowNumber: index + 1,
      sourceRef: machinePass.sourceRef,
      promptsBefore: pass.promptsBefore,
      passes: [machinePass],
      promptsAfter: pass.promptsAfter,
    };
  });
  const minNeedle = Math.min(...rows.map((row) => row.passes[0]!.activeNeedles.left));
  const maxNeedle = Math.max(...rows.map((row) => row.passes[0]!.activeNeedles.right));
  const techniques = uniqueValues(rows.map((row) => row.passes[0]!.technique));
  const sourceChecksum = machineJobTextChecksum(document.sourceText);
  const identitySeed = [
    AYAB_KNITOUT_COMPILER_VERSION,
    sourceChecksum,
    options.machine.profileId,
    placement,
    carrierOrder.join(","),
  ].join("|");
  const jobDigest = machineJobTextChecksum(identitySeed);
  const job: MachineJob = {
    formatVersion: "1.0",
    jobId: `knitout-${jobDigest.slice(0, 20)}`,
    title: options.title ?? titleFromFileName(options.fileName),
    coordinateSystem: "zeroBasedNeedleIndex",
    source: {
      producer: "AYAB Knitout compiler",
      producerVersion: AYAB_KNITOUT_COMPILER_VERSION,
      sourceId: `sha256:${sourceChecksum}`,
    },
    requirements: {
      minNeedle,
      maxNeedle,
      maxColors: Math.max(...rows.map((row) => row.passes[0]!.yarnIds.length)),
      techniques,
      carriageRoles: ["knit"],
    },
    yarns: carrierOrder.map((carrier) => yarnForCarrier(document, carrier)),
    rows,
  };
  const canonicalText = canonicalMachineJobText(job);
  return {
    ok: true,
    job,
    canonicalText,
    sourceChecksum,
    placement,
    analysis,
    diagnostics,
  };
}
