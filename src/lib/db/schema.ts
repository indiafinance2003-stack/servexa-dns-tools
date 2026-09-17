import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';

/**
 * Users. Email is stored normalized (lowercase, trimmed) and unique at the
 * database level. Passwords are only ever stored as Argon2id hashes.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_unique_idx').on(table.email),
  ]
);

/**
 * Server-side sessions. Only a SHA-256 hash of the session token is stored;
 * the raw token lives exclusively in an HttpOnly cookie.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique_idx').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ]
);

/**
 * Saved analyses. Only explicitly user-initiated saves are stored. Raw email
 * headers are never persisted; email analysis is intentionally not saveable.
 */
export const savedAnalyses = pgTable(
  'saved_analyses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    analysisType: text('analysis_type').notNull(),
    target: text('target').notNull(),
    resultJson: jsonb('result_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('saved_analyses_user_id_created_at_idx').on(table.userId, table.createdAt),
  ]
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type SavedAnalysisRow = typeof savedAnalyses.$inferSelect;

/** ---------------------------------------------------------------------------
 * Support tickets
 * --------------------------------------------------------------------------- */

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reference: text('reference').notNull().unique(),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    priority: text('priority').notNull().default('normal'),
    status: text('status').notNull().default('open'),
    affectedDomain: text('affected_domain'),
    relatedTool: text('related_tool'),
    notifyEmail: text('notify_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('support_tickets_user_id_idx').on(table.userId),
    index('support_tickets_user_id_status_idx').on(table.userId, table.status),
    index('support_tickets_reference_idx').on(table.reference),
  ]
);

/** ---------------------------------------------------------------------------
 * Support messages
 * --------------------------------------------------------------------------- */

export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    authorRole: text('author_role').notNull(),
    body: text('body').notNull(),
    isInternal: boolean('is_internal').notNull().default(false),
    internalNote: text('internal_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('support_messages_ticket_id_created_at_idx').on(table.ticketId, table.createdAt),
  ]
);

/** ---------------------------------------------------------------------------
 * Knowledge base categories
 * --------------------------------------------------------------------------- */

export const kbCategories = pgTable(
  'kb_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('kb_categories_slug_unique_idx').on(table.slug)]
);

/** ---------------------------------------------------------------------------
 * Knowledge base articles
 * --------------------------------------------------------------------------- */

export const kbArticles = pgTable(
  'kb_articles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => kbCategories.id, { onDelete: 'restrict' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('published'),
    body: text('body').notNull(),
    bodyJson: jsonb('body_json'),
    relatedTools: jsonb('related_tools'),
    relatedArticles: jsonb('related_articles'),
    featured: boolean('featured').notNull().default(false),
    readingTimeMinutes: integer('reading_time_minutes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    index('kb_articles_category_id_idx').on(table.categoryId),
    index('kb_articles_category_slug_idx').on(table.categoryId, table.slug),
    index('kb_articles_status_idx').on(table.status),
    index('kb_articles_published_at_idx').on(table.publishedAt),
  ]
);

/** ---------------------------------------------------------------------------
 * Managed support subscriptions
 * --------------------------------------------------------------------------- */

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('none'),
    plan: text('plan').notNull().default('managed_support'),
    pricePerCycle: integer('price_per_cycle'),
    currency: text('currency').notNull().default('INR'),
    billingInterval: text('billing_interval').notNull().default('monthly'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    providerSubscriptionId: text('provider_subscription_id'),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subscriptions_user_id_unique_idx').on(table.userId),
    index('subscriptions_status_idx').on(table.status),
  ]
);

/** ---------------------------------------------------------------------------
 * Invoices
 * --------------------------------------------------------------------------- */

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invoiceNumber: text('invoice_number').notNull(),
    status: text('status').notNull().default('pending'),
    amount: integer('amount'),
    currency: text('currency').notNull().default('INR'),
    description: text('description'),
    providerInvoiceId: text('provider_invoice_id'),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invoices_user_id_invoice_number_unique_idx').on(table.userId, table.invoiceNumber),
    index('invoices_user_id_status_idx').on(table.userId, table.status),
    index('invoices_user_id_created_at_idx').on(table.userId, table.createdAt),
  ]
);

/** ---------------------------------------------------------------------------
 * Customer notifications
 * --------------------------------------------------------------------------- */

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_id_read_created_at_idx').on(table.userId, table.read, table.createdAt),
    index('notifications_user_id_created_at_idx').on(table.userId, table.createdAt),
  ]
);

/** ---------------------------------------------------------------------------
 * Exported types
 * --------------------------------------------------------------------------- */

export type SupportTicketRow = typeof supportTickets.$inferSelect;
export type SupportMessageRow = typeof supportMessages.$inferSelect;
export type KbCategoryRow = typeof kbCategories.$inferSelect;
export type KbArticleRow = typeof kbArticles.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

/** Support ticket category options. */
export const SUPPORT_CATEGORIES = [
  'dns',
  'email',
  'website',
  'ssl_tls',
  'domain',
  'hosting',
  'security',
  'other',
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/** Support ticket priority options. */
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high'] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

/** Support ticket status options. */
export const SUPPORT_STATUSES = ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

/** Subscription status options. */
export const SUBSCRIPTION_STATUSES = ['none', 'trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Invoice status options. */
export const INVOICE_STATUSES = ['pending', 'paid', 'void', 'uncollectible'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Notification types. */
export const NOTIFICATION_TYPES = [
  'ticket_created',
  'ticket_reply',
  'ticket_status_changed',
  'subscription_created',
  'subscription_status_changed',
  'invoice_issued',
  'invoice_paid',
  'account',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
