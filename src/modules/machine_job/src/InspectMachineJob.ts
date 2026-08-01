import { MachineCapabilities } from "./MachineCapabilities";
import {
  MachineJobValidationIssue,
  parseMachineJob,
} from "./ParseMachineJob";
import {
  MachineJobPreflightResult,
  preflightMachineJob,
} from "./PreflightMachineJob";
import { MachineJob } from "./MachineJobTypes";

export type InspectMachineJobResult =
  | {
      ok: false;
      stage: "structure";
      issues: MachineJobValidationIssue[];
    }
  | {
      ok: true;
      job: MachineJob;
      preflight: MachineJobPreflightResult;
    };

/**
 * Read-only import boundary. A successful inspection never starts or mutates a
 * knit session; callers decide how to present incompatible jobs.
 */
export function inspectMachineJob(
  json: string,
  machine: MachineCapabilities,
): InspectMachineJobResult {
  const parsed = parseMachineJob(json);
  if (!parsed.ok) {
    return { ok: false, stage: "structure", issues: parsed.issues };
  }
  return {
    ok: true,
    job: parsed.job,
    preflight: preflightMachineJob(parsed.job, machine),
  };
}
