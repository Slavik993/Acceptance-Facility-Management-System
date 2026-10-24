import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildFeedbackBook, wallClock, type FeedbackBookRow } from "./feedback-book.js";

const row = (patch: Partial<FeedbackBookRow>): FeedbackBookRow => ({
  id: "fb-1",
  createdAt: new Date("2026-10-24T07:05:00Z"),
  kind: "DEFECT",
  roleLabel: "Прораб",
  section: "Объекты",
  objectCode: "R-99",
  tab: "Смета",
  routeTemplate: "#[объект]/estimate",
  device: "телефон",
  viewportWidth: 390,
  text: "Итог раздела налезает на соседнюю колонку",
  severityAuto: "HIGH",
  severity: "HIGH",
  status: "NEW",
  note: null,
  resolvedAt: null,
  hasScreenshot: false,
  ...patch,
});

const OPTIONS = {
  organization: "DOLGIY STUDIO",
  timeZone: "Europe/Moscow",
  generatedAt: new Date("2026-10-24T09:00:00Z"),
};

async function open(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ArrayBuffer);
  return book;
}

function sheetOf(book: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = book.getWorksheet(name);
  if (!sheet) throw new Error(`нет листа «${name}»`);
  return sheet;
}

const text = (sheet: ExcelJS.Worksheet, rowNumber: number): string[] =>
  (sheet.getRow(rowNumber).values as unknown[]).slice(1).map((value) =>
    value instanceof Date ? value.toISOString()
      : typeof value === "string" || typeof value === "number" ? String(value) : "");

describe("книга замечаний", () => {
  it("показания часов организации: Москва — UTC+3", () => {
    expect(wallClock(new Date("2026-10-24T07:05:00Z"), "Europe/Moscow").toISOString())
      .toBe("2026-10-24T10:05:00.000Z");
    expect(wallClock(new Date("2026-10-24T22:30:00Z"), "Europe/Moscow").toISOString())
      .toBe("2026-10-25T01:30:00.000Z");
  });

  it("шапка закреплена, фильтр включён, свежие сверху", async () => {
    const book = await open(await buildFeedbackBook([
      row({ id: "fb-old", createdAt: new Date("2026-10-20T08:00:00Z") }),
      row({ id: "fb-new", createdAt: new Date("2026-10-24T08:00:00Z") }),
    ], OPTIONS));
    const sheet = sheetOf(book, "Замечания");
    expect(text(sheet, 1)).toEqual([
      "Дата", "Вид", "Критичность", "Состояние", "Роль автора", "Раздел", "Объект", "Вкладка", "Экран",
      "Устройство", "Ширина окна", "Замечание", "Что сделано", "Закрыто", "Критичность (авто)", "Снимок",
      "Идентификатор",
    ]);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBeTruthy();
    expect(sheet.getRow(2).getCell(17).value).toBe("fb-new");
    expect(sheet.getRow(3).getCell(17).value).toBe("fb-old");
  });

  it("строка несёт подписи, а не коды, и дату в часах организации", async () => {
    const book = await open(await buildFeedbackBook([
      row({
        kind: "IDEA", severity: "LOW", severityAuto: "MEDIUM", status: "DONE",
        note: "Сделано в выпуске 31.10", resolvedAt: new Date("2026-10-31T12:00:00Z"), hasScreenshot: true,
      }),
    ], OPTIONS));
    const sheet = sheetOf(book, "Замечания");
    expect(text(sheet, 2)).toEqual([
      "2026-10-24T10:05:00.000Z", "Рекомендация", "низкая", "сделано", "Прораб", "Объекты", "R-99", "Смета",
      "#[объект]/estimate", "телефон", "390", "Итог раздела налезает на соседнюю колонку",
      "Сделано в выпуске 31.10", "2026-10-31T15:00:00.000Z", "средняя", "есть", "fb-1",
    ]);
    expect(sheet.getRow(2).getCell(1).numFmt).toBe("dd.mm.yyyy hh:mm");
  });

  it("пустые поля — пустые ячейки, а не «null»", async () => {
    const book = await open(await buildFeedbackBook([
      row({ objectCode: null, viewportWidth: null, note: null, resolvedAt: null }),
    ], OPTIONS));
    const values = text(sheetOf(book, "Замечания"), 2);
    expect(values).not.toContain("null");
    expect(values[6]).toBe("");
  });

  it("сводка считает открытые по критичности и видам", async () => {
    const book = await open(await buildFeedbackBook([
      row({ id: "a", severity: "CRITICAL", status: "NEW" }),
      row({ id: "b", severity: "CRITICAL", status: "DONE" }),
      row({ id: "c", kind: "WORKS", severity: "LOW", status: "IN_WORK" }),
    ], OPTIONS));
    const sheet = sheetOf(book, "Сводка");
    const pairs = new Map<string, unknown>();
    sheet.eachRow((line) => {
      const [, name, count] = line.values as unknown[];
      if (typeof name === "string" && typeof count === "number") pairs.set(name, count);
    });
    expect(pairs.get("замечаний")).toBe(3);
    expect(pairs.get("открытых")).toBe(2);
    expect(pairs.get("критично")).toBe(1);
    expect(pairs.get("Работает верно")).toBe(1);
    expect(pairs.get("сделано")).toBe(1);
  });

  it("пустой перечень — книга с шапкой и нулями", async () => {
    const book = await open(await buildFeedbackBook([], OPTIONS));
    expect(sheetOf(book, "Замечания").rowCount).toBe(1);
  });
});
