import { AppLayout } from "@rivetjs/ui/app-layout";
import { Sidebar } from "@rivetjs/ui/sidebar";

export default function AppLayoutSheetStory() {
  return (
    <AppLayout
      id="sheet"
      contained
      scrollMode="content"
      class="mx-auto my-8 h-[480px] max-w-5xl"
      sidebar={() => (
        <Sidebar resizable>
          <Sidebar.Content>Conversation history</Sidebar.Content>
        </Sidebar>
      )}
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
