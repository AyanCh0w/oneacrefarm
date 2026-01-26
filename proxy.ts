import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/api/(.*)",
]);

const isPendingRoute = createRouteMatcher(["/pending-approval"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // If accessing protected routes, require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // If user is signed in, check if they're approved
  if (userId) {
    const isApproved = sessionClaims?.metadata?.approved === true;
    const isAdmin = sessionClaims?.metadata?.role === "admin";

    // Admins are always approved
    if (isAdmin) {
      if (isPendingRoute(req)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    // Not approved and trying to access protected route
    if (!isApproved && isProtectedRoute(req)) {
      return NextResponse.redirect(new URL("/pending-approval", req.url));
    }

    // Approved user on pending page, redirect to dashboard
    if (isApproved && isPendingRoute(req)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
