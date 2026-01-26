import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

// Mutation to sync vegetables (qualifiers) data
export const syncVegetables = mutation({
  args: {
    vegetables: v.array(
      v.object({
        name: v.string(),
        assessments: v.array(
          v.object({
            name: v.string(),
            options: v.array(v.string()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { vegetables } = args;
    const results = [];

    for (const vegetable of vegetables) {
      // Check if this vegetable already exists
      const existing = await ctx.db
        .query("vegetables")
        .withIndex("by_name", (q) => q.eq("name", vegetable.name))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          assessments: vegetable.assessments,
          lastSynced: Date.now(),
        });
        results.push({ name: vegetable.name, action: "updated", id: existing._id });
      } else {
        const id = await ctx.db.insert("vegetables", {
          name: vegetable.name,
          assessments: vegetable.assessments,
          lastSynced: Date.now(),
        });
        results.push({ name: vegetable.name, action: "created", id });
      }
    }

    return {
      success: true,
      count: results.length,
      results,
    };
  },
});

// Get all vegetables
export const getAllVegetables = query({
  handler: async (ctx) => {
    return ctx.db.query("vegetables").collect();
  },
});

// Get vegetable by name
export const getVegetableByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("vegetables")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
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
