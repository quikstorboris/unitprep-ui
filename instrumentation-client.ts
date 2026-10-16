import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentryOptions";

// Browser-side error reporting; a no-op without NEXT_PUBLIC_SENTRY_DSN.
Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
