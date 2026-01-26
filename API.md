# API Documentation

This document describes all API routes in the One Acre Farm Crop Logger application.

## Authentication

All API routes require Clerk authentication. Requests without a valid session return `401 Unauthorized`. Routes that require Google OAuth access will return `400 Bad Request` if no Google account is linked.

---

## GET /api/spreadsheets

Lists all Google Spreadsheets accessible to the authenticated user.

### Input
- **Headers**: Clerk session cookie (automatic)

### Logic
1. Verifies user authentication via Clerk
2. Retrieves Google OAuth access token from Clerk
3. Calls Google Drive API to list spreadsheets (ordered by modified time, descending)
4. Returns spreadsheet metadata

### Output

**Success (200)**
```json
{
  "spreadsheets": [
    {
      "id": "spreadsheet-id",
      "name": "What We Planted 2025",
      "modifiedTime": "2025-01-20T10:30:00Z",
      "ownerName": "John Doe",
      "ownerEmail": "john@example.com"
    }
  ]
}
```

**Errors**
- `401`: User not authenticated
- `400`: No Google account linked to Clerk
- `500`: Failed to fetch spreadsheets

---

## GET /api/sheets/[id]

Fetches data from a specific Google Spreadsheet.

### Input
- **URL Parameter**: `id` - Google Spreadsheet ID
- **Query Parameters**:
  - `range` (optional): Cell range (e.g., "A1:D10")
  - `sheet` (optional): Sheet name to fetch

### Logic
1. Verifies user authentication
2. Retrieves Google OAuth access token
3. Fetches spreadsheet metadata (for name)
4. Fetches sheet data using Google Sheets API
5. If `sheet` param provided, fetches that specific sheet with range "A:ZZ"
6. If `range` param provided, fetches that specific range

### Output

**Success (200)**
```json
{
  "data": [
    ["Bed", "Crop:Variety", "Trays", "Rows", "Date", "Notes"],
    ["A1", "Tomato:Roma", "5", "2", "2025-03-15", "Started indoors"]
  ],
  "spreadsheetName": "What We Planted 2025",
  "sheetName": "Field A"
}
```

**Errors**
- `401`: User not authenticated
- `400`: No Google account linked
- `500`: Failed to fetch spreadsheet data

---

## GET /api/sheets/[id]/list

Lists all sheets (tabs) within a Google Spreadsheet.

### Input
- **URL Parameter**: `id` - Google Spreadsheet ID

### Logic
1. Verifies user authentication
2. Retrieves Google OAuth access token
3. Calls Google Sheets API to get spreadsheet metadata
4. Extracts sheet information from metadata

### Output

**Success (200)**
```json
{
  "spreadsheetId": "spreadsheet-id",
  "spreadsheetName": "What We Planted 2025",
  "sheets": [
    {
      "sheetId": 0,
      "title": "Field A",
      "index": 0
    },
    {
      "sheetId": 123456,
      "title": "Qualifiers",
      "index": 1
    }
  ]
}
```

**Errors**
- `401`: User not authenticated
- `400`: No Google account linked
- `500`: Failed to fetch sheet list

---

## POST /api/sheets/[id]/sync

Syncs a Google Sheet's data to the Convex database.

### Input
- **URL Parameter**: `id` - Google Spreadsheet ID
- **Request Body**:
```json
{
  "sheetName": "Field A"
}
```

### Logic
1. Verifies user authentication
2. Retrieves Google OAuth access token
3. Fetches sheet data from Google Sheets API (range: `{sheetName}!A:ZZ`)
4. Parses raw data into structured crop records:
   - Skips header row (row 0)
   - Skips empty rows
   - Expected column format: `[bed, crop:variety, trays, rows, date, notes]`
   - Splits "Crop:Variety" into separate fields
   - Uses sheet name as field name
5. Calls Convex `syncSheetData` mutation:
   - Creates or updates sheet record
   - Clears existing crops for the field
   - Inserts new crop records

### Data Parsing

Raw row format:
```
["A1", "Tomato:Roma", "5", "2", "2025-03-15", "Started indoors"]
```

Parsed crop object:
```json
{
  "field": "Field A",
  "bed": "A1",
  "crop": "Tomato",
  "variety": "Roma",
  "trays": "5",
  "rows": "2",
  "date": "2025-03-15",
  "notes": "Started indoors"
}
```

### Output

**Success (200)**
```json
{
  "success": true,
  "synced": "Field A",
  "rowCount": 25,
  "cropsCount": 24,
  "convexResult": {
    "success": true,
    "action": "updated",
    "sheetId": "convex-document-id",
    "cropsCount": 24
  }
}
```

**Errors**
- `401`: User not authenticated
- `400`: No Google account linked OR missing sheetName in body
- `500`: Failed to sync sheet data

---

## Convex Functions

### syncSheetData (mutation)

**Location**: `convex/sheets.ts`

**Arguments**:
- `spreadsheetId`: string
- `range`: string
- `data`: string[][] (raw sheet data)
- `parsedData`: CropData[] (optional)

**Logic**:
1. Queries for existing sheet with same spreadsheetId + range
2. If exists: updates with new data and timestamp
3. If not exists: creates new sheet record
4. Extracts field name from range (e.g., "Field A!A:ZZ" → "Field A")
5. Deletes all existing crops for that field
6. Inserts new crops from parsedData

**Returns**:
```json
{
  "success": true,
  "action": "updated" | "created",
  "sheetId": "document-id",
  "cropsCount": 24
}
```

### getAllSheets (query)

Returns all records from the `sheets` table.

### getAllCrops (query)

Returns all records from the `crops` table.

### getCropsByField (query)

**Arguments**: `field`: string

Returns all crops matching the specified field name.

### getUniqueFields (query)

Returns a sorted array of unique field names from all crops.

### getUniqueCrops (query)

Returns a sorted array of unique crop names from all crops.

---

## GoogleSheetsClient

**Location**: `lib/google-sheets.ts`

A utility class for interacting with Google Sheets and Drive APIs.

### Constructor
```typescript
new GoogleSheetsClient(accessToken: string)
```

### Methods

#### listSpreadsheets()
Lists user's spreadsheets via Google Drive API.

**Returns**: `Promise<SpreadsheetInfo[]>`

#### listSheets(spreadsheetId: string)
Lists sheets within a spreadsheet.

**Returns**: `Promise<Array<{ sheetId: number, title: string, index: number }>>`

#### getSpreadsheetData(spreadsheetId: string, range?: string, sheetName?: string)
Fetches cell values from a spreadsheet.

**Returns**: `Promise<string[][] | undefined>`

#### getSpreadsheetMetadata(spreadsheetId: string)
Fetches spreadsheet metadata including title and sheet list.

**Returns**: `Promise<SpreadsheetMetadata>`
