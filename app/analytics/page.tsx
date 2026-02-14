"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUser } from "@clerk/nextjs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetNames: string[];
  adminUserId?: string;
  adminEmail?: string;
}

interface SyncProgress {
  current: number;
  total: number;
  currentField: string;
  status: "idle" | "syncing" | "complete" | "error";
  error?: string;
}

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatWeekLabel(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useUser();

  // Get shared settings from Convex
  const settings = useQuery(api.sheets.getSettings);
  const updateSettingsSheetNames = useMutation(
    api.sheets.updateSettingsSheetNames,
  );

  // Derive config from Convex settings
  const config: SheetConfig | null = useMemo(
    () =>
      settings
        ? {
            spreadsheetId: settings.spreadsheetId,
            spreadsheetName: settings.spreadsheetName,
            sheetNames: settings.sheetNames,
            adminUserId: settings.adminUserId,
            adminEmail: settings.adminEmail,
          }
        : null,
    [settings],
  );

  // Config is loaded when settings query has returned (even if null)
  const configLoaded = settings !== undefined;
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    current: 0,
    total: 0,
    currentField: "",
    status: "idle",
  });

  // Dialog states
  const [showChangeSpreadsheetDialog, setShowChangeSpreadsheetDialog] =
    useState(false);
  const [showNoChangesDialog, setShowNoChangesDialog] = useState(false);
  const [sheetLastModified, setSheetLastModified] = useState<string | null>(
    null,
  );
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [selectedCropFilter, setSelectedCropFilter] = useState("all");
  const [selectedFieldFilter, setSelectedFieldFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);

  // Check if user is admin (using Clerk publicMetadata)
  const isAdmin = user?.publicMetadata?.role === "admin";

  // Convex queries and mutations
  const lastSyncTime = useQuery(api.sheets.getLastSyncTime);
  const analyticsFilters = useMemo(
    () => ({
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
      crop: selectedCropFilter === "all" ? undefined : selectedCropFilter,
      field: selectedFieldFilter === "all" ? undefined : selectedFieldFilter,
    }),
    [startDateFilter, endDateFilter, selectedCropFilter, selectedFieldFilter],
  );
  const analytics = useQuery(api.sheets.getAnalyticsOverview, analyticsFilters);
  const deleteSheetByField = useMutation(api.sheets.deleteSheetByField);

  // Fetch spreadsheet last modified time
  const fetchSpreadsheetMetadata = useCallback(async () => {
    if (!config?.spreadsheetId) return;

    setIsLoadingMetadata(true);
    try {
      const response = await fetch(
        `/api/sheets/${config.spreadsheetId}/metadata`,
      );
      if (response.ok) {
        const data = await response.json();
        setSheetLastModified(data.modifiedTime);
      }
    } catch (error) {
      console.error("Failed to fetch spreadsheet metadata:", error);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [config?.spreadsheetId]);

  // Fetch metadata on load and after sync
  useEffect(() => {
    if (config?.spreadsheetId) {
      fetchSpreadsheetMetadata();
    }
  }, [config?.spreadsheetId, fetchSpreadsheetMetadata]);

  // Check if sheet has changes since last sync
  const hasChangesSinceLastSync = useCallback(() => {
    if (!sheetLastModified || !lastSyncTime) return true;
    const modifiedTime = new Date(sheetLastModified).getTime();
    return modifiedTime > lastSyncTime;
  }, [sheetLastModified, lastSyncTime]);

  const topCropData = analytics?.byCrop.slice(0, 8) ?? [];
  const weeklyData = analytics?.logsByWeek ?? [];
  const planningByCropData =
    analytics?.planning.byCrop.slice(0, 8).map((row) => ({
      crop: row.crop,
      under: -row.underRate,
      onTarget: row.onTargetRate,
      over: row.overRate,
      samples: row.total,
    })) ?? [];
  const planningTrendData =
    analytics?.planning.trend.map((row) => ({
      weekStart: row.weekStart,
      balance: row.balance,
      underRate: row.underRate,
      overRate: row.overRate,
    })) ?? [];
  const planningPieData = analytics
    ? [
        { name: "Underplanned", value: analytics.planning.underCount },
        { name: "On target", value: analytics.planning.onTargetCount },
        { name: "Overplanned", value: analytics.planning.overCount },
      ].filter((item) => item.value > 0)
    : [];

  const hasActiveFilters =
    selectedCropFilter !== "all" ||
    selectedFieldFilter !== "all" ||
    startDateFilter.length > 0 ||
    endDateFilter.length > 0;
  const shouldShowCropCharts = selectedCropFilter === "all";

  // Sync all sheets
  const syncAllSheets = useCallback(async () => {
    if (!config || syncProgress.status === "syncing") return;

    const sheetsToSync = config.sheetNames.filter(
      (name) => name.toLowerCase() !== "qualifiers",
    );

    // Always include Qualifiers first
    const allSheets = ["Qualifiers", ...sheetsToSync];
    const removedSheets: string[] = [];

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
          const errorData = await response.json().catch(() => ({}));

          // Check if sheet was not found (renamed or deleted)
          if (response.status === 404 && errorData.code === "SHEET_NOT_FOUND") {
            console.log(
              `Sheet "${sheetName}" not found, removing from database...`,
            );

            // Delete the sheet data from the database
            await deleteSheetByField({
              spreadsheetId: config.spreadsheetId,
              fieldName: sheetName,
            });

            // Track removed sheets to update config later
            removedSheets.push(sheetName);

            // Continue to next sheet
            continue;
          }

          throw new Error(`Failed to sync ${sheetName}`);
        }

        // Small delay for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Update Convex settings if any sheets were removed
      if (removedSheets.length > 0) {
        const updatedSheetNames = config.sheetNames.filter(
          (name) => !removedSheets.includes(name),
        );
        await updateSettingsSheetNames({ sheetNames: updatedSheetNames });
      }

      setSyncProgress((prev) => ({
        ...prev,
        current: allSheets.length,
        status: "complete",
      }));

      // Refresh metadata after sync
      fetchSpreadsheetMetadata();

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
  }, [
    config,
    syncProgress.status,
    fetchSpreadsheetMetadata,
    deleteSheetByField,
    updateSettingsSheetNames,
  ]);

  // Handle sync button click
  const handleSyncClick = useCallback(() => {
    if (!hasChangesSinceLastSync()) {
      setShowNoChangesDialog(true);
    } else {
      syncAllSheets();
    }
  }, [hasChangesSinceLastSync, syncAllSheets]);

  // Handle change spreadsheet
  const handleChangeSpreadsheet = () => {
    localStorage.removeItem("cropLogger_sheetConfig");
    router.push("/onboarding");
  };

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
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  // Format last modified time (ISO string)
  const formatLastModified = (isoString: string | null) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  // No config - show setup prompt (admin) or waiting message (non-admin)
  if (configLoaded && !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 gap-4">
        {isAdmin ? (
          <>
            <p className="text-muted-foreground">No spreadsheet configured</p>
            <Button onClick={() => router.push("/onboarding")}>
              Setup Spreadsheet
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-center">
              No spreadsheet has been configured yet.
              <br />
              Please wait for an admin to set up the spreadsheet.
            </p>
          </>
        )}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">{config?.spreadsheetName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFiltersPanel((prev) => !prev)}
            >
              {showFiltersPanel ? "Hide Filters" : "Filters"}
            </Button>
            <Button variant="ghost" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Collapsible filters */}
        {showFiltersPanel && (
          <Card>
            <CardHeader>
              <CardTitle>Interactive Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Crop</label>
                  <select
                    value={selectedCropFilter}
                    onChange={(e) => setSelectedCropFilter(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="all">All crops</option>
                    {(analytics?.filters.cropOptions ?? []).map((crop) => (
                      <option key={crop} value={crop}>
                        {crop}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Field</label>
                  <select
                    value={selectedFieldFilter}
                    onChange={(e) => setSelectedFieldFilter(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="all">All fields</option>
                    {(analytics?.filters.fieldOptions ?? []).map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Start date</label>
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">End date</label>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedCropFilter("all");
                      setSelectedFieldFilter("all");
                      setStartDateFilter("");
                      setEndDateFilter("");
                    }}
                    disabled={!hasActiveFilters}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
              {hasActiveFilters && (
                <p className="text-xs text-muted-foreground">
                  Showing filtered analytics across all charts.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {analytics === undefined ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading analytics...</p>
          </Card>
        ) : analytics.totals.totalLogs === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No quality logs yet. Add entries from Log Data to populate analytics.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Total Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{analytics.totals.totalLogs}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Active Crops
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {analytics.totals.uniqueCrops}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Planning Sample
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {analytics.planning.sampleSize}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Planning Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {formatPercent(analytics.planning.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Under minus over
                  </p>
                </CardContent>
              </Card>
            </div>

            <div
              className={`grid grid-cols-1 gap-6 ${
                shouldShowCropCharts ? "lg:grid-cols-2" : ""
              }`}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Logs Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis
                          dataKey="weekStart"
                          tickFormatter={formatWeekLabel}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(value) =>
                            `Week of ${formatWeekLabel(String(value))}`
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="logsCount"
                          name="Logs"
                          stroke={CHART_COLORS[0]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {shouldShowCropCharts && (
                <Card>
                  <CardHeader>
                    <CardTitle>Logs by Crop</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topCropData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="value" name="Logs" fill={CHART_COLORS[1]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {!shouldShowCropCharts && (
              <p className="text-xs text-muted-foreground">
                Crop-level charts are hidden while a specific crop filter is selected.
              </p>
            )}

            <div
              className={`grid grid-cols-1 gap-6 ${
                shouldShowCropCharts ? "lg:grid-cols-2" : ""
              }`}
            >
              {shouldShowCropCharts && (
                <Card>
                  <CardHeader>
                    <CardTitle>Over / Under Planning by Crop</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={planningByCropData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis
                            type="number"
                            tickFormatter={(value) =>
                              formatPercent(Math.abs(Number(value)))
                            }
                          />
                          <YAxis
                            type="category"
                            dataKey="crop"
                            width={92}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(value) =>
                              formatPercent(Math.abs(Number(value)))
                            }
                          />
                          <Legend />
                          <Bar
                            dataKey="under"
                            stackId="planning"
                            fill={CHART_COLORS[3]}
                            name="Under"
                          />
                          <Bar
                            dataKey="onTarget"
                            stackId="planning"
                            fill={CHART_COLORS[0]}
                            name="On target"
                          />
                          <Bar
                            dataKey="over"
                            stackId="planning"
                            fill={CHART_COLORS[4]}
                            name="Over"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Planning Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={planningPieData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={110}
                          label={({ name, percent }) =>
                            `${name} ${Math.round((percent || 0) * 100)}%`
                          }
                        >
                          {planningPieData.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Planning Balance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={planningTrendData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis
                        dataKey="weekStart"
                        tickFormatter={formatWeekLabel}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tickFormatter={formatPercent} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatPercent(Number(value))}
                        labelFormatter={(value) =>
                          `Week of ${formatWeekLabel(String(value))}`
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        name="Under - Over"
                        stroke={CHART_COLORS[2]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="fixed right-5 bottom-5 md:right-8 md:bottom-8 z-30">
          <Button onClick={() => setShowSyncDialog(true)} size="sm">
            Sync Data
          </Button>
        </div>

        <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sync Spreadsheet Data</DialogTitle>
              <DialogDescription>
                Keep analytics up to date by syncing your connected spreadsheet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {syncProgress.status === "idle" && (
                <>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {lastSyncTime !== undefined && (
                      <p>Last synced: {formatLastSync(lastSyncTime)}</p>
                    )}
                    {!isLoadingMetadata && sheetLastModified && (
                      <p>Sheet edited: {formatLastModified(sheetLastModified)}</p>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>
                      {isAdmin
                        ? "Sync your Google Sheets data to update crops and qualifiers."
                        : "Data is synced from Google Sheets by the admin."}
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
                </>
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
            </div>

            <DialogFooter>
              {!isAdmin && config?.adminEmail && (
                <span className="mr-auto text-xs text-muted-foreground">
                  Managed by {config.adminEmail}
                </span>
              )}
              <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                Close
              </Button>
              {isAdmin && syncProgress.status !== "syncing" && (
                <>
                  <Button
                    onClick={() => {
                      setShowSyncDialog(false);
                      setShowChangeSpreadsheetDialog(true);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Change Spreadsheet
                  </Button>
                  <Button onClick={handleSyncClick} size="sm">
                    Sync Now
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Spreadsheet Confirmation Dialog */}
        <Dialog
          open={showChangeSpreadsheetDialog}
          onOpenChange={setShowChangeSpreadsheetDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Spreadsheet?</DialogTitle>
              <DialogDescription>
                Are you sure you want to change your connected spreadsheet? You
                will be redirected to the setup page to connect a different
                spreadsheet.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowChangeSpreadsheetDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleChangeSpreadsheet}>
                Yes, Change Spreadsheet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* No Changes Sync Confirmation Dialog */}
        <Dialog
          open={showNoChangesDialog}
          onOpenChange={setShowNoChangesDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>No Changes Detected</DialogTitle>
              <DialogDescription>
                The spreadsheet has not been modified since your last sync. Do
                you still want to sync?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowNoChangesDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowNoChangesDialog(false);
                  syncAllSheets();
                }}
              >
                Sync Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
