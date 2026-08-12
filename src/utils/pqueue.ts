/** Minimal promise queue with a concurrency limit (p-queue replacement). */

type Task<T> = {
  promiseFunction: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export class PromiseQueue {
  private concurrency: number;
  private running = 0;
  private queue: Task<unknown>[] = [];

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  /** Enqueue a task; resolves with the task's value once it has run. */
  add<T>(promiseFunction: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        promiseFunction,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.next();
    });
  }

  next(): void {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { promiseFunction, resolve, reject } = this.queue.shift()!;

    promiseFunction()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        this.next();
      });
  }
}

// Self-check: bun src/utils/pqueue.ts
if (import.meta.main) {
  const q = new PromiseQueue(2);
  let active = 0;
  let peak = 0;
  const done: number[] = [];
  const tasks = Array.from({ length: 5 }, (_, i) =>
    q.add(async () => {
      active++;
      peak = Math.max(peak, active);
      await Bun.sleep(10);
      done.push(i);
      active--;
    }),
  );
  await Promise.all(tasks);
  console.assert(peak <= 2, `concurrency exceeded: peak=${peak}`);
  console.assert(done.sort().join(",") === "0,1,2,3,4", "not all tasks ran");
  console.log("PromiseQueue self-check passed");
}
