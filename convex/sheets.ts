import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

type PlanningBucket = "under" | "on_target" | "over" | "unknown";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPlanningQuestion(question: string): boolean {
  const q = normalizeLabel(question);
  return (
    q.includes("planting quantity") ||
    q.includes("quantity planted") ||
    q.includes("quantity?") ||
    q.includes("planted too")
  );
}

function getPlanningBucket(answer: string): PlanningBucket {
  const normalized = normalizeLabel(answer);

  if (
    normalized.includes("not enough") ||
    normalized.includes("too little") ||
    normalized.includes("under")
  ) {
    return "under";
  }

  if (
    normalized.includes("too much") ||
    normalized.includes("too many") ||
    normalized.includes("over") ||
    normalized.includes("excess")
  ) {
    return "over";
  }

  if (
    normalized.includes("just right") ||
    normalized.includes("perfect") ||
    normalized.includes("ideal") ||
    normalized.includes("right amount")
  ) {
    return "on_target";
  }

  return "unknown";
}

function startOfWeekUtc(timestamp: number): Date {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date;
}

function dateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getStartTimestampFromDate(dateString: string): number {
  return new Date(`${dateString}T00:00:00.000Z`).getTime();
}

function getEndTimestampFromDate(dateString: string): number {
  return new Date(`${dateString}T23:59:59.999Z`).getTime();
}

// ============ Settings (Global Spreadsheet Config) ============

// Get the global spreadsheet settings
export const getSettings = query({
  handler: async (ctx) => {
    // There should only be one settings record
    return await ctx.db.query("settings").first();
  },
});

// Set the global spreadsheet settings (admin only - enforced on client)
export const setSettings = mutation({
  args: {
    spreadsheetId: v.string(),
    spreadsheetName: v.string(),
    sheetNames: v.array(v.string()),
    adminUserId: v.string(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").first();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, {
        spreadsheetId: args.spreadsheetId,
        spreadsheetName: args.spreadsheetName,
        sheetNames: args.sheetNames,
        adminUserId: args.adminUserId,
        adminEmail: args.adminEmail,
        lastUpdated: Date.now(),
      });
      return { success: true, action: "updated", id: existing._id };
    } else {
      // Create new settings
      const id = await ctx.db.insert("settings", {
        spreadsheetId: args.spreadsheetId,
        spreadsheetName: args.spreadsheetName,
        sheetNames: args.sheetNames,
        adminUserId: args.adminUserId,
        adminEmail: args.adminEmail,
        lastUpdated: Date.now(),
      });
      return { success: true, action: "created", id };
    }
  },
});

// Update sheet names in settings (for when sheets are added/removed)
export const updateSettingsSheetNames = mutation({
  args: {
    sheetNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").first();
    if (!existing) {
      throw new Error("No settings found");
    }

    await ctx.db.patch(existing._id, {
      sheetNames: args.sheetNames,
      lastUpdated: Date.now(),
    });

    return { success: true };
  },
});

// Mutation to sync Google Sheets data to Convex
export const syncSheetData = mutation({
  args: {
    spreadsheetId: v.string(),
    range: v.string(),
    data: v.array(v.array(v.string())),
    parsedData: v.optional(
      v.array(
        v.object({
          field: v.string(),
          bed: v.string(),
          crop: v.string(),
          variety: v.string(),
          trays: v.string(),
          rows: v.string(),
          date: v.string(),
          notes: v.string(),
          location: v.optional(v.string()),
          replantedFrom: v.optional(
            v.object({
              crop: v.string(),
              variety: v.string(),
              date: v.string(),
              notes: v.string(),
            })
          ),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { spreadsheetId, range, data, parsedData } = args;

    // Check if this spreadsheet+range combo already exists
    const existing = await ctx.db
      .query("sheets")
      .withIndex("by_spreadsheet_and_range", (q) =>
        q.eq("spreadsheetId", spreadsheetId).eq("range", range)
      )
      .first();

    let sheetId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        data,
        parsedData,
        lastSynced: Date.now(),
      });
      sheetId = existing._id;
    } else {
      sheetId = await ctx.db.insert("sheets", {
        spreadsheetId,
        range,
        data,
        parsedData,
        lastSynced: Date.now(),
      });
    }

    // Clear existing crops for this field (to avoid duplicates on re-sync)
    if (parsedData && parsedData.length > 0) {
      const fieldName = parsedData[0].field;
      const existingCrops = await ctx.db
        .query("crops")
        .withIndex("by_field", (q) => q.eq("field", fieldName))
        .collect();

      // Delete existing crops for this field
      for (const crop of existingCrops) {
        await ctx.db.delete(crop._id);
      }

      // Insert new crops
      const cropIds = [];
      for (const cropData of parsedData) {
        const cropId = await ctx.db.insert("crops", {
          ...cropData,
          lastSynced: Date.now(),
        });
        cropIds.push(cropId);
      }
      return {
        success: true,
        action: existing ? "updated" : "created",
        sheetId,
        cropsCount: cropIds.length,
      };
    }

    return {
      success: true,
      action: existing ? "updated" : "created",
      sheetId,
      cropsCount: 0,
    };
  },
});

// Get all sheets
export const getAllSheets = query({
  handler: async (ctx) => {
    return ctx.db.query("sheets").collect();
  },
});

// Get all crops
export const getAllCrops = query({
  handler: async (ctx) => {
    return ctx.db.query("crops").collect();
  },
});

// Get crops by field
export const getCropsByField = query({
  args: { field: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("crops")
      .withIndex("by_field", (q) => q.eq("field", args.field))
      .collect();
  },
});

// Get unique fields (for field selection)
export const getUniqueFields = query({
  handler: async (ctx) => {
    const crops = await ctx.db.query("crops").collect();
    const fields = [...new Set(crops.map((c) => c.field))];
    return fields.sort();
  },
});

// Get unique crops (for crop selection)
export const getUniqueCrops = query({
  handler: async (ctx) => {
    const crops = await ctx.db.query("crops").collect();
    const uniqueCrops = [...new Set(crops.map((c) => c.crop))];
    return uniqueCrops.sort();
  },
});

// Mutation to sync qualifiers data (crop-specific only, universal goes to separate table)
export const syncQualifiers = mutation({
  args: {
    qualifiers: v.array(
      v.object({
        name: v.string(),
        location: v.optional(v.string()),
        assessments: v.array(
          v.object({
            name: v.string(),
            options: v.array(v.string()),
            isUniversal: v.optional(v.boolean()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { qualifiers } = args;
    const results = [];

    for (const qualifier of qualifiers) {
      // Check if this qualifier already exists (by name AND location)
      const existing = await ctx.db
        .query("qualifiers")
        .withIndex("by_name_and_location", (q) =>
          q.eq("name", qualifier.name).eq("location", qualifier.location ?? undefined)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          assessments: qualifier.assessments,
          lastSynced: Date.now(),
        });
        results.push({
          name: qualifier.name,
          location: qualifier.location,
          action: "updated",
          id: existing._id,
        });
      } else {
        const id = await ctx.db.insert("qualifiers", {
          name: qualifier.name,
          location: qualifier.location,
          assessments: qualifier.assessments,
          lastSynced: Date.now(),
        });
        results.push({
          name: qualifier.name,
          location: qualifier.location,
          action: "created",
          id,
        });
      }
    }

    return {
      success: true,
      count: results.length,
      results,
    };
  },
});

// Get all qualifiers
export const getAllQualifiers = query({
  handler: async (ctx) => {
    return ctx.db.query("qualifiers").collect();
  },
});

// Get qualifier by name (without location - for backwards compatibility)
export const getQualifierByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("qualifiers")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

// Get qualifier by name and location
export const getQualifierByNameAndLocation = query({
  args: {
    name: v.string(),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("qualifiers")
      .withIndex("by_name_and_location", (q) =>
        q.eq("name", args.name).eq("location", args.location ?? undefined)
      )
      .first();
  },
});

// ============ Universal Qualifiers ============

// Sync universal qualifiers (assessments that apply to ALL crops)
export const syncUniversalQualifiers = mutation({
  args: {
    qualifiers: v.array(
      v.object({
        name: v.string(),
        options: v.array(v.string()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { qualifiers } = args;
    const results = [];

    // Get all existing universal qualifiers
    const existing = await ctx.db.query("universalQualifiers").collect();
    const existingMap = new Map(existing.map((q) => [q.name, q]));

    // Track which ones we've seen
    const seen = new Set<string>();

    for (const qualifier of qualifiers) {
      seen.add(qualifier.name);
      const existingQualifier = existingMap.get(qualifier.name);

      if (existingQualifier) {
        // Update existing
        await ctx.db.patch(existingQualifier._id, {
          options: qualifier.options,
          order: qualifier.order,
          lastSynced: Date.now(),
        });
        results.push({
          name: qualifier.name,
          action: "updated",
          id: existingQualifier._id,
        });
      } else {
        // Create new
        const id = await ctx.db.insert("universalQualifiers", {
          name: qualifier.name,
          options: qualifier.options,
          order: qualifier.order,
          lastSynced: Date.now(),
        });
        results.push({
          name: qualifier.name,
          action: "created",
          id,
        });
      }
    }

    // Delete any that were removed from the source
    for (const existingQualifier of existing) {
      if (!seen.has(existingQualifier.name)) {
        await ctx.db.delete(existingQualifier._id);
        results.push({
          name: existingQualifier.name,
          action: "deleted",
          id: existingQualifier._id,
        });
      }
    }

    return {
      success: true,
      count: results.length,
      results,
    };
  },
});

// Get all universal qualifiers (ordered by order field)
export const getAllUniversalQualifiers = query({
  handler: async (ctx) => {
    return ctx.db
      .query("universalQualifiers")
      .withIndex("by_order")
      .collect();
  },
});

// ============ Quality Logs ============

// Create a new quality log entry
export const createQualityLog = mutation({
  args: {
    cropId: v.optional(v.id("crops")),
    crop: v.string(),
    variety: v.string(),
    field: v.string(),
    bed: v.string(),
    datePlanted: v.string(),
    trays: v.string(),
    rows: v.string(),
    plantingNotes: v.string(),
    responses: v.array(
      v.object({
        question: v.string(),
        answer: v.string(),
      })
    ),
    logNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const logId = await ctx.db.insert("qualityLogs", {
      ...args,
      assessmentDate: now,
      createdAt: now,
    });
    return { success: true, logId };
  },
});

// Get all quality logs
export const getAllQualityLogs = query({
  handler: async (ctx) => {
    return ctx.db.query("qualityLogs").order("desc").collect();
  },
});

// Get quality logs by crop type
export const getQualityLogsByCrop = query({
  args: { crop: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("qualityLogs")
      .withIndex("by_crop", (q) => q.eq("crop", args.crop))
      .order("desc")
      .collect();
  },
});

// Get quality logs by field
export const getQualityLogsByField = query({
  args: { field: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("qualityLogs")
      .withIndex("by_field", (q) => q.eq("field", args.field))
      .order("desc")
      .collect();
  },
});

// Get recent quality logs (for dashboard/stats)
export const getRecentQualityLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return ctx.db.query("qualityLogs").order("desc").take(limit);
  },
});

// Get quality log stats (aggregated data for charts)
export const getQualityLogStats = query({
  handler: async (ctx) => {
    const logs = await ctx.db.query("qualityLogs").collect();

    // Group logs by crop
    const byCrop: Record<string, number> = {};
    // Group logs by field
    const byField: Record<string, number> = {};
    // Group responses by question and answer
    const responseStats: Record<string, Record<string, number>> = {};

    for (const log of logs) {
      // Count by crop
      byCrop[log.crop] = (byCrop[log.crop] || 0) + 1;
      // Count by field
      byField[log.field] = (byField[log.field] || 0) + 1;

      // Count responses
      for (const response of log.responses) {
        if (!responseStats[response.question]) {
          responseStats[response.question] = {};
        }
        responseStats[response.question][response.answer] =
          (responseStats[response.question][response.answer] || 0) + 1;
      }
    }

    return {
      totalLogs: logs.length,
      byCrop,
      byField,
      responseStats,
    };
  },
});

// Analytics-ready datasets for the analytics page charts
export const getAnalyticsOverview = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    crop: v.optional(v.string()),
    field: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [allLogs, crops] = await Promise.all([
      ctx.db.query("qualityLogs").collect(),
      ctx.db.query("crops").collect(),
    ]);

    const cropOptions = [...new Set(allLogs.map((l) => l.crop))].sort();
    const fieldOptions = [...new Set(allLogs.map((l) => l.field))].sort();

    const startTs = args.startDate ? getStartTimestampFromDate(args.startDate) : null;
    const endTs = args.endDate ? getEndTimestampFromDate(args.endDate) : null;

    const logs = allLogs.filter((log) => {
      if (args.crop && log.crop !== args.crop) return false;
      if (args.field && log.field !== args.field) return false;
      if (startTs !== null && log.assessmentDate < startTs) return false;
      if (endTs !== null && log.assessmentDate > endTs) return false;
      return true;
    });

    const byCrop = new Map<string, number>();
    const byField = new Map<string, number>();
    const logsByWeek = new Map<string, number>();
    const questionStats = new Map<string, Map<string, number>>();

    const planningByCrop = new Map<
      string,
      { under: number; onTarget: number; over: number; unknown: number; total: number }
    >();
    const planningByField = new Map<
      string,
      { under: number; onTarget: number; over: number; unknown: number; total: number }
    >();
    const planningByWeek = new Map<
      string,
      { under: number; onTarget: number; over: number; unknown: number; total: number }
    >();

    let underCount = 0;
    let onTargetCount = 0;
    let overCount = 0;
    let unknownCount = 0;
    let planningSampleSize = 0;

    for (const log of logs) {
      byCrop.set(log.crop, (byCrop.get(log.crop) || 0) + 1);
      byField.set(log.field, (byField.get(log.field) || 0) + 1);

      const weekKey = dateKey(startOfWeekUtc(log.assessmentDate));
      logsByWeek.set(weekKey, (logsByWeek.get(weekKey) || 0) + 1);

      let planningBucket: PlanningBucket | null = null;

      for (const response of log.responses) {
        if (!questionStats.has(response.question)) {
          questionStats.set(response.question, new Map<string, number>());
        }
        const answerCounts = questionStats.get(response.question)!;
        answerCounts.set(response.answer, (answerCounts.get(response.answer) || 0) + 1);

        if (!planningBucket && isPlanningQuestion(response.question)) {
          planningBucket = getPlanningBucket(response.answer);
        }
      }

      if (!planningBucket) continue;

      planningSampleSize += 1;
      if (planningBucket === "under") underCount += 1;
      if (planningBucket === "on_target") onTargetCount += 1;
      if (planningBucket === "over") overCount += 1;
      if (planningBucket === "unknown") unknownCount += 1;

      if (!planningByCrop.has(log.crop)) {
        planningByCrop.set(log.crop, {
          under: 0,
          onTarget: 0,
          over: 0,
          unknown: 0,
          total: 0,
        });
      }
      if (!planningByField.has(log.field)) {
        planningByField.set(log.field, {
          under: 0,
          onTarget: 0,
          over: 0,
          unknown: 0,
          total: 0,
        });
      }
      if (!planningByWeek.has(weekKey)) {
        planningByWeek.set(weekKey, {
          under: 0,
          onTarget: 0,
          over: 0,
          unknown: 0,
          total: 0,
        });
      }

      const cropStats = planningByCrop.get(log.crop)!;
      const fieldStats = planningByField.get(log.field)!;
      const weekStats = planningByWeek.get(weekKey)!;

      cropStats.total += 1;
      fieldStats.total += 1;
      weekStats.total += 1;

      if (planningBucket === "under") {
        cropStats.under += 1;
        fieldStats.under += 1;
        weekStats.under += 1;
      } else if (planningBucket === "on_target") {
        cropStats.onTarget += 1;
        fieldStats.onTarget += 1;
        weekStats.onTarget += 1;
      } else if (planningBucket === "over") {
        cropStats.over += 1;
        fieldStats.over += 1;
        weekStats.over += 1;
      } else {
        cropStats.unknown += 1;
        fieldStats.unknown += 1;
        weekStats.unknown += 1;
      }
    }

    const cropChart = Array.from(byCrop.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const fieldChart = Array.from(byField.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const weeklyChart = Array.from(logsByWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, logsCount]) => ({ weekStart, logsCount }));

    const responseByQuestion = Array.from(questionStats.entries())
      .map(([question, answers]) => ({
        question,
        total: Array.from(answers.values()).reduce((sum, count) => sum + count, 0),
        answers: Array.from(answers.entries())
          .map(([answer, count]) => ({ answer, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);

    const planningByCropChart = Array.from(planningByCrop.entries())
      .map(([crop, stats]) => {
        const total = stats.total || 1;
        const underRate = (stats.under / total) * 100;
        const onTargetRate = (stats.onTarget / total) * 100;
        const overRate = (stats.over / total) * 100;
        return {
          crop,
          total: stats.total,
          under: stats.under,
          onTarget: stats.onTarget,
          over: stats.over,
          unknown: stats.unknown,
          underRate,
          onTargetRate,
          overRate,
          balance: underRate - overRate,
        };
      })
      .sort((a, b) => b.total - a.total);

    const planningByFieldChart = Array.from(planningByField.entries())
      .map(([field, stats]) => {
        const total = stats.total || 1;
        const underRate = (stats.under / total) * 100;
        const onTargetRate = (stats.onTarget / total) * 100;
        const overRate = (stats.over / total) * 100;
        return {
          field,
          total: stats.total,
          under: stats.under,
          onTarget: stats.onTarget,
          over: stats.over,
          unknown: stats.unknown,
          underRate,
          onTargetRate,
          overRate,
          balance: underRate - overRate,
        };
      })
      .sort((a, b) => b.total - a.total);

    const planningTrend = Array.from(planningByWeek.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, stats]) => {
        const total = stats.total || 1;
        const underRate = (stats.under / total) * 100;
        const overRate = (stats.over / total) * 100;
        return {
          weekStart,
          total: stats.total,
          under: stats.under,
          onTarget: stats.onTarget,
          over: stats.over,
          unknown: stats.unknown,
          underRate,
          overRate,
          balance: underRate - overRate,
        };
      });

    return {
      filters: {
        cropOptions,
        fieldOptions,
      },
      totals: {
        totalLogs: logs.length,
        totalCrops: crops.length,
        uniqueCrops: new Set(crops.map((c) => c.crop)).size,
        uniqueFields: new Set(crops.map((c) => c.field)).size,
      },
      logsByWeek: weeklyChart,
      byCrop: cropChart,
      byField: fieldChart,
      responseByQuestion,
      planning: {
        sampleSize: planningSampleSize,
        underCount,
        onTargetCount,
        overCount,
        unknownCount,
        underRate: planningSampleSize > 0 ? (underCount / planningSampleSize) * 100 : 0,
        onTargetRate:
          planningSampleSize > 0 ? (onTargetCount / planningSampleSize) * 100 : 0,
        overRate: planningSampleSize > 0 ? (overCount / planningSampleSize) * 100 : 0,
        balance:
          planningSampleSize > 0
            ? ((underCount - overCount) / planningSampleSize) * 100
            : 0,
        byCrop: planningByCropChart,
        byField: planningByFieldChart,
        trend: planningTrend,
      },
    };
  },
});

// Get last sync time
export const getLastSyncTime = query({
  handler: async (ctx) => {
    const sheets = await ctx.db.query("sheets").collect();
    if (sheets.length === 0) return null;

    const lastSyncTimes = sheets.map((s) => s.lastSynced);
    return Math.max(...lastSyncTimes);
  },
});

// Get unique varieties count
export const getUniqueVarieties = query({
  handler: async (ctx) => {
    const crops = await ctx.db.query("crops").collect();
    const varieties = [...new Set(crops.map((c) => c.variety).filter((v) => v && v.trim() !== ""))];
    return varieties;
  },
});

// Delete a quality log by ID
export const deleteQualityLog = mutation({
  args: { id: v.id("qualityLogs") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Quality log not found");
    }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Delete sheet data and associated crops by field/sheet name
export const deleteSheetByField = mutation({
  args: {
    spreadsheetId: v.string(),
    fieldName: v.string(),
  },
  handler: async (ctx, args) => {
    const { spreadsheetId, fieldName } = args;

    // Find and delete the sheet record
    const range = `${fieldName}!A:ZZ`;
    const existingSheet = await ctx.db
      .query("sheets")
      .withIndex("by_spreadsheet_and_range", (q) =>
        q.eq("spreadsheetId", spreadsheetId).eq("range", range)
      )
      .first();

    if (existingSheet) {
      await ctx.db.delete(existingSheet._id);
    }

    // Delete all crops associated with this field
    const existingCrops = await ctx.db
      .query("crops")
      .withIndex("by_field", (q) => q.eq("field", fieldName))
      .collect();

    for (const crop of existingCrops) {
      await ctx.db.delete(crop._id);
    }

    return {
      success: true,
      deletedSheet: existingSheet !== null,
      deletedCropsCount: existingCrops.length,
    };
  },
});
