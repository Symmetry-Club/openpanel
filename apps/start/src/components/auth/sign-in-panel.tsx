import { AlertCircle } from 'lucide-react';
import { SignInEmailForm } from './sign-in-email-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SignInPanelProps {
  error?: string;
  correlationId?: string;
  inviteId?: string;
}

/** Email + password sign in, rendered on both `/` and `/login`. */
export function SignInPanel({
  error,
  correlationId,
  inviteId,
}: SignInPanelProps) {
  return (
    <div className="col w-full gap-6 text-left">
      {error && (
        <Alert
          className="border-destructive/20 bg-destructive/10 text-left"
          variant="destructive"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            {correlationId && <p>Correlation ID: {correlationId}</p>}
          </AlertDescription>
        </Alert>
      )}
      <SignInEmailForm hideForgotPassword inviteId={inviteId} />
    </div>
  );
}
