import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { SignUpEmailForm } from '@/components/auth/sign-up-email-form';
import FullPageLoadingState from '@/components/full-page-loading-state';
import { useTRPC } from '@/integrations/trpc/react';
import { createEntityTitle, PAGE_TITLES } from '@/utils/title';

const validateSearch = z.object({
  inviteId: z.string().optional(),
});
export const Route = createFileRoute('/_public/onboarding')({
  head: () => ({
    meta: [
      { title: createEntityTitle('Create an account', PAGE_TITLES.ONBOARDING) },
    ],
  }),
  beforeLoad: async ({ context }) => {
    if (context.session?.session) {
      throw redirect({ to: '/' });
    }
  },
  component: Component,
  validateSearch,
  loader: async ({ context, location }) => {
    const search = validateSearch.safeParse(location.search);
    if (search.success && search.data.inviteId) {
      await context.queryClient.prefetchQuery(
        context.trpc.organization.getInvite.queryOptions({
          inviteId: search.data.inviteId,
        })
      );
    }
  },
  pendingComponent: FullPageLoadingState,
});

function Component() {
  const { inviteId } = Route.useSearch();
  const trpc = useTRPC();
  const { data: invite } = useQuery(
    trpc.organization.getInvite.queryOptions(
      {
        inviteId,
      },
      {
        enabled: !!inviteId,
      }
    )
  );
  return (
    <div className="col w-full gap-6 text-left">
      <div>
        <h1 className="mb-2 font-semibold text-2xl text-foreground">
          Create your account
        </h1>
        <p className="text-muted-foreground text-sm">
          Already have an account?{' '}
          <a
            className="font-medium text-foreground underline"
            href={
              inviteId
                ? `/login?inviteId=${encodeURIComponent(inviteId)}`
                : '/login'
            }
          >
            Sign in
          </a>
        </p>
      </div>

      {invite && !invite.isExpired && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 font-semibold text-xl">
            Invitation to {invite.organization?.name}
          </h2>
          <p className="text-muted-foreground">
            After you have created your account, you will be added to the
            organization.
          </p>
        </div>
      )}
      {invite?.isExpired && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6">
          <h2 className="mb-2 font-semibold text-destructive text-xl">
            Invitation to {invite.organization?.name} has expired
          </h2>
          <p className="text-muted-foreground">
            The invitation has expired. Please contact the organization owner to
            get a new invitation.
          </p>
        </div>
      )}

      <div>
        <SignUpEmailForm inviteId={inviteId} />
      </div>
    </div>
  );
}
