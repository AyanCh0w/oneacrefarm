"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import { Card } from "@/components/ui/card";

interface SpreadsheetInfo {
  id: string;
  name: string;
  modifiedTime: string;
  ownerName: string;
  ownerEmail: string;
}

function formatRelativeDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

interface FieldInfo {
  sheetId: number;
  title: string;
  index: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [selectedSpreadsheet, setSelectedSpreadsheet] =
    useState<SpreadsheetInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStarted, setSyncStarted] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    currentField: string;
  } | null>(null);
  const [syncedFields, setSyncedFields] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Filter and sort spreadsheets based on search query (most recently edited first)
  const filteredSpreadsheets = useMemo(() => {
    let filtered = spreadsheets;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = spreadsheets.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.ownerName.toLowerCase().includes(query)
      );
    }
    // Sort by most recently modified
    return [...filtered].sort(
      (a, b) =>
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
    );
  }, [spreadsheets, searchQuery]);

  useEffect(() => {
    fetchSpreadsheets();
  }, []);

  useEffect(() => {
    if (selectedSpreadsheet) {
      fetchFields(selectedSpreadsheet.id);
    } else {
      setFields([]);
      setSyncedFields([]);
      setSyncStarted(false);
    }
  }, [selectedSpreadsheet]);

  const fetchSpreadsheets = async () => {
    setLoadingSpreadsheets(true);
    setError("");

    try {
      const response = await fetch("/api/spreadsheets");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to fetch spreadsheets"
        );
      }

      setSpreadsheets(data.spreadsheets);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch spreadsheets"
      );
    } finally {
      setLoadingSpreadsheets(false);
    }
  };

  const fetchFields = async (spreadsheetId: string) => {
    setLoadingFields(true);
    setSyncedFields([]);
    setSyncStarted(false);
    setError("");

    try {
      const response = await fetch(`/api/sheets/${spreadsheetId}/list`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to fetch fields");
      }

      // Filter out "qualifiers" sheet (case-insensitive)
      const fieldsToShow = data.sheets.filter(
        (sheet: FieldInfo) => sheet.title.toLowerCase() !== "qualifiers"
      );

      setFields(fieldsToShow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch fields");
    } finally {
      setLoadingFields(false);
    }
  };

  const startSync = async () => {
    if (!selectedSpreadsheet || fields.length === 0) return;

    setSyncStarted(true);
    setSyncing(true);
    const synced: string[] = [];

    // Total includes all fields plus the Qualifiers sheet
    const totalSheets = fields.length + 1;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      setSyncProgress({
        current: i + 1,
        total: totalSheets,
        currentField: field.title,
      });

      try {
        const response = await fetch(
          `/api/sheets/${selectedSpreadsheet.id}/sync`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheetName: field.title }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(`Failed to sync ${field.title}:`, data.error);
        } else {
          synced.push(field.title);
          setSyncedFields([...synced]);
        }
      } catch (err) {
        console.error(`Error syncing ${field.title}:`, err);
      }
    }

    // Sync Qualifiers sheet last (required for log data page)
    setSyncProgress({
      current: totalSheets,
      total: totalSheets,
      currentField: "Qualifiers",
    });

    try {
      const response = await fetch(
        `/api/sheets/${selectedSpreadsheet.id}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetName: "Qualifiers" }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to sync Qualifiers:", data.error);
      }
    } catch (err) {
      console.error("Error syncing Qualifiers:", err);
    }

    setSyncing(false);
    setSyncProgress(null);
  };

  const saveAndContinue = () => {
    if (!selectedSpreadsheet || syncedFields.length === 0) {
      setError("Please select a spreadsheet and sync the fields first");
      return;
    }

    localStorage.setItem(
      "cropLogger_sheetConfig",
      JSON.stringify({
        spreadsheetId: selectedSpreadsheet.id,
        spreadsheetName: selectedSpreadsheet.name,
        sheetNames: syncedFields,
      })
    );

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-2xl p-8 space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Setup Crop Logger</h1>
          <p className="text-lg text-muted-foreground">
            Select your Google Sheet to get started
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-lg">Select Spreadsheet</Label>
            {loadingSpreadsheets ? (
              <div className="h-14 flex items-center text-lg text-muted-foreground">
                Loading your spreadsheets...
              </div>
            ) : (
              <Combobox
                value={selectedSpreadsheet?.id || null}
                onValueChange={(value) => {
                  const spreadsheet = spreadsheets.find((s) => s.id === value);
                  setSelectedSpreadsheet(spreadsheet || null);
                  setSearchQuery("");
                }}
                onInputValueChange={(value) => setSearchQuery(value)}
              >
                <ComboboxInput
                  placeholder="Search spreadsheets..."
                  className="w-full h-14 text-lg"
                  showClear={!!selectedSpreadsheet}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {filteredSpreadsheets.length > 0 ? (
                      filteredSpreadsheets.map((spreadsheet) => (
                        <ComboboxItem
                          key={spreadsheet.id}
                          value={spreadsheet.id}
                          className="flex-col items-start gap-0.5 py-3"
                        >
                          <span className="text-base font-medium">
                            {spreadsheet.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {spreadsheet.ownerName} ·{" "}
                            {formatRelativeDate(spreadsheet.modifiedTime)}
                          </span>
                        </ComboboxItem>
                      ))
                    ) : (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No spreadsheets found
                      </div>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            )}
          </div>

          {selectedSpreadsheet && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg">Fields to Sync</Label>
                {fields.length > 0 && !syncStarted && (
                  <span className="text-sm text-muted-foreground">
                    {fields.length} field{fields.length !== 1 ? "s" : ""} found
                  </span>
                )}
              </div>

              {loadingFields ? (
                <div className="h-14 flex items-center text-lg text-muted-foreground">
                  Loading fields...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map((field) => (
                      <div
                        key={field.sheetId}
                        className="flex items-center justify-between px-4 py-4 rounded-lg border border-border bg-card"
                      >
                        <span className="text-lg">{field.title}</span>
                        {syncStarted && (
                          <>
                            {syncedFields.includes(field.title) ? (
                              <span className="text-sm text-emerald-500 font-medium">
                                Synced
                              </span>
                            ) : syncing &&
                              syncProgress?.currentField === field.title ? (
                              <span className="text-sm text-muted-foreground">
                                Syncing...
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                Pending
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {syncProgress && (
                    <p className="text-base text-muted-foreground text-center">
                      Syncing field {syncProgress.current} of {syncProgress.total}...
                    </p>
                  )}

                  {!syncStarted && fields.length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full h-14 text-lg"
                      onClick={startSync}
                    >
                      Sync {fields.length} Field{fields.length !== 1 ? "s" : ""}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="text-base text-red-500">{error}</p>}

          <Button
            className="w-full h-14 text-lg"
            onClick={saveAndContinue}
            disabled={!selectedSpreadsheet || syncing || syncedFields.length === 0}
          >
            {syncing ? "Syncing..." : "Continue to Dashboard"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
