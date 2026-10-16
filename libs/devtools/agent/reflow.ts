// Forced-reflow detection (dev only, off by default, enabled from the Performance tab): a prototype
// patch marks layout dirty on DOM writes and reports a layout read that follows one in the same task.
// Generic over the patched objects so tests drive it with fakes; `domSpecs` lists the browser's.

/** Members of one object (found along its prototype chain) to wrap. */
export interface ReflowSpec {
  target: object;
  /** Layout-reading getters and methods. */
  reads?: readonly string[];
  readMethods?: readonly string[];
  /** DOM-writing setters and methods. */
  writes?: readonly string[];
  writeMethods?: readonly string[];
}
export interface ReflowPatch {
  /** Restore every wrapped member. */
  uninstall(): void;
  /** Run without marking or reporting (the agent's own overlay work). */
  quiet<T>(fn: () => T): T;
  readonly dirty: boolean;
}

/** Own descriptor of `key` on `object` or the first prototype that has it. */
function holder(object: object, key: string): { at: object; descriptor: PropertyDescriptor } | null {
  for (let at: object | null = object; at; at = Object.getPrototypeOf(at) as object | null) {
    const descriptor = Object.getOwnPropertyDescriptor(at, key);
    if (descriptor) return { at, descriptor };
  }
  return null;
}

/**
 * Wrap the given members. `onRead(name, receiver)` is called for a read while layout is dirty (a DOM
 * write happened earlier in the same task); `later` schedules the end of the task (layout clean again).
 */
export function patchReflow(specs: readonly ReflowSpec[], onRead: (name: string, receiver: unknown) => void, later: (fn: () => void) => void): ReflowPatch {
  let dirty = false, scheduled = false, quiet = 0;
  const restores: (() => void)[] = [];
  const mark = () => {
    if (quiet || dirty) return;
    dirty = true;
    if (!scheduled) {
      scheduled = true;
      later(() => {
        scheduled = false;
        dirty = false;
      });
    }
  };
  const check = (name: string, receiver: unknown) => {
    if (!dirty || quiet) return;
    // The read lays out: later reads in this task are cheap until the next write.
    dirty = false;
    quiet++;
    try {
      onRead(name, receiver);
    } catch {
    } finally {
      quiet--;
    }
  };
  const wrapAccessor = (target: object, key: string, kind: "get" | "set") => {
    const found = holder(target, key);
    const original = found?.descriptor[kind] as ((this: unknown, value?: unknown) => unknown) | undefined;
    if (!found || !original || !found.descriptor.configurable) return;
    const { at, descriptor } = found;
    const wrapped: PropertyDescriptor =
      kind === "get"
        ? {
            ...descriptor,
            get(this: unknown) {
              check(key, this);
              return original.call(this);
            },
          }
        : {
            ...descriptor,
            set(this: unknown, value: unknown) {
              mark();
              original.call(this, value);
            },
          };
    Object.defineProperty(at, key, wrapped);
    restores.push(() => Object.defineProperty(at, key, descriptor));
  };
  const wrapMethod = (target: object, key: string, kind: "read" | "write") => {
    const found = holder(target, key);
    const original = found?.descriptor.value as ((...args: unknown[]) => unknown) | undefined;
    if (!found || typeof original !== "function" || !(found.descriptor.writable || found.descriptor.configurable)) return;
    const { at, descriptor } = found;
    const wrapped = {
      [key](this: unknown, ...args: unknown[]) {
        if (kind === "read") check(key, this);
        else mark();
        return original.apply(this, args);
      },
    }[key]!;
    Object.defineProperty(at, key, { ...descriptor, value: wrapped });
    restores.push(() => Object.defineProperty(at, key, descriptor));
  };
  for (const spec of specs) {
    for (const key of spec.reads ?? []) wrapAccessor(spec.target, key, "get");
    for (const key of spec.writes ?? []) wrapAccessor(spec.target, key, "set");
    for (const key of spec.readMethods ?? []) wrapMethod(spec.target, key, "read");
    for (const key of spec.writeMethods ?? []) wrapMethod(spec.target, key, "write");
  }
  return {
    uninstall() {
      for (const restore of restores.splice(0).reverse()) restore();
    },
    quiet(fn) {
      quiet++;
      try {
        return fn();
      } finally {
        quiet--;
      }
    },
    get dirty() {
      return dirty;
    },
  };
}

/** The browser's layout reads and DOM writes. */
export function domSpecs(win: Window & typeof globalThis): ReflowSpec[] {
  const style = win.CSSStyleDeclaration.prototype;
  // CSS properties are accessors on the declaration prototype (`el.style.width = …`).
  const styleSetters = Object.getOwnPropertyNames(style).filter((key) => typeof Object.getOwnPropertyDescriptor(style, key)?.set === "function");
  return [
    { target: win.HTMLElement.prototype, reads: ["offsetWidth", "offsetHeight", "offsetTop", "offsetLeft", "offsetParent", "innerText"], writes: ["innerText", "hidden", "outerText"] },
    {
      target: win.Element.prototype,
      reads: ["clientWidth", "clientHeight", "clientTop", "clientLeft", "scrollWidth", "scrollHeight", "scrollTop", "scrollLeft"],
      readMethods: ["getBoundingClientRect", "getClientRects", "computedStyleMap"],
      writes: ["innerHTML", "outerHTML", "className", "id"],
      writeMethods: ["setAttribute", "setAttributeNS", "removeAttribute", "toggleAttribute", "append", "prepend", "before", "after", "remove", "replaceWith", "replaceChildren", "insertAdjacentElement", "insertAdjacentHTML", "insertAdjacentText"],
    },
    { target: win.Node.prototype, writes: ["textContent", "nodeValue"], writeMethods: ["appendChild", "insertBefore", "removeChild", "replaceChild"] },
    { target: win.CharacterData.prototype, writes: ["data"] },
    { target: win.DOMTokenList.prototype, writeMethods: ["add", "remove", "toggle", "replace"] },
    { target: style, writes: styleSetters, writeMethods: ["setProperty", "removeProperty"] },
    { target: win, readMethods: ["getComputedStyle"] },
  ];
}
