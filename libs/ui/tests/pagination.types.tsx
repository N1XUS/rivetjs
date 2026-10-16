// Type-level suite (`tsc -p libs/ui` only): `Pagination` parts (generic dom parts, cdk Button parts), compound prop types, errors.
import { Pagination } from "../src/components/pagination/index.ts";

export const pages = () => (
  <Pagination size="lg" class="x" aria-label="pages">
    <Pagination.Summary dir="ltr">Summary</Pagination.Summary>
    <Pagination.Content>
      <Pagination.Item>
        <Pagination.Previous isDisabled onPress={() => {}}>
          <Pagination.PreviousIcon class="i" />
        </Pagination.Previous>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Link isActive onPress={(e) => void e.pointerType} class={({ isHovered }) => (isHovered() ? "h" : "")}>
          1
        </Pagination.Link>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Ellipsis />
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Next>
          <Pagination.NextIcon>
            <span />
          </Pagination.NextIcon>
        </Pagination.Next>
      </Pagination.Item>
    </Pagination.Content>
  </Pagination>
);

const p: Pagination["Props"] = { children: "x", size: "sm" };
const l: Pagination["LinkProps"] = { children: "1", isActive: true };
void p;
void l;

// @ts-expect-error bad size
export const badSize = () => <Pagination size="xl">x</Pagination>;

// Rivet shorthand: no children with `total`.
export const shorthand = () => <Pagination total={5} defaultPage={2} siblings={1} />;

// @ts-expect-error total is a number
export const badTotal = () => <Pagination total="5" />;
