/**
 * Serializes async operations so only one is ever in flight at a time.
 * Used to prevent overlapping calls to WritableStream.getWriter() - the Web
 * Serial API only allows one active writer lock, so two writes issued back
 * to back (no await between them) throw "Cannot create writer when
 * WritableStream is locked" unless queued like this.
 *
 * Kept in sync with serial/web/AsyncWriteQueue.ts (web/ can't import from
 * src/ - see AGENTS.md - so the runtime copy lives there; this copy is what
 * gets unit tested).
 */
export class AsyncWriteQueue {
  private tail: Promise<void> = Promise.resolve();

  /** Runs `fn` only after every previously queued operation has settled. */
  enqueue(fn: () => Promise<void>): Promise<void> {
    const run = this.tail.then(fn, fn);
    // Never let a failed operation poison the chain for subsequent enqueues.
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
