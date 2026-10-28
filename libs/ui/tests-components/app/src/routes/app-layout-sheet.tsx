import { AppLayout } from "@rivetjs/ui/app-layout";

export default function AppLayoutSheetStory() {
  return (
    <AppLayout
      id="sheet"
      asideMobile="sheet"
      navbar={() => <AppLayout.AsideTrigger id="sheet-trigger" tooltipProps={{ delay: 0, closeDelay: 0 }} />}
      aside={() => (
        <>
          <button>Panel action</button>
          <AppLayout.MobileAside>
            <AppLayout.AsideTrigger tooltipProps={{ delay: 0, closeDelay: 0 }} />
          </AppLayout.MobileAside>
        </>
      )}
    >
      Main content
    </AppLayout>
  );
}
