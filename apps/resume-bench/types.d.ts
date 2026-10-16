/** Page globals: the fixture's analytics log, check/run markers, and run.ts's in-page probe. */
declare global {
  interface FirstInputSync {
    at: number;
    end?: number;
    mutated?: boolean;
    marks?: string[];
    rows?: boolean;
  }

  interface BenchProbe {
    /** [startTime, duration] per long task. */
    tasks: [number, number][];
    /** [startTime, duration, blockingDuration] per long animation frame. */
    loafs: [number, number, number][];
    /** [name, startTime, duration, interactionId] per slow event. */
    events: [string, number, number, number][];
    frames: number[];
    marks: Record<string, number>;
    sync: Record<string, FirstInputSync>;
    frameLoop: () => void;
    until: (name: string, predicate: () => boolean) => Promise<number>;
    pending?: Promise<number>;
  }

  var __bench: BenchProbe;
  var __analytics: [string, string][] | undefined;
  var __noReload: boolean | undefined;
  var __marker: number | undefined;
}

export {};
