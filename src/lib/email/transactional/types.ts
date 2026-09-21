import 'server-only';

/**
 * Provider-neutral transactional email interface.
 *
 * The application deliberately does not hard-code a provider: no email may be
 * sent until an operator registers a real provider and sets EMAIL_PROVIDER /
 * EMAIL_FROM. A new provider is added by implementing this interface and
 * registering it in `provider.ts`.
 */
export interface EmailSendInput {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: EmailSendInput): Promise<void>;
}