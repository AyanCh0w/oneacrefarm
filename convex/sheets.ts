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
