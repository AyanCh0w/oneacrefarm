import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { GoogleSheetsClient } from "@/lib/google-sheets";
import { parseQualifiersSheet } from "@/lib/parse-qualifiers";
import { isAdmin } from "@/lib/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Parse sheet data into structured crop records
function parseSheetData(
  data: string[][],
  sheetName: string
): Array<{
  field: string;
  bed: string;
  crop: string;
  variety: string;
  trays: string;
  rows: string;
  date: string;
  notes: string;
}> {
  if (data.length === 0) return [];

  // Skip header row
  const rows = data.slice(1);
  const parsedData = [];

  for (const row of rows) {
    const [bed, cropVariety, trays, rowsCount, date, notes] = row;

    // Skip empty rows
    if (!bed && !cropVariety) continue;

    // Parse crop:variety format (e.g., "Tomato:Roma" or just "Tomato")
    let crop = "";
    let variety = "";
    if (cropVariety?.includes(":")) {
      [crop, variety] = cropVariety.split(":").map((s) => s.trim());
    } else {
      crop = cropVariety || "";
    }

    if (crop.trim()) {
      parsedData.push({
        field: sheetName,
        bed: bed || "",
        crop: crop.trim(),
        variety: variety.trim(),
        trays: trays || "",
        rows: rowsCount || "",
        date: date || "",
        notes: notes || "",
      });
    }
  }

  return parsedData;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can sync spreadsheet data
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required to sync data" },
        { status: 403 }
      );
    }

    const { id: spreadsheetId } = await params;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Spreadsheet ID is required" },
        { status: 400 }
      );
    }

    // Get sheet name from request body
    const body = await request.json();
    const { sheetName } = body;

    if (!sheetName) {
      return NextResponse.json(
        { error: "Sheet name is required" },
        { status: 400 }
      );
    }

    // Get Google OAuth token from Clerk
    const provider = "google";
    const client = await clerkClient();
    const clerkResponse = await client.users.getUserOauthAccessToken(
      userId,
      provider
    );

    const accessToken = clerkResponse.data[0]?.token;

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Google account not connected",
          message: "Please sign in with Google to access your sheets",
        },
        { status: 400 }
      );
    }

    // Fetch sheet data
    const sheetsClient = new GoogleSheetsClient(accessToken);
    const data = await sheetsClient.getSpreadsheetData(
      spreadsheetId,
      undefined,
      sheetName
    );

    const values = data.values || [];

    // Convert all cells to strings
    const stringValues = values.map((row) =>
      row.map((cell) => String(cell ?? ""))
    );

    // Check if this is the Qualifiers sheet
    const isQualifiersSheet = sheetName.toLowerCase() === "qualifiers";

    if (isQualifiersSheet) {
      // Parse Qualifiers data
      const qualifiers = parseQualifiersSheet(stringValues);

      // Sync qualifiers to Convex
      const qualifiersResult = await convex.mutation(api.sheets.syncQualifiers, {
        qualifiers,
      });

      // Also store raw sheet data
      const sheetResult = await convex.mutation(api.sheets.syncSheetData, {
        spreadsheetId,
        range: `${sheetName}!A:ZZ`,
        data: stringValues,
      });

      return NextResponse.json({
        success: true,
        synced: true,
        rowCount: stringValues.length,
        qualifiersCount: qualifiersResult.count,
        qualifiers: qualifiersResult.results,
        sheetResult,
      });
    }

    // Parse field data (non-Qualifiers sheets)
    const parsedData = parseSheetData(stringValues, sheetName);

    // Sync to Convex
    const convexResult = await convex.mutation(api.sheets.syncSheetData, {
      spreadsheetId,
      range: `${sheetName}!A:ZZ`,
      data: stringValues,
      parsedData,
    });

    return NextResponse.json({
      success: true,
      synced: true,
      rowCount: stringValues.length,
      cropsCount: convexResult.cropsCount,
      convexResult,
    });
  } catch (error) {
    console.error("Error syncing sheet data:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check if the error is due to sheet not found (renamed or deleted)
    const isSheetNotFound =
      errorMessage.includes("Unable to parse range") ||
      errorMessage.includes("is not a valid range") ||
      errorMessage.includes("Requested entity was not found");

    if (isSheetNotFound) {
      return NextResponse.json(
        {
          error: "Sheet not found",
          code: "SHEET_NOT_FOUND",
          message: `The requested sheet was not found. It may have been renamed or deleted.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to sync sheet data",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
