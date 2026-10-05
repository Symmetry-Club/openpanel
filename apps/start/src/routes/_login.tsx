import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AuthShell } from '@/components/auth/auth-shell';

export const Route = createFileRoute('/_login')({
  beforeLoad: async ({ context }) => {
    if (context.session?.session) {
      throw redirect({ to: '/' });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
