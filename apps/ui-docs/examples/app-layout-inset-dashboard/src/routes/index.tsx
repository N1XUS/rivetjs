// Rivet-authored demo (AppLayout is a Rivet addition, own content).
import { Icon } from "@rivetjs/kit/icon";
import { ChartColumn, ChevronsUpDown, CreditCard, House, LogOut, Settings, User, Users } from "lucide";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Avatar } from "@rivetjs/ui/avatar";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Kpi } from "@rivetjs/ui/kpi";
import { KpiGroup } from "@rivetjs/ui/kpi-group";
import { Label } from "@rivetjs/ui/label";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout: Inset dashboard" };

const LINKS = [
  { label: "Dashboard", icon: House },
  { label: "Analytics", icon: ChartColumn },
  { label: "Customers", icon: Users },
  { label: "Billing", icon: CreditCard },
];

const METRICS = [
  { title: "Revenue", value: 48210, format: { style: "currency", currency: "USD", maximumFractionDigits: 0 }, trend: "up", change: "9.6%" },
  { title: "Active users", value: 3912, format: {}, trend: "up", change: "4.1%" },
  { title: "Churn", value: 0.018, format: { style: "percent", maximumFractionDigits: 1 }, trend: "down", change: "0.3 pt" },
] as const;

function UserMenu() {
  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Dropdown>
          <Sidebar.MenuButton id="aid-user" size="lg" aria-label="Account menu">
            <Avatar size="sm" color="accent">
              <Avatar.Fallback>JR</Avatar.Fallback>
            </Avatar>
            <span class="flex flex-col leading-tight">
              <span class="font-medium">Jonah Reyes</span>
              <span class="text-xs text-muted">jonah@northwind.test</span>
            </span>
            <Icon icon={ChevronsUpDown} size={16} class="ms-auto" />
          </Sidebar.MenuButton>
          <Dropdown.Popover placement="right bottom">
            <Dropdown.Menu aria-label="Account">
              <Dropdown.Item id="profile" textValue="Profile">
                <Icon icon={User} size={16} />
                <Label>Profile</Label>
              </Dropdown.Item>
              <Dropdown.Item id="settings" textValue="Settings">
                <Icon icon={Settings} size={16} />
                <Label>Settings</Label>
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="Log out">
                <Icon icon={LogOut} size={16} />
                <Label>Log out</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}

function AppSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header>
        <span class="px-2 text-sm font-semibold in-data-[collapsible=icon]:hidden">Northwind</span>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Overview</Sidebar.GroupLabel>
          <Sidebar.Menu>
            {LINKS.map((link, i) => (
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#" isCurrent={i === 0} tooltip={link.label}>
                  <Icon icon={link.icon} size={16} />
                  <span>{link.label}</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
      <Sidebar.Footer>
        <UserMenu />
      </Sidebar.Footer>
    </Sidebar>
  );
}

function Dashboard() {
  return (
    <div class="flex flex-col gap-6 p-6">
      <h1 class="text-xl font-semibold">Dashboard</h1>
      <KpiGroup id="aid-kpis">
        {METRICS.map((metric, i) => (
          <>
            {i > 0 ? <KpiGroup.Separator /> : null}
            <Kpi>
              <Kpi.Title>{metric.title}</Kpi.Title>
              <Kpi.Body>
                <Kpi.Value value={metric.value} formatOptions={metric.format} />
                <Kpi.Trend trend={metric.trend} isInverted={metric.title === "Churn"}>
                  {metric.change}
                </Kpi.Trend>
              </Kpi.Body>
            </Kpi>
          </>
        ))}
      </KpiGroup>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="h-40 rounded-xl bg-surface-secondary" />
        <div class="h-40 rounded-xl bg-surface-secondary" />
      </div>
    </div>
  );
}

// #region demo
export function AppLayoutInsetDashboard() {
  return (
    <AppLayout
      id="app-layout-inset-dashboard"
      sidebarVariant="inset"
      sidebarCollapsible="offcanvas"
      sidebar={() => <AppSidebar />}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger id="aid-trigger" />
          <span class="flex-1 text-sm font-medium">Dashboard</span>
        </>
      )}
    >
      <Dashboard />
    </AppLayout>
  );
}
// #endregion

export default function Demo() {
  return <AppLayoutInsetDashboard />;
}
