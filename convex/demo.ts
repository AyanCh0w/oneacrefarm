import { mutation } from "./_generated/server";

// DEMO - REMOVE FOR PRODUCTION
// This entire file can be deleted to remove demo functionality.

const DEMO_CROPS = [
  // Field 3
  { field: "Field 3", bed: "1", crop: "Tomato", variety: "Roma", trays: "4", rows: "2", date: "5/12/2025", notes: "", location: "field" },
  { field: "Field 3", bed: "2", crop: "Tomato", variety: "Cherry", trays: "3", rows: "2", date: "5/15/2025", notes: "", location: "field" },
  { field: "Field 3", bed: "3", crop: "Pepper", variety: "Bell", trays: "5", rows: "3", date: "5/20/2025", notes: "", location: "field" },
  { field: "Field 3", bed: "4", crop: "Pepper", variety: "Jalapeño", trays: "2", rows: "1", date: "5/22/2025", notes: "", location: "field" },
  { field: "Field 3", bed: "5", crop: "Lettuce", variety: "Romaine", trays: "6", rows: "4", date: "6/1/2025", notes: "", location: "field" },
  { field: "Field 3", bed: "6", crop: "Squash", variety: "Zucchini", trays: "3", rows: "2", date: "6/5/2025", notes: "", location: "field" },
  // HT 1
  { field: "HT 1", bed: "1", crop: "Tomato", variety: "Roma", trays: "6", rows: "3", date: "5/10/2025", notes: "", location: "HT" },
  { field: "HT 1", bed: "2", crop: "Tomato", variety: "Cherry", trays: "4", rows: "2", date: "5/10/2025", notes: "", location: "HT" },
  { field: "HT 1", bed: "3", crop: "Cucumber", variety: "Mini Me", trays: "3", rows: "2", date: "5/18/2025", notes: "", location: "HT" },
  { field: "HT 1", bed: "4", crop: "Cucumber", variety: "Tasty Green", trays: "2", rows: "1", date: "5/18/2025", notes: "", location: "HT" },
  { field: "HT 1", bed: "5", crop: "Basil", variety: "Genovese", trays: "2", rows: "1", date: "6/2/2025", notes: "", location: "HT" },
  // HT 2
  { field: "HT 2", bed: "1", crop: "Tomato", variety: "Roma", trays: "5", rows: "3", date: "5/14/2025", notes: "", location: "HT" },
  { field: "HT 2", bed: "2", crop: "Lettuce", variety: "Butterhead", trays: "4", rows: "2", date: "6/8/2025", notes: "", location: "HT" },
  { field: "HT 2", bed: "3", crop: "Pepper", variety: "Bell", trays: "3", rows: "2", date: "5/25/2025", notes: "", location: "HT" },
  // Replanted crop example
  {
    field: "HT 2", bed: "4", crop: "Cucumber", variety: "Mini Me", trays: "2", rows: "1", date: "7/1/2025",
    notes: "Tomato: Roma replaced with Cucumber: Mini Me",
    location: "HT",
    replantedFrom: { crop: "Tomato", variety: "Roma", date: "5/14/2025", notes: "Tomato: Roma replaced with Cucumber: Mini Me" },
  },
] as const;

const DEMO_QUALIFIERS = [
  {
    name: "Tomato",
    location: "HT",
    assessments: [
      { name: "Fruit set?", options: ["None", "Light", "Moderate", "Heavy"] },
      { name: "Disease pressure?", options: ["None", "Low", "Moderate", "High"] },
      { name: "Pruning status?", options: ["Up to date", "Behind", "Not started"] },
    ],
  },
  {
    name: "Tomato",
    location: "field",
    assessments: [
      { name: "Fruit set?", options: ["None", "Light", "Moderate", "Heavy"] },
      { name: "Staking status?", options: ["Good", "Needs attention", "Fallen"] },
    ],
  },
  {
    name: "Cucumber",
    assessments: [
      { name: "Vine vigor?", options: ["Weak", "Moderate", "Strong"] },
      { name: "Fruit quality?", options: ["Poor", "Fair", "Good", "Excellent"] },
    ],
  },
  {
    name: "Pepper",
    assessments: [
      { name: "Fruit set?", options: ["None", "Light", "Moderate", "Heavy"] },
      { name: "Plant size?", options: ["Small", "Medium", "Large"] },
    ],
  },
  {
    name: "Lettuce",
    assessments: [
      { name: "Head formation?", options: ["None", "Starting", "Formed", "Bolting"] },
      { name: "Pest damage?", options: ["None", "Minor", "Moderate", "Severe"] },
    ],
  },
];

const DEMO_UNIVERSAL_QUALIFIERS = [
  { name: "Planting quantity?", options: ["Too little", "On target", "Too much"], order: 1 },
  { name: "Overall health?", options: ["Poor", "Fair", "Good", "Excellent"], order: 2 },
];

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Insert crops and collect IDs for quality logs
    const cropIds: { id: string; crop: typeof DEMO_CROPS[number] }[] = [];
    for (const crop of DEMO_CROPS) {
      const { replantedFrom, ...rest } = crop as Record<string, unknown>;
      const id = await ctx.db.insert("crops", {
        field: rest.field as string,
        bed: rest.bed as string,
        crop: rest.crop as string,
        variety: rest.variety as string,
        trays: rest.trays as string,
        rows: rest.rows as string,
        date: rest.date as string,
        notes: rest.notes as string,
        location: rest.location as string,
        ...(replantedFrom ? { replantedFrom: replantedFrom as { crop: string; variety: string; date: string; notes: string } } : {}),
        lastSynced: now,
      });
      cropIds.push({ id, crop });
    }

    // Insert qualifiers
    for (const q of DEMO_QUALIFIERS) {
      await ctx.db.insert("qualifiers", {
        name: q.name,
        ...(q.location ? { location: q.location } : {}),
        assessments: q.assessments.map((a) => ({ name: a.name, options: [...a.options] })),
        lastSynced: now,
      });
    }

    // Insert universal qualifiers
    for (const uq of DEMO_UNIVERSAL_QUALIFIERS) {
      await ctx.db.insert("universalQualifiers", {
        name: uq.name,
        options: [...uq.options],
        order: uq.order,
        lastSynced: now,
      });
    }

    // Insert quality logs spread over 6 weeks (mid-June to end of July 2025)
    const plantingAnswers = ["Too little", "On target", "On target", "Too much", "On target", "On target"];
    const healthAnswers = ["Good", "Good", "Excellent", "Fair", "Good", "Excellent", "Good", "Poor"];

    const logEntries: {
      cropIndex: number;
      weekOffset: number;
      extraResponses: { question: string; answer: string }[];
    }[] = [
      // Week 1 - mid June
      { cropIndex: 0, weekOffset: 0, extraResponses: [{ question: "Fruit set?", answer: "Light" }] },
      { cropIndex: 6, weekOffset: 0, extraResponses: [{ question: "Fruit set?", answer: "Moderate" }, { question: "Pruning status?", answer: "Up to date" }] },
      { cropIndex: 8, weekOffset: 0, extraResponses: [{ question: "Vine vigor?", answer: "Strong" }] },
      // Week 2
      { cropIndex: 1, weekOffset: 1, extraResponses: [{ question: "Fruit set?", answer: "Light" }] },
      { cropIndex: 2, weekOffset: 1, extraResponses: [{ question: "Fruit set?", answer: "None" }, { question: "Plant size?", answer: "Medium" }] },
      { cropIndex: 7, weekOffset: 1, extraResponses: [{ question: "Fruit set?", answer: "Moderate" }] },
      // Week 3
      { cropIndex: 0, weekOffset: 2, extraResponses: [{ question: "Fruit set?", answer: "Moderate" }] },
      { cropIndex: 4, weekOffset: 2, extraResponses: [{ question: "Head formation?", answer: "Starting" }, { question: "Pest damage?", answer: "Minor" }] },
      { cropIndex: 11, weekOffset: 2, extraResponses: [{ question: "Fruit set?", answer: "Heavy" }, { question: "Pruning status?", answer: "Behind" }] },
      // Week 4
      { cropIndex: 6, weekOffset: 3, extraResponses: [{ question: "Fruit set?", answer: "Heavy" }, { question: "Disease pressure?", answer: "Low" }] },
      { cropIndex: 8, weekOffset: 3, extraResponses: [{ question: "Vine vigor?", answer: "Moderate" }, { question: "Fruit quality?", answer: "Good" }] },
      { cropIndex: 3, weekOffset: 3, extraResponses: [{ question: "Fruit set?", answer: "Light" }, { question: "Plant size?", answer: "Large" }] },
      { cropIndex: 10, weekOffset: 3, extraResponses: [{ question: "Vine vigor?", answer: "Strong" }] },
      // Week 5
      { cropIndex: 1, weekOffset: 4, extraResponses: [{ question: "Fruit set?", answer: "Heavy" }] },
      { cropIndex: 5, weekOffset: 4, extraResponses: [] },
      { cropIndex: 12, weekOffset: 4, extraResponses: [{ question: "Head formation?", answer: "Formed" }, { question: "Pest damage?", answer: "None" }] },
      { cropIndex: 13, weekOffset: 4, extraResponses: [{ question: "Fruit set?", answer: "Moderate" }] },
      // Week 6
      { cropIndex: 0, weekOffset: 5, extraResponses: [{ question: "Fruit set?", answer: "Heavy" }, { question: "Staking status?", answer: "Needs attention" }] },
      { cropIndex: 6, weekOffset: 5, extraResponses: [{ question: "Fruit set?", answer: "Heavy" }, { question: "Disease pressure?", answer: "Moderate" }] },
      { cropIndex: 14, weekOffset: 5, extraResponses: [{ question: "Vine vigor?", answer: "Strong" }, { question: "Fruit quality?", answer: "Excellent" }] },
    ];

    const baseDate = new Date("2025-06-15T10:00:00Z").getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    let logCount = 0;

    for (let i = 0; i < logEntries.length; i++) {
      const entry = logEntries[i];
      const cropEntry = cropIds[entry.cropIndex];
      if (!cropEntry) continue;

      const assessmentDate = baseDate + entry.weekOffset * oneWeek + i * 3600000; // stagger by hour
      const responses = [
        { question: "Planting quantity?", answer: plantingAnswers[i % plantingAnswers.length] },
        { question: "Overall health?", answer: healthAnswers[i % healthAnswers.length] },
        ...entry.extraResponses,
      ];

      await ctx.db.insert("qualityLogs", {
        cropId: cropEntry.id as any,
        crop: cropEntry.crop.crop,
        variety: cropEntry.crop.variety,
        field: cropEntry.crop.field,
        bed: cropEntry.crop.bed,
        datePlanted: cropEntry.crop.date,
        trays: cropEntry.crop.trays,
        rows: cropEntry.crop.rows,
        plantingNotes: cropEntry.crop.notes,
        assessmentDate,
        responses,
        createdAt: assessmentDate,
      });
      logCount++;
    }

    return {
      success: true,
      counts: {
        crops: DEMO_CROPS.length,
        qualifiers: DEMO_QUALIFIERS.length,
        universalQualifiers: DEMO_UNIVERSAL_QUALIFIERS.length,
        qualityLogs: logCount,
      },
    };
  },
});

export const clearDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear all data from each table
    const tables = ["crops", "qualifiers", "universalQualifiers", "qualityLogs"] as const;
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      counts[table] = rows.length;
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }

    return { success: true, deleted: counts };
  },
});
