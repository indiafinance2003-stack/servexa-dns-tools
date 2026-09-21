import 'server-only';
import { config } from '@/lib/config';
import type { EmailProvider } from './types';

/**
 * Registered transactional email providers.
 *
 * Empty by default: no provider is invented. EMAIL_PROVIDER must exactly match
 * a registered provider name before any email can be delivered. Connect a real
 * provider (e.g. an SMTP or HTTP transactional API) by registering it here.
 *
 * Registered providers must never embed credentials: secrets always come from
 * the environment through `config`, exactly like the Razorpay integration.
 */
const registeredProviders: Record<string, EmailProvider> = {};

export function registerEmailProvider(provider: EmailProvider): void {
  registeredProviders[provider.name] = provider;
}

/**
 * Resolves the configured provider, or null when EMAIL_PROVIDER is empty or
 * does not match a registered provider. Credentials are never exposed.
 */
export function getEmailProvider(): EmailProvider | null {
  if (!config.EMAIL_PROVIDER) return null;
  return registeredProviders[config.EMAIL_PROVIDER] ?? null;
}

export interface EmailProviderStatus {
  /** True only when a provider is selected AND registered. */
  configured: boolean;
  /** The raw EMAIL_PROVIDER value when set (safe to log; never a secret). */
  configuredProvider: string | null;
  /** True when a provider name is set but no matching implementation exists. */
  unsupported: boolean;
}

/**
 * Precise delivery-availability report used for honest operational logging.
 * `EMAIL_FROM` must also be present before delivery is possible.
 */
export function emailProviderStatus(): EmailProviderStatus {
  const providerName = config.EMAIL_PROVIDER;
  if (!providerName || !config.EMAIL_FROM) {
    return { configured: false, configuredProvider: providerName || null, unsupported: false };
  }
  const provider = registeredProviders[providerName];
  return {
    configured: provider !== undefined,
    configuredProvider: providerName,
    unsupported: provider === undefined,
  };
}