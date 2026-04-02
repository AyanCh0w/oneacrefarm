# One Acre Farm - Crop Logger

## Project Overview

A crop quality tracking and data collection application for One Acre Farm to reduce overplanting and monitor crop quality over time. Integrates with Google Sheets to sync existing planting data.

## Tech Stack

- **Framework**: Next.js 16.1.4 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (OKLCH color space)
- **UI Components**: shadcn/ui (Base UI variant)
- **Database**: Convex
- **Authentication**: Clerk (Email + Password, Google OAuth)
- **Google Integration**: googleapis for Sheets/Drive API
- **Icons**: Hugeicons, Lucide React
- **Maps**: Mapbox GL JS, react-map-gl
- **Deployment**: Vercel

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
app/
├── api/
│   ├── spreadsheets/route.ts    # List user's Google Spreadsheets
│   └── sheets/[id]/
│       ├── route.ts             # Get spreadsheet data
│       ├── list/route.ts        # List sheets in spreadsheet
│       └── sync/route.ts        # Sync sheet to Convex
├── dashboard/page.tsx           # Main dashboard view
├── onboarding/page.tsx          # Spreadsheet setup flow
├── page.tsx                     # Landing page
├── layout.tsx                   # Root layout with providers
├── providers.tsx                # Convex provider setup
└── globals.css                  # Tailwind v4 styles

components/
├── map.tsx                      # Mapbox GL map component
└── ui/                          # shadcn/ui components
    ├── button.tsx
    ├── card.tsx
    ├── combobox.tsx
    ├── input.tsx
    ├── input-group.tsx
    ├── label.tsx
    ├── select.tsx
    └── textarea.tsx

convex/
├── schema.ts                    # Database schema (sheets, crops)
└── sheets.ts                    # Convex functions (queries, mutations)

lib/
├── google-sheets.ts             # GoogleSheetsClient class
├── parse-qualifiers.ts          # Qualifiers sheet parser
└── utils.ts                     # cn() utility for Tailwind
```

## Database Schema (Convex)

### sheets table
Stores raw synced sheet data:
- `spreadsheetId`: string
- `range`: string (e.g., "FieldName!A:ZZ")
- `data`: string[][] (raw values)
- `parsedData`: CropData[] (optional, includes location and replanting info)
- `lastSynced`: number (timestamp)

### crops table
Stores parsed crop records:
- `field`: string - Field name (e.g., "Field 3", "HT 1")
- `bed`: string - Bed identifier
- `crop`: string - Crop name (singular, e.g., "Tomato")
- `variety`: string - Variety name
- `trays`: string - Number of trays planted
- `rows`: string - Number of rows
- `date`: string - Planting date
- `notes`: string - Planting notes
- `location`: string (optional) - Auto-detected location type ("HT", "greenhouse", "field")
- `replantedFrom`: object (optional) - Tracks replanting history
  - `crop`: string - Original crop name
  - `variety`: string - Original variety
  - `date`: string - Original planting date
  - `notes`: string - Replanting notes (e.g., "Tomato replaced with Cucumber")
- `lastSynced`: number (timestamp)
- **Indexes**: `by_field`, `by_bed`, `by_crop`, `by_field_and_bed`

### qualifiers table
Defines quality assessments for specific crops and locations:
- `name`: string - Base crop name (e.g., "Tomato", "Cucumber")
- `location`: string (optional) - Location specifier ("HT", "field", "greenhouse")
  - Enables location-specific qualifiers (e.g., "Tomatoes, HT" vs "Tomatoes, field")
- `assessments`: array of objects
  - `name`: string - Assessment question (crop-specific only)
  - `options`: array of strings - Possible answers
- `lastSynced`: number (timestamp)
- **Indexes**: `by_name`, `by_name_and_location`
- **Note**: Universal assessments (that apply to all crops) are stored in the `universalQualifiers` table

### universalQualifiers table
Global assessments that apply to all crops (edit once, applies everywhere):
- `name`: string - Assessment question (e.g., "Planting quantity?")
- `options`: array of strings - Possible answers
- `order`: number - Display order (lower numbers first)
- `lastSynced`: number (timestamp)
- **Indexes**: `by_order`
- **Note**: These are automatically extracted from Qualifiers sheet during sync
  - Assessments that appear in ALL crops are identified as universal
  - They are stored separately to avoid duplication
  - Combined with crop-specific qualifiers when displaying forms

### qualityLogs table
Tracks crop quality assessments over time:
- `cropId`: Id<"crops"> - Reference to crop
- `field`: string - Field name
- `bed`: string - Bed identifier
- `crop`: string - Crop name
- `variety`: string - Variety name
- `assessments`: array of objects - User responses
  - `question`: string
  - `answer`: string
- `notes`: string (optional) - Additional notes
- `timestamp`: number - When logged
- **Indexes**: `by_crop_id`, `by_timestamp`, `by_field_and_bed`

## Special Parsing Features

### Multi-Crop Bed Support
Beds can contain multiple crops separated by " / " in the Crop:Variety column:
- Example: `"Cucumber: Mini Me / Cucumber: Tasty Green"` with trays `"1 / 0.2"`
- Parser creates separate crop records for each entry
- Trays are split proportionally, or first value is used if counts don't match

### Replanting Detection
Automatically detects replanting information from notes field:
- **Patterns recognized**:
  - `"Tomato replaced with Cucumber"` - Captures original crop
  - `"Tomato: Roma replaced with Cucumber: Mini Me"` - Captures original crop + variety
  - `"replanted with Cucumber"` - Notes replanting without original
  - `"replaced by Cucumber in June"` - Alternative phrasing
- Stores original crop info in `replantedFrom` field
- UI displays ⚠ warning badges on replanted crops

### Location Auto-Detection
Field names are analyzed to determine location type:
- **"HT"** - High tunnel (patterns: "HT", "High Tunnel", "HighTunnel")
- **"greenhouse"** - Greenhouse (patterns: "Greenhouse", "GH")
- **"field"** - Outdoor field (patterns: "Field", or default)
- Location is stored in `crops.location` field
- Enables location-specific qualifier matching

### Qualifier Matching Logic
When showing assessments for a crop:
1. Extract base crop name (before ":") from crop field
2. Detect location from field name
3. Try to match qualifier by `name + location` (e.g., "Tomatoes, HT")
4. Fall back to generic qualifier with no location
5. Combine with universal assessments (DEPRECATED - will use universalQualifiers table)

**Note**: Crops use SINGULAR names (e.g., "Tomato"), Qualifiers may use PLURAL (e.g., "Tomatoes"). Ensure naming consistency or add both versions.

## Current Features (V1 Progress)

### Implemented
- Google Sheets integration (list, read, sync)
- User authentication with Google OAuth
- Onboarding flow to connect spreadsheets
- Field sheet syncing to Convex
- Dashboard displaying Qualifiers sheet data
- Real-time sync progress indicators
- Dark mode by default
- Multi-crop bed parsing
- Replanting detection and tracking
- Location-based qualifier matching
- Universal qualifiers system (separate table, edit once applies everywhere)
- Field-based data entry forms
- Crop quality assessment UI

### Pending
- Data visualization/charts
- Analytics dashboard

## Business Context

### Goals
- Reduce overplanting of crops
- Track timeline of crop quality
- Sync form data and crop locations with Google Sheets

### Existing Data
- Spreadsheet: "What We Planted 2025" containing:
  - Crop type
  - Field locations (with code names)
  - Date planted
  - Quantity

## Data Flow

```
Google Sheets → /api/spreadsheets (list)
             → /api/sheets/[id]/list (sheets)
             → /api/sheets/[id]/sync (sync data)
             → Convex (storage)
             → Dashboard (display)
```

## Code Conventions

- Use shadcn/ui components (Base UI variant) for consistent UI
- Follow Next.js App Router patterns
- Keep components mobile/tablet friendly with large touch targets
- Minimize required typing in forms (use dropdowns, buttons, etc.)
- Use Hugeicons as primary icon library
- Store user preferences in localStorage
- All API routes require Clerk authentication

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox public access token
- Clerk keys (configured via Clerk dashboard)

## V2 Features (Future)

- GPS coordinates
- Image capture
- Machine learning analysis
- Predictive modeling
- Scenario-based analysis
