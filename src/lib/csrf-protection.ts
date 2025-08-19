/**
 * Simple CSRF protection for API endpoints
 * In production, consider using a more robust CSRF protection library
 */

import { headers } from "next/headers";

/**
 * Check for CSRF protection headers
 * This is a simple implementation - in production, use proper CSRF tokens
 */
export function validateCSRFHeaders(): boolean {
  const headersList = headers();

  // Check for custom header that indicates intentional API call
  const customHeader = headersList.get("x-requested-with");
  const origin = headersList.get("origin");
  const referer = headersList.get("referer");

  // Allow requests with custom header (common CSRF protection pattern)
  if (customHeader === "XMLHttpRequest" || customHeader === "fetch") {
    return true;
  }

  // Check origin/referer for same-origin requests
  if (origin || referer) {
    const allowedOrigins = [
      process.env.NEXTAUTH_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      "http://localhost:3000", // Development
      "https://localhost:3000", // Development with HTTPS
    ].filter(Boolean);

    const requestOrigin = origin || (referer ? new URL(referer).origin : null);

    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      return true;
    }
  }

  // For development, be more lenient
  if (process.env.NODE_ENV === "development") {
    console.warn("CSRF validation bypassed in development mode");
    return true;
  }

  return false;
}

/**
 * Log CSRF validation attempts
 */
export function logCSRFAttempt(
  valid: boolean,
  ip: string,
  userAgent: string,
  email?: string,
) {
  const headersList = headers();
  const origin = headersList.get("origin");
  const referer = headersList.get("referer");
  const customHeader = headersList.get("x-requested-with");

  console.log(`[CSRF] ${valid ? "VALID" : "INVALID"} request`, {
    ip,
    userAgent,
    email,
    origin,
    referer,
    customHeader,
    timestamp: new Date().toISOString(),
  });
}
