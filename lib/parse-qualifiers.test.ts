import assert from "node:assert/strict";
import test from "node:test";
import { parseQualifiersSheet } from "./parse-qualifiers";

test("keeps non-question assessment labels aligned with their source columns", () => {
  const data = [
    ["Arugula", "Planting quantity?", "Bolting?", "Spacing?", "Buggy?"],
    ["", "- too much", "- quickly", "- too close", "- very"],
    ["", "- not enough", "- slowly", "- perfect", "- not very"],
    ["", "", "", "- too far", ""],
    [
      "Broccoli",
      "Planting quantity?",
      "Head size",
      "Bolting?",
      "Side shoots?",
      "Black rot?",
    ],
    ["", "- too much", "- small", "- yes", "- lots", "- yes"],
    ["", "- not enough", "- medium", "- no", "- not many", "- no"],
    ["", "", "- large", "", "", ""],
  ];

  const { vegetables, universalQualifiers } = parseQualifiersSheet(data);

  assert.deepEqual(universalQualifiers, [
    {
      name: "Planting quantity?",
      options: ["too much", "not enough"],
      order: 0,
    },
  ]);

  assert.deepEqual(
    vegetables.find((vegetable) => vegetable.name === "Broccoli"),
    {
      name: "Broccoli",
      location: undefined,
      assessments: [
        {
          name: "Head size",
          options: ["small", "medium", "large"],
        },
        {
          name: "Bolting?",
          options: ["yes", "no"],
        },
        {
          name: "Side shoots?",
          options: ["lots", "not many"],
        },
        {
          name: "Black rot?",
          options: ["yes", "no"],
        },
      ],
    }
  );
});
