import { Status, Carriage, Direction } from "state_machine/src/Status";

export function formatRowDetail(
  status: Status,
  direction: Direction = status.carriageDirection,
): string {
  const parts: string[] = [];
  if (status.passesPerRow > 1) {
    const pass = (status.lineNumber % status.passesPerRow) + 1;
    parts.push(`Pass ${pass}/${status.passesPerRow}`);
  }
  if (status.colorSymbol) parts.push(`Color ${status.colorSymbol}`);
  const c = Carriage.symbol(status.carriageType);
  const d = Direction.symbol(direction);
  if (c) parts.push(c);
  if (d) parts.push(d);
  return parts.join(" ");
}

/** Completed row was knit on the pass before the current carriage direction. */
export function formatCompletedRowDetail(status: Status): string {
  return formatRowDetail(status, Direction.reverse(status.carriageDirection));
}
