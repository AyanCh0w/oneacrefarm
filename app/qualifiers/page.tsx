"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Crop {
  _id: Id<"crops">;
  field: string;
  bed: string;
  crop: string;
  variety: string;
  trays: string;
  rows: string;
  date: string;
  notes: string;
  location?: string;
  lastSynced: number;
}

interface Qualifier {
  _id: Id<"qualifiers">;
  name: string;
  location?: string;
  assessments: {
    name: string;
    options: string[];
    isUniversal?: boolean;
  }[];
  lastSynced: number;
}

interface CropAuditRow {
  crop: string;
  fields: string[];
  plantings: Crop[];
  matchedQualifiers: Qualifier[];
  unmatchedLocations: string[];
  assessmentCount: number;
}

function getBaseCropName(cropName: string): string {
  return cropName.split(":")[0].trim();
}

function detectLocationFromField(fieldName: string): string | undefined {
  const normalized = fieldName.toLowerCase();

  if (
    normalized.includes("ht") ||
    normalized.includes("high tunnel") ||
    normalized.includes("hightunnel")
  ) {
    return "HT";
  }

  if (normalized.includes("greenhouse") || normalized.includes("gh")) {
    return "greenhouse";
  }

  if (normalized.includes("field")) {
    return "field";
  }

  return "field";
}

function findBestQualifier(
  cropName: string,
  fieldName: string,
  qualifiers: Qualifier[],
): Qualifier | null {
  const baseCropName = getBaseCropName(cropName);
  const location = detectLocationFromField(fieldName);

  const locationMatch = qualifiers.find(
    (q) =>
      q.name.toLowerCase() === baseCropName.toLowerCase() &&
      q.location?.toLowerCase() === location?.toLowerCase(),
  );

  if (locationMatch) return locationMatch;

  return (
    qualifiers.find(
      (q) => q.name.toLowerCase() === baseCropName.toLowerCase() && !q.location,
    ) ?? null
  );
}

function uniqueById<T extends { _id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item._id, item])).values()];
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />
  );
}

function StatusBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        complete
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      {complete ? "Covered" : "Missing"}
    </span>
  );
}

function FieldList({ plantings }: { plantings: Crop[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {plantings.map((crop) => (
        <span
          key={crop._id}
          className="rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs"
        >
          {crop.field}
          {crop.bed && (
            <span className="text-muted-foreground"> / Bed {crop.bed}</span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function QualifiersPage() {
  const router = useRouter();
  const crops = useQuery(api.sheets.getAllCrops);
  const qualifiers = useQuery(api.sheets.getAllQualifiers);
  const universalQualifiers = useQuery(api.sheets.getAllUniversalQualifiers);
  const [search, setSearch] = useState("");
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CropAuditRow | null>(null);

  const auditRows = useMemo<CropAuditRow[]>(() => {
    if (!crops || !qualifiers) return [];

    const byCrop = new Map<string, Crop[]>();
    for (const crop of crops) {
      const baseName = getBaseCropName(crop.crop);
      byCrop.set(baseName, [...(byCrop.get(baseName) ?? []), crop]);
    }

    return [...byCrop.entries()]
      .map(([cropName, plantings]) => {
        const matches = plantings
          .map((crop) => findBestQualifier(crop.crop, crop.field, qualifiers))
          .filter((qualifier): qualifier is Qualifier => qualifier !== null);
        const matchedQualifiers = uniqueById(matches);
        const unmatchedLocations = [
          ...new Set(
            plantings
              .filter(
                (crop) =>
                  !findBestQualifier(crop.crop, crop.field, qualifiers),
              )
              .map((crop) => detectLocationFromField(crop.field) ?? "field"),
          ),
        ].sort();

        return {
          crop: cropName,
          fields: [...new Set(plantings.map((crop) => crop.field))].sort(),
          plantings: [...plantings].sort((a, b) =>
            `${a.field} ${a.bed}`.localeCompare(`${b.field} ${b.bed}`),
          ),
          matchedQualifiers,
          unmatchedLocations,
          assessmentCount:
            (universalQualifiers?.length ?? 0) +
            matchedQualifiers.reduce(
              (sum, qualifier) => sum + qualifier.assessments.length,
              0,
            ),
        };
      })
      .sort((a, b) => a.crop.localeCompare(b.crop));
  }, [crops, qualifiers, universalQualifiers]);

  const filteredRows = auditRows.filter((row) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      row.crop.toLowerCase().includes(query) ||
      row.fields.some((field) => field.toLowerCase().includes(query));
    const matchesMissingFilter =
      !showOnlyMissing || row.unmatchedLocations.length > 0;

    return matchesSearch && matchesMissingFilter;
  });

  const missingCount = auditRows.filter(
    (row) => row.unmatchedLocations.length > 0,
  ).length;
  const loading =
    crops === undefined ||
    qualifiers === undefined ||
    universalQualifiers === undefined;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Qualifier Coverage</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Check which planted crops have crop-specific qualifier questions.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Crop Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                <p className="text-3xl font-bold">{auditRows.length}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Missing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                <p className="text-3xl font-bold">{missingCount}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Crop Qualifiers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                <p className="text-3xl font-bold">{qualifiers?.length ?? 0}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Universal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                <p className="text-3xl font-bold">
                  {universalQualifiers?.length ?? 0}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Planted Crops</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search crop or field"
                  className="h-10 sm:w-64"
                />
                <Button
                  type="button"
                  variant={showOnlyMissing ? "default" : "outline"}
                  className="h-10"
                  onClick={() => setShowOnlyMissing((value) => !value)}
                >
                  Missing only
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No crops match the current filters.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRows.map((row) => {
                  const covered = row.unmatchedLocations.length === 0;

                  return (
                    <div
                      key={row.crop}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold">
                              {row.crop}
                            </h2>
                            <StatusBadge complete={covered} />
                            <span className="text-xs text-muted-foreground">
                              {row.plantings.length} planting
                              {row.plantings.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <FieldList plantings={row.plantings} />
                          {!covered && (
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                              Missing crop-specific qualifiers for{" "}
                              {row.unmatchedLocations.join(", ")} location
                              {row.unmatchedLocations.length === 1 ? "" : "s"}.
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                            <span className="font-medium">
                              {row.assessmentCount}
                            </span>{" "}
                            total question
                            {row.assessmentCount === 1 ? "" : "s"}
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedRow(row)}
                          >
                            View Qualifiers
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={selectedRow !== null}
        onOpenChange={(open) => !open && setSelectedRow(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          {selectedRow && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {selectedRow.crop} Qualifiers
                </DialogTitle>
                <DialogDescription>
                  Questions shown here match the logging form: universal
                  questions first, then crop-specific questions.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Fields</h3>
                  <FieldList plantings={selectedRow.plantings} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    Universal Questions
                  </h3>
                  {universalQualifiers && universalQualifiers.length > 0 ? (
                    <div className="space-y-2">
                      {universalQualifiers.map((qualifier) => (
                        <div
                          key={qualifier._id}
                          className="rounded-lg border border-border p-3"
                        >
                          <p className="font-medium">{qualifier.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {qualifier.options.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No universal questions are synced.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    Crop-Specific Questions
                  </h3>
                  {selectedRow.matchedQualifiers.length > 0 ? (
                    <div className="space-y-3">
                      {selectedRow.matchedQualifiers.map((qualifier) => (
                        <div
                          key={qualifier._id}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <p className="font-medium">{qualifier.name}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {qualifier.location ?? "generic"}
                            </span>
                          </div>
                          {qualifier.assessments.length > 0 ? (
                            <div className="space-y-2">
                              {qualifier.assessments.map((assessment) => (
                                <div
                                  key={assessment.name}
                                  className="rounded-lg bg-muted/30 p-3"
                                >
                                  <p className="font-medium">
                                    {assessment.name}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {assessment.options.join(", ")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              This qualifier has no crop-specific questions.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No crop-specific qualifier matched this crop.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
