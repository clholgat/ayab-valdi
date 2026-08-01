export const MACHINE_JOB_FORMAT_VERSION = "1.0";

export type PassDirection = "leftToRight" | "rightToLeft" | "either";

export type PromptKind =
  | "info"
  | "confirm"
  | "yarnChange"
  | "shape"
  | "carriageChange"
  | "manualAction";

export type PromptSeverity = "info" | "warning" | "critical";

export interface SourceReference {
  documentId?: string;
  section?: string;
  row?: string;
}

export interface MachineJobSource {
  producer: string;
  producerVersion?: string;
  sourceId?: string;
}

export interface MachineRequirements {
  minNeedle: number;
  maxNeedle: number;
  maxColors?: number;
  techniques?: string[];
  carriageRoles?: string[];
  accessories?: string[];
}

export interface MachineJobYarn {
  id: string;
  name?: string;
  color?: string;
}

export interface OperatorPrompt {
  id: string;
  kind: PromptKind;
  severity: PromptSeverity;
  text: string;
  acknowledgementRequired: boolean;
  yarnId?: string;
  carriage?: string;
  needle?: number;
  sourceRef?: SourceReference;
}

export interface ActiveNeedles {
  left: number;
  right: number;
}

export type NeedleSelection =
  | { encoding: "indices"; indices: number[] }
  | { encoding: "bitmap"; offset: number; bits: string };

export interface MachinePass {
  passId: string;
  direction: PassDirection;
  activeNeedles: ActiveNeedles;
  selection: NeedleSelection;
  yarnIds: string[];
  technique: string;
  carriage?: string;
  sourceRef?: SourceReference;
}

export interface LogicalRow {
  rowNumber: number;
  sourceRef?: SourceReference;
  promptsBefore: OperatorPrompt[];
  passes: MachinePass[];
  promptsAfter: OperatorPrompt[];
}

export interface MachineJobIntegrity {
  algorithm: "sha256";
  digest: string;
}

export interface MachineJob {
  formatVersion: typeof MACHINE_JOB_FORMAT_VERSION;
  jobId: string;
  title: string;
  /** Zero-based AYAB bed index; 0 is the leftmost selectable needle. */
  coordinateSystem: "zeroBasedNeedleIndex";
  source?: MachineJobSource;
  requirements: MachineRequirements;
  yarns: MachineJobYarn[];
  rows: LogicalRow[];
  integrity?: MachineJobIntegrity;
}
