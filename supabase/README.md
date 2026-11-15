# Accounts and cloud save (Supabase)

Wayword works without any of this: progress is saved in the browser. Connecting Supabase adds real
sign-up and sign-in, and saves each learner's progress to their account so it follows them to any device.

## Set up (about 10 minutes)

1. **Create a project.** Sign in at [supabase.com](https://supabase.com), choose **New project**, give it a name
   (for example `wayword`), set a database password (keep it somewhere safe), and pick the region closest to you.
   Wait a minute or two while it starts.
2. **Create the progress table.** In the project, open **SQL Editor → New query**, paste everything from
   [`schema.sql`](schema.sql), and press **Run**. You should see "Success. No rows returned".
3. **For a smooth demo, skip email confirmation** (optional). Open **Authentication → Sign In / Providers → Email**
   and switch off **Confirm email**. With it on, new learners must click a link in their inbox before they can sign in.
4. **Copy your keys.** Open **Project Settings → API** (or the **Connect** button) and copy:
   - the **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - the **anon / public** key, a long string starting with `eyJ`.

   The anon key is designed to be public: the row-level security rules in `schema.sql` stop anyone reading
   another learner's progress. **Never** use the `service_role` key in this app.
5. **Add them to the project.** Create a file named `.env.local` in the project root (next to `package.json`):

   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your anon key...
   ```

   `.env.local` is ignored by git, so the keys are never committed.
6. **Restart** `npm run dev` (it reads the file when it starts).

## Check that it works

- Open the site, choose **Start your adventure**, and create an account. The sign-in card now says
  "YOUR ACCOUNT" instead of "PLAYABLE DEMO".
- Play a chapter, then open the map: the note at the bottom says **Progress saved to your account**.
- In Supabase, **Table Editor → learner_progress** shows one row for your account.
- Open the site in a private window, sign in with the same account, and your progress is there.

## How it works

- `src/cloud.ts` handles sign-up, sign-in, password reset and syncing.
- When a signed-in learner opens any page, their saved progress is pulled into the browser first, then changes
  are saved every 15 seconds and whenever the page is hidden or closed.
- Lists (completed chapters, traced letters, visited stalls) are merged, so progress is never lost when switching
  devices. For single settings, the current browser wins.
- Automated test browsers always use the local demo, so tests never create real accounts.
