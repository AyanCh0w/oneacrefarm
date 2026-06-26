import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { GoogleSheetsClient } from "@/lib/google-sheets";
import { isApproved } from "@/lib/auth";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isApproved())) {
      return NextResponse.json({ error: "Account not approved" }, { status: 403 });
    }

    const provider = "google";
    const client = await clerkClient();
    const clerkResponse = await client.users.getUserOauthAccessToken(
      userId,
      provider,
    );

    const accessToken = clerkResponse.data[0]?.token;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Google account not connected",
          message: "Please sign in with Google to access your spreadsheets",
        },
        { status: 400 },
      );
    }

    const sheetsClient = new GoogleSheetsClient(accessToken);
    const spreadsheets = await sheetsClient.listSpreadsheets();

    return NextResponse.json({ spreadsheets });
  } catch (error) {
    console.error("Error listing spreadsheets:", error);

    return NextResponse.json(
      {
        error: "Failed to list spreadsheets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
