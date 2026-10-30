# Setup: cross-device sync + GitHub Pages

Free tier only. The app works fully offline without any of this; sync is opt-in.

## 1. Supabase (reuse one of your existing free projects)
1. Open the project > **SQL Editor** > paste `supabase/schema.sql` > **Run**. It only creates `clear_tasks`, `clear_tags`, `clear_dumps` (with row-level security) and the private `clear-audio` storage bucket for voice recordings, and is safe to re-run. Re-run it after pulling schema changes.
2. **Authentication > URL Configuration**: add these under **Redirect URLs** (do NOT change **Site URL**, your other app may depend on it):
   - `https://raul-portugal.github.io/clear/**` (generally `https://<github-user>.github.io/<repo>/**`)
   - `http://localhost:5173/**`

   If the app's URL is missing here, Supabase ignores the app's redirect and sends the link to the **Site URL** instead (by default `http://localhost:3000`, which shows "can't reach this page").
3. **Project Settings > API**: copy the **Project URL** and the **anon / publishable** key (both are public by design; RLS protects the data).

## 2. GitHub Pages
1. Repo **Settings > Pages > Source: GitHub Actions**.
2. Repo **Settings > Secrets and variables > Actions > Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Push to `main`/`master`; `.github/workflows/deploy.yml` tests, builds (with the `/<repo>/` base path) and deploys.

## 3. Local development with sync
Copy `.env.example` to `.env.local`, fill in the two values, run `npm run dev`. Never commit real values to git beyond these public ones.

## 4. Use it
Open the app > **⋯** menu > **Sync** > enter your email > click the link in the email. Repeat on each device with the same email.

## Notes
- Tasks, tags, brain dumps and their voice recordings sync. Recordings go to the `clear-audio` bucket (`<user_id>/<audio id>`, only readable by that user) and are downloaded in the background for dumps in the Inbox. Free tier: 1 GB of storage.
- A recording made in Chrome (WebM) may not play on an older iPhone Safari, and an iPhone recording (MP4) plays everywhere.
- Conflicts: last write wins per item. Deletes sync as tombstones.
- Supabase's built-in email is rate-limited (a few links per hour) on the free tier.
- A link works once and expires after an hour. Requesting a new link invalidates older ones, so always use the newest email. An expired or used link shows "That sign-in link expired" in the app.
- Free Supabase projects pause after ~1 week of inactivity; resume from the dashboard.
