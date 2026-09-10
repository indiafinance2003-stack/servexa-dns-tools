# Ravelyth Tools

Public DNS and email diagnostics toolkit. Next.js App Router, TypeScript, Zod, Vitest.

The site is stateless. It does not provide hosting control panels, accounts, or unrelated Ravelyth products.

## What it does

- DNS lookup (A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV, CAA)
- DNS health inspection with Pass / Info / Warning / Error findings
- SPF, DKIM (selector), and DMARC record analysis
- PTR lookup for public IP addresses
- Resolver comparison across selected public resolvers (not global propagation)
- Raw email header analysis (Received chain, Authentication-Results as reported, domain relationships)

DKIM cryptographic verification is not performed. SPF is inspected as published policy unless you only supply a domain. DNSSEC inspection reports DS/DNSKEY/RRSIG presence when the resolver returns those types; it does not validate a chain of trust.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Production server |

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

POST bodies are JSON. GET uses query parameters (`domain`, `recordType`, `selector`, `ip`).

## Security notes

- Domains and IPs are validated; localhost, private, and link-local targets are rejected
- DNS uses Node.js resolver APIs, not shell commands
- Request size, header size, header count, and DNS query budget are limited
- In-memory rate limiting is suitable for a single instance; use an external store for multiple instances

See `.env.example` for configuration.
