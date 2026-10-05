import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { createTitle, PAGE_TITLES } from '@/utils/title';

export const Route = createFileRoute('/_login/login')({
  component: LoginPage,
  head: () => ({
    meta: [{ title: createTitle(PAGE_TITLES.LOGIN) }],
  }),
  validateSearch: z.object({
    error: z.string().optional(),
    correlationId: z.string().optional(),
    inviteId: z.string().optional(),
  }),
});

function LoginPage() {
  const { error, correlationId, inviteId } = Route.useSearch();
  return (
    <SignInPanel
      correlationId={correlationId}
      error={error}
      inviteId={inviteId}
    />
  );
}
