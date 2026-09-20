/**
 * Ravelyth Control — Provider/Reseller/Enterprise tenant foundation.
 *
 * Organizations group users and servers for multi-tenant provider/reseller use.
 * In the default single-tenant deployment, provider features are available
 * but tenant isolation is straightforward. In a future provider deployment,
 * CONTROL_PROVIDER_TENANT_ISOLATION (default true) enables strict per-tenant
 * data scoping enforced server-side.
 *
 * SECURITY: Tenant boundaries are always enforced server-side via organizationId
 * filters on every query. The client can never select or bypass their own scope.
 */

export const PROVIDER_TENANT_MODES = ['single', 'isolated'] as const;
export type ProviderTenantMode = (typeof PROVIDER_TENANT_MODES)[number];

/** Capabilities that an organization/license may grant within Control. */
export const CONTROL_CAPABILITIES = [
  'server_management',
  'license_management',
  'agent_commands',
  'dns_management',
  'ssl_management',
  'database_management',
  'deployment_management',
  'log_access',
  'backup_management',
  'security_scanning',
] as const;
export type ControlCapability = (typeof CONTROL_CAPABILITIES)[number];

/** Default empty capability set. */
export const EMPTY_CAPABILITIES: Record<string, boolean> = {};

/**
 * Scopes a query to a specific organization. All Control queries MUST pass
 * the acting organization's ID through this filter so that provider tenants
 * are isolated from each other.
 */
export function organizationScopeFilter(organizationId: string | null): {
  organizationId: string | null;
} {
  // Even when organizationId is null (default single-tenant), we return it
  // explicitly so callers always apply a WHERE clause that prevents cross-
  // tenant data leakage.
  return { organizationId: organizationId ?? null };
}

/**
 * Validates that a set of capabilities is a subset of known control capabilities.
 */
export function validateCapabilities(
  capabilities: Record<string, unknown>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const cap of CONTROL_CAPABILITIES) {
    if (capabilities[cap] === true) {
      result[cap] = true;
    }
  }
  return result;
}

/**
 * Returns the tenant mode based on config.
 */
export function getProviderTenantMode(isolationEnabled: boolean): ProviderTenantMode {
  return isolationEnabled ? 'isolated' : 'single';
}
