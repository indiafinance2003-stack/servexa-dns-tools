# Ravelyth

Public DNS and email diagnostics toolkit. Next.js App Router, TypeScript, Tailwind, Zod, Vitest.

- DNS lookup (A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA)
- DNS health inspection with Pass / Info / Warning / Error findings
- SPF, DKIM (selector), and DMARC record analysis
- PTR lookup for public IP addresses
- Resolver comparison across selected public resolvers (not global propagation)
- Raw email header analysis (Received chain, Authentication-Results as reported, domain relationships)
- Optional free accounts: save DNS lookup analyses to your account (explicit save only; raw email headers are never stored)

DKIM cryptographic verification is not performed. SPF is inspected as published policy. DNSSEC inspection reports DS/DNSKEY/RRSIG presence; it does not validate a chain of trust. Accounts do not unlock extra diagnostics — all tools work anonymously.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Public tools work immediately; PostgreSQL is only needed for accounts.

### PostgreSQL (accounts, sessions, saved analyses)

1. Run a PostgreSQL 14+ server locally (any method; e.g. `docker run -e POSTGRES_PASSWORD=... -p 5432:5432 postgres:16`).
2. In `.env.local` set:
   ```
   DATABASE_URL=postgresql://user:pass@localhost:5432/ravelyth
   ```
3. Create the schema from the committed SQL migrations:
   ```
   npm run db:migrate
   ```
   (Or regenerate after editing `src/lib/db/schema.ts` with `npm run db:generate`.)
4. Restart `npm run dev`. Register at /register.

Without `DATABASE_URL`, the app builds and all public pages/APIs work; account endpoints respond 503 with a clear message.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Vitest (database integration tests auto-skip without `TEST_DATABASE_URL`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |

## API

All JSON responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message" } }`.

| Method | Path |
| --- | --- |
| GET | `/api/health` |
| GET, POST | `/api/dns/lookup` |
| GET, POST | `/api/dns/analyze` |
| GET, POST | `/api/dns/spf` |
| GET, POST | `/api/dns/dmarc` |
| GET, POST | `/api/dns/dkim` |
| GET, POST | `/api/dns/ptr` |
| GET, POST | `/api/dns/resolvers` |
| POST | `/api/email/analyze` |
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/logout` |
| GET | `/api/auth/me` |
| GET, POST | `/api/account/saved-analyses` (auth required) |
| DELETE | `/api/account/saved-analyses/[id]` (auth required) |

POST bodies are JSON. GET uses query parameters (`domain`, `recordType`, `selector`, `ip`).

## Security notes

- Domains and IPs are validated; localhost, private, and link-local targets are rejected
- DNS uses Node.js resolver APIs, not shell commands
- Passwords are hashed with Argon2id; never stored or logged in plaintext
- Sessions are server-side: random 256-bit tokens in HttpOnly SameSite=Lax cookies (Secure in production), only SHA-256 hashes stored, 7-day expiry enforced in the database
- All database access is parameterized through Drizzle and server-side only
- Rate limiting applies to public endpoints, with stricter per-account limits on login (per IP + email) and registration
- Security headers (CSP, X-Frame-Options DENY, nosniff, referrer policy) are set on every response
- Request size, header size, header count, and DNS query budget are limited
- In-memory rate limiting is suitable for a single instance; use an external store for multiple instances

See `.env.example` for configuration.
