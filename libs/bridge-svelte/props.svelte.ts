// A compiled rune module keeps one reactive props object for the mounted component's entire lifetime.
export function liveProps(initial: Record<string, unknown>): Record<string, unknown> {
  const props = $state({ ...initial });
  return props;
}

export function replaceProps(target: Record<string, unknown>, next: Record<string, unknown>): void {
  for (const key of Object.keys(target)) if (!(key in next)) delete target[key];
  Object.assign(target, next);
}
