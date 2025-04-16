import { NextResponse, NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);

  // Add the absolute URL as x-url header
  requestHeaders.set("x-url", request.url);

  // Return the response with the modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/game/:path*"],
};
