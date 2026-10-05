import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ConstructionIcon } from 'lucide-react';
import { ChatDrawerSlot } from '@/components/chat/chat-drawer-slot';
import { FullPageEmptyState } from '@/components/full-page-empty-state';
import { Sidebar } from '@/components/sidebar';
import { useAppContext } from '@/hooks/use-app-context';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    if (!context.session?.session) {
      throw redirect({ to: '/' });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { isMaintenance } = useAppContext();

  if (isMaintenance) {
    return (
      <FullPageEmptyState
        className="min-h-screen"
        description="We are currently performing maintenance on the system. Please check back later."
        icon={ConstructionIcon}
        title="Maintenance mode"
      />
    );
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <div className="w-full lg:pl-72 min-w-0 flex-1">
        <div className="fixed top-0 z-10 block h-16 w-full border-b bg-background lg:hidden" />
        <div className="block h-16 lg:hidden" />
        <Outlet />
      </div>
      <ChatDrawerSlot />
    </div>
  );
}
