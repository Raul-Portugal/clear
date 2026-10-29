import { useState } from 'react';
import { syncConfigured } from '../../data/supabase';
import { Button } from '../../ui/Button';
import { relativeTime } from './relativeTime';
import { useSync } from './useSync';
import styles from './SyncSection.module.css';

/** Quiet sync controls for the view menu. Renders nothing when sync is not configured. */
export function SyncSection() {
  const { status, email, lastSyncedAt, linkSent, signIn, signOut, syncNow } = useSync();
  const [address, setAddress] = useState('');
  const [failed, setFailed] = useState(false);
  if (!syncConfigured) return null;

  const signedIn = status !== 'signed-out' && status !== 'off';

  return (
    <section aria-label="Sync" data-testid="sync-section">
      <h2 className={styles.h}>Sync</h2>
      {!signedIn ? (
        linkSent ? (
          <p className={styles.note} role="status">
            Check your email
          </p>
        ) : (
          <form
            className={styles.form}
            onSubmit={async (e) => {
              e.preventDefault();
              setFailed(false);
              try {
                await signIn(address.trim());
              } catch {
                setFailed(true);
              }
            }}
          >
            <input
              type="email"
              required
              className={styles.input}
              aria-label="Email address"
              placeholder="you@example.com"
              autoComplete="email"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Button type="submit" variant="primary">
              Send sign-in link
            </Button>
            <p className={styles.note}>{failed ? 'Could not send the link. Try again.' : "We'll email you a link. No password."}</p>
          </form>
        )
      ) : (
        <div className={styles.form}>
          <p className={styles.note}>
            {status === 'error' && <span className={styles.dot} role="img" aria-label="Sync problem" />}
            {status === 'error' ? 'Offline or sync failed' : 'Synced'} · {email}
            {lastSyncedAt ? ` · ${relativeTime(lastSyncedAt)}` : ''}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.link} onClick={() => void syncNow()}>
              Sync now
            </button>
            <button type="button" className={styles.link} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      )}
      <p className={styles.note}>Voice recordings stay on the device they were made on.</p>
    </section>
  );
}
