"use client";

import { useState } from "react";
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
import { UserButton } from "@clerk/clerk-react";
import { useUser } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";
import { MapboxMap } from "@/components/map";

interface SheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetNames: string[];
  adminUserId?: string;
  adminEmail?: string;
}

// Skeleton component
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />
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
  const { user } = useUser();

  // Get shared settings from Convex
  const settings = useQuery(api.sheets.getSettings);

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

  const [selectedLogId, setSelectedLogId] = useState<Id<"qualityLogs"> | null>(
    null,
  );
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [logToDelete, setLogToDelete] = useState<Id<"qualityLogs"> | null>(
    null,
  );

  // Check if user is admin (using Clerk publicMetadata)
  const isAdmin = user?.publicMetadata?.role === "admin";

  // Convex queries and mutations
  const crops = useQuery(api.sheets.getAllCrops);
  const qualityLogs = useQuery(api.sheets.getRecentQualityLogs, { limit: 10 });
  const uniqueFields = useQuery(api.sheets.getUniqueFields);
  const uniqueVarieties = useQuery(api.sheets.getUniqueVarieties);
  const deleteQualityLog = useMutation(api.sheets.deleteQualityLog);

  // Handle delete quality log
  const handleDeleteLog = async () => {
    if (!logToDelete) return;
    try {
      await deleteQualityLog({ id: logToDelete });
      setShowDeleteConfirmDialog(false);
      setLogToDelete(null);
      setSelectedLogId(null);
    } catch (error) {
      console.error("Failed to delete quality log:", error);
    }
  };

  // Get selected log details
  const selectedLog = qualityLogs?.find((log) => log._id === selectedLogId);

  // Get unique crop types count
  const uniqueCropTypes = crops
    ? [...new Set(crops.map((c) => c.crop))].length
    : 0;

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">{config?.spreadsheetName}</p>
          </div>
          <UserButton />
        </div>

        {/* Main Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => router.push("/log-data")}
            className="h-16 text-lg"
            size="lg"
          >
            Log Data
          </Button>
          <Button
            onClick={() => router.push("/analytics")}
            variant="outline"
            className="h-16 text-lg"
            size="lg"
          >
            See Analysis
          </Button>
        </div>

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

        {/* Farm Map */}
        <Card>
          <CardHeader>
            <CardTitle>Farm Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-lg">
            <MapboxMap
              className="h-[350px] md:h-[400px]"
              style="mapbox://styles/ayanchow/cmkwthf8e005501qu4jcae74l"
              initialCenter={[-77.451251, 39.162552]}
              initialZoom={17}
              initialBearing={-67.2}
              initialPitch={0}
            />
          </CardContent>
        </Card>

        {/* Recent Logs */}
        {qualityLogs && qualityLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Quality Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {qualityLogs.slice(0, 5).map((log) => (
                  <div
                    key={log._id}
                    className="w-full flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                  >
                    <button
                      onClick={() => setSelectedLogId(log._id)}
                      className="flex-1 flex items-center justify-between hover:bg-muted/30 rounded px-2 py-1 -mx-2 transition-colors cursor-pointer text-left"
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "ml-2 text-destructive hover:text-destructive hover:bg-destructive/10",
                        !isAdmin && "opacity-40 cursor-not-allowed",
                      )}
                      disabled={!isAdmin}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isAdmin) {
                          setLogToDelete(log._id);
                          setShowDeleteConfirmDialog(true);
                        }
                      }}
                      title={isAdmin ? "Delete log" : "Admin only"}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quality Log Detail Dialog */}
        <Dialog
          open={selectedLogId !== null}
          onOpenChange={(open) => !open && setSelectedLogId(null)}
        >
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
                    Logged on{" "}
                    {new Date(selectedLog.assessmentDate).toLocaleDateString()}{" "}
                    at{" "}
                    {new Date(selectedLog.assessmentDate).toLocaleTimeString()}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Location Info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">
                        Field
                      </span>
                      <span className="font-medium">{selectedLog.field}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">
                        Bed
                      </span>
                      <span className="font-medium">
                        {selectedLog.bed || "—"}
                      </span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">
                        Planted
                      </span>
                      <span className="font-medium">
                        {selectedLog.datePlanted || "—"}
                      </span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <span className="text-muted-foreground block text-xs mb-1">
                        Trays
                      </span>
                      <span className="font-medium">
                        {selectedLog.trays || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Planting Notes */}
                  {selectedLog.plantingNotes && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">
                        Planting Notes
                      </h3>
                      <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                        {selectedLog.plantingNotes}
                      </p>
                    </div>
                  )}

                  {/* Assessment Responses */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">
                      Assessment Responses
                    </h3>
                    <div className="space-y-3">
                      {selectedLog.responses.map((response, index) => (
                        <div
                          key={index}
                          className="border border-border rounded-lg p-3"
                        >
                          <p className="text-sm font-medium mb-1">
                            {response.question}
                          </p>
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
                      <h3 className="text-sm font-semibold mb-2">
                        Additional Notes
                      </h3>
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

        {/* Delete Quality Log Confirmation Dialog */}
        <Dialog
          open={showDeleteConfirmDialog}
          onOpenChange={setShowDeleteConfirmDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Quality Log?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this quality log? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirmDialog(false);
                  setLogToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteLog}>
                Delete
              </Button>
            </DialogFooter>
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
              No crops synced yet. Go to Analytics to sync your data from Google
              Sheets.
            </p>
            <Button onClick={() => router.push("/analytics")}>
              Go to Analytics
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
