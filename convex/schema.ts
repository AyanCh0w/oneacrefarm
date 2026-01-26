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

  qualifiers: defineTable({
    name: v.string(),
    assessments: v.array(
      v.object({
        name: v.string(),
        options: v.array(v.string()),
      })
    ),
    lastSynced: v.number(),
  }).index("by_name", ["name"]),

  // Quality logs for tracking crop assessments over time
  qualityLogs: defineTable({
    // Reference to original crop (optional - may not always have one)
    cropId: v.optional(v.id("crops")),

    // Denormalized crop info for easier queries and analytics
    crop: v.string(), // e.g., "Tomato"
    variety: v.string(), // e.g., "Roma"
    field: v.string(), // e.g., "Field A"
    bed: v.string(), // e.g., "A1"

    // Original planting data (for context)
    datePlanted: v.string(), // When it was planted
    trays: v.string(),
    rows: v.string(),
    plantingNotes: v.string(), // Original notes from planting

    // Assessment data
    assessmentDate: v.number(), // Timestamp when assessment was done
    responses: v.array(
      v.object({
        question: v.string(), // e.g., "Planting quantity?"
        answer: v.string(), // e.g., "too much"
      })
    ),

    // Additional metadata
    logNotes: v.optional(v.string()), // Notes added during logging
    createdAt: v.number(), // Record creation timestamp
  })
    .index("by_crop", ["crop"])
    .index("by_field", ["field"])
    .index("by_bed", ["bed"])
    .index("by_assessment_date", ["assessmentDate"])
    .index("by_crop_and_date", ["crop", "assessmentDate"])
    .index("by_field_and_date", ["field", "assessmentDate"]),
});
