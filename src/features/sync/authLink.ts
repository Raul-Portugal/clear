/**
 * Reads the error Supabase puts in the URL hash when a sign-in link fails
 * (e.g. `#error=access_denied&error_code=otp_expired&…`). Returns a message for the user, or null.
 */
export function authLinkError(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('error') && !params.has('error_code')) return null;
  if (params.get('error_code') === 'otp_expired') return 'That sign-in link expired. Send a new one from ⋯';
  return 'Sign-in failed. Send a new link from ⋯';
}
