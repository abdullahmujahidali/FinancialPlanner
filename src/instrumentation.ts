import * as Sentry from "@sentry/nextjs";

/**
 * Server error reporting.
 *
 * Off until SENTRY_DSN is set (Vercel → Settings → Environment Variables), so
 * local dev and preview builds stay silent. Server-only on purpose: the app
 * ships almost no client JS, and the failures that hurt — a 500 after the two
 * databases drifted apart — happen on the server.
 *
 * This is a family's money, so nothing identifying leaves: no cookies (the
 * session token lives there), no default PII, no performance tracing.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Sentry 11 collects all of these by default; a form post here is someone's
    // salary or a loan, so none of it goes.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "referer"] }, response: false },
      httpBodies: [],
      urlQueryParams: false
    },
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
      }
      return event;
    }
  });
}

/** Every server-side render, route and server action error. A no-op without a DSN. */
export const onRequestError = Sentry.captureRequestError;
