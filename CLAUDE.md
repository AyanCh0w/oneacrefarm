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
└── utils.ts                     # cn() utility for Tailwind
```

## Database Schema (Convex)

### sheets table
Stores raw synced sheet data:
- `spreadsheetId`: string
- `range`: string (e.g., "FieldName!A:ZZ")
- `data`: string[][] (raw values)
- `parsedData`: CropData[] (optional)
- `lastSynced`: number (timestamp)

### crops table
Stores parsed crop records:
- `field`, `bed`, `crop`, `variety`, `trays`, `rows`, `date`, `notes`: string
- `lastSynced`: number (timestamp)

## Current Features (V1 Progress)

### Implemented
- Google Sheets integration (list, read, sync)
- User authentication with Google OAuth
- Onboarding flow to connect spreadsheets
- Field sheet syncing to Convex
- Dashboard displaying Qualifiers sheet data
- Real-time sync progress indicators
- Dark mode by default

### Pending
- Field-based data entry forms
- Crop quality assessment UI
- Data visualization/charts

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
- Clerk keys (configured via Clerk dashboard)

## V2 Features (Future)

- GPS coordinates
- Image capture
- Machine learning analysis
- Predictive modeling
- Scenario-based analysis
