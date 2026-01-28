"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MapboxMap, MapFeature } from "@/components/map";

// Types
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
  lastSynced: number;
}

interface Qualifier {
  _id: Id<"qualifiers">;
  name: string;
  assessments: {
    name: string;
    options: string[];
  }[];
  lastSynced: number;
}

type Step = "select-field" | "select-crop" | "data-entry" | "success";
type ViewMode = "list" | "map";

// Helper to extract base crop name (before colon)
function getBaseCropName(cropName: string): string {
  return cropName.split(":")[0].trim();
}

// Skeleton components
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />
  );
}

function FieldButtonSkeleton() {
  return <Skeleton className="h-24 w-full rounded-xl" />;
}

// View Toggle Component
function ViewToggle({
  viewMode,
  onViewChange,
}: {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      <button
        onClick={() => onViewChange("map")}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
          viewMode === "map"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
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
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        Map
      </button>
      <button
        onClick={() => onViewChange("list")}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
          viewMode === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
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
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
        List
      </button>
    </div>
  );
}

function CropCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

function QuestionSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

// Field Selection Button (grid-friendly)
function FieldButton({
  field,
  cropCount,
  onSelect,
  isSelected,
}: {
  field: string;
  cropCount: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
        "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]",
        "flex flex-col items-start justify-center min-h-[6rem]",
        isSelected
          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
          : "border-border bg-card",
      )}
    >
      <span className="font-semibold text-lg leading-tight">{field}</span>
      <span className="text-sm text-muted-foreground mt-1">
        {cropCount} crop{cropCount !== 1 ? "s" : ""}
      </span>
    </button>
  );
}

// Crop Selection Card
function CropCard({
  crop,
  onSelect,
  isSelected,
}: {
  crop: Crop;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
        "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]",
        isSelected
          ? "border-primary bg-primary/10 ring-2 ring-primary/20"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{crop.crop}</h3>
          {crop.variety && (
            <p className="text-muted-foreground text-sm">{crop.variety}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-muted">
          Bed {crop.bed || "—"}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="text-muted-foreground">
          Date:{" "}
          <span className="text-foreground font-medium">
            {crop.date || "—"}
          </span>
        </div>
        {crop.trays && (
          <div className="text-muted-foreground">
            Trays:{" "}
            <span className="text-foreground font-medium">{crop.trays}</span>
          </div>
        )}
        {crop.rows && (
          <div className="text-muted-foreground">
            Rows:{" "}
            <span className="text-foreground font-medium">{crop.rows}</span>
          </div>
        )}
      </div>
      {crop.notes && (
        <p className="mt-2 text-sm text-muted-foreground italic line-clamp-2">
          {crop.notes}
        </p>
      )}
    </button>
  );
}

// Option Button for Qualifiers
function OptionButton({
  option,
  isSelected,
  onSelect,
}: {
  option: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 rounded-xl border-2 text-center font-medium text-lg",
        "transition-all duration-200 active:scale-[0.97]",
        "min-h-[4rem] flex items-center justify-center",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
      )}
    >
      {option}
    </button>
  );
}

// Data Entry Component - All questions on one page
function DataEntryForm({
  qualifier,
  selectedCrop,
  onSubmit,
  onBack,
}: {
  qualifier: Qualifier;
  selectedCrop: Crop;
  onSubmit: (
    responses: { question: string; answer: string }[],
    notes?: string,
  ) => void;
  onBack: () => void;
}) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const assessments = qualifier.assessments;
  const answeredCount = Object.keys(responses).length;
  const allAnswered = assessments.every((a) => responses[a.name]);

  const handleOptionSelect = (question: string, answer: string) => {
    setResponses((prev) => ({ ...prev, [question]: answer }));
  };

  const handleSubmit = () => {
    const formattedResponses = Object.entries(responses).map(
      ([question, answer]) => ({
        question,
        answer,
      }),
    );
    onSubmit(formattedResponses, notes || undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header with crop info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{selectedCrop.crop}</CardTitle>
              {selectedCrop.variety && (
                <CardDescription className="text-base">
                  {selectedCrop.variety}
                </CardDescription>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onBack}>
              Change
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-2">
              <span className="text-muted-foreground block text-xs">Field</span>
              <span className="font-medium">{selectedCrop.field}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <span className="text-muted-foreground block text-xs">Bed</span>
              <span className="font-medium">{selectedCrop.bed || "—"}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <span className="text-muted-foreground block text-xs">
                Planted
              </span>
              <span className="font-medium">{selectedCrop.date || "—"}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <span className="text-muted-foreground block text-xs">Trays</span>
              <span className="font-medium">{selectedCrop.trays || "—"}</span>
            </div>
          </div>
          {selectedCrop.notes && (
            <p className="mt-3 text-sm text-muted-foreground bg-muted/30 rounded-lg p-2">
              <span className="font-medium">Notes:</span> {selectedCrop.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {answeredCount} of {assessments.length} answered
        </span>
        <div className="flex items-center gap-2">
          {assessments.map((a, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                responses[a.name] ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {/* All Questions */}
      <div className="space-y-4">
        {assessments.map((assessment) => (
          <Card key={assessment.name}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">
                {assessment.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {assessment.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleOptionSelect(assessment.name, option)}
                    className={cn(
                      "px-4 py-3 rounded-xl border-2 text-sm font-medium",
                      "transition-all duration-200 active:scale-[0.97]",
                      responses[assessment.name] === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50 hover:bg-primary/5",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notes section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Additional Notes (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any observations or comments..."
            className="w-full h-20 p-3 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </CardContent>
      </Card>

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className="w-full h-14 text-lg"
      >
        {allAnswered
          ? "Submit Log"
          : `Answer all questions (${answeredCount}/${assessments.length})`}
      </Button>
    </div>
  );
}

// Success Screen
function SuccessScreen({
  onLogAnother,
  onGoToDashboard,
}: {
  onLogAnother: () => void;
  onGoToDashboard: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-green-500"
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
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Log Submitted!</h2>
        <p className="text-muted-foreground">
          Your quality assessment has been saved successfully.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button onClick={onLogAnother} className="flex-1 h-12">
          Log Another
        </Button>
        <Button
          variant="outline"
          onClick={onGoToDashboard}
          className="flex-1 h-12"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

// Main Page Component
export default function LogDataPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select-field");
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedFeature, setSelectedFeature] = useState<MapFeature | null>(
    null,
  );

  // Handle feature click - just show the data
  const handleFeatureClick = (feature: MapFeature) => {
    setSelectedFeature(feature);
  };

  // Convex queries
  const crops = useQuery(api.sheets.getAllCrops);
  const qualifiers = useQuery(api.sheets.getAllQualifiers);
  const uniqueFields = useQuery(api.sheets.getUniqueFields);
  const createQualityLog = useMutation(api.sheets.createQualityLog);

  // Get crops for selected field
  const fieldCrops =
    selectedField && crops
      ? crops.filter((c) => c.field === selectedField)
      : [];

  // Count crops per field
  const cropCountByField: Record<string, number> = {};
  crops?.forEach((c) => {
    cropCountByField[c.field] = (cropCountByField[c.field] || 0) + 1;
  });

  // Group fields by parent (if they have colon notation like "Parent:SubField")
  const groupedFields: Record<string, string[]> = {};
  const standaloneFields: string[] = [];

  uniqueFields?.forEach((field) => {
    if (field.includes(":")) {
      const [parent, subfield] = field.split(":");
      const parentKey = parent.trim();
      if (!groupedFields[parentKey]) {
        groupedFields[parentKey] = [];
      }
      groupedFields[parentKey].push(field);
    } else {
      standaloneFields.push(field);
    }
  });

  // Get the qualifier definition for the selected crop
  // Match by base crop name (before the colon)
  const selectedQualifier =
    selectedCrop && qualifiers
      ? qualifiers.find((q) => {
          const baseCropName = getBaseCropName(selectedCrop.crop);
          return q.name.toLowerCase() === baseCropName.toLowerCase();
        })
      : null;

  // Handle field selection
  const handleFieldSelect = (field: string) => {
    setSelectedField(field);
    setStep("select-crop");
  };

  // Handle crop selection
  const handleCropSelect = (crop: Crop) => {
    setSelectedCrop(crop);
    setStep("data-entry");
  };

  // Handle form submission
  const handleSubmit = async (
    responses: { question: string; answer: string }[],
    notes?: string,
  ) => {
    if (!selectedCrop) return;

    try {
      await createQualityLog({
        cropId: selectedCrop._id,
        crop: selectedCrop.crop,
        variety: selectedCrop.variety,
        field: selectedCrop.field,
        bed: selectedCrop.bed,
        datePlanted: selectedCrop.date,
        trays: selectedCrop.trays,
        rows: selectedCrop.rows,
        plantingNotes: selectedCrop.notes,
        responses,
        logNotes: notes,
      });

      setStep("success");
    } catch (error) {
      console.error("Failed to submit log:", error);
      alert("Failed to submit log. Please try again.");
    }
  };

  // Handle log another
  const handleLogAnother = () => {
    setSelectedCrop(null);
    setSelectedField(null);
    setStep("select-field");
  };

  // Handle back navigation
  const handleBackToFields = () => {
    setSelectedCrop(null);
    setSelectedField(null);
    setStep("select-field");
  };

  const handleBackToCrops = () => {
    setSelectedCrop(null);
    setStep("select-crop");
  };

  // No crops synced yet
  const noCrops = crops && crops.length === 0;
  const isLoading = crops === undefined || uniqueFields === undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Log Quality Data</h1>
            <p className="text-muted-foreground text-sm">
              {step === "select-field" && "Select a field"}
              {step === "select-crop" && `Select a crop from ${selectedField}`}
              {step === "data-entry" && "Answer assessment questions"}
              {step === "success" && "Log submitted"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>

        {/* No crops message */}
        {noCrops && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No crops synced yet. Sync your data from the dashboard first.
            </p>
            <Button onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </Card>
        )}

        {/* Field Selection Step */}
        {step === "select-field" && !noCrops && (
          <div className="space-y-4">
            {/* View Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {uniqueFields?.length ?? 0} fields
              </span>
              <ViewToggle viewMode={viewMode} onViewChange={setViewMode} />
            </div>

            {/* Map View */}
            {viewMode === "map" && (
              <div className="space-y-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <MapboxMap
                      className="h-[400px] md:h-[500px]"
                      style="mapbox://styles/ayanchow/cmkwthf8e005501qu4jcae74l"
                      initialCenter={[-77.451251, 39.162552]}
                      initialZoom={17}
                      initialBearing={-67.2}
                      initialPitch={0}
                      onFeatureClick={handleFeatureClick}
                      showFieldLabels
                    />
                  </CardContent>
                </Card>

                {/* Show clicked field data */}
                {selectedFeature ? (
                  (() => {
                    const name = String(
                      selectedFeature.properties.name ||
                        selectedFeature.properties.Name ||
                        "Field",
                    );
                    const description =
                      selectedFeature.properties.description ||
                      selectedFeature.properties.Description;

                    // Find similar fields from the database
                    const nameLower = name.toLowerCase();
                    let similarFields =
                      uniqueFields?.filter((field) => {
                        const fieldLower = field.toLowerCase();
                        const parentField = fieldLower.split(":")[0].trim();
                        const subField = field.includes(":")
                          ? fieldLower.split(":")[1].trim()
                          : "";

                        // Single char: prefix match on parent (A→A, A1; G→G, G1)
                        if (nameLower.length === 1) {
                          return parentField.startsWith(nameLower);
                        }

                        // Exact match on parent or subfield
                        if (parentField === nameLower || subField === nameLower) {
                          return true;
                        }
                        // Name with space: subfield starts with name (sub-variants like HT 1 Winter)
                        if (nameLower.includes(" ")) {
                          if (subField.startsWith(nameLower + " ")) {
                            return true;
                          }
                        }
                        // Name more specific than subfield (map "HT 1 Winter" → sub "HT 1")
                        if (subField && subField.length > 1 && nameLower.startsWith(subField + " ")) {
                          return true;
                        }
                        return false;
                      }) || [];
                    // Fallback: treat each char as exact parent match (handles codes like "EFGHI")
                    if (similarFields.length === 0) {
                      const chars = [
                        ...new Set(nameLower.replace(/\s/g, "").split("")),
                      ];
                      similarFields =
                        uniqueFields?.filter((field) => {
                          const parentField = field
                            .toLowerCase()
                            .split(":")[0]
                            .trim();
                          return chars.some((char) =>
                            parentField === char,
                          );
                        }) || [];
                    }

                    return (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg border border-primary bg-primary/10">
                          <p className="text-sm text-muted-foreground">
                            Selected from map
                          </p>
                          <p className="font-semibold text-lg">{name}</p>
                          {description != null && (
                            <p className="text-muted-foreground mt-1">
                              {String(description)}
                            </p>
                          )}
                        </div>

                        {/* Similar fields from database */}
                        {similarFields.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Matching fields ({similarFields.length})
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {similarFields.map((field) => (
                                <FieldButton
                                  key={field}
                                  field={
                                    field.includes(":")
                                      ? field.split(":")[1]?.trim() || field
                                      : field
                                  }
                                  cropCount={cropCountByField[field] || 0}
                                  onSelect={() => handleFieldSelect(field)}
                                  isSelected={selectedField === field}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Tap on a field to see its details
                  </p>
                )}
              </div>
            )}

            {/* List View - Grid Layout with Categorization */}
            {viewMode === "list" && (
              <div className="space-y-6">
                {isLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FieldButtonSkeleton />
                    <FieldButtonSkeleton />
                    <FieldButtonSkeleton />
                    <FieldButtonSkeleton />
                    <FieldButtonSkeleton />
                    <FieldButtonSkeleton />
                  </div>
                ) : uniqueFields && uniqueFields.length > 0 ? (
                  <>
                    {/* Standalone fields (no colon) */}
                    {standaloneFields.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {standaloneFields.map((field) => (
                          <FieldButton
                            key={field}
                            field={field}
                            cropCount={cropCountByField[field] || 0}
                            onSelect={() => handleFieldSelect(field)}
                            isSelected={selectedField === field}
                          />
                        ))}
                      </div>
                    )}

                    {/* Grouped fields (parent:subfield) */}
                    {Object.entries(groupedFields).map(([parent, fields]) => (
                      <div key={parent}>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                          {parent}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {fields.map((field) => (
                            <FieldButton
                              key={field}
                              field={field.split(":")[1]?.trim() || field}
                              cropCount={cropCountByField[field] || 0}
                              onSelect={() => handleFieldSelect(field)}
                              isSelected={selectedField === field}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No fields found.</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Crop Selection Step */}
        {step === "select-crop" && selectedField && (
          <div className="space-y-4">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToFields}
              className="mb-2"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Fields
            </Button>

            {/* Field header */}
            <div className="bg-primary/10 rounded-xl p-4 mb-4">
              <h2 className="font-semibold text-lg">{selectedField}</h2>
              <p className="text-sm text-muted-foreground">
                {fieldCrops.length} crop{fieldCrops.length !== 1 ? "s" : ""}{" "}
                available
              </p>
            </div>

            {/* Crops list */}
            <div className="space-y-3">
              {fieldCrops.length > 0 ? (
                fieldCrops.map((crop) => (
                  <CropCard
                    key={crop._id}
                    crop={crop}
                    onSelect={() => handleCropSelect(crop)}
                    isSelected={selectedCrop?._id === crop._id}
                  />
                ))
              ) : (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No crops in this field.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Data Entry Step */}
        {step === "data-entry" && selectedCrop && (
          <>
            {!qualifiers ? (
              <QuestionSkeleton />
            ) : selectedQualifier ? (
              <DataEntryForm
                qualifier={selectedQualifier}
                selectedCrop={selectedCrop}
                onSubmit={handleSubmit}
                onBack={handleBackToCrops}
              />
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No assessment questions found for &quot;
                  {getBaseCropName(selectedCrop.crop)}&quot;.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Make sure this crop is defined in your Qualifiers sheet.
                </p>
                <Button onClick={handleBackToCrops}>
                  Select Different Crop
                </Button>
              </Card>
            )}
          </>
        )}

        {/* Success Step */}
        {step === "success" && (
          <SuccessScreen
            onLogAnother={handleLogAnother}
            onGoToDashboard={() => router.push("/dashboard")}
          />
        )}
      </div>
    </div>
  );
}
