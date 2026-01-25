import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { GoogleSheetsClient } from "@/lib/google-sheets";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sheet ID from params
    const { id: spreadsheetId } = await params;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Sheet ID is required" },
        { status: 400 },
      );
    }

    // Get range and sheet from query params (optional)
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || undefined;
    const sheetName = searchParams.get("sheet") || undefined;

    // Get Google OAuth token from Clerk
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

    // Fetch sheet data using Google Sheets client
    const sheetsClient = new GoogleSheetsClient(accessToken);
    const data = await sheetsClient.getSpreadsheetData(spreadsheetId, range, sheetName);

    // Also fetch metadata to get spreadsheet name
    const metadata = await sheetsClient.getSpreadsheetMetadata(spreadsheetId);
    const spreadsheetName = metadata.properties?.title || "Untitled";

    return NextResponse.json({
      data: {
        ...data,
        spreadsheetName,
        sheetName: sheetName || "Sheet1",
      },
    });
  } catch (error) {
    console.error("Error in sheet data API:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch sheet data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
