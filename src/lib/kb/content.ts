/**
 * Authored Knowledge Base content.
 *
 * This module is the editorial source of truth for Ravelyth's public
 * troubleshooting guides. Content is seeded into the database (see
 * `src/lib/kb/service.ts`); the database is the authority for what is
 * *published* — admin edits, drafts and unpublishing happen there, never by
 * redeploying code.
 *
 * Every troubleshooting article follows the same structure:
 * Problem → Symptoms → Information to Collect → Diagnostic Steps →
 * Interpretation → Possible Causes → Resolution → Verification → Prevention.
 *
 * Articles describe only what Ravelyth's tools can actually observe. They never
 * promise an outcome we cannot deliver.
 */

export type KbSection =
  | { kind: 'text'; heading: string; paragraphs: string[] }
  | { kind: 'list'; heading: string; items: string[]; ordered?: boolean }
  | {
      kind: 'steps';
      heading: string;
      steps: Array<{ title: string; detail: string }>;
    }
  | { kind: 'code'; heading: string; language: string; lines: string[] };

export interface KbRelatedTool {
  label: string;
  href: string;
}

export interface KbArticleContent {
  slug: string;
  categorySlug: string;
  title: string;
  description: string;
  featured?: boolean;
  readingTimeMinutes: number;
  sections: KbSection[];
  relatedTools: KbRelatedTool[];
  relatedArticles: string[];
}

export interface KbCategoryContent {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
}

export const KB_CATEGORIES: KbCategoryContent[] = [
  {
    slug: 'dns-and-nameservers',
    title: 'DNS & Nameservers',
    description:
      'Propagation, nameserver changes, and connecting a domain to its hosting.',
    sortOrder: 10,
  },
  {
    slug: 'email-authentication',
    title: 'Email Authentication',
    description: 'SPF, DKIM and DMARC records and how policies interact.',
    sortOrder: 20,
  },
  {
    slug: 'email-delivery',
    title: 'Email Delivery',
    description:
      'Bounces, rejections, Gmail and Outlook problems, and business email setup.',
    sortOrder: 30,
  },
  {
    slug: 'wordpress-websites',
    title: 'WordPress & Websites',
    description: 'Common WordPress errors, login problems, and HTTP 5xx pages.',
    sortOrder: 40,
  },
  {
    slug: 'servers-and-ssl',
    title: 'Servers & SSL',
    description: 'VPS housekeeping, basic hardening, and certificate problems.',
    sortOrder: 50,
  },
  {
    slug: 'using-ravelyth',
    title: 'Using Ravelyth',
    description:
      'How the tools work, what they measure, what they do not claim, and how accounts work.',
    sortOrder: 60,
  },
];

export const KB_ARTICLES: KbArticleContent[] = [
  {
    slug: 'dns-propagation-not-updating',
    categorySlug: 'dns-and-nameservers',
    title: 'DNS changes are not showing up (propagation)',
    description:
      'Why a DNS change still resolves to the old value for some people, how to verify what is actually published, and when to escalate.',
    readingTimeMinutes: 6,
    relatedTools: [
      { label: 'DNS Lookup', href: '/dns/lookup' },
      { label: 'Resolver Comparison', href: '/dns/resolvers' },
      { label: 'DNS Health', href: '/dns/analyze' },
    ],
    relatedArticles: ['nameserver-change-checklist', 'domain-not-connecting-to-hosting'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'You changed a DNS record — an A record, MX, TXT or nameservers — but part of the internet still sees the old answer. This guide explains how to verify what is actually published with evidence instead of guesswork.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          'The new value is visible from one network or resolver but not another.',
          'Your own device still resolves the old value after a cache flush.',
          'A third-party "propagation checker" disagrees with your provider dashboard.',
          'Email or website traffic continues to hit the old server.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'The exact record type and name (for example the A record for example.com).',
          'The old value and the new value, exactly as published.',
          'The time (in UTC) the change was made.',
          'The TTL that was configured on the record before the change.',
          'Which nameservers the domain is delegated to.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Query the authoritative nameservers directly',
            detail:
              'Run the DNS Lookup tool. The authoritative answer shows what the provider has actually published right now. If it still shows the old value, the change was never saved to the live zone — waiting will not fix it.',
          },
          {
            title: 'Compare public resolvers',
            detail:
              'Use the Resolver Comparison tool to ask several large public resolvers the same question. Differences are cached answers aging out at different times.',
          },
          {
            title: 'Check the TTL of the surviving old answer',
            detail:
              'A long TTL (for example 86400 seconds) means resolvers may keep serving the old value for up to that long. This is expected behaviour, not a fault.',
          },
          {
            title: 'Confirm delegation has not changed unexpectedly',
            detail:
              'If you changed nameservers, use the DNS Health tool to confirm the new nameservers respond authoritatively and the old ones no longer do.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'Either the authoritative servers already publish the new value (and what you see is resolver caches expiring), or they do not (and the change itself failed). The authoritative answer plus Resolver Comparison distinguishes these cases in one step.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'The record was saved in a draft or staging zone instead of the live one.',
          'The TTL on the old record is long and caches have not expired yet.',
          'Your local device, browser or ISP resolver caches DNS aggressively.',
          'Nameservers were changed but the new provider zone is incomplete.',
          'Two conflicting records exist (for example a leftover AAAA record).',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'If the authoritative answer is correct',
            detail:
              'No further DNS work is needed. Wait for caches to expire; next time, lower the TTL in advance. Local caches can be flushed on your own device.',
          },
          {
            title: 'If the authoritative answer is still the old value',
            detail:
              'Re-apply the change in the DNS provider and verify it was saved in the live zone. If the dashboard shows the new value but the authoritative servers answer with the old one, contact the provider — that is a provider-side fault.',
          },
          {
            title: 'If nameservers were changed',
            detail:
              'Recreate the full record set on the new provider before removing the old zone. An incomplete new zone explains most "broken after nameserver change" cases.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Re-run both tools',
            detail:
              'The authoritative answer and the resolver comparison should now agree on the new value. Re-check after one TTL period to confirm stability.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Lower a record TTL to 300–600 seconds at least a day before a planned change.',
          'Make one change at a time and verify the authoritative answer immediately.',
          'Keep the old zone intact until the new one is verified when changing providers.',
        ],
      },
    ],
  },
  {
    slug: 'nameserver-change-checklist',
    categorySlug: 'dns-and-nameservers',
    title: 'Changing nameservers without breaking your site',
    description:
      'A safe, ordered checklist for moving a domain to new nameservers, and how to verify each step with evidence.',
    readingTimeMinutes: 7,
    relatedTools: [
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'DNS Lookup', href: '/dns/lookup' },
    ],
    relatedArticles: ['dns-propagation-not-updating', 'domain-not-connecting-to-hosting'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'Changing a domain’s nameservers replaces the entire set of servers that answer for it. If the new zone is incomplete, mail stops and websites go offline — often hours later. This checklist prevents that.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          'The website resolves but mail stops shortly after a nameserver change.',
          'Some records exist and others return NXDOMAIN from the new provider.',
          'The old host still shows a zone for the domain, but nothing answers from it.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'The current nameservers and the planned new nameservers.',
          'The full record list from the old provider (A, AAAA, CNAME, MX, TXT, SRV, CAA).',
          'Where email is hosted and which MX records it requires.',
          'Whether SPF, DKIM or DMARC records reference hostnames that must be recreated.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Inventory the old zone first',
            detail:
              'Run the DNS Lookup tool for every record type before changing anything, and save the output. You cannot recreate what you did not record.',
          },
          {
            title: 'Build the new zone completely',
            detail:
              'Recreate every record on the new provider, including SPF, DKIM, DMARC and any CAA records. A missing DMARC record silently weakens your mail policy.',
          },
          {
            title: 'Verify the new zone answers before switching',
            detail:
              'Query the new nameservers directly with the DNS Lookup tool. Most providers answer queries for a zone that is not delegated yet, which lets you validate the copy safely.',
          },
          {
            title: 'Lower TTLs in advance',
            detail:
              'Reduce record TTLs to 300–600 seconds at least a day before the switch so any mistake is reversible quickly.',
          },
          {
            title: 'Switch, then verify delegation',
            detail:
              'Change the nameservers at the registrar, then run the DNS Health tool: the new nameservers must respond authoritatively and the old ones must not.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'A clean migration shows: identical record sets on both providers before the switch, authoritative answers from the new nameservers after it, and mail continuing to flow. Any disagreement between the two zones is a gap to fix before cutover, not after.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'The new zone was copied from a stale or partial export.',
          'DKIM or TXT records were truncated when pasted into the new provider.',
          'The registrar still has old nameservers cached, or the change has not propagated to the registry yet.',
          'Mail-routing records (MX, SPF) were considered “website settings” and left behind.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'If a record is missing after the switch',
            detail:
              'Re-add it from your saved inventory. DKIM selectors and SRV records are the most commonly forgotten.',
          },
          {
            title: 'If mail breaks after the switch',
            detail:
              'Compare the MX and SPF answers on the new zone with your inventory using the SPF Checker and DMARC Checker tools, then restore the missing records.',
          },
          {
            title: 'If the old zone must be revived temporarily',
            detail:
              'Point the nameservers back to the old provider while you fix the new zone. Keep the old zone intact until the new one is verified.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Confirm authoritative answers',
            detail:
              'DNS Health must show the new nameservers answering for the domain, with no dependence on the old set.',
          },
          {
            title: 'Confirm mail authentication',
            detail:
              'Run the SPF, DKIM and DMARC checkers for each sending selector and confirm every record resolves.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Always export the full zone before touching nameservers.',
          'Never let the old zone be deleted on the same day as the switch.',
          'Re-verify email authentication records after every provider move.',
        ],
      },
    ],
  },
  {
    slug: 'domain-not-connecting-to-hosting',
    categorySlug: 'dns-and-nameservers',
    title: 'Domain is not connecting to your hosting',
    description:
      'How to trace a domain-to-hosting connection failure from the registrar, through nameservers, to the web server.',
    readingTimeMinutes: 6,
    relatedTools: [
      { label: 'DNS Lookup', href: '/dns/lookup' },
      { label: 'DNS Health', href: '/dns/analyze' },
    ],
    relatedArticles: ['nameserver-change-checklist', 'ssl-certificate-problems'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'You pointed a domain at your hosting — or hosting at a domain — and the site still does not load. The connection involves three independent steps: registry delegation, DNS records, and the web server itself. Finding which step fails is the whole job.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          'The browser shows a registrar parking page instead of your site.',
          'The site loads with the hosting-provided URL but not with the domain.',
          'Some visitors see the site and others see an error page.',
          'The domain resolves to an IP that is not your server.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'The domain name and the hosting provider.',
          'The IP address or hostname the hosting gave you.',
          'The nameservers currently delegated at the registrar.',
          'Whether HTTPS is expected and how the certificate is issued.',
          'When the record or delegation was last changed.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Check what the domain resolves to',
            detail:
              'Run the DNS Lookup tool for A and AAAA records. This is the factual answer the internet sees — it overrides what any dashboard claims.',
          },
          {
            title: 'Verify the nameservers answer for the domain',
            detail:
              'Run the DNS Health tool. If delegation is wrong, the lookup may answer from a cached or default zone and mislead you.',
          },
          {
            title: 'Compare the resolved IP with your server',
            detail:
              'The A/AAAA answers must match the address your hosting assigned. If they differ, the DNS record points elsewhere and no amount of server work will fix it.',
          },
          {
            title: 'Check the web server response',
            detail:
              'If DNS is correct but the site still fails, the problem is on the server (web server, firewall or application) — a different responsibility than DNS.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'Registry problem: the registrar still points at parking nameservers. DNS problem: nameservers are right but the A/AAAA record is wrong or missing. Hosting problem: DNS is correct and reachable, but the server does not answer. Each case has a different owner — registrar, DNS zone, or hosting provider.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'The domain still uses the registrar’s default parking nameservers.',
          'The A record points to an old host or a placeholder IP.',
          'An AAAA record exists for an IPv6 address the server does not actually serve.',
          'The hosting account has no document root or domain mapping configured yet.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'If delegation is wrong',
            detail:
              'Update the nameservers at the registrar, then follow the nameserver-change checklist to verify the new zone is complete.',
          },
          {
            title: 'If the A/AAAA record is wrong',
            detail:
              'Correct the record in the DNS zone to the hosting IP, with a modest TTL, and verify the authoritative answer.',
          },
          {
            title: 'If DNS is correct but the site fails',
            detail:
              'The issue belongs on the server: check the web server configuration, firewall and application logs on the hosting side.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Confirm end-to-end',
            detail:
              'DNS Lookup shows your hosting IP, DNS Health shows clean delegation, and the site loads over HTTPS from the domain itself.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Change DNS during a low-traffic window with a short TTL pre-set.',
          'Keep one authoritative record set — avoid splitting zones across two providers.',
          'Re-check HTTPS after every hosting move, because certificates are hostname-bound.',
        ],
      },
    ],
  },
  {
    slug: 'spf-dkim-dmarc-basics',
    categorySlug: 'email-authentication',
    title: 'SPF, DKIM and DMARC: what each record actually does',
    description:
      'The three email authentication records, how they interact, and how to inspect each one with Ravelyth.',
    readingTimeMinutes: 8,
    relatedTools: [
      { label: 'SPF Checker', href: '/dns/spf' },
      { label: 'DKIM Checker', href: '/dns/dkim' },
      { label: 'DMARC Checker', href: '/dns/dmarc' },
    ],
    relatedArticles: ['email-delivery-issues', 'dns-propagation-not-updating'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'Mail sent from your domain is rejected, lands in spam, or is spoofed by others. Three DNS records control how receivers judge your mail: SPF (which servers may send), DKIM (which cryptographic key signs it) and DMARC (what happens when the checks fail).',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          'Gmail or Outlook reports “authentication failed” or sends mail to spam.',
          'Headers of a received message show spf=fail, dkim=fail or dmarc=fail.',
          'Your domain receives spoofed mail that claims to come from you.',
          'DMARC aggregate reports show failing sources you do not recognise.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'Every service that sends mail as your domain (mail host, CRM, invoicing, newsletter).',
          'The current SPF record from your DNS zone.',
          'The DKIM selector names your mail host uses (often visible in its admin panel).',
          'The published DMARC policy and any rua reporting address.',
          'Headers of one real received message, showing its authentication results.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Inspect SPF',
            detail:
              'Run the SPF Checker. It parses the v=spf1 record, resolves include chains and flags the classic failure: more than 10 DNS lookups, which causes a permanent error at receivers.',
          },
          {
            title: 'Inspect DKIM per selector',
            detail:
              'Run the DKIM Checker for each selector your mail host publishes. It shows whether the key record exists and is well-formed. Cryptographic verification of a signature is out of scope for the tool — it inspects the published key, not the signed message.',
          },
          {
            title: 'Inspect DMARC',
            detail:
              'Run the DMARC Checker. Confirm the policy (none, quarantine, reject), the alignment settings, and that the percentage tag does not accidentally limit enforcement.',
          },
          {
            title: 'Read the authentication results in real mail',
            detail:
              'Use the Email Header Analyzer on a delivered message to see the actual spf/dkim/dmarc verdicts the receiver computed for your mail.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'SPF fail with a legitimate send usually means a sending service is missing from the record. DKIM fail usually means the selector changed or the key record is missing/truncated. DMARC fail with SPF and DKIM both passing means the passing identities do not align with the From: domain — often caused by third-party senders that need custom alignment setup.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'SPF has too many includes (DNS lookup limit exceeded).',
          'Two SPF records exist for the same name — the second silently invalidates the first.',
          'The DKIM key was rotated on the mail host but the DNS record was never updated.',
          'DMARC alignment fails because a third-party sender signs with its own domain.',
          'DMARC policy is still p=none, so failures are reported but never enforced.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'Fix SPF breadth',
            detail:
              'Consolidate includes, remove dead services, and use IP mechanisms sparingly. Keep the lookup count at or below 10.',
          },
          {
            title: 'Restore DKIM keys',
            detail:
              'Re-publish the key record for the exact selector, unbroken and matching what the mail host reports.',
          },
          {
            title: 'Tighten DMARC gradually',
            detail:
              'Start at p=none with aggregate reports, review who fails, fix those sources, then move to quarantine and finally reject.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Re-run all three checkers',
            detail:
              'SPF passes with a manageable lookup count, every DKIM selector resolves, and DMARC reflects the intended policy.',
          },
          {
            title: 'Verify with real mail',
            detail:
              'Send a message and confirm with the Email Header Analyzer that the receiver computed spf=pass, dkim=pass and dmarc=pass.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Maintain one inventory of all senders for the domain and update SPF when it changes.',
          'Keep DMARC reports enabled (rua) so failures are visible before enforcement.',
          'Re-check authentication records after any change of mail provider.',
        ],
      },
    ],
  },
  {
    slug: 'email-delivery-issues',
    categorySlug: 'email-delivery',
    title: 'Email is not being delivered (bounces and rejections)',
    description:
      'Reading a bounce, locating the failing hop with headers, and separating DNS problems from provider problems.',
    readingTimeMinutes: 8,
    relatedTools: [
      { label: 'Email Header Analyzer', href: '/email/analyze' },
      { label: 'MX records via DNS Lookup', href: '/dns/lookup' },
      { label: 'SPF Checker', href: '/dns/spf' },
    ],
    relatedArticles: ['spf-dkim-dmarc-basics', 'dns-propagation-not-updating'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'Messages from your domain bounce, vanish, or land in the recipient’s spam folder. Delivery is judged at several independent checkpoints — your outgoing server, DNS, the receiving server and the mailbox provider — and each produces its own evidence.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          'A bounce message arrives with a numeric code (for example 550 or 421).',
          'Mail to one provider fails while other recipients receive it.',
          'Mail is delivered but consistently filed in spam.',
          'Outgoing mail queues for hours and is then returned.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'The complete bounce message, including its numeric code and explanation.',
          'Full raw headers of one affected message (never paste private content publicly).',
          'The sending domain and the receiving provider.',
          'Whether the failure affects one recipient or every recipient.',
          'The time (UTC) of a failed attempt.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Classify the bounce code',
            detail:
              '4xx codes are temporary (retry later); 5xx codes are permanent rejections. The code text usually names the failing rule: authentication, rate limit, reputation or non-existent recipient.',
          },
          {
            title: 'Trace the hops with headers',
            detail:
              'Paste the raw headers into the Email Header Analyzer. Follow the Received chain from the newest entry backwards to find where the message last travelled successfully.',
          },
          {
            title: 'Verify the receiving domain’s MX records',
            detail:
              'Use the DNS Lookup tool for MX records of the recipient domain. A missing or stale MX record on their side is not something you can fix, but it explains the failure.',
          },
          {
            title: 'Verify your own authentication',
            detail:
              'Run the SPF, DKIM and DMARC checkers for your sending domain. Authentication failures are the most common cause of silent spam placement.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'Authentication failures (spf/dkim/dmarc) are fixed in your DNS. Temporary 4xx codes usually indicate provider throttling or greylisting — waiting is legitimate. Permanent 5xx rejections that cite policy or reputation belong to the receiving provider; changing your records cannot force delivery. A message that stops mid-way through the Received chain points at the server owning that hop.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'SPF, DKIM or DMARC failures caused by recent record or key changes.',
          'The sending IP is on a blocklist or has a poor provider reputation.',
          'The recipient address no longer exists (hard bounce).',
          'The receiving provider is rate limiting or greylisting your server.',
          'MX records for the recipient domain are wrong or expired.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'If authentication failed',
            detail:
              'Fix the offending record (see the SPF/DKIM/DMARC guide) and re-verify with the checkers before resending.',
          },
          {
            title: 'If the bounce is temporary',
            detail:
              'Let your mail server retry on its schedule. Do not resend the same message manually — it doubles the queue.',
          },
          {
            title: 'If the rejection is policy-based',
            detail:
              'Contact the receiving provider with the bounce code and headers. Ravelyth can diagnose the evidence but cannot override another provider’s policy.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Confirm with a fresh send',
            detail:
              'After any fix, send a new message and analyse its headers: the final delivery should show accepted hops and passing authentication.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Keep an eye on DMARC reports — they reveal failing senders before users complain.',
          'Separate transactional and newsletter sending so one bad stream does not affect the other.',
          'Never paste raw headers with personal data into public channels.',
        ],
      },
    ],
  },
  {
    slug: 'wordpress-500-502-503-errors',
    categorySlug: 'wordpress-websites',
    title: 'WordPress 500, 502 and 503 errors and the white screen',
    description:
      'How to tell which layer fails — PHP, the web server, the database or a plugin — and what to collect for each.',
    readingTimeMinutes: 7,
    relatedTools: [
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'Email Header Analyzer', href: '/email/analyze' },
    ],
    relatedArticles: ['wordpress-login-admin-issues', 'vps-disk-space-full'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'Your WordPress site returns a 500, 502 or 503 error, or a blank white page. These are server-side failures: the browser asked, and something behind the web server did not answer correctly. Note that Ravelyth provides management and troubleshooting for WordPress — not development.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          'The whole site or only wp-admin returns an error page.',
          'The error appeared immediately after a plugin, theme or PHP update.',
          'The page is white with no content (white screen of death).',
          '503 responses also appear for static files, or only intermittently.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'The exact URL that fails and the exact status code shown.',
          'The WordPress version, PHP version and database version.',
          'The last change made (plugin, theme, PHP version, hosting move).',
          'The PHP error log tail from the hosting panel, if accessible.',
          'Whether the database is on the same server or remote.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Read the error class',
            detail:
              '500 is an unhandled PHP/application error. 502 means the web server could not get a valid answer from the backend (PHP process). 503 usually means the backend is overloaded or explicitly unavailable.',
          },
          {
            title: 'Check the PHP error log',
            detail:
              'The log names the exact file and line that failed. Fatal errors from a plugin or theme point to a conflict; memory-exhaustion errors point at resource limits.',
          },
          {
            title: 'Isolate plugins and theme',
            detail:
              'Rename the plugins folder (or deactivate plugins from the dashboard if reachable) and reload. If the site returns, re-enable one by one to find the conflict. Switch to a default theme to test theme conflicts.',
          },
          {
            title: 'Confirm DNS and TLS are not the cause',
            detail:
              'A 5xx page proves the domain reaches a server — DNS is working. If instead the browser shows a certificate or DNS error, use the DNS Health tool first; that is a different problem.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'A fatal error naming a plugin/theme file means an extension conflict. “Allowed memory size exhausted” means a limit needs raising or a runaway query needs fixing. 502/503 with an empty PHP log means the PHP process itself is crashing or the server is out of resources — check disk space and process counts next.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'A plugin or theme incompatible with the current PHP version.',
          'PHP memory or execution-time limits too low for the workload.',
          'A corrupted .htaccess or web-server configuration.',
          'Database connection failure (wrong credentials after a host move).',
          'Disk full or PHP-FPM worker exhaustion on the server.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'Roll back the last change',
            detail:
              'Restore the previous plugin/theme version or PHP version — the fastest safe fix, then upgrade deliberately.',
          },
          {
            title: 'Raise the specific limit',
            detail:
              'If logs show memory exhaustion, increase the PHP memory limit in the hosting panel; if workers are exhausted, reduce load or request more workers.',
          },
          {
            title: 'Repair configuration',
            detail:
              'Regenerate .htaccess (rename it and let WordPress recreate it) and confirm database credentials in wp-config.php.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Exercise the site',
            detail:
              'Load the homepage, one post, wp-admin and a search page. All should return 200 with content and no blank pages.',
          },
          {
            title: 'Watch the logs',
            detail:
              'No new fatal errors should appear in the PHP log during normal use.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Take a backup before every plugin, theme or PHP update.',
          'Update one component at a time on staging or during low traffic.',
          'Keep PHP error logging enabled so the next failure names itself.',
        ],
      },
    ],
  },
  {
    slug: 'wordpress-login-admin-issues',
    categorySlug: 'wordpress-websites',
    title: 'Locked out of WordPress (wp-admin will not let you in)',
    description:
      'Recovering admin access step by step — cookies, passwords, URLs, and what to do when nothing loads.',
    readingTimeMinutes: 6,
    relatedTools: [
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'DNS Lookup', href: '/dns/lookup' },
    ],
    relatedArticles: ['wordpress-500-502-503-errors', 'ssl-certificate-problems'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'You cannot log in to wp-admin: the page reloads without an error, cookies are rejected, or the login URL itself fails. Access problems have a small number of distinct causes and each is testable.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          'The login page reloads with no message and no error.',
          '“Cookies are blocked” appears despite accepting cookies.',
          'Login redirects back to the same page in a loop.',
          'The wp-admin URL returns 404, 500 or redirects to another domain.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'The exact login URL used (including any custom path).',
          'Whether site URL and WordPress URL settings were changed recently.',
          'Whether HTTPS is active and whether the certificate is valid.',
          'Any security plugin that may be limiting logins.',
          'Whether other administrators can log in from other networks.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Rule out URL and HTTPS problems',
            detail:
              'If wp-admin redirects to another domain or http:// loops, the WordPress site URL settings or a certificate problem may be the cause. Verify the domain resolves correctly with the DNS Lookup tool first.',
          },
          {
            title: 'Test with cookies cleared',
            detail:
              'Clear cookies for the domain or use a private window. A stale or malformed cookie causes silent reload loops.',
          },
          {
            title: 'Reset the password at the database level if needed',
            detail:
              'If email password reset does not arrive, an administrator password can be reset from the database using the standard WordPress password-hashing scheme — never by editing plaintext.',
          },
          {
            title: 'Check for security plugins blocking access',
            detail:
              'Rename the security plugin’s folder to deactivate it, then retry. Many lockouts are self-inflicted by failed-attempt lockouts.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'Silent reloads usually mean cookies or a redirect mismatch (http/https, www/non-www). A 404 on wp-admin means a permalink or security-plugin rewrite issue. Redirects to another domain mean the site URL configuration changed. Everything else falls back to credentials and the users table.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'Site URL or WordPress URL changed to a wrong value.',
          'Mixed http/https or www/non-www redirect loops.',
          'A security plugin locked the account after failed attempts.',
          'An administrator account was removed or its role downgraded.',
          'A corrupted login rewrite rule in .htaccess or the web server config.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'Correct the URLs',
            detail:
              'Fix the site URL/WordPress URL values in the database or wp-config.php, and make sure every entry point uses one canonical form.',
          },
          {
            title: 'Deactivate the blocking plugin',
            detail:
              'Rename its folder, regain access, then reconfigure its lockout settings before reactivating.',
          },
          {
            title: 'Create a fresh administrator account',
            detail:
              'Once database access is possible, add a new administrator with a strong password, log in, and remove the temporary account afterwards.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Confirm a clean login',
            detail:
              'Log out fully, clear cookies, and log in again over HTTPS without loops. The dashboard must load normally.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Keep two administrator accounts with current passwords.',
          'Configure lockout settings leniently enough that you cannot lock yourself out.',
          'Take a database backup before changing URL or security settings.',
        ],
      },
    ],
  },
  {
    slug: 'ssl-certificate-problems',
    categorySlug: 'servers-and-ssl',
    title: 'SSL certificate warnings and HTTPS errors',
    description:
      'How to tell an expired certificate from a wrong hostname, a missing chain or a redirect problem, and what to fix in each case.',
    readingTimeMinutes: 8,
    relatedTools: [
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'DNS Lookup', href: '/dns/lookup' },
    ],
    relatedArticles: ['dns-propagation-not-updating', 'domain-not-connecting-to-hosting'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'A browser shows a security warning, or HTTPS fails, while the site may still work over plain HTTP. The cause is usually one of four things: an expired certificate, a certificate issued for the wrong name, an incomplete certificate chain, or a web server configuration problem.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          '“Your connection is not private” with NET::ERR_CERT_DATE_INVALID or ERR_CERT_AUTHORITY_INVALID.',
          'The certificate name does not match the visited hostname.',
          'Works in one browser or network but not in another.',
          'A redirect loop between http:// and https://.',
          'Some page assets load over http:// and trigger mixed-content warnings.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'The exact hostname and the full browser error text.',
          'The certificate issuer and expiry date shown by the browser.',
          'Whether a CDN, reverse proxy or load balancer sits in front of the site.',
          'When the certificate was last issued or renewed.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Confirm the hostname resolves',
            detail:
              'Run the DNS Lookup tool for the exact hostname. An A/AAAA record pointing at the wrong server explains certificates issued for a different host.',
          },
          {
            title: 'Run DNS Health',
            detail:
              'Review nameserver and record findings for anything that changed recently, such as a host migration.',
          },
          {
            title: 'Inspect the certificate directly',
            detail:
              'Click the padlock in the browser and read the issuer, subject names and expiry. Compare the subject names with the hostname you visit.',
          },
          {
            title: 'Test another network',
            detail:
              'A mobile connection (not the office Wi-Fi) shows whether a local proxy or captive portal is interfering.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'If the expiry date is in the past, the certificate needs renewal. If the issuer is unknown to the browser, the chain is incomplete on the server. If the subject names do not include your hostname, the wrong certificate was installed or DNS points at the wrong host. If the certificate looks correct in the browser but the site still fails, the problem is application or redirect configuration rather than the certificate.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'Certificate expired and automatic renewal is not running.',
          'Certificate issued for example.com but the site is visited at www.example.com (or the reverse).',
          'Intermediate certificate missing on the server.',
          'DNS still pointing at the old server after a migration.',
          'Reverse proxy or CDN serving its own certificate edge-side.',
          'HTTP→HTTPS redirect rules configured in two places, creating a loop.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'Renew or reissue the certificate',
            detail:
              'Renew on the server that actually terminates TLS. Make sure the renewal automation (for example a cron-based ACME client) covers every hostname.',
          },
          {
            title: 'Fix hostname coverage',
            detail:
              'Issue a certificate that includes both the apex and www names, or redirect one permanently to the other.',
          },
          {
            title: 'Install the full chain',
            detail:
              'Serve the intermediate certificate(s) together with the leaf certificate so mobile browsers can build the chain.',
          },
          {
            title: 'Correct DNS or proxy target',
            detail:
              'If DNS points at the wrong host, update the A/AAAA record and wait for the TTL, then re-verify.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Re-check in a private window',
            detail:
              'Open the site in a private browsing window and confirm there is no warning and the padlock shows the expected issuer and expiry.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Use automatic renewal (ACME/Let’s Encrypt or your provider’s managed certificates) and monitor expiry.',
          'Keep one canonical hostname and redirect the other.',
          'Re-verify HTTPS after every host or proxy change.',
        ],
      },
    ],
  },
  {
    slug: 'vps-disk-space-full',
    categorySlug: 'servers-and-ssl',
    title: 'VPS disk space is full (or filling fast)',
    description:
      'How to find what is consuming disk on a small VPS, clean it safely, and confirm the underlying cause instead of just deleting files.',
    readingTimeMinutes: 7,
    relatedTools: [
      { label: 'PTR Lookup', href: '/dns/ptr' },
      { label: 'DNS Health', href: '/dns/analyze' },
    ],
    relatedArticles: ['vps-basic-hardening', 'wordpress-500-502-503-errors'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'A VPS runs out of disk space. Services start failing in confusing ways: databases refuse writes, logins break, mail bounces, and websites return 5xx errors. Freeing space fixes the symptom, so the cause must also be found or the problem returns.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms',
        items: [
          '“No space left on device” in logs or on the console.',
          'A database or mail service stops and will not restart.',
          'The site intermittently returns 500 errors.',
          'Backups or uploads fail part-way.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect',
        items: [
          'Provider, plan size (disk and RAM) and operating system.',
          'Output of a disk-usage summary run just before opening the ticket.',
          'Whether growth was gradual or sudden.',
          'Recent changes: new backups, log settings, deployments or imports.',
        ],
      },
      {
        kind: 'code',
        heading: 'Diagnostic steps',
        language: 'shell',
        lines: [
          '# Overall filesystem usage',
          'df -h',
          '',
          '# Biggest directories under the root filesystem',
          'du -xh --max-depth=2 / 2>/dev/null | sort -rh | head -n 20',
          '',
          '# Size of common suspects',
          'du -sh /var/log /var/lib/mysql /var/log/nginx /tmp 2>/dev/null',
          '',
          '# Large deleted-but-open files held by running processes',
          'lsof -nP +L1 2>/dev/null | awk \'$7 > 100000000\' | head',
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'Large /var/log growth points to log rotation that is missing or misconfigured. A large /var/lib/mysql usually means real data growth or accumulated binary logs. Space held by deleted-but-open files means a service still grips a giant log that was removed with rm — a restart releases it. A rapidly filling root disk with no obvious directory often indicates an application writing unbounded output or a runaway backup job.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'Journald or application logs without rotation limits.',
          'Old log rotations retained indefinitely.',
          'Database binary logs or accumulated temporary tables.',
          'A backup job writing into the same disk without retention.',
          'Abandoned package caches after upgrades.',
          'A stuck process holding deleted files open.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'Clean safely, oldest and safest first',
            detail:
              'Truncate (do not rm) active logs the system still writes to, remove package caches with the package manager, and prune old rotated logs beyond a small retention.',
          },
          {
            title: 'Configure rotation limits',
            detail:
              'Set size or time limits in logrotate and journald so growth is capped, then verify the configuration parses.',
          },
          {
            title: 'Restart the affected services',
            detail:
              'Restart services that held deleted files open so their file handles are released and the space is actually freed.',
          },
          {
            title: 'Address the producer',
            detail:
              'If one application generates the bulk of the data (verbose debugging, failed-job retries), reduce its verbosity or fix the failing job.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Confirm usage and service health',
            detail:
              'Run df -h again to confirm meaningful free space (aim for at least 20% free), and confirm every previously failing service is running and accepting requests.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Alert or routinely check disk usage before it reaches 90%.',
          'Cap log growth with rotation everywhere, including journald.',
          'Keep backup retention shorter than the disk can hold.',
        ],
      },
    ],
  },
  {
    slug: 'vps-basic-hardening',
    categorySlug: 'servers-and-ssl',
    title: 'Basic VPS hardening checklist',
    description:
      'A minimal, ordered list of server hygiene steps that stop the most common compromises of small Linux VPS machines.',
    readingTimeMinutes: 8,
    relatedTools: [
      { label: 'PTR Lookup', href: '/dns/ptr' },
      { label: 'DNS Health', href: '/dns/analyze' },
    ],
    relatedArticles: ['vps-disk-space-full', 'ssl-certificate-problems'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'Small VPS machines on the public internet are probed constantly. Most compromises are not sophisticated: weak or reused passwords on SSH, exposed management panels, and unpatched services. This checklist covers the hygiene steps that prevent the majority of incidents, without turning this article into a full security course.',
        ],
      },
      {
        kind: 'list',
        heading: 'Symptoms of a problem already present',
        items: [
          'Unknown processes running or new listening ports.',
          'Auth logs full of successful logins you did not make.',
          'Outbound spam or mail queue growth you cannot explain.',
          'CPU load that stays high with no traffic.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect before changing anything',
        items: [
          'Operating system version and current running services.',
          'Which ports are exposed to the internet.',
          'How administrators currently log in (password or key).',
          'Whether a firewall is configured and what it allows.',
        ],
      },
      {
        kind: 'code',
        heading: 'Diagnostic steps',
        language: 'shell',
        lines: [
          '# Listening services and their addresses',
          'ss -tulpn',
          '',
          '# Recent successful and failed SSH logins',
          'journalctl -u ssh --since "7 days ago" | grep -Ei "accepted|failed" | tail -n 40',
          '',
          '# Firewall status (ufw example)',
          'ufw status verbose',
          '',
          '# Pending security updates',
          'apt list --upgradable 2>/dev/null | head -n 20',
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'Anything listening on 0.0.0.0 that you cannot name is a finding. Password-based SSH logins from unexpected countries, or thousands of failed attempts, indicate that password authentication should be closed. A firewall that allows every port means every vulnerable service is public. A long list of pending security updates means the machine has no update routine.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes',
        items: [
          'SSH password authentication enabled with weak or reused passwords.',
          'Management panels (phpMyAdmin, webmail) exposed publicly.',
          'No firewall, or one that allows all inbound traffic.',
          'Automatic security updates disabled.',
          'Test or default accounts left enabled.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'Add a second admin path before locking anything',
            detail:
              'Create a sudo-capable user and install your SSH key, and keep the provider console available as an emergency path. Never harden yourself out of your own server.',
          },
          {
            title: 'Close SSH password authentication',
            detail:
              'Set PasswordAuthentication no (and PermitRootLogin no) in the SSH configuration, then restart SSH and verify a new session still works before closing your current one.',
          },
          {
            title: 'Allow only needed inbound ports',
            detail:
              'Enable a firewall that permits SSH, HTTP and HTTPS (and mail ports if the server really sends mail) and denies everything else.',
          },
          {
            title: 'Enable security updates',
            detail:
              'Configure unattended upgrades for security channels and verify the service is active.',
          },
          {
            title: 'Remove what you do not use',
            detail:
              'Disable unknown services found listening, and delete default or test accounts.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Re-run the checks',
            detail:
              'ss -tulpn should show only intended services, the firewall should list only intended ports, and a fresh SSH session with your key should succeed while password login is refused.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Review listening ports and auth logs on a schedule.',
          'Keep a second administrator path documented for emergencies.',
          'Patch on a fixed cadence rather than only during incidents.',
        ],
      },
    ],
  },
  {
    slug: 'running-diagnostics-before-support',
    categorySlug: 'using-ravelyth',
    title: 'Running diagnostics before requesting support',
    description:
      'Which Ravelyth tools answer which questions, what the findings mean, and what evidence to attach when you open a support request.',
    readingTimeMinutes: 6,
    relatedTools: [
      { label: 'DNS Health', href: '/dns/analyze' },
      { label: 'DNS Lookup', href: '/dns/lookup' },
      { label: 'Email Header Analyzer', href: '/email/analyze' },
    ],
    relatedArticles: ['dns-propagation-not-updating', 'email-delivery-issues'],
    sections: [
      {
        kind: 'text',
        heading: 'Problem',
        paragraphs: [
          'Most DNS and email incidents can be narrowed down in minutes with evidence, yet support conversations usually start without any. Running the right diagnostic first — and bringing its results — shortens every request, whether you self-solve from the Knowledge Base or open a ticket.',
        ],
      },
      {
        kind: 'list',
        heading: 'Which tool answers which question',
        items: [
          'DNS Lookup — “what records exist right now for this domain?”',
          'DNS Health — “is anything about this domain’s DNS misconfigured or risky?”',
          'SPF / DKIM / DMARC — “are the email authentication records published and internally consistent?”',
          'PTR Lookup — “does this sending IP have a matching reverse record?”',
          'Resolver Comparison — “do public resolvers disagree, i.e. is this still propagating?”',
          'Email Header Analyzer — “which hop or authentication check actually failed for one message?”',
        ],
      },
      {
        kind: 'list',
        heading: 'What Ravelyth findings mean',
        items: [
          'Pass — the evidence checked was found and looks correctly formed.',
          'Info — an observation that may or may not be a problem.',
          'Warning — something that commonly causes failures and deserves review.',
          'Error — evidence of a concrete problem that will break things as configured.',
        ],
      },
      {
        kind: 'list',
        heading: 'Information to collect before a request',
        items: [
          'The exact domain(s) and hostname(s) involved.',
          'When the problem started and what changed just before.',
          'Tool outputs for the checks above, with the time you ran them.',
          'For email: one full raw message header from an affected message.',
          'For websites: the exact error text and the URL it appears on.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Diagnostic steps',
        steps: [
          {
            title: 'Reproduce with evidence',
            detail:
              'Run the tool that matches the symptom and note Pass/Warning/Error findings rather than describing the problem from memory.',
          },
          {
            title: 'Check for a propagation state',
            detail:
              'Use Resolver Comparison to see whether resolvers disagree — if they do, the change simply has not propagated everywhere yet.',
          },
          {
            title: 'Check the Knowledge Base',
            detail:
              'Each tool links to related guides. Many incidents end here, and the article explains how to verify the fix.',
          },
          {
            title: 'Open a request with the evidence attached',
            detail:
              'If you use Managed Support or the public request form, include the tool outputs, the timeline and the exact error text. Never include passwords.',
          },
        ],
      },
      {
        kind: 'text',
        heading: 'Interpretation',
        paragraphs: [
          'Findings are evidence, not verdicts about your provider. An Error finding explains what will break as configured; a Warning describes a common cause worth checking. Where a result depends on data Ravelyth cannot observe — such as mailbox-level filtering or provider-side queues — the tools say so instead of guessing.',
        ],
      },
      {
        kind: 'list',
        heading: 'Possible causes when everything passes',
        items: [
          'The problem lives above DNS: application code, mailbox filters or provider-side queues.',
          'The failure is intermittent and tied to a specific network or recipient.',
          'The change is still within its TTL window on some resolvers.',
        ],
      },
      {
        kind: 'steps',
        heading: 'Resolution',
        steps: [
          {
            title: 'Act on the findings',
            detail:
              'Apply the resolution steps from the matching Knowledge Base article, one change at a time, and record what you changed.',
          },
          {
            title: 'Escalate with context when needed',
            detail:
              'If the findings point to something Ravelyth Managed Support can act on, open a ticket with the diagnostic context attached — the request form lets you link tool results directly.',
          },
        ],
      },
      {
        kind: 'steps',
        heading: 'Verification',
        steps: [
          {
            title: 'Re-run the same tools',
            detail:
              'After a change, re-run the identical diagnostics. The findings that were in Warning/Error should now be Pass or Info.',
          },
        ],
      },
      {
        kind: 'list',
        heading: 'Prevention',
        items: [
          'Re-run DNS Health after every DNS change.',
          'Save important analyses to your account so you can compare before and after.',
          'Keep a short change log of DNS and email configuration edits with timestamps.',
        ],
      },
    ],
  },
];
