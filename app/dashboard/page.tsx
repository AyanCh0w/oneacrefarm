"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UserButton, UserProfile } from "@clerk/clerk-react";
import { Id } from "@/convex/_generated/dataModel";

interface SheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetNames: string[];
}

interface SyncProgress {
  current: number;
  total: number;
  currentField: string;
  status: "idle" | "syncing" | "complete" | "error";
  error?: string;
}

// Skeleton component
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />
  );
}

// Sync Progress Bar Component
function SyncProgressBar({ progress }: { progress: SyncProgress }) {
  const percentage =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Syncing {progress.current} of {progress.total}
        </span>
        <span className="font-medium">{percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Current field indicator */}
      <div className="flex items-center gap-2">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
        </div>
        <p className="text-sm text-foreground">
          Syncing <span className="font-semibold">{progress.currentField}</span>
          ...
        </p>
      </div>
    </div>
  );
}

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  loading,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    current: 0,
    total: 0,
    currentField: "",
    status: "idle",
  });
  const [selectedLogId, setSelectedLogId] = useState<Id<"qualityLogs"> | null>(null);

  // Convex queries
  const crops = useQuery(api.sheets.getAllCrops);
  const vegetables = useQuery(api.sheets.getAllVegetables);
  const qualityLogs = useQuery(api.sheets.getRecentQualityLogs, { limit: 10 });
  const uniqueFields = useQuery(api.sheets.getUniqueFields);
  const uniqueVarieties = useQuery(api.sheets.getUniqueVarieties);
  const lastSyncTime = useQuery(api.sheets.getLastSyncTime);

  // Load config from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("cropLogger_sheetConfig");
    if (stored) {
      const parsed = JSON.parse(stored) as SheetConfig;
      setConfig(parsed);
    }
    setConfigLoaded(true);
  }, []);

  // Sync all sheets
  const syncAllSheets = useCallback(async () => {
    if (!config || syncProgress.status === "syncing") return;

    const sheetsToSync = config.sheetNames.filter(
      (name) => name.toLowerCase() !== "qualifiers",
    );

    // Always include Qualifiers first
    const allSheets = ["Qualifiers", ...sheetsToSync];

    setSyncProgress({
      current: 0,
      total: allSheets.length,
      currentField: allSheets[0] || "",
      status: "syncing",
    });

    try {
      for (let i = 0; i < allSheets.length; i++) {
        const sheetName = allSheets[i];
        setSyncProgress((prev) => ({
          ...prev,
          current: i,
          currentField: sheetName,
        }));

        const response = await fetch(
          `/api/sheets/${config.spreadsheetId}/sync`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheetName }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to sync ${sheetName}`);
        }

        // Small delay for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      setSyncProgress((prev) => ({
        ...prev,
        current: allSheets.length,
        status: "complete",
      }));

      // Reset to idle after showing complete
      setTimeout(() => {
        setSyncProgress((prev) => ({ ...prev, status: "idle" }));
      }, 2000);
    } catch (error) {
      setSyncProgress((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Sync failed",
      }));
    }
  }, [config, syncProgress.status]);

  // Get selected log details
  const selectedLog = qualityLogs?.find((log) => log._id === selectedLogId);

  // Format last sync time
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return "Never synced";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  // Get unique crop types count
  const uniqueCropTypes = crops
    ? [...new Set(crops.map((c) => c.crop))].length
    : 0;

  // No config - show setup prompt
  if (configLoaded && !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 gap-4">
        <p className="text-muted-foreground">No spreadsheet configured</p>
        <Button onClick={() => router.push("/onboarding")}>
          Setup Spreadsheet
        </Button>
      </div>
    );
  }

  // Loading config
  if (!configLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">{config?.spreadsheetName}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/log-data")}>
              Log Quality Data
            </Button>
            <UserButton></UserButton>
          </div>
        </div>

        {/* Sync Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle>Sync Data</CardTitle>
                {syncProgress.status === "idle" && lastSyncTime !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last synced: {formatLastSync(lastSyncTime)}
                  </p>
                )}
              </div>
              {syncProgress.status === "idle" && (
                <Button onClick={syncAllSheets} size="sm">
                  Sync Now
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {syncProgress.status === "idle" && (
              <div className="text-sm text-muted-foreground">
                <p>
                  Sync your Google Sheets data to update crops and qualifiers.
                </p>
                {config?.sheetNames && config.sheetNames.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {config.sheetNames.map((name) => (
                      <span
                        key={name}
                        className="px-2.5 py-1 bg-muted rounded-md text-xs font-medium"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {syncProgress.status === "syncing" && (
              <SyncProgressBar progress={syncProgress} />
            )}

            {syncProgress.status === "complete" && (
              <div className="flex items-center gap-2 text-green-500">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-medium">Sync complete!</span>
              </div>
            )}

            {syncProgress.status === "error" && (
              <div className="space-y-3">
                <p className="text-red-500 text-sm">{syncProgress.error}</p>
                <Button onClick={syncAllSheets} size="sm" variant="outline">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="Total Crops"
            value={crops?.length ?? 0}
            subtitle={
              uniqueFields ? `${uniqueFields.length} fields` : undefined
            }
            loading={crops === undefined}
          />
          <StatsCard
            title="Crop Types"
            value={uniqueCropTypes}
            subtitle={
              uniqueVarieties
                ? `${uniqueVarieties.length} varieties`
                : undefined
            }
            loading={crops === undefined || uniqueVarieties === undefined}
          />
          <StatsCard
            title="Quality Logs"
            value={qualityLogs?.length ?? 0}
            subtitle="assessments"
            loading={qualityLogs === undefined}
          />
          <StatsCard
            title="Fields"
            value={uniqueFields?.length ?? 0}
            loading={uniqueFields === undefined}
          />
        </div>

        {/* Recent Logs */}
        {qualityLogs && qualityLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Quality Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {qualityLogs.slice(0, 5).map((log) => (
                  <button
                    key={log._id}
                    onClick={() => setSelectedLogId(log._id)}
                    className="w-full flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded px-2 -mx-2 transition-colors cursor-pointer text-left"
                  >
                    <div>
                      <p className="font-medium">
                        {log.crop}
                        {log.variety && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            ({log.variety})
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.field} - Bed {log.bed}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.assessmentDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.responses.length} responses
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quality Log Detail Dialog */}
        <Dialog open={selectedLogId !== null} onOpenChange={(open) => !open && setSelectedLogId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedLog && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl">
                    {selectedLog.crop}
                    {selectedLog.variety && (
                      <span className="text-muted-foreground font-normal ml-2">
                        ({selectedLog.variety})
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    Logged on {new Date(selectedLog.assessmentDate).toLocaleDateString()} at{" "}
                    {new Date(selectedLog.assessmentDate).toLocaleTimeString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Location Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">Field</span>
                      <span className="font-medium">{selectedLog.field}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">Bed</span>
                      <span className="font-medium">{selectedLog.bed || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">Planted</span>
                      <span className="font-medium">{selectedLog.datePlanted || "—"}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">Trays</span>
                      <span className="font-medium">{selectedLog.trays || "—"}</span>
                    </div>
                  </div>

                  {/* Planting Notes */}
                  {selectedLog.plantingNotes && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Planting Notes</h3>
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                        {selectedLog.plantingNotes}
                      </p>
                    </div>
                  )}

                  {/* Assessment Responses */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Assessment Responses</h3>
                    <div className="space-y-3">
                      {selectedLog.responses.map((response, index) => (
                        <div key={index} className="border border-border rounded-lg p-3">
                          <p className="text-sm font-medium mb-1">{response.question}</p>
                          <p className="text-sm text-muted-foreground bg-primary/10 rounded px-2 py-1 inline-block">
                            {response.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Log Notes */}
                  {selectedLog.logNotes && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Additional Notes</h3>
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                        {selectedLog.logNotes}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Empty state for logs */}
        {qualityLogs &&
          qualityLogs.length === 0 &&
          crops &&
          crops.length > 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                No quality logs yet. Start logging crop assessments!
              </p>
              <Button onClick={() => router.push("/log-data")}>
                Log Quality Data
              </Button>
            </Card>
          )}

        {/* No data state */}
        {crops && crops.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No crops synced yet. Click &quot;Sync Now&quot; to import your
              data from Google Sheets.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
