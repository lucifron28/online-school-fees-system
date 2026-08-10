import { createAuthClient } from 'better-auth/react';

// The auth API is hosted by this Next.js app. Leaving the client URL relative
// keeps requests on the current origin instead of forcing localhost in dev or
// a stale public URL in a preview deployment.
export const authClient = createAuthClient();

export const { useSession, signIn, signOut } = authClient;
