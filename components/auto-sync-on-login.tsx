"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";

type SpreadsheetMetadataResponse = {
  modifiedTime?: string;
  name?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
          ? data.error
          : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function AutoSyncOnLogin() {
  const { user, isLoaded } = useUser();
  const settings = useQuery(api.sheets.getSettings);
  const lastSyncTime = useQuery(api.sheets.getLastSyncTime);
  const updateSettingsSheetNames = useMutation(
    api.sheets.updateSettingsSheetNames,
  );
  const deleteSheetByField = useMutation(api.sheets.deleteSheetByField);
  const isRunningRef = useRef(false);
  const lastCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isLoaded ||
      !user ||
      settings === undefined ||
      lastSyncTime === undefined ||
      isRunningRef.current
    ) {
      return;
    }

    const isAdmin = user.publicMetadata?.role === "admin";
    const isConfiguredOwner = settings?.adminUserId === user.id;

    if (!settings || !isAdmin || !isConfiguredOwner) {
      return;
    }

    const syncedSettings = settings;
    let cancelled = false;

    async function runAutoSync() {
      isRunningRef.current = true;

      try {
        const metadata = await fetchJson<SpreadsheetMetadataResponse>(
          `/api/sheets/${syncedSettings.spreadsheetId}/metadata`,
        );
        const modifiedTime = metadata.modifiedTime;
        const modifiedTimestamp = modifiedTime
          ? new Date(modifiedTime).getTime()
          : NaN;
        const syncTimestamp = lastSyncTime ?? 0;
        const checkKey = `${syncedSettings.spreadsheetId}:${modifiedTime ?? "unknown"}:${syncTimestamp}`;

        if (
          cancelled ||
          lastCheckedRef.current === checkKey ||
          !Number.isFinite(modifiedTimestamp)
        ) {
          return;
        }

        lastCheckedRef.current = checkKey;

        if (modifiedTimestamp <= syncTimestamp) {
          return;
        }

        const toastId = toast.loading("Spreadsheet changed. Syncing data...", {
          description: syncedSettings.spreadsheetName,
        });
        const sheetsToSync = syncedSettings.sheetNames.filter(
          (name) => name.toLowerCase() !== "qualifiers",
        );
        const allSheets = ["Qualifiers", ...sheetsToSync];
        const removedSheets: string[] = [];

        for (let i = 0; i < allSheets.length; i++) {
          if (cancelled) return;

          const sheetName = allSheets[i];
          toast.loading("Syncing spreadsheet data...", {
            id: toastId,
            description: `${sheetName} (${i + 1} of ${allSheets.length})`,
          });

          try {
            await fetchJson(
              `/api/sheets/${syncedSettings.spreadsheetId}/sync`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sheetName }),
              },
            );
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.toLowerCase().includes("sheet not found")
            ) {
              await deleteSheetByField({
                spreadsheetId: syncedSettings.spreadsheetId,
                fieldName: sheetName,
              });
              removedSheets.push(sheetName);
              continue;
            }

            throw error;
          }
        }

        if (removedSheets.length > 0) {
          const updatedSheetNames = syncedSettings.sheetNames.filter(
            (name) => !removedSheets.includes(name),
          );
          await updateSettingsSheetNames({ sheetNames: updatedSheetNames });
        }

        toast.success("Spreadsheet sync complete", {
          id: toastId,
          description:
            removedSheets.length > 0
              ? `Removed ${removedSheets.length} missing sheet${removedSheets.length === 1 ? "" : "s"}.`
              : syncedSettings.spreadsheetName,
        });
      } catch (error) {
        if (cancelled) return;

        toast.error("Auto-sync failed", {
          description:
            error instanceof Error ? error.message : "Unable to sync data.",
        });
      } finally {
        isRunningRef.current = false;
      }
    }

    runAutoSync();

    return () => {
      cancelled = true;
    };
  }, [
    deleteSheetByField,
    isLoaded,
    lastSyncTime,
    settings,
    updateSettingsSheetNames,
    user,
  ]);

  return null;
}
