import { PassDirection } from "./MachineJobTypes";

export type SelectionEncoding = "indices" | "bitmap";

/**
 * Portable facts about a selected machine configuration.
 *
 * This deliberately excludes connection state, ports, and device IDs so the
 * same profile can be used for import preflight before hardware is connected.
 */
export interface MachineCapabilities {
  profileId: string;
  displayName: string;
  minNeedle: number;
  maxNeedle: number;
  maxColorsPerPass: number;
  selectionEncodings: SelectionEncoding[];
  directions: Exclude<PassDirection, "either">[];
  techniques: string[];
  carriageRoles: string[];
  accessories: string[];
}
