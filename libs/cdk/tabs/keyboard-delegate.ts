// TabsKeyboardDelegate: wrapping next / previous over enabled tabs; Left / Right follow the text
// direction in both orientations, Up / Down only for vertical tab lists. Ported from react-spectrum
// (Apache-2.0, © Adobe): packages/react-aria/src/tabs/TabsKeyboardDelegate.ts.
import type { Collection, Direction, Key, KeyboardDelegate, Node, Orientation } from "../_adapters/collection.ts";
import { hasKey } from "../_adapters/grid-selection.ts";

export class TabsKeyboardDelegate<T> implements KeyboardDelegate {
  private collection: Collection<Node<T>>;
  private flipDirection: boolean;
  private disabledKeys: Set<Key>;
  private tabDirection: boolean;

  constructor(collection: Collection<Node<T>>, direction: Direction, orientation: Orientation, disabledKeys: Set<Key> = new Set()) {
    this.collection = collection;
    // getKeyLeftOf / getKeyRightOf follow the text direction regardless of orientation, so
    // ArrowLeft always moves to the next tab in RTL. getKeyAbove / getKeyBelow are never flipped.
    this.flipDirection = direction === "rtl";
    this.disabledKeys = disabledKeys;
    this.tabDirection = orientation === "horizontal";
  }

  getKeyLeftOf(key: Key): Key | null {
    return this.flipDirection ? this.getNextKey(key) : this.getPreviousKey(key);
  }

  getKeyRightOf(key: Key): Key | null {
    return this.flipDirection ? this.getPreviousKey(key) : this.getNextKey(key);
  }

  private isDisabled(key: Key): boolean {
    return hasKey(this.disabledKeys, key) || !!this.collection.getItem(key)?.props?.isDisabled;
  }

  getFirstKey(): Key | null {
    let key = this.collection.getFirstKey();
    if (key != null && this.isDisabled(key)) key = this.getNextKey(key);
    return key;
  }

  getLastKey(): Key | null {
    let key = this.collection.getLastKey();
    if (key != null && this.isDisabled(key)) key = this.getPreviousKey(key);
    return key;
  }

  getKeyAbove(key: Key): Key | null {
    if (this.tabDirection) return null;
    return this.getPreviousKey(key);
  }

  getKeyBelow(key: Key): Key | null {
    if (this.tabDirection) return null;
    return this.getNextKey(key);
  }

  getNextKey(startKey: Key): Key | null {
    let key: Key | null = startKey;
    do {
      key = this.collection.getKeyAfter(key);
      if (key == null) key = this.collection.getFirstKey();
    } while (key != null && this.isDisabled(key) && key !== startKey);
    return key;
  }

  getPreviousKey(startKey: Key): Key | null {
    let key: Key | null = startKey;
    do {
      key = this.collection.getKeyBefore(key);
      if (key == null) key = this.collection.getLastKey();
    } while (key != null && this.isDisabled(key) && key !== startKey);
    return key;
  }
}
