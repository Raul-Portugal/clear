# Setup: cross-device sync + GitHub Pages

Free tier only. The app works fully offline without any of this; sync is opt-in.

## 1. Supabase (reuse one of your existing free projects)
1. Open the project > **SQL Editor** > paste `supabase/schema.sql` > **Run**. It only creates `clear_tasks`, `clear_tags`, `clear_dumps` (with row-level security) and is safe to re-run.
2. **Authentication > URL Configuration**: add these under **Redirect URLs** (do NOT change **Site URL**, your other app may depend on it):
   - `https://<github-user>.github.io/<repo>/`
   - `http://localhost:5173/`
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
- Voice recordings stay on the device that made them; text, tasks, tags and brain dumps sync.
- Conflicts: last write wins per item. Deletes sync as tombstones.
- Supabase's built-in email is rate-limited (a few links per hour) on the free tier.
- Free Supabase projects pause after ~1 week of inactivity; resume from the dashboard.
