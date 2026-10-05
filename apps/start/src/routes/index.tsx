import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import FullPageLoadingState from '@/components/full-page-loading-state';
import { LogoSquare } from '@/components/logo';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/branding';
import { useLogout } from '@/hooks/use-logout';
import { useNumber } from '@/hooks/use-numer-formatter';
import { useTRPC } from '@/integrations/trpc/react';
import { createTitle, PAGE_TITLES } from '@/utils/title';

interface IndexLoaderData {
  isSignedIn: boolean;
}

// Signed-out visitors get the sign-in form right here on `/` (no redirect to
// `/login`), so the root URL is the only entry point anyone sees.
export const Route = createFileRoute('/')({
  component: IndexPage,
  validateSearch: z.object({
    error: z.string().optional(),
    correlationId: z.string().optional(),
    inviteId: z.string().optional(),
  }),
  loader: async ({ context }): Promise<IndexLoaderData> => {
    if (!context.session?.session) {
      return { isSignedIn: false };
    }

    // Unsure why not using ensureQueryData here works
    // We need to put staleTime and gcTime to 0 to get the latest data
    // Even tho this query has never been called before
    const organizations = await context.queryClient
      .fetchQuery(
        context.trpc.organization.list.queryOptions(undefined, {
          staleTime: 0,
          gcTime: 0,
        })
      )
      .catch(() => []);

    if (organizations.length === 0) {
      throw redirect({ to: '/onboarding/project' });
    }

    if (organizations.length === 1) {
      throw redirect({
        to: '/$organizationId',
        params: { organizationId: organizations[0].id },
      });
    }

    return { isSignedIn: true };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: createTitle(
          loaderData?.isSignedIn === false ? PAGE_TITLES.LOGIN : 'Welcome'
        ),
      },
    ],
  }),
  pendingComponent: FullPageLoadingState,
});

function IndexPage() {
  const { isSignedIn } = Route.useLoaderData();
  const { error, correlationId, inviteId } = Route.useSearch();

  if (!isSignedIn) {
    return (
      <AuthShell>
        <SignInPanel
          correlationId={correlationId}
          error={error}
          inviteId={inviteId}
        />
      </AuthShell>
    );
  }

  return <LandingPage />;
}

function LandingPage() {
  const trpc = useTRPC();
  const logout = useLogout();
  const { data: organizations } = useSuspenseQuery(
    trpc.organization.list.queryOptions()
  );
  const number = useNumber();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="col mx-auto max-w-2xl gap-12 px-4 py-8">
        <div className="col gap-4">
          <LogoSquare className="w-full max-w-14 md:max-w-24" />
          <PageHeader title={`Welcome to ${BRAND.name}`} />
        </div>

        <div className="col gap-2">
          {organizations?.map((org) => (
            <Link
              className="row items-center justify-between rounded-lg border bg-card p-3 transition-all hover:translate-x-1 hover:border-primary hover:shadow-md"
              key={org.id}
              params={{ organizationId: org.id }}
              to={'/$organizationId'}
            >
              <div className="col gap-2">
                <span className="font-medium text-lg">{org.name}</span>
                <span className="text-muted-foreground text-sm">
                  ({org.id})
                </span>
              </div>
              <span>
                {number.format(org.subscriptionPeriodEventsCount)}
                <span className="mx-1 opacity-50">/</span>
                {number.format(org.subscriptionPeriodEventsLimit)}
              </span>
            </Link>
          ))}
        </div>

        <div className="row gap-4">
          <Button loading={logout.isPending} onClick={() => logout.mutate()}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
