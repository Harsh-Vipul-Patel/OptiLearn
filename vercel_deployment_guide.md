# Guide: Fixing Google Auth and Deploying to Vercel

## 1. Fixing Google Auth (Supabase + Next.js)

If your Google Auth works inconsistently or fails to redirect, you need to ensure the **Callback URLs** and **OAuth Credentials** are correctly configured in both Google Cloud Console and Supabase.

### A. Google Cloud Console Configuration
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services** > **Credentials**.
3. Edit your OAuth 2.0 Web Application Client ID (or create a new one).
4. **Authorized JavaScript origins** (Add both):
   - `http://localhost:3000` (for local development)
   - `https://your-vercel-domain.vercel.app` (for your production Vercel app)
5. **Authorized redirect URIs**:
   - `https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback`
   *(You get this exact URL from your Supabase Dashboard -> Authentication -> Providers -> Google)*

### B. Supabase Dashboard Configuration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) > **Authentication** > **Providers**.
2. Open **Google** and ensure it's **Enabled**.
3. Paste the **Client ID** and **Client Secret** from your Google Cloud Console.
4. Go to **Authentication** > **URL Configuration**.
5. Set the **Site URL** to your primary app URL:
   - `http://localhost:3000` (while testing locally, switch to Vercel later)
   - `https://your-vercel-domain.vercel.app` (when deploying)
6. Add the following **Redirect URLs** so Supabase allows redirecting back to your app:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/dashboard`
   - `http://localhost:3000/*` (wildcard for local testing)
   - `https://your-vercel-domain.vercel.app/auth/callback`
   - `https://your-vercel-domain.vercel.app/dashboard`
   - `https://your-vercel-domain.vercel.app/*`

---

## 2. Deploying to Vercel: Environment Variables

When deploying to Vercel, you need to add your environment variables to the Vercel project settings so your deployed app can communicate with Supabase.

### Where to add keys in Vercel:
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Select your project -> **Settings** -> **Environment Variables**.
3. Add the exact same keys you have in your local `.env` (or `.env.local`) file. Usually, these include at least:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```
*(If you have other keys like `DATABASE_URL` for direct DB access or backend URLs, add those as well).*

> **Important**: Never commit your `.env` file to GitHub! Vercel will securely inject these variables internally during the build.

---

## 3. Routing Considerations for Vercel

If you are using Next.js App Router (which you are, based on the `src/app` directory), Vercel automatically handles the routing maps perfectly. You don't need to change any Next.js routing code specifically for Vercel. However, ensure the following constraints for Auth are met:

### A. Next.js Auth Callback Route
You already have an auth callback route at `src/app/auth/callback/route.ts`. The Vercel deployment will serve this route automatically at `https://your-vercel-domain.vercel.app/auth/callback`.

### B. Dynamic Origin in Code
Ensure that when you call `signInWithOAuth` in your login component, the `redirectTo` option uses the `location.origin` dynamically. This makes sure it works seamlessly on both `localhost:3000` and `your-vercel-domain.vercel.app` without hardcoding URLs.

```tsx
// Example inside your Login/Auth component
const handleGoogleLogin = async () => {
  const supabase = createClient(); // (client-side initialization)
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Use window.location.origin to dynamically get the current hostname
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

If you do all these steps, your Google Authentication will work consistently both in local and production environments!
