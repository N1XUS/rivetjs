import type { LayoutProps } from "@rivetjs/router";
import { Announcer } from "@rivetjs/cdk/announcer";

export default function Layout({ children }: LayoutProps) {
  return (
    <main>
      <nav aria-label="Stories">
        <a href="/">Index</a> <a href="/buttons">Buttons</a> <a href="/listbox">ListBox</a> <a href="/tabs">Tabs</a> <a href="/menu">Menu</a>{" "}
        <a href="/dialog">Dialog</a> <a href="/popover">Popover</a> <a href="/tooltip">Tooltip</a> <a href="/combobox">ComboBox</a> <a href="/select">Select</a> <a href="/autocomplete">Autocomplete</a> <a href="/forms">Form fields</a> <a href="/focus-scope">FocusScope</a> <a href="/calendar">Calendar</a> <a href="/date-picker">DatePicker</a>
      </nav>
      {children}
      <Announcer />
    </main>
  );
}
