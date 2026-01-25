import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sheets: defineTable({
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
    lastSynced: v.number(),
  })
    .index("by_spreadsheet", ["spreadsheetId"])
    .index("by_spreadsheet_and_range", ["spreadsheetId", "range"]),

  crops: defineTable({
    field: v.string(),
    bed: v.string(),
    crop: v.string(),
    variety: v.string(),
    trays: v.string(),
    rows: v.string(),
    date: v.string(),
    notes: v.string(),
    lastSynced: v.number(),
  })
    .index("by_field", ["field"])
    .index("by_bed", ["bed"])
    .index("by_crop", ["crop"]),
});
