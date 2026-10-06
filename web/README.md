# web — Stow frontend

Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn (Base UI) · framer-motion · next-themes.
The design started from the previous `justanidea` project (StockMaster), rebranded as Stow and rebuilt on this monorepo's `auth-service`.

## Run

```bash
cp .env.example .env.local      # AUTH_SERVICE_URL, defaults to http://localhost:3001
npm run start:web:dev           # from the monorepo root (nx run web:dev)
```

Requires `auth-service` on `AUTH_SERVICE_URL`. Note `auth-service`'s dev console
(`npm run console`) also listens on :3000 — stop it or run Next on another port.

## Routes

| Route | What |
|---|---|
| `/` | Marketing landing (header / hero / features / pricing / testimonials / CTA / footer) |
| `/login` | Email + password (show/hide) and "Sign in with Fingerprint" (passkey) |
| `/signup` | Three-step registration (email → details → check your email) |
| `/verify-email?token=` · `/forgot-password` · `/reset-password?token=` | Email-link flows |
| `/dashboard` and `(app)/*` | Sidebar shell with workspace switcher |
| `/settings/{profile,account,workspace,notifications}` | Settings with side nav; account = passkey registration |
| `/workspace/new` | Create a company workspace (tenant) |

## How auth works

- Tokens never reach the browser. Server actions in `src/lib/auth/actions.ts` call
  auth-service and keep access/refresh tokens in httpOnly cookies.
- `src/proxy.ts` runs on every request: silently refreshes an expired access token,
  sends signed-out users to `/login?next=…`, and signed-in users away from auth pages.
  `/` is public in both states.
- Server components read the session via `getSession()` / `getCurrentUser()` in
  `src/lib/auth/session.ts`.
- Passkeys: the browser runs WebAuthn (`@simplewebauthn/browser`); server actions broker
  the options/response with auth-service so a passkey login still ends in cookies.
- Email: auth-service sends verification and reset links (see its `MAIL_*` env). With no
  SMTP configured it logs the links, and outside production the raw tokens are also
  returned so the signup screen can show a "verify now" link.

## shadcn rules

- `src/components/ui/**` and `src/hooks/use-mobile.ts` belong to the shadcn registry.
  Never hand-edit; refresh with `npx shadcn@latest add <name> -o`.
- Prefer whole **blocks** (`login-04`, `dashboard-01`) over assembling primitives.
- App code lives outside `ui/`: `components/landing`, `components/auth`,
  `components/settings`, `components/brand`, plus the sidebar/nav files.
