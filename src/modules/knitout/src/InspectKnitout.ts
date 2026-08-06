import { MachineCapabilities } from "machine_job/src/MachineCapabilities";
import { preflightMachineJob } from "machine_job/src/PreflightMachineJob";
import { analyzeKnitout } from "./AnalyzeKnitout";
import {
  KnitoutCompileOptions,
  KnitoutCompileResult,
  knitoutToMachineJob,
} from "./KnitoutToMachineJob";
import { parseKnitout } from "./ParseKnitout";
import {
  KnitoutAnalysis,
  KnitoutDiagnostic,
  KnitoutDocument,
  KnitoutPlacement,
} from "./KnitoutTypes";

export interface InspectKnitoutOptions {
  machine: MachineCapabilities;
  fileName?: string;
  placement?: KnitoutPlacement;
  carrierOrder?: string[];
}

export type InspectKnitoutResult =
  | {
      ok: false;
      stage: "parse";
      diagnostics: KnitoutDiagnostic[];
    }
  | {
      ok: true;
      document: KnitoutDocument;
      analysis: KnitoutAnalysis;
      compilation: KnitoutCompileResult;
    };

export function inspectKnitout(
  text: string,
  options: InspectKnitoutOptions,
): InspectKnitoutResult {
  const parsed = parseKnitout(text);
  if (!parsed.ok) return { ok: false, stage: "parse", diagnostics: parsed.diagnostics };
  const analysis = analyzeKnitout(parsed.document, parsed.diagnostics);
  const compileOptions: KnitoutCompileOptions = {
    machine: options.machine,
    fileName: options.fileName,
    placement: options.placement,
    carrierOrder: options.carrierOrder,
  };
  const compilation = knitoutToMachineJob(parsed.document, compileOptions);
  // Parsing can succeed with actionable warnings (for example CRLF input or
  // a byte-order mark). Keep those visible beside scheduler/compiler output.
  compilation.diagnostics.unshift(...parsed.diagnostics);
  if (compilation.ok) {
    const preflight = preflightMachineJob(compilation.job, options.machine);
    if (!preflight.compatible) {
      compilation.diagnostics.push(
        ...preflight.issues.map((issue): KnitoutDiagnostic => ({
          severity: "error",
          code: `machine.${issue.code}`,
          message: issue.message,
          line: issue.rowNumber,
        })),
      );
      return {
        ok: true,
        document: parsed.document,
        analysis,
        compilation: {
          ok: false,
          analysis: compilation.analysis,
          diagnostics: compilation.diagnostics,
        },
      };
    }
  }
  return { ok: true, document: parsed.document, analysis, compilation };
}
