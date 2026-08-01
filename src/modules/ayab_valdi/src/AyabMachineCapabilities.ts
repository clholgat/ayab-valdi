import { Mode } from "constants/src/StateMachineConstants";
import { MachineCapabilities } from "machine_job/src/MachineCapabilities";
import { Machine } from "state_machine/src/Machine";

export interface AyabMachineConfiguration {
  machine: Machine;
  mode: Mode;
  numColors: number;
}

function modeProfileId(mode: Mode): string {
  switch (mode) {
    case Mode.SINGLEBED:
      return "singlebed";
    case Mode.CLASSIC_RIBBER:
      return "classic-ribber";
    case Mode.MIDDLECOLORSTWICE_RIBBER:
      return "middle-colors-twice-ribber";
    case Mode.HEARTOFPLUTO_RIBBER:
      return "heart-of-pluto-ribber";
    case Mode.CIRCULAR_RIBBER:
      return "circular-ribber";
  }
}

function techniquesForMode(mode: Mode): string[] {
  switch (mode) {
    case Mode.SINGLEBED:
      return ["stockinette", "fairIsle"];
    case Mode.CLASSIC_RIBBER:
      return ["classicRibber"];
    case Mode.MIDDLECOLORSTWICE_RIBBER:
      return ["middleColorsTwiceRibber"];
    case Mode.HEARTOFPLUTO_RIBBER:
      return ["heartOfPlutoRibber"];
    case Mode.CIRCULAR_RIBBER:
      return ["circularRibber"];
  }
}

/** Maps selected, reusable AYAB settings to connection-independent facts. */
export function ayabMachineCapabilities(
  configuration: AyabMachineConfiguration,
): MachineCapabilities {
  const width = Machine.width(configuration.machine);
  const usesRibber = configuration.mode !== Mode.SINGLEBED;
  return {
    profileId:
      `ayab-${configuration.machine}-${modeProfileId(configuration.mode)}` +
      `-${configuration.numColors}c`,
    displayName: `${Machine.getLabel(configuration.machine)} (${Mode.getLabel(configuration.mode)})`,
    minNeedle: 0,
    maxNeedle: width - 1,
    maxColorsPerPass: configuration.numColors,
    selectionEncodings: ["bitmap", "indices"],
    directions: ["leftToRight", "rightToLeft"],
    techniques: techniquesForMode(configuration.mode),
    carriageRoles: usesRibber ? ["knit", "ribber"] : ["knit"],
    accessories: usesRibber ? ["ribber"] : [],
  };
}
