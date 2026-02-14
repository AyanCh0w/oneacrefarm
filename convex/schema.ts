import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Global app settings - only one record for shared spreadsheet config
  settings: defineTable({
    spreadsheetId: v.string(),
    spreadsheetName: v.string(),
    sheetNames: v.array(v.string()),
    adminUserId: v.string(), // Clerk user ID of the admin who set this up
    adminEmail: v.string(), // Email of the admin (for display)
    lastUpdated: v.number(),
  }),

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
    location: v.optional(v.string()), // Detected location (e.g., "HT", "field")
    replantedFrom: v.optional(
      v.object({
        crop: v.string(),
        variety: v.string(),
        date: v.string(),
        notes: v.string(),
      })
    ), // If this crop replaced another, store original here
    lastSynced: v.number(),
  })
    .index("by_field", ["field"])
    .index("by_bed", ["bed"])
    .index("by_crop", ["crop"])
    .index("by_field_and_bed", ["field", "bed"]),

  qualifiers: defineTable({
    name: v.string(), // Base crop name (e.g., "Tomato", "Cucumber")
    location: v.optional(v.string()), // Location specifier (e.g., "HT", "field")
    assessments: v.array(
      v.object({
        name: v.string(),
        options: v.array(v.string()),
        isUniversal: v.optional(v.boolean()),
      })
    ),
    lastSynced: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_name_and_location", ["name", "location"]),

  // Universal assessments that apply to ALL crops
  // Edit once, applies everywhere
  universalQualifiers: defineTable({
    name: v.string(), // Assessment question (e.g., "Planting quantity?")
    options: v.array(v.string()), // Possible answers
    order: v.number(), // Display order (lower numbers appear first)
    lastSynced: v.number(),
  }).index("by_order", ["order"]),

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
