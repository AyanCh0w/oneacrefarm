import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

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

    // Get spreadsheet ID from params
    const { id: spreadsheetId } = await params;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Spreadsheet ID is required" },
        { status: 400 },
      );
    }

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

    // Fetch file metadata from Google Drive API
    const url = `${DRIVE_API_BASE}/files/${spreadsheetId}?fields=modifiedTime,name`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `Google Drive API error: ${response.status}`
      );
    }

    const data = await response.json();

    return NextResponse.json({
      modifiedTime: data.modifiedTime,
      name: data.name,
    });
  } catch (error) {
    console.error("Error fetching spreadsheet metadata:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch spreadsheet metadata",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
