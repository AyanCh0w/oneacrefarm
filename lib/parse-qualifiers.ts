export interface Assessment {
  name: string;
  options: string[];
}

export interface VegetableData {
  name: string;
  assessments: Assessment[];
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
 * - Columns B, C, D, E... contain questions in the first row of each vegetable
 * - Options are listed below each question in the same column
 * - Options may have "- " prefix which is stripped
 */
export function parseQualifiersSheet(data: string[][]): VegetableData[] {
  if (data.length === 0) return [];

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
        for (const name of currentVegetableNames) {
          vegetables.push({
            name,
            assessments: currentAssessments.map((a) => ({
              name: a.name,
              options: [...a.options],
            })),
          });
        }
      }

      // Split vegetable names by "/" (e.g., "Sage / Oregano / Mint" -> ["Sage", "Oregano", "Mint"])
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
    for (const name of currentVegetableNames) {
      vegetables.push({
        name,
        assessments: currentAssessments.map((a) => ({
          name: a.name,
          options: [...a.options],
        })),
      });
    }
  }

  // Filter out vegetables with no valid assessments
  return vegetables.filter(
    (v) => v.assessments.length > 0 && v.assessments.some((a) => a.options.length > 0)
  );
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

  const vegetables = parseQualifiersSheet(data);
  return vegetables[0] || null;
}
