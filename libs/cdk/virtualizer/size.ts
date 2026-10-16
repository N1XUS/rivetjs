// Ported from React Spectrum (react-stately/src/virtualizer/Size.ts), Apache-2.0, © Adobe.

export class Size {
  width: number;
  height: number;

  constructor(width = 0, height = 0) {
    this.width = Math.max(width, 0);
    this.height = Math.max(height, 0);
  }

  /** Returns a copy of this size. */
  copy(): Size {
    return new Size(this.width, this.height);
  }

  /** Returns whether this size is equal to another one. */
  equals(other: Size): boolean {
    return this.width === other.width && this.height === other.height;
  }

  /** The total area of the Size. */
  get area(): number {
    return this.width * this.height;
  }
}
