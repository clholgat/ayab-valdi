export const AYAB_KNITOUT_COMPILER_VERSION = "1.0.0";
export const AYAB_SUPPORTED_KNITOUT_VERSION = 2;

export type KnitoutDiagnosticSeverity = "error" | "warning" | "info";

export interface KnitoutDiagnostic {
  severity: KnitoutDiagnosticSeverity;
  code: string;
  message: string;
  line?: number;
}

export interface KnitoutHeader {
  name: string;
  value: string;
  line: number;
}

export type KnitoutBed = "f" | "b" | "fs" | "bs";
export type KnitoutDirection = "+" | "-";

export interface KnitoutNeedle {
  bed: KnitoutBed;
  index: number;
  token: string;
}

export interface KnitoutOperationBase {
  opcode: string;
  line: number;
  raw: string;
  comment?: string;
  source?: string;
}

export interface KnitoutCarrierOperation extends KnitoutOperationBase {
  opcode: "in" | "inhook" | "releasehook" | "out" | "outhook";
  carriers: string[];
}

export interface KnitoutStitchOperation extends KnitoutOperationBase {
  opcode: "stitch";
  loopLength: number;
  tuckLength: number;
}

export interface KnitoutRackOperation extends KnitoutOperationBase {
  opcode: "rack";
  value: number;
}

export interface KnitoutNeedleOperation extends KnitoutOperationBase {
  opcode: "knit" | "tuck" | "miss";
  direction: KnitoutDirection;
  needle: KnitoutNeedle;
  carriers: string[];
}

export interface KnitoutSplitOperation extends KnitoutOperationBase {
  opcode: "split";
  direction: KnitoutDirection;
  needle: KnitoutNeedle;
  target: KnitoutNeedle;
  carriers: string[];
}

export interface KnitoutNeedleOnlyOperation extends KnitoutOperationBase {
  opcode: "drop" | "amiss";
  needle: KnitoutNeedle;
}

export interface KnitoutTransferOperation extends KnitoutOperationBase {
  opcode: "xfer";
  needle: KnitoutNeedle;
  target: KnitoutNeedle;
}

export interface KnitoutPauseOperation extends KnitoutOperationBase {
  opcode: "pause";
}

export interface KnitoutExtensionOperation extends KnitoutOperationBase {
  opcode: `x-${string}`;
  arguments: string[];
}

export type KnitoutOperation =
  | KnitoutCarrierOperation
  | KnitoutStitchOperation
  | KnitoutRackOperation
  | KnitoutNeedleOperation
  | KnitoutSplitOperation
  | KnitoutNeedleOnlyOperation
  | KnitoutTransferOperation
  | KnitoutPauseOperation
  | KnitoutExtensionOperation;

export interface KnitoutDocument {
  version: number;
  headers: KnitoutHeader[];
  operations: KnitoutOperation[];
  declaredCarriers: string[];
  sourceText: string;
}

export type ParseKnitoutResult =
  | {
      ok: true;
      document: KnitoutDocument;
      diagnostics: KnitoutDiagnostic[];
    }
  | {
      ok: false;
      diagnostics: KnitoutDiagnostic[];
    };

export interface KnitoutAnalysis {
  operationCount: number;
  candidatePasses: number;
  carriers: string[];
  usedBeds: KnitoutBed[];
  minNeedle?: number;
  maxNeedle?: number;
  opcodeCounts: Record<string, number>;
  diagnostics: KnitoutDiagnostic[];
}

export type KnitoutPlacement = "keep" | "left" | "center" | "right";
