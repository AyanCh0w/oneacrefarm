"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  sheetNames: string[];
}

interface SheetData {
  range?: string;
  values?: string[][];
  spreadsheetName?: string;
  sheetName?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const [qualifiersData, setQualifiersData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("cropLogger_sheetConfig");
    if (stored) {
      const parsed = JSON.parse(stored) as SheetConfig;
      setConfig(parsed);
      fetchQualifiersData(parsed.spreadsheetId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchQualifiersData = async (spreadsheetId: string) => {
    setLoading(true);
    setError("");

    try {
      const url = `/api/sheets/${spreadsheetId}?sheet=${encodeURIComponent("Qualifiers")}`;
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.error || "Failed to fetch qualifiers data"
        );
      }

      setQualifiersData(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch qualifiers data"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 gap-4">
        <p className="text-muted-foreground">No spreadsheet configured</p>
        <Button onClick={() => router.push("/onboarding")}>
          Setup Spreadsheet
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Crop Qualifiers</h1>
            <p className="text-muted-foreground">{config.spreadsheetName}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/onboarding")}>
            Change Spreadsheet
          </Button>
        </div>

        {loading ? (
          <Card className="p-8 flex items-center justify-center">
            <p className="text-muted-foreground">Loading qualifiers...</p>
          </Card>
        ) : error ? (
          <Card className="p-8">
            <p className="text-red-500 text-center">{error}</p>
            <p className="text-muted-foreground text-center mt-2">
              Make sure your spreadsheet has a &quot;Qualifiers&quot; sheet.
            </p>
          </Card>
        ) : qualifiersData && qualifiersData.values ? (
          <Card className="p-4 overflow-x-auto">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                {qualifiersData.values.length - 1} qualifiers defined
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {qualifiersData.values[0]?.map((header, i) => (
                      <th
                        key={i}
                        className="text-left p-3 font-semibold text-foreground whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qualifiersData.values.slice(1).map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="p-3 text-foreground/90"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-8">
            <p className="text-muted-foreground text-center">
              No qualifiers data found. Make sure your spreadsheet has a
              &quot;Qualifiers&quot; sheet.
            </p>
          </Card>
        )}

        {config.sheetNames && config.sheetNames.length > 0 && (
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-3">Synced Field Sheets</h2>
            <div className="flex flex-wrap gap-2">
              {config.sheetNames.map((name) => (
                <span
                  key={name}
                  className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium"
                >
                  {name}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
