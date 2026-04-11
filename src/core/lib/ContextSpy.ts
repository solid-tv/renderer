/**
 * Class that keeps track of the invocations of Context methods when
 * the `enableContextSpy` renderer option is enabled.
 */
export class ContextSpy {
  private data: Record<string, number> = {};

  reset() {
    this.data = {};
  }

  increment(name: string) {
    if (!this.data[name]) {
      this.data[name] = 0;
    }
    this.data[name]++;
  }

  getData() {
    return { ...this.data };
  }
}
