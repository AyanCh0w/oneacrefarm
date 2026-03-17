import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const linkButtonBase =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-transparent px-2.5 text-sm font-medium transition-all";
const defaultLinkButton = `${linkButtonBase} bg-primary text-primary-foreground`;
const outlineLinkButton = `${linkButtonBase} border-border bg-background hover:bg-muted hover:text-foreground`;
const secondaryLinkButton = `${linkButtonBase} bg-secondary text-secondary-foreground hover:bg-secondary/80`;

const quickStartSteps = [
  {
    title: "Sign in",
    description:
      "Use Google or email/password to access the app. Google sign-in is the simplest option when you also need spreadsheet access.",
  },
  {
    title: "Connect your spreadsheet",
    description:
      "Choose your planting spreadsheet, select the field tabs and Qualifiers tab, then sync to bring that data into the app.",
  },
  {
    title: "Log crop quality",
    description:
      "Pick a field and bed, answer the crop-specific questions, and save your observations from the field.",
  },
];

const appFeatures = [
  "View current plantings by field and bed",
  "Log quality assessments with crop-specific questions",
  "Track replanting with automatic warning badges",
  "Keep a historical record of quality logs over time",
];

const spreadsheetReads = [
  "Field sheets such as Field 3, HT 1, or Greenhouse for planting data",
  "The Qualifiers sheet for crop-specific assessment questions",
  "Field names to detect whether a crop is in a field, greenhouse, or high tunnel",
  "Notes that mention replanted beds or multiple crops in a single bed",
];

const tips = [
  "Keep the Qualifiers sheet up to date so forms show the right questions.",
  "Re-sync after editing Google Sheets because the app reads from its synced copy.",
  "Watch for warning badges on replanted beds so you can spot crop changes quickly.",
  "Use the app on a phone or tablet while walking the fields for faster logging.",
];

const privacyCards = [
  {
    title: "Google Sheets",
    visibility: "You + the app",
    notes:
      "Access is read-only. The app can import data, but it cannot edit or delete your spreadsheet.",
  },
  {
    title: "Synced planting data",
    visibility: "You + developer admin access",
    notes:
      "Stored in Convex so the app can load quickly without reading Google Sheets every time.",
  },
  {
    title: "Quality logs",
    visibility: "You + developer admin access",
    notes:
      "Saved in the app database so you can track observations over time.",
  },
  {
    title: "Sign-in information",
    visibility: "Handled by Clerk",
    notes:
      "Authentication runs through Clerk using standard account and OAuth flows.",
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                Crop Logger Guide
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  Help for using the One Acre Farm dashboard
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  This guide explains what the app does, how data gets synced,
                  what happens when you log crop quality, and what to expect
                  from permissions and privacy.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard" className={outlineLinkButton}>
                Back to Dashboard
              </Link>
              <Link href="/log-data" className={defaultLinkButton}>
                Log Data
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {appFeatures.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-muted-foreground"
              >
                <span className="font-medium text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Getting started</CardTitle>
              <CardDescription>
                The normal setup flow from first sign-in through your first
                quality log.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quickStartSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-medium">{step.title}</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>
                Jump straight to the part of the app you need.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/dashboard"
                className={cn(outlineLinkButton, "w-full justify-center")}
              >
                Open dashboard
              </Link>
              <Link
                href="/log-data"
                className={cn(defaultLinkButton, "w-full justify-center")}
              >
                Start logging
              </Link>
              <Link
                href="/analytics"
                className={cn(secondaryLinkButton, "w-full justify-center")}
              >
                View analysis and sync tools
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>How the data works</CardTitle>
              <CardDescription>
                The app reads from a synced copy of your spreadsheet data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                When you connect your Google account, the app requests read-only
                access to Google Drive and Sheets. That allows it to import
                planting data, but it cannot edit, delete, or modify your
                original spreadsheet.
              </p>
              <p>
                After a sync, the app works from its own Convex database copy of
                that data. This is what keeps the interface fast and lets your
                team view crops and logs without re-reading Google Sheets every
                time a page opens.
              </p>
              <p>
                If your spreadsheet changes, run a sync again so the dashboard
                reflects the newest planting information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What the app reads</CardTitle>
              <CardDescription>
                These signals drive the dashboard, forms, and warnings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {spreadsheetReads.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Privacy and access</CardTitle>
            <CardDescription>
              A plain-language summary of what is stored where.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {privacyCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-border/60 bg-muted/20 p-4"
              >
                <p className="text-sm font-semibold">{card.title}</p>
                <p className="mt-2 text-sm text-primary">{card.visibility}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {card.notes}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Tips for best results</CardTitle>
              <CardDescription>
                Small habits that make logging faster and more accurate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tips.map((tip) => (
                <div
                  key={tip}
                  className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm leading-6 text-muted-foreground"
                >
                  {tip}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need support?</CardTitle>
              <CardDescription>
                This is a custom tool for One Acre Farm, so support is direct and
                personal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                Reach out if something looks wrong, if a sync does not behave as
                expected, or if you want a copy of your crop or quality log
                data.
              </p>
              <p>
                Your original Google Sheets remain untouched by the app. The app
                only imports data so the team can work from a cleaner field
                interface.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/dashboard" className={outlineLinkButton}>
                  Return to dashboard
                </Link>
                <Link href="/analytics" className={secondaryLinkButton}>
                  Manage sync settings
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
