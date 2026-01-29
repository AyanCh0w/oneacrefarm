export interface Assessment {
  name: string;
  options: string[];
}

export interface VegetableData {
  name: string; // Base crop name (e.g., "Cucumbers", "Tomatoes")
  location?: string; // Location specifier (e.g., "HT", "field")
  assessments: Assessment[];
}

export interface UniversalQualifier {
  name: string;
  options: string[];
  order: number; // Display order
}

/**
 * Parse crop name and extract location suffix if present.
 * Examples:
 * - "Cucumbers, HT" → { name: "Cucumbers", location: "HT" }
 * - "Tomatoes, field" → { name: "Tomatoes", location: "field" }
 * - "Arugula" → { name: "Arugula", location: undefined }
 */
function parseCropNameAndLocation(fullName: string): { name: string; location?: string } {
  const commaIndex = fullName.lastIndexOf(",");
  if (commaIndex === -1) {
    return { name: fullName.trim() };
  }

  const name = fullName.slice(0, commaIndex).trim();
  const location = fullName.slice(commaIndex + 1).trim();

  return { name, location };
}

/**
 * Parse Qualifiers sheet from 2D array (Google Sheets format).
 *
 * Expected format:
 * | Arugula      | Planting quantity? | Bolting?  | Spacing?   | Buggy?    |
 * |              | - too much         | - quickly | - too close| - very    |
 * |              | - not enough       | - slowly  | - perfect  | - not very|
 * |              |                    |           | - too far  |           |
 * | Asian greens | Planting quantity? | Bolting?  | Spacing?   | Buggy?    |
 * |              | - too much         | - quickly | - too close| - very    |
 * |              | - not enough       | - slowly  | - perfect  | - not very|
 * |              |                    |           | - too far  |           |
 *
 * Structure:
 * - Column A contains vegetable names (marks start of new vegetable)
 *   - Names may include location suffix (e.g., "Cucumbers, HT")
 * - Columns B, C, D, E... contain questions in the first row of each vegetable
 * - Options are listed below each question in the same column
 * - Options may have "- " prefix which is stripped
 *
 * Universal Qualifiers:
 * - Assessments that appear in ALL crops are extracted separately
 * - Returned in universalQualifiers array with display order
 * - Removed from individual crop qualifiers to avoid duplication
 */
export function parseQualifiersSheet(data: string[][]): {
  vegetables: VegetableData[];
  universalQualifiers: UniversalQualifier[];
} {
  if (data.length === 0) return { vegetables: [], universalQualifiers: [] };

  const vegetables: VegetableData[] = [];
  let currentVegetableNames: string[] = [];
  let currentAssessments: Assessment[] = [];

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    if (!row || row.length === 0) continue;

    const firstCell = row[0]?.trim() || "";

    // Check if this row starts a new vegetable (has a name in column A)
    if (firstCell && !firstCell.startsWith("-")) {
      // Save previous vegetables if exist
      if (currentVegetableNames.length > 0 && currentAssessments.length > 0) {
        // Create a vegetable entry for each name (handles "Sage / Oregano / Mint")
        for (const fullName of currentVegetableNames) {
          const { name, location } = parseCropNameAndLocation(fullName);
          vegetables.push({
            name,
            location,
            assessments: currentAssessments.map((a) => ({
              name: a.name,
              options: [...a.options],
            })),
          });
        }
      }

      // Split vegetable names by "/" (e.g., "Sage / Oregano / Mint" -> ["Sage", "Oregano", "Mint"])
      // Each name is kept as-is with potential location suffix
      currentVegetableNames = firstCell
        .split("/")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      // Extract questions from columns B onwards (row with vegetable name)
      currentAssessments = [];
      for (let col = 1; col < row.length; col++) {
        const cell = row[col]?.trim() || "";
        // Questions end with "?"
        if (cell && cell.endsWith("?")) {
          currentAssessments.push({
            name: cell,
            options: [],
          });
        }
      }
    } else if (currentVegetableNames.length > 0 && currentAssessments.length > 0) {
      // This is an options row - add options to each question
      for (let col = 1; col < row.length; col++) {
        const cell = row[col]?.trim() || "";
        if (!cell) continue;

        // Find which question this column corresponds to
        const questionIndex = col - 1; // Column B = index 0, Column C = index 1, etc.
        if (questionIndex < currentAssessments.length) {
          // Strip "- " prefix if present
          const option = cell.startsWith("- ") ? cell.slice(2).trim() : cell;
          if (option && !option.endsWith("?")) {
            currentAssessments[questionIndex].options.push(option);
          }
        }
      }
    }
  }

  // Don't forget to add the last vegetables
  if (currentVegetableNames.length > 0 && currentAssessments.length > 0) {
    for (const fullName of currentVegetableNames) {
      const { name, location } = parseCropNameAndLocation(fullName);
      vegetables.push({
        name,
        location,
        assessments: currentAssessments.map((a) => ({
          name: a.name,
          options: [...a.options],
        })),
      });
    }
  }

  // Filter out vegetables with no valid assessments
  const filteredVegetables = vegetables.filter(
    (v) => v.assessments.length > 0 && v.assessments.some((a) => a.options.length > 0)
  );

  // Identify universal assessments (those that appear in ALL vegetables)
  const universalQualifiers: UniversalQualifier[] = [];
  const universalAssessmentNames = new Set<string>();

  if (filteredVegetables.length > 0) {
    // Count how many times each assessment name appears
    const assessmentCounts = new Map<string, number>();
    const assessmentData = new Map<
      string,
      { options: string[]; firstSeenIndex: number }
    >();

    for (const veg of filteredVegetables) {
      const uniqueAssessmentNames = new Set(veg.assessments.map((a) => a.name));
      for (const assessmentName of uniqueAssessmentNames) {
        assessmentCounts.set(assessmentName, (assessmentCounts.get(assessmentName) || 0) + 1);
      }

      // Store assessment data from first occurrence
      for (let i = 0; i < veg.assessments.length; i++) {
        const assessment = veg.assessments[i];
        if (!assessmentData.has(assessment.name)) {
          assessmentData.set(assessment.name, {
            options: assessment.options,
            firstSeenIndex: i, // Track original column order
          });
        }
      }
    }

    // Extract universal assessments (appear in all vegetables)
    const totalVegetables = filteredVegetables.length;
    for (const [name, count] of assessmentCounts.entries()) {
      if (count === totalVegetables) {
        universalAssessmentNames.add(name);
        const data = assessmentData.get(name);
        if (data) {
          universalQualifiers.push({
            name,
            options: data.options,
            order: data.firstSeenIndex, // Use original column position as order
          });
        }
      }
    }

    // Sort universal qualifiers by order
    universalQualifiers.sort((a, b) => a.order - b.order);

    // Remove universal assessments from individual vegetables
    for (const veg of filteredVegetables) {
      veg.assessments = veg.assessments.filter(
        (a) => !universalAssessmentNames.has(a.name)
      );
    }
  }

  return {
    vegetables: filteredVegetables,
    universalQualifiers,
  };
}

/**
 * Parse Qualifiers from raw text (for testing/debugging).
 * Each vegetable block is separated by blank lines.
 */
export function parseQualifiersText(rawText: string): VegetableData | null {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return null;

  // Convert to 2D array format and use the main parser
  const data: string[][] = lines.map((line) => line.split("\t").map((cell) => cell.trim()));

  const { vegetables } = parseQualifiersSheet(data);
  return vegetables[0] || null;
}
