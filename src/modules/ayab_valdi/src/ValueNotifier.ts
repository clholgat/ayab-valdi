/** Lightweight pub/sub for scoping high-frequency UI updates below App. */

export class ValueNotifier<T> {
  private value: T;
  private listeners = new Set<(value: T) => void>();

  constructor(initial: T) {
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    this.emit();
  }

  update(updater: (previous: T) => T): void {
    this.set(updater(this.value));
  }

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    listener(this.value);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.value);
    }
  }
}
