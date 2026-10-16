/** Globals the browser tests install through init scripts. */
declare global {
  interface Window {
    /** performance.now() at the first idle callback after navigation. */
    __firstIdle?: number;
  }
}

export {};
