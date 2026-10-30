import { describe, expect, it } from 'vitest';
import { authLinkError } from './authLink';

describe('authLinkError', () => {
  it('ignores normal and session hashes', () => {
    expect(authLinkError('')).toBeNull();
    expect(authLinkError('#access_token=abc&refresh_token=def&type=magiclink')).toBeNull();
  });

  it('explains an expired link', () => {
    const hash =
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';
    expect(authLinkError(hash)).toMatch(/expired/);
  });

  it('falls back to a generic message for other errors', () => {
    expect(authLinkError('#error=server_error&error_description=x')).toMatch(/failed/);
  });
});
