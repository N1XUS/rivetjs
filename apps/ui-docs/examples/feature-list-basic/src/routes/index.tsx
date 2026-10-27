// Rivet-authored FeatureList demo (Rivet addition, own demo content).
import { FeatureList } from "@rivetjs/ui/feature-list";
import { Leaf, RotateCcw, Truck } from "lucide";

export const head = { title: "FeatureList: Usage" };

// #region demo
export function Features() {
  return (
    <div class="grid w-full max-w-xl gap-8 sm:grid-cols-2">
      <FeatureList id="plan-features" aria-label="Growth plan">
        <FeatureList.Item>Unlimited products</FeatureList.Item>
        <FeatureList.Item>Stock across two locations</FeatureList.Item>
        <FeatureList.Item>Discount codes and gift cards</FeatureList.Item>
        <FeatureList.Item>Email support within a day</FeatureList.Item>
      </FeatureList>
      <FeatureList id="shop-perks" color="accent" aria-label="Perks" class="text-muted">
        <FeatureList.Item icon={Truck}>Free delivery by Thursday</FeatureList.Item>
        <FeatureList.Item icon={RotateCcw}>30-day returns, unworn and in the box</FeatureList.Item>
        <FeatureList.Item icon={Leaf}>Upper knit from 12 recycled bottles</FeatureList.Item>
      </FeatureList>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Features />
    </div>
  );
}
