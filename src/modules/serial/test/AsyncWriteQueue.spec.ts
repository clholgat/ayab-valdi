import "jasmine/src/jasmine";
import { AsyncWriteQueue } from "serial/src/AsyncWriteQueue";

describe("AsyncWriteQueue", () => {
  it("runs a single enqueued operation and resolves", async () => {
    const queue = new AsyncWriteQueue();
    let ran = false;
    await queue.enqueue(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it("serializes operations enqueued back-to-back (no await between enqueues)", async () => {
    // Mirrors a WritableStream that only allows one active lock at a time:
    // if two operations ever overlap, acquire() throws.
    let locked = false;
    const order: string[] = [];

    function acquireExclusive(): () => void {
      if (locked) {
        throw new Error("Cannot create writer when WritableStream is locked");
      }
      locked = true;
      return () => {
        locked = false;
      };
    }

    async function op(label: string): Promise<void> {
      const release = acquireExclusive();
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(label);
      } finally {
        release();
      }
    }

    const queue = new AsyncWriteQueue();
    // Enqueue all five synchronously, exactly like cnf_final_line_API6()
    // immediately followed by reqInfo() with no await in between.
    const results = [
      queue.enqueue(() => op("A")),
      queue.enqueue(() => op("B")),
      queue.enqueue(() => op("C")),
      queue.enqueue(() => op("D")),
      queue.enqueue(() => op("E")),
    ];

    await Promise.all(results);

    expect(order).toEqual(["A", "B", "C", "D", "E"]);
    expect(locked).toBe(false);
  });

  it("continues processing later operations after an earlier one throws", async () => {
    const queue = new AsyncWriteQueue();
    const order: string[] = [];

    const first = queue.enqueue(async () => {
      order.push("first");
      throw new Error("simulated write failure");
    });
    const second = queue.enqueue(async () => {
      order.push("second");
    });

    try {
      await first;
      fail("expected first enqueue to reject");
    } catch (error) {
      expect((error as Error).message).toBe("simulated write failure");
    }
    await second;

    expect(order).toEqual(["first", "second"]);
  });

  it("each enqueue's returned promise reflects only that operation's outcome", async () => {
    const queue = new AsyncWriteQueue();

    const ok = queue.enqueue(async () => {});
    const fails = queue.enqueue(async () => {
      throw new Error("boom");
    });
    const okAgain = queue.enqueue(async () => {});

    await ok;

    try {
      await fails;
      fail("expected second enqueue to reject");
    } catch (error) {
      expect((error as Error).message).toBe("boom");
    }

    await okAgain;
  });
});
