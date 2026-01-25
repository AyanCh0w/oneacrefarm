import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { GoogleSheetsClient } from "@/lib/google-sheets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: spreadsheetId } = await params;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Spreadsheet ID is required" },
        { status: 400 },
      );
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
          message: "Please sign in with Google to access your sheets",
        },
        { status: 400 },
      );
    }

    const sheetsClient = new GoogleSheetsClient(accessToken);
    const sheets = await sheetsClient.listSheets(spreadsheetId);
    const metadata = await sheetsClient.getSpreadsheetMetadata(spreadsheetId);

    return NextResponse.json({
      spreadsheetId,
      spreadsheetName: metadata.properties?.title || "Untitled",
      sheets,
    });
  } catch (error) {
    console.error("Error listing sheets:", error);

    return NextResponse.json(
      {
        error: "Failed to list sheets",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
