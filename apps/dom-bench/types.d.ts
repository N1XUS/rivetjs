/** Page globals installed by the benchmark adapters and the in-page identity probe. */
interface DomBench {
  mount(rows: number): void;
  update(indices: number[], revision: number): void;
  dispose(): void;
}

declare global {
  interface Window {
    bench: DomBench;
    __identity?: { i: number; element: Element; text: ChildNode | undefined }[];
  }
}

export {};
