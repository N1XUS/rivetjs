import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
import { Search, X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "SearchField: CSS" };

// #region demo
export default function Css() {
  return (
    <div class="demo">
      <SearchField id="q">
        <Label>Search</Label>
        <div class="box">
          <Icon icon={Search} class="glass" />
          <Input placeholder="Search components" />
          <Button>
            <Icon icon={X} />
          </Button>
        </div>
      </SearchField>
    </div>
  );
}
// #endregion
