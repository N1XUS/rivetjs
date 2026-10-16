import { Label } from "@rivetjs/cdk/label";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "TagGroup with plain CSS" };

// #region demo
export default function Sizes() {
  return (
    <TagGroup id="sizes" selectionMode="single" defaultSelectedKeys={["m"]} disabledKeys={["xl"]}>
      <Label>Size</Label>
      <TagList>
        <Tag id="s">Small</Tag>
        <Tag id="m">Medium</Tag>
        <Tag id="l">Large</Tag>
        <Tag id="xl">Extra large</Tag>
      </TagList>
      <Text slot="description">Extra large is sold out.</Text>
    </TagGroup>
  );
}
// #endregion
