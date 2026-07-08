import { NextResponse } from "next/server";

/**
 * Liveness/version check for this UI deployment — mirrors
 * unitprep-api's GET /health. Useful for confirming exactly which
 * frontend build is actually serving a given environment.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    version:
      process.env
        .NEXT_PUBLIC_APP_VERSION ??
      "unknown",
  });
}
