import { ConvexHttpClient } from "convex/browser";

let convexHttpClient: ConvexHttpClient | null = null;

export function getConvexHttpClient() {
  if (!convexHttpClient) {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    }

    convexHttpClient = new ConvexHttpClient(convexUrl);
  }

  return convexHttpClient;
}
