// Motion's `inView`, loaded by a `whileInView` element when it first becomes visible (element.tsx: a dynamic import of
// this module, so the chunk holds `inView` alone and elements without `whileInView` never carry it).
export { inView } from "motion";
