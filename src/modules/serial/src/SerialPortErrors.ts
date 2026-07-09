/** Detect Web Serial "port is already open" InvalidStateError. */
export function isSerialPortAlreadyOpenError(err: unknown): boolean {
  if (err == null || typeof err !== "object") {
    return false;
  }
  const maybe = err as { name?: string; message?: string };
  if (maybe.name === "InvalidStateError") {
    return true;
  }
  return (
    typeof maybe.message === "string" &&
    maybe.message.toLowerCase().includes("already open")
  );
}
