const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export interface SpreadsheetInfo {
  id: string;
  name: string;
  modifiedTime: string;
  ownerName: string;
  ownerEmail: string;
}

interface DriveFilesResponse {
  files?: Array<{
    id?: string;
    name?: string;
    modifiedTime?: string;
    owners?: Array<{
      displayName?: string;
      emailAddress?: string;
    }>;
  }>;
  nextPageToken?: string;
}

interface SpreadsheetMetadata {
  properties?: {
    title?: string;
    locale?: string;
    autoRecalc?: string;
    timeZone?: string;
  };
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
      index?: number;
    };
  }>;
}

interface SpreadsheetData {
  range?: string;
  majorDimension?: string;
  values?: string[][];
}

export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
}

export class GoogleSheetsClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error?.message || `Google Sheets API error: ${response.status}`
      );
    }

    return response.json();
  }

  async getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMetadata> {
    const url = `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties,sheets.properties`;
    return this.fetch<SpreadsheetMetadata>(url);
  }

  async listSpreadsheets(): Promise<SpreadsheetInfo[]> {
    const spreadsheets: SpreadsheetInfo[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: "files(id,name,modifiedTime,owners(displayName,emailAddress)),nextPageToken",
        orderBy: "modifiedTime desc",
        pageSize: "100",
      });

      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const url = `${DRIVE_API_BASE}/files?${params.toString()}`;
      const response = await this.fetch<DriveFilesResponse>(url);

      if (response.files) {
        for (const file of response.files) {
          if (file.id && file.name) {
            const owner = file.owners?.[0];
            spreadsheets.push({
              id: file.id,
              name: file.name,
              modifiedTime: file.modifiedTime || "",
              ownerName: owner?.displayName || "Unknown",
              ownerEmail: owner?.emailAddress || "",
            });
          }
        }
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    return spreadsheets;
  }

  async listSheets(spreadsheetId: string): Promise<SheetInfo[]> {
    const metadata = await this.getSpreadsheetMetadata(spreadsheetId);
    return (
      metadata.sheets?.map((sheet) => ({
        sheetId: sheet.properties?.sheetId ?? 0,
        title: sheet.properties?.title ?? "Untitled",
        index: sheet.properties?.index ?? 0,
      })) ?? []
    );
  }

  async getSpreadsheetData(
    spreadsheetId: string,
    range?: string,
    sheetName?: string
  ): Promise<SpreadsheetData> {
    let rangeParam: string;

    if (sheetName) {
      const escapedSheetName = sheetName.includes(" ")
        ? `'${sheetName}'`
        : sheetName;
      rangeParam = range
        ? `${escapedSheetName}!${range}`
        : `${escapedSheetName}!A:ZZ`;
    } else {
      rangeParam = range || "A:ZZ";
    }

    const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}`;
    return this.fetch<SpreadsheetData>(url);
  }
}
