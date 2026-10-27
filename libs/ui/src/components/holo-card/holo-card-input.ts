// Rivet-authored. Kept with the resumed input handler: iOS permission must be requested BEFORE an async import.
let permission: Promise<boolean> | undefined;

export function requestHoloOrientation(): Promise<boolean> {
  if (permission) return permission;
  const orientation = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }) | undefined;
  try {
    permission = orientation?.requestPermission
      ? orientation.requestPermission().then(
          (value) => value === "granted",
          () => false,
        )
      : Promise.resolve(true);
  } catch {
    permission = Promise.resolve(false);
  }
  return permission;
}

export function isHoloTouchTap(event: PointerEvent): boolean {
  return (
    (event.pointerType === "touch" || event.pointerType === "pen" || window.matchMedia("(hover: none)").matches) &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
