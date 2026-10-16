// Ported from React Spectrum (react-stately/src/virtualizer/Rect.ts), Apache-2.0, © Adobe.
// Rivet: `intersects` has no jsdom test-environment shortcut (Rivet tests run real layout math).
import { Point } from "./point.ts";
import type { Size } from "./size.ts";

export type RectCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

/** Represents a rectangle. */
export class Rect {
  /** The x-coordinate of the rectangle. */
  x: number;
  /** The y-coordinate of the rectangle. */
  y: number;
  /** The width of the rectangle. */
  width: number;
  /** The height of the rectangle. */
  height: number;

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /** The maximum x-coordinate in the rectangle. */
  get maxX(): number {
    return this.x + this.width;
  }

  /** The maximum y-coordinate in the rectangle. */
  get maxY(): number {
    return this.y + this.height;
  }

  /** The area of the rectangle. */
  get area(): number {
    return this.width * this.height;
  }

  /** The top left corner of the rectangle. */
  get topLeft(): Point {
    return new Point(this.x, this.y);
  }

  /** The top right corner of the rectangle. */
  get topRight(): Point {
    return new Point(this.maxX, this.y);
  }

  /** The bottom left corner of the rectangle. */
  get bottomLeft(): Point {
    return new Point(this.x, this.maxY);
  }

  /** The bottom right corner of the rectangle. */
  get bottomRight(): Point {
    return new Point(this.maxX, this.maxY);
  }

  /** Returns whether this rectangle intersects another rectangle (both need a non-zero area). */
  intersects(rect: Rect): boolean {
    return (
      this.area > 0 &&
      rect.area > 0 &&
      this.x <= rect.x + rect.width &&
      rect.x <= this.x + this.width &&
      this.y <= rect.y + rect.height &&
      rect.y <= this.y + this.height
    );
  }

  /** Returns whether this rectangle fully contains another rectangle. */
  containsRect(rect: Rect): boolean {
    return this.x <= rect.x && this.y <= rect.y && this.maxX >= rect.maxX && this.maxY >= rect.maxY;
  }

  /** Returns whether the rectangle contains the given point. */
  containsPoint(point: Point): boolean {
    return this.x <= point.x && this.y <= point.y && this.maxX >= point.x && this.maxY >= point.y;
  }

  /**
   * Returns the first corner of this rectangle (from top to bottom, left to right)
   * that is contained in the given rectangle, or null of the rectangles do not intersect.
   */
  getCornerInRect(rect: Rect): RectCorner | null {
    for (const key of ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const) {
      if (rect.containsPoint(this[key])) return key;
    }
    return null;
  }

  equals(rect: Rect): boolean {
    return rect.x === this.x && rect.y === this.y && rect.width === this.width && rect.height === this.height;
  }

  pointEquals(point: Point | Rect): boolean {
    return this.x === point.x && this.y === point.y;
  }

  sizeEquals(size: Size | Rect): boolean {
    return this.width === size.width && this.height === size.height;
  }

  /** Returns the union of this Rect and another. */
  union(other: Rect): Rect {
    const x = Math.min(this.x, other.x);
    const y = Math.min(this.y, other.y);
    const width = Math.max(this.maxX, other.maxX) - x;
    const height = Math.max(this.maxY, other.maxY) - y;
    return new Rect(x, y, width, height);
  }

  /** Returns the intersection of this Rect with another; an all zero Rect if they do not intersect. */
  intersection(other: Rect): Rect {
    if (!this.intersects(other)) return new Rect(0, 0, 0, 0);
    const x = Math.max(this.x, other.x);
    const y = Math.max(this.y, other.y);
    return new Rect(x, y, Math.min(this.maxX, other.maxX) - x, Math.min(this.maxY, other.maxY) - y);
  }

  /** Returns a copy of this rectangle. */
  copy(): Rect {
    return new Rect(this.x, this.y, this.width, this.height);
  }
}
