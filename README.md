# PacketDrop

Independent Hebrew parcel tracker for iPhone home-screen installation. Next.js + Auth.js + Google Gmail API + optional Neon/Postgres name storage. No Floot SDK, broker, branding, keys or hosting dependency.

## Current status

This is a new portable implementation, **not a full export of the Floot application**. The design, brand asset and core workflow have been carried over. Existing Floot accounts, connections and edited package names have NOT been copied. Users sign in to Google again. No production credentials are included.

- Google sign-in plus read-only Gmail permission, in a single OAuth flow.
- Mail scanned on opening and by the refresh button, with pagination (30 messages/page, 180 days).
- Real product names/images, tracking links, arrival estimates and event timelines extracted from the scanned email. No sample orders. Horizontal stages run right to left.
- AliExpress/Amazon/Temu/SHEIN/eBay/Israel Post brand icons, loaded through Google's favicon service. Product pictures are remote HTTPS images and may be blocked by the originating store.
- Custom package names saved to Postgres, scoped by Google subject ID. Reset restores the extracted name.
- iPhone Apple touch PNG at 180 px, 192/512 PNG icons, web app manifest and the short home-screen name `PacketDrop`.
- Accessible labeled controls, text enlargement, dark style, reduced-motion support and native `<dialog>` editing.

## Start locally

Node.js 22 or newer recommended.

```sh
npm ci
cp .env.example .env.local
# Set values in .env.local locally. Never commit the file.
npm run dev
```

Without OAuth configuration, the home page intentionally shows a setup message. It does not pretend a Gmail connection exists.

## Google configuration (required)

1. Create a project you control in Google Cloud and enable Gmail API.
2. Configure Google Auth Platform / OAuth consent as an External application. For personal testing, add your own email as a test user. Request `openid`, `email`, `profile` and `https://www.googleapis.com/auth/gmail.readonly`.
3. Create an OAuth client of type **Web application**.
4. Add exact redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-PRODUCTION-DOMAIN/api/auth/callback/google`
5. Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and `AUTH_SECRET` (generate at least 32 random bytes, e.g. `openssl rand -base64 32`) in your hosting provider's encrypted environment settings. Set `AUTH_URL` to the production HTTPS origin.
6. Never paste secrets into a chat, put them in browser code or commit them to GitHub.

Google's testing mode may require renewed consent and is not a permanent public production setup. Public access to the restricted Gmail scope can require Google's verification process. Floot's Google authorization cannot be reused by this independent app.

## Package name storage (required for editing)

Create a Postgres database (for example Neon), set `DATABASE_URL` as a server environment secret, and run `schema.sql` once in its SQL editor. Only user-created title overrides are stored; message bodies are not stored. Without a database, reading Gmail still works and the rename controls are disabled.

## GitHub / Vercel

1. Create a private repository `packetdrop` in the intended GitHub account, initialized with a README (so it has a branch).
2. Grant the ChatGPT GitHub connector access to that repository; the connected profile alone is not repository access.
3. Upload this project's source (exclude `node_modules`, `.next`, `.env.local` and `.git`). Keep the lockfile.
4. Import the repository in Vercel; framework **Next.js**, root directory the project root, install `npm ci`, build `npm run build`.
5. Add the environment variables above securely in the Vercel dashboard, run the SQL migration and redeploy. Register the final Vercel URL in Google before testing OAuth. Use a stable production URL; random preview URLs are not automatically authorized by Google.
6. Verify Google consent → scan → product details → rename → reload → reset → sign out with the real account before switching away from Floot.
7. Open the production URL in Safari → Share → Add to Home Screen. Keep the existing Floot deployment until the new one has been verified.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Parser tests cover unrelated email, unsafe URLs, product image/title/ETA extraction, collection status and chronological deduplication. Authentication and live Gmail cannot be end-to-end tested without the owner's Google client and consent.

## Limits

Email extraction is deterministic and conservative, without an external AI bill. Message formats vary, so fields can be missing and some orders may remain separate (especially when different shops/carriers use different order references). ETA is copied only when an explicit supported phrase is present; no invented prediction. The current implementation does not have push notifications, periodic server background scanning, carrier APIs or offline mail caching. Old Floot title overrides need a separate authenticated export/import step after the old service's access is available.

## Privacy/security

Google refresh/access tokens stay in Auth.js encrypted HttpOnly cookies; the public session endpoint exposes no tokens. API routes authenticate before calling Gmail. User IDs are derived from the validated Google identity, never request bodies. Title mutations require matching Origin and parameterized SQL; every title query includes the user's ID. Gmail bodies are processed in server memory, not logged or persisted. No service worker caches email or session responses. Sign out clears the application session; Google permissions can also be revoked from the user's Google account.
