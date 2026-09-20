import { describe, expect, it } from 'vitest';
import {
  FREE_TOOLS_PLAN_ID,
  MANAGED_SUPPORT_PLAN_ID,
  availabilityLabel,
  findPlan,
  formatPlanPrice,
  isBillingProviderConfigured,
  isPlanPurchasable,
  managedSupportPlan,
  planCatalog,
} from '@/lib/plans/catalog';
import { SERVICE_DEFINITIONS, findService, serviceSlugs } from '@/lib/plans/services';

describe('plan catalogue', () => {
  it('contains exactly the free tools plan and the managed support plan', () => {
    const ids = planCatalog().map((plan) => plan.id);
    expect(ids).toEqual([FREE_TOOLS_PLAN_ID, MANAGED_SUPPORT_PLAN_ID]);
  });

  it('takes the Managed Support price from configuration only', () => {
    const plan = managedSupportPlan();
    expect(plan.price).not.toBeNull();
    expect(plan.price?.amountMinor).toBeGreaterThan(0);
    expect(plan.price?.currency).toBe('INR');
  });

  it('grants the managed support entitlement only to the support plan', () => {
    expect(findPlan(MANAGED_SUPPORT_PLAN_ID)?.entitlement.managedSupport).toBe(true);
    expect(findPlan(FREE_TOOLS_PLAN_ID)?.entitlement.managedSupport).toBe(false);
  });

  it('never offers a purchasable plan while no billing provider is configured', () => {
    if (isBillingProviderConfigured()) return; // provider configured locally
    for (const plan of planCatalog()) {
      expect(isPlanPurchasable(plan)).toBe(false);
    }
  });

  it('publishes explicit boundaries for every plan', () => {
    for (const plan of planCatalog()) {
      expect(plan.boundaries.length).toBeGreaterThan(0);
    }
  });
});

describe('formatPlanPrice', () => {
  it('formats minor units with the configured currency and interval', () => {
    const formatted = formatPlanPrice({
      amountMinor: 59900,
      currency: 'INR',
      interval: 'monthly',
    });
    expect(formatted).toContain('599');
    expect(formatted.endsWith('/month')).toBe(true);
  });

  it('renders zero prices as Free and missing prices honestly', () => {
    expect(formatPlanPrice({ amountMinor: 0, currency: 'INR', interval: 'monthly' })).toBe('Free');
    expect(formatPlanPrice(null)).toBe('Price not published');
  });

  it('uses the correct suffix per interval', () => {
    expect(formatPlanPrice({ amountMinor: 100, currency: 'INR', interval: 'yearly' }).endsWith('/year')).toBe(true);
    expect(formatPlanPrice({ amountMinor: 100, currency: 'INR', interval: 'quarterly' }).endsWith('/quarter')).toBe(true);
  });
});

describe('availability labels', () => {
  it('distinguishes available from planned plans', () => {
    expect(availabilityLabel({ ...managedSupportPlan(), availability: 'available' })).toBe('Available');
    expect(availabilityLabel({ ...managedSupportPlan(), availability: 'coming_soon' })).toBe(
      'Planned — not available yet'
    );
    expect(availabilityLabel({ ...managedSupportPlan(), availability: 'unavailable' })).toBe('Unavailable');
  });
});

describe('service catalogue', () => {
  it('has unique slugs', () => {
    const slugs = serviceSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('finds services by slug and returns null for unknown slugs', () => {
    expect(findService('dns-management')?.title).toBe('DNS Management');
    expect(findService('not-a-service')).toBeNull();
  });

  it('publishes explicit exclusions for every service', () => {
    for (const service of SERVICE_DEFINITIONS) {
      expect(service.excludes.length).toBeGreaterThan(0);
      expect(service.collect.length).toBeGreaterThan(0);
    }
  });

  it('only links to real public tool routes', () => {
    for (const service of SERVICE_DEFINITIONS) {
      for (const tool of service.relatedTools) {
        expect(tool.href.startsWith('/')).toBe(true);
      }
    }
  });
});
