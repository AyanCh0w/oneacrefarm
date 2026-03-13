# One Acre Farm — Crop Logger: User Guide

Welcome to the Crop Logger, a tool built specifically for One Acre Farm to help track crop quality, monitor what's been planted, and reduce overplanting over time. This guide walks you through how the app works, what it does with your data, and what you can expect as a user.

---

## What This App Does

The Crop Logger pulls your existing planting data from your Google Sheets spreadsheet (e.g., "What We Planted 2025") and gives you a clean interface to:

- **View your current plantings** organized by field and bed
- **Log quality assessments** for each crop — answering quick questions about crop health and quantity
- **Track replanting** — the app automatically detects when a crop was replaced and flags it with a warning
- **Keep a historical record** of all quality logs over time

The goal is to give you and your team a fast, mobile-friendly way to record crop observations in the field, without needing to open a spreadsheet.

---

## Getting Started

### 1. Sign In

You can sign in with your Google account or with an email and password. Google sign-in is the easiest option since the app also needs to read your Google Sheets.

### 2. Connect Your Spreadsheet

After signing in, you'll go through a short setup flow:

1. The app will ask permission to access your Google Drive (read-only — more on this below)
2. It will show you a list of your Google Spreadsheets
3. Select your planting spreadsheet (e.g., "What We Planted 2025")
4. Choose which sheets (tabs) to sync — typically your field tabs and a "Qualifiers" sheet
5. Hit **Sync** — the app will read that data and store a copy in its database

Once synced, your crop data appears on the dashboard. You can re-sync at any time to pull in updates from your spreadsheet.

### 3. Log Crop Quality

From the dashboard, select a field, then a bed. You'll see the crops in that bed and a form with questions tailored to each crop (e.g., "How does the fruit look?", "Planting quantity?"). Answer the questions and submit. That's it.

---

## How the Data Works

### Your Google Sheets (Read-Only)

When you connect your Google account, the app requests **read-only access** to your Google Drive and Sheets. This means:

- The app can **view** your spreadsheets to import planting data
- The app **cannot edit, delete, or modify** anything in your Google Sheets — ever
- Your original spreadsheet stays exactly as it is

I (the developer) also do **not** have access to your Google Sheets. When you grant the app access to your Google account, that permission is between your Google account and the app — not me personally. I cannot log in and view your spreadsheet.

### The App's Database (Convex)

When you sync a spreadsheet, the app makes a **copy** of that data into its own database (powered by a service called [Convex](https://convex.dev)). This copy is what the app reads from day-to-day — it does not reach back into Google Sheets every time you open the app.

**Important disclosure:** This database is hosted under my (the developer's) account on Convex. That means:

- Your synced planting data and quality logs are stored on infrastructure that I manage
- I have administrative access to that database as the account holder
- I do not actively view or use your data, but technically that access exists

If you ever want a copy of your data (your quality logs, crop records, etc.), **just email me and I'll export it and send it to you.** It's your data and you should always be able to get it.

All other parts of the app — the code, the interface, the API connections — run either in the browser on your device or on Vercel (a web hosting platform). Nothing is stored locally on your phone or computer beyond basic preferences like which spreadsheet you last used.

---

## What the App Reads from Your Spreadsheet

The app is designed to read two types of sheets:

- **Field sheets** — tabs named after your fields (e.g., "Field 3", "HT 1", "Greenhouse"). These contain your planting data: crop name, variety, bed, trays, rows, date planted, and notes.
- **Qualifiers sheet** — a sheet that defines the quality assessment questions for each crop. This is what drives the logging forms.

The app automatically detects:
- **Location type** from the field name — high tunnel (HT), greenhouse, or outdoor field — so it can show the right questions for that context
- **Replanted beds** — if your notes say something like "Tomato replaced with Cucumber", the app flags that bed with a warning icon
- **Multiple crops in one bed** — if a bed has two crops listed (separated by " / "), the app splits them into separate records

---

## Privacy & Data Summary

| What | Who can see it | Notes |
|---|---|---|
| Your Google Sheets | You + the app (read-only) | App cannot edit; I cannot view |
| Synced planting data | You + me (developer, via Convex admin) | Stored in app database |
| Quality logs you submit | You + me (developer, via Convex admin) | Stored in app database |
| Your Google account info | Clerk (sign-in service) | Standard OAuth, not stored by me |

---

## Tips for Best Results

- **Keep your Qualifiers sheet up to date.** The assessment forms are generated from it — if a crop is missing from Qualifiers, you'll get a generic form.
- **Re-sync after updating your spreadsheet.** The app works from its own copy of your data, so changes in Google Sheets won't appear until you sync again.
- **Watch for the warning badge (⚠).** That means a bed was replanted — the original crop is shown underneath the current one.
- **The app is mobile-friendly.** It's designed for use on a phone or tablet while you're walking the fields.

---

## Questions or Issues?

If something isn't working, data looks wrong, or you want a copy of your logged data, reach out directly. This is a small custom tool built for One Acre Farm and support is personal — just send an email.

---

*Built for One Acre Farm. Data stored in Convex under developer account. Google Sheets access is read-only. Your original spreadsheets are never modified.*
