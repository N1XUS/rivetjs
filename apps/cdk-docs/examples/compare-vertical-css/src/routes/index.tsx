import { Compare, CompareAfter, CompareBefore, CompareDivider, CompareHandle } from "@rivetjs/cdk/compare";

export const head = { title: "Compare: vertical" };

// #region demo
export default function PlanCompare() {
  return (
    <section class="page">
      <Compare id="plans" orientation="vertical" defaultValue={40}>
        <CompareBefore>
          <div class="layer before">
            <strong>Draft</strong>
            <p>Three columns, no hierarchy, every link the same weight.</p>
          </div>
        </CompareBefore>
        <CompareAfter>
          <div class="layer after">
            <strong>Final</strong>
            <p>One clear heading, a primary action, secondary links muted.</p>
          </div>
        </CompareAfter>
        <CompareHandle aria-label="Draft versus final">
          <CompareDivider />
        </CompareHandle>
      </Compare>
    </section>
  );
}
// #endregion
