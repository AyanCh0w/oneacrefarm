"use client";

import { useEffect, useState, useCallback } from "react";
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
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";

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
  const config: SheetConfig | null = settings
    ? {
        spreadsheetId: settings.spreadsheetId,
        spreadsheetName: settings.spreadsheetName,
        sheetNames: settings.sheetNames,
        adminUserId: settings.adminUserId,
        adminEmail: settings.adminEmail,
      }
    : null;

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

  // Check if user is admin (using Clerk publicMetadata)
  const isAdmin = user?.publicMetadata?.role === "admin";

  // Convex queries and mutations
  const lastSyncTime = useQuery(api.sheets.getLastSyncTime);
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
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {/* Sync Spreadsheet Data Section */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Spreadsheet Data</CardTitle>
          </CardHeader>
          <CardContent>
            {syncProgress.status === "idle" && (
              <div className="space-y-4">
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
                <div className="flex gap-2 pt-2">
                  {isAdmin && (
                    <>
                      <Button
                        onClick={() => setShowChangeSpreadsheetDialog(true)}
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
                  {!isAdmin && config?.adminEmail && (
                    <span className="text-xs text-muted-foreground">
                      Managed by {config.adminEmail}
                    </span>
                  )}
                </div>
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

        {/* Placeholder for future analytics */}
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            More analytics features coming soon...
          </p>
        </Card>

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
