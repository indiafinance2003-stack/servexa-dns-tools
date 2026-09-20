import { config } from '@/lib/config';

/**
 * Central plan catalogue.
 *
 * Commercial values (price, currency, interval, quarterly/yearly pricing) are
 * configuration, not code: `config` holds the single default for the Managed
 * Support price. Nothing in the application should hard-code a price again.
 *
 * Implementation status is explicit on every plan so that a "foundation"
 * (architecture only) is never presented to a customer as a purchasable
 * product:
 *   - `availability: 'available'`   → can be requested/used today
 *   - `availability: 'coming_soon'` → architecture exists, nothing to buy
 *   - `availability: 'unavailable'` → not part of the public product
 */

export type BillingInterval = 'monthly' | 'quarterly' | 'yearly';
export type PlanAvailability = 'available' | 'coming_soon' | 'unavailable';
export type PlanStatus = 'active' | 'draft' | 'retired';

export interface PlanPrice {
  /** Integer minor units (paise for INR). Never a float. */
  amountMinor: number;
  currency: string;
  interval: BillingInterval;
}

export interface PlanLimits {
  /** Maximum simultaneously open support tickets (null = not limited). */
  maxOpenTickets: number | null;
  /** Domains included in the plan (null = not defined yet). */
  includedDomains: number | null;
  /** Servers included in the plan (null = not defined yet). */
  includedServers: number | null;
  /** Target first-response time in hours (null = not committed yet). */
  responseTargetHours: number | null;
}

export interface PlanEntitlement {
  /** Unlocks Managed Support tickets in the customer portal. */
  managedSupport: boolean;
  /** Unlocks a Ravelyth Control licence (Part 3 architecture). */
  controlLicense: boolean;
}

export interface PlanDefinition {
  id: string;
  name: string;
  summary: string;
  description: string;
  /** null = no price is published for this plan. */
  price: PlanPrice | null;
  features: string[];
  limits: PlanLimits;
  entitlement: PlanEntitlement;
  availability: PlanAvailability;
  status: PlanStatus;
  /** Honest boundary notes shown to customers (what the plan does NOT cover). */
  boundaries: string[];
}

export const FREE_TOOLS_PLAN_ID = 'free_tools';
export const MANAGED_SUPPORT_PLAN_ID = 'managed_support';

/**
 * Whether online purchasing is possible right now. Derived from the configured
 * billing provider, so the UI never shows a checkout that cannot complete and
 * never reports a payment that did not happen.
 */
export function isBillingProviderConfigured(): boolean {
  return config.BILLING_PROVIDER.length > 0;
}

/** Human label for the configured billing provider, or null when none. */
export function billingProviderLabel(): string | null {
  return config.BILLING_PROVIDER || null;
}

export function managedSupportPrice(): PlanPrice {
  return {
    amountMinor: config.MANAGED_SUPPORT_PRICE_MINOR,
    currency: config.MANAGED_SUPPORT_CURRENCY,
    interval: config.MANAGED_SUPPORT_BILLING_INTERVAL,
  };
}

export function managedSupportPlan(): PlanDefinition {
  return {
    id: MANAGED_SUPPORT_PLAN_ID,
    name: 'Ravelyth Managed Support',
    summary: 'Hands-on technical support for DNS, email, WordPress and basic VPS operations.',
    description:
      'A monthly Managed Support agreement covering DNS, email, WordPress and basic server operations performed by Ravelyth, with a support ticket queue in your customer portal.',
    price: managedSupportPrice(),
    features: [
      'DNS setup, record changes and DNS migration assistance',
      'A / AAAA / CNAME / MX / TXT / NS / SRV / CAA troubleshooting',
      'Nameserver changes and DNS propagation investigation',
      'SPF, DKIM and DMARC configuration and troubleshooting',
      'Business email setup (Gmail / Google Workspace / Outlook) and MX problems',
      'SMTP, delivery, bounce and rejection investigation',
      'WordPress management and troubleshooting (errors, plugins, themes, PHP, SSL)',
      'VPS basics: disk and log cleanup, service checks, small configuration fixes',
      'Web server and SSL/TLS troubleshooting',
      'Support tickets in the customer portal with diagnostics context',
      'Knowledge Base troubleshooting guides',
    ],
    limits: {
      maxOpenTickets: config.SUPPORT_MAX_OPEN_TICKETS,
      includedDomains: null,
      includedServers: null,
      responseTargetHours: null,
    },
    entitlement: { managedSupport: true, controlLicense: false },
    availability: 'available',
    status: 'active',
    boundaries: [
      'Management and troubleshooting only — not application, theme or plugin development.',
      'No guaranteed fix time and no guaranteed outcome for issues outside Ravelyth control.',
      'No major infrastructure redesign, complex deployments or advanced DevOps projects.',
      'No unlimited work: each request must relate to the supported DNS, email, WordPress or basic VPS scope.',
      'Third-party provider outages and provider-side limitations are diagnosed, not overridden.',
    ],
  };
}

export function freeToolsPlan(): PlanDefinition {
  return {
    id: FREE_TOOLS_PLAN_ID,
    name: 'Free Diagnostic Tools',
    summary: 'All public DNS and email diagnostic tools, no account required.',
    description:
      'Every Ravelyth diagnostic tool is free and usable without an account. Creating an account only adds saved analyses; it does not include Managed Support.',
    price: { amountMinor: 0, currency: config.MANAGED_SUPPORT_CURRENCY, interval: 'monthly' },
    features: [
      'DNS lookup and DNS health analysis',
      'SPF, DKIM and DMARC inspection',
      'PTR lookup and resolver comparison',
      'Email header analysis',
      'Public Knowledge Base troubleshooting guides',
    ],
    limits: {
      maxOpenTickets: 0,
      includedDomains: null,
      includedServers: null,
      responseTargetHours: null,
    },
    entitlement: { managedSupport: false, controlLicense: false },
    availability: 'available',
    status: 'active',
    boundaries: [
      'A free account does NOT include Managed Support or a support queue.',
      'No cryptographic DKIM verification and no live SPF authorization test.',
    ],
  };
}

/** Full catalogue. Only plans describing real, current offerings belong here. */
export function planCatalog(): PlanDefinition[] {
  return [freeToolsPlan(), managedSupportPlan()];
}

export function findPlan(id: string): PlanDefinition | null {
  return planCatalog().find((plan) => plan.id === id) ?? null;
}

/**
 * Formats a plan price for display using the plan's own currency, so a plan
 * change never leaves a stale symbol in the UI.
 */
export function formatPlanPrice(price: PlanPrice | null): string {
  if (!price) return 'Price not published';
  if (price.amountMinor === 0) return 'Free';
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: 2,
  });
  const suffix =
    price.interval === 'monthly' ? '/month' : price.interval === 'quarterly' ? '/quarter' : '/year';
  return `${formatter.format(price.amountMinor / 100)}${suffix}`;
}

/**
 * Whether a plan can be purchased through the website right now. Managed
 * Support requires a configured billing provider; without one the UI must
 * route the customer to contact instead of a checkout that cannot complete.
 */
export function isPlanPurchasable(plan: PlanDefinition): boolean {
  if (plan.status !== 'active' || plan.availability !== 'available') return false;
  if (!plan.price || plan.price.amountMinor === 0) return false;
  if (plan.entitlement.managedSupport) return isBillingProviderConfigured();
  return false;
}

/** Availability wording used across public pages. */
export function availabilityLabel(plan: PlanDefinition): string {
  switch (plan.availability) {
    case 'available':
      return 'Available';
    case 'coming_soon':
      return 'Planned — not available yet';
    default:
      return 'Unavailable';
  }
}
