import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type ExportRequestBody = {
  start_date?: string;
  start_data?: string;
  end_date?: string;
};

class ValidationError extends Error {}

function parseDateInput(
  value: string,
  fieldName: "start_date" | "end_date"
): { year: number; month: number; day: number } {
  const match = value.match(/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-(\d{4})$/);

  if (!match) {
    throw new ValidationError(`${fieldName} must be formatted as MM-DD-YYYY`);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError(`${fieldName} is not a valid calendar date`);
  }

  return { year, month, day };
}

function getStartOfDayTimestamp(date: { year: number; month: number; day: number }) {
  return Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0, 0);
}

function getEndOfDayTimestamp(date: { year: number; month: number; day: number }) {
  return Date.UTC(date.year, date.month - 1, date.day, 23, 59, 59, 999);
}

function formatDateForCsv(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${month}-${day}-${year}`;
}

function escapeCsvCell(value: unknown) {
  const stringValue = String(value ?? "").replace(/\r\n/g, "\n");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(
  logs: Array<{
    _id: string;
    crop: string;
    variety: string;
    field: string;
    bed: string;
    datePlanted: string;
    trays: string;
    rows: string;
    plantingNotes: string;
    logNotes?: string;
    assessmentDate: number;
    createdAt: number;
    responses: Array<{ question: string; answer: string }>;
  }>
) {
  const questionHeaders = Array.from(
    new Set(
      logs.flatMap((log) => log.responses.map((response) => response.question.trim()))
    )
  );

  const headers = [
    "log_id",
    "assessment_date",
    "assessment_timestamp_utc",
    "created_at_utc",
    "field",
    "bed",
    "crop",
    "variety",
    "date_planted",
    "trays",
    "rows",
    "planting_notes",
    "log_notes",
    ...questionHeaders,
  ];

  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...logs.map((log) => {
      const answersByQuestion = new Map<string, string[]>();

      for (const response of log.responses) {
        const question = response.question.trim();
        const existingAnswers = answersByQuestion.get(question) ?? [];
        existingAnswers.push(response.answer);
        answersByQuestion.set(question, existingAnswers);
      }

      const row = [
        log._id,
        formatDateForCsv(log.assessmentDate),
        new Date(log.assessmentDate).toISOString(),
        new Date(log.createdAt).toISOString(),
        log.field,
        log.bed,
        log.crop,
        log.variety,
        log.datePlanted,
        log.trays,
        log.rows,
        log.plantingNotes,
        log.logNotes ?? "",
        ...questionHeaders.map((question) =>
          (answersByQuestion.get(question) ?? []).join(" | ")
        ),
      ];

      return row.map(escapeCsvCell).join(",");
    }),
  ];

  return `\uFEFF${lines.join("\n")}`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ExportRequestBody;
    const startDateInput = body.start_date ?? body.start_data;
    const endDateInput = body.end_date;

    if (!startDateInput || !endDateInput) {
      return NextResponse.json(
        {
          error: "start_date and end_date are required in MM-DD-YYYY format",
        },
        { status: 400 }
      );
    }

    const startDate = parseDateInput(startDateInput, "start_date");
    const endDate = parseDateInput(endDateInput, "end_date");
    const startTimestamp = getStartOfDayTimestamp(startDate);
    const endTimestamp = getEndOfDayTimestamp(endDate);

    if (startTimestamp > endTimestamp) {
      return NextResponse.json(
        { error: "start_date must be on or before end_date" },
        { status: 400 }
      );
    }

    const logs = await convex.query(api.sheets.getQualityLogsInDateRange, {
      startTimestamp,
      endTimestamp,
    });

    const csv = buildCsv(logs);
    const fileName = `quality-logs-${startDateInput}-to-${endDateInput}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting quality logs:", error);

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "Failed to export quality logs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
