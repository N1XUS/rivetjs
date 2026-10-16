// Theme builder preview, data tiles: invoices table, trip booking calendar, project overview, AI assistant. Real
// @rivetjs/ui components with invented content (see Preview.tsx for the stage + portal container).

import { signal } from "@rivetjs/reactivity";
import type { Selection } from "@rivetjs/cdk/collections/types";
import { parseDate } from "@rivetjs/cdk/date";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown, CircleCheck, Download, FolderGit2, GitPullRequest, Globe, Plane, Plus } from "lucide";
import { Accordion } from "@rivetjs/ui/accordion";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { Button } from "@rivetjs/ui/button";
import { Calendar } from "@rivetjs/ui/calendar";
import { Card } from "@rivetjs/ui/card";
import { ChatMessage } from "@rivetjs/ui/chat-message";
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Chip } from "@rivetjs/ui/chip";
import { DateField } from "@rivetjs/ui/date-field";
import { DatePicker } from "@rivetjs/ui/date-picker";
import { Label } from "@rivetjs/ui/label";
import { Pagination } from "@rivetjs/ui/pagination";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import { RangeCalendar } from "@rivetjs/ui/range-calendar";
import { Table } from "@rivetjs/ui/table";
import { Tabs } from "@rivetjs/ui/tabs";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import { ANSWER, FAQ, INVOICES, STATUS_COLOR, TOPICS } from "./content.ts";

/** Invoices: Table with row selection, status Chips, Pagination. */
export function InvoicesCard() {
  const selected = signal<Selection>(new Set());
  const page = signal(1);
  return (
    <Card class="tb-tile">
      <Card.Header class="flex-row items-start justify-between gap-2">
        <div class="flex flex-col gap-1">
          <Card.Title>Invoices</Card.Title>
          <Card.Description>
            {(() => {
              const keys = selected();
              const count = keys === "all" ? INVOICES.length : keys.size;
              return count ? `${count} selected` : "Select rows to export them.";
            })()}
          </Card.Description>
        </div>
        <Button size="sm" variant="secondary">
          <Icon icon={Download} size={16} />
          Export
        </Button>
      </Card.Header>
      <Card.Content class="gap-3">
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="Invoices" class="min-w-[22rem]" selectedKeys={selected} selectionMode="multiple">
              <Table.Header>
                <Table.Column class="pe-0">
                  <Checkbox aria-label="Select all" slot="selection">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Column>
                <Table.Column isRowHeader>Invoice</Table.Column>
                <Table.Column>Customer</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column class="text-end">Amount</Table.Column>
              </Table.Header>
              <Table.Body>
                {INVOICES.map((row) => (
                  <Table.Row id={row.id}>
                    <Table.Cell class="pe-0">
                      <Checkbox aria-label={`Select ${row.id}`} slot="selection" variant="secondary">
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </Table.Cell>
                    <Table.Cell class="font-medium">{row.id}</Table.Cell>
                    <Table.Cell>{row.customer}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={STATUS_COLOR[row.status]}>
                        {row.status}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell class="text-end tabular-nums">{row.amount}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <Pagination size="sm" class="justify-center">
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous isDisabled={page() === 1} onPress={() => page.set(page() - 1)}>
                <Pagination.PreviousIcon />
              </Pagination.Previous>
            </Pagination.Item>
            {[1, 2, 3].map((p) => (
              <Pagination.Item>
                <Pagination.Link isActive={p === page()} onPress={() => page.set(p)}>
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next isDisabled={page() === 3} onPress={() => page.set(page() + 1)}>
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </Card.Content>
    </Card>
  );
}

/** Trip booking: RangeCalendar + DatePicker (popover calendar). */
export function BookingCard() {
  return (
    <Card class="tb-tile">
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Icon icon={Plane} size={18} />
          Book a trip
        </Card.Title>
        <Card.Description>Pick the nights, then the return flight.</Card.Description>
      </Card.Header>
      <Card.Content class="items-center gap-4">
        <RangeCalendar aria-label="Trip dates" defaultValue={{ start: parseDate("2026-11-09"), end: parseDate("2026-11-13") }} firstDayOfWeek="mon">
          <RangeCalendar.Header>
            <RangeCalendar.Heading />
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
          </RangeCalendar.Grid>
        </RangeCalendar>
        <DatePicker class="w-full" name="return" defaultValue={parseDate("2026-11-14")}>
          <Label>Return flight</Label>
          <DateField.Group fullWidth variant="secondary">
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            <DateField.Suffix>
              <DatePicker.Trigger>
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DatePicker.Popover>
            <Calendar aria-label="Return flight">
              <Calendar.Header>
                <Calendar.Heading />
                <Calendar.NavButton slot="previous" />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </DatePicker.Popover>
        </DatePicker>
      </Card.Content>
      <Card.Footer>
        <Button fullWidth>Reserve 4 nights</Button>
      </Card.Footer>
    </Card>
  );
}

/** Project overview: Breadcrumbs, Tabs (render-function panels), TagGroup, Accordion. */
export function ProjectCard() {
  return (
    <Card class="tb-tile">
      <Card.Header class="gap-2">
        <Breadcrumbs>
          <Breadcrumbs.Item href="#theme-css">Acme</Breadcrumbs.Item>
          <Breadcrumbs.Item href="#theme-css">Projects</Breadcrumbs.Item>
          <Breadcrumbs.Item>Website</Breadcrumbs.Item>
        </Breadcrumbs>
        <Card.Title class="flex items-center gap-2">
          <Icon icon={FolderGit2} size={18} />
          Website redesign
        </Card.Title>
      </Card.Header>
      <Card.Content class="gap-4">
        <Tabs class="w-full">
          <Tabs.List aria-label="Project sections">
            <Tabs.Tab id="overview">Overview</Tabs.Tab>
            <Tabs.Tab id="activity">Activity</Tabs.Tab>
            <Tabs.Tab id="faq">FAQ</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel class="flex flex-col gap-3 pt-4" id="overview">
            {() => (
              <>
                <p class="text-sm text-muted">A faster marketing site on the new design system. Launch planned for November.</p>
                <TagGroup aria-label="Topics" selectionMode="multiple" defaultSelectedKeys={["frontend", "a11y"]} size="sm">
                  <TagGroup.List>
                    {TOPICS.map((t) => (
                      <Tag id={t.id} textValue={t.label}>
                        {t.label}
                      </Tag>
                    ))}
                  </TagGroup.List>
                </TagGroup>
              </>
            )}
          </Tabs.Panel>
          <Tabs.Panel class="flex flex-col gap-3 pt-4" id="activity">
            {() => (
              <>
                <p class="flex items-center gap-2 text-sm">
                  <Icon icon={GitPullRequest} size={16} class="text-accent" />
                  Grace opened “New pricing page”
                </p>
                <p class="flex items-center gap-2 text-sm">
                  <Icon icon={CircleCheck} size={16} class="text-success" />
                  Checks passed on main
                </p>
              </>
            )}
          </Tabs.Panel>
          <Tabs.Panel class="pt-2" id="faq">
            {() => (
              <Accordion class="w-full">
                {FAQ.map((item) => (
                  <Accordion.Item>
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        <span class="me-3 size-4 shrink-0 text-muted">
                          <Icon icon={item.icon} />
                        </span>
                        {item.title}
                        <Accordion.Indicator>
                          <Icon icon={ChevronDown} />
                        </Accordion.Indicator>
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body>{item.body}</Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
      <Card.Footer class="gap-2">
        <Button size="sm">
          <Icon icon={Plus} size={16} />
          New task
        </Button>
        <Button size="sm" variant="ghost">
          View board
        </Button>
      </Card.Footer>
    </Card>
  );
}

/** AI assistant: ChatMessage user / assistant turns, ChatMessageActions, PromptInput. */
export function AssistantCard() {
  const sent = signal("");
  return (
    <Card class="tb-tile">
      <Card.Header>
        <Card.Title>Assistant</Card.Title>
        <Card.Description>Chat components on the theme.</Card.Description>
      </Card.Header>
      <Card.Content class="gap-4">
        <ChatMessage.User>
          <ChatMessage.Bubble>Does my new theme have enough contrast?</ChatMessage.Bubble>
        </ChatMessage.User>
        <ChatMessage.Assistant>
          <ChatMessage.Avatar fallback="AI" />
          <ChatMessage.Body>
            <ChatMessage.Content>{ANSWER}</ChatMessage.Content>
            <ChatMessage.Actions>
              <ChatMessageActions>
                <ChatMessageActions.Copy text={ANSWER} />
              </ChatMessageActions>
            </ChatMessage.Actions>
          </ChatMessage.Body>
        </ChatMessage.Assistant>
        {sent() ? (
          <ChatMessage.User>
            <ChatMessage.Bubble>{sent()}</ChatMessage.Bubble>
          </ChatMessage.User>
        ) : null}
        <PromptInput onSubmit={(value: string) => sent.set(value)}>
          <PromptInput.Shell>
            <PromptInput.Content>
              <PromptInput.TextArea placeholder="Ask about your theme" />
            </PromptInput.Content>
            <PromptInput.Toolbar>
              <PromptInput.ToolbarStart>
                <PromptInput.Action aria-label="Search the web" tooltip="Search the web">
                  <Icon icon={Globe} size={16} />
                </PromptInput.Action>
              </PromptInput.ToolbarStart>
              <PromptInput.ToolbarEnd>
                <PromptInput.Send />
              </PromptInput.ToolbarEnd>
            </PromptInput.Toolbar>
          </PromptInput.Shell>
        </PromptInput>
      </Card.Content>
    </Card>
  );
}
