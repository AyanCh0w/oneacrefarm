# One Acre Farm - Crop Logger

## Project Overview

A crop quality tracking and data collection application for One Acre Farm to reduce overplanting and monitor crop quality over time.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Database**: Convex
- **Authentication**: Clerk (Email + Password, Google)
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
app/              # Next.js App Router pages
convex/           # Convex backend (schema, functions)
public/           # Static assets
components/       # React components (to be created)
```

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

## MVP (V1) Requirements

### Data Collection

- Field-based location tracking (labeled by field names from farm map)
- Qualitative crop assessment per vegetable group:
  - Size: measured in cm or inches (not small/medium/large)
  - Color: red, yellow, green, brown
  - Additional assessment items: TBD per vegetable group (Sophia to provide)

### UI Requirements

- Large buttons for field use
- Limited typing required
- Mobile/tablet friendly (primary device: tablet with internet)
- Browser-based data entry

### Data Storage

- Cloud-based table format (Convex)
- Future: sync with master Excel spreadsheet

### Data Output

- Dashboard to display collected data

## V2 Features (Future)

### Data Collection

- GPS coordinates
- Image capture

### Data Processing

- Machine learning analysis

### Data Output

- Predictive modeling
- Scenario-based analysis

## Code Conventions

- Use shadcn/ui components for consistent UI
- Follow Next.js App Router patterns
- Keep components mobile/tablet friendly with large touch targets
- Minimize required typing in forms (use dropdowns, buttons, etc.)
