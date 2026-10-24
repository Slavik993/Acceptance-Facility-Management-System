/**
 * Книга замечаний о платформе.
 *
 * Руководитель разбирает замечания раз в неделю и делает это в Excel:
 * сортирует по своему, фильтрует по виду и объекту, складывает. Книга
 * собирается целиком при каждой выгрузке — это всегда полный перечень, а не
 * приращение: приращение требовало бы помнить, чем кончился прошлый раз, и
 * умело бы расходиться с базой (решение Р-403 сайта ProDisser).
 *
 * Лист «Замечания» — строка на замечание, свежие сверху, шапка закреплена,
 * фильтр включён. Лист «Сводка» — числа для разбора: сколько открыто, по
 * видам и по критичности. Время — по часовому поясу организации, как
 * «сегодня» в продукте (`day.ts`): ячейка хранит дату, и сортировка по ней
 * хронологическая, а не по тексту.
 */

import ExcelJS from "exceljs";
import {
  CLOSED_FEEDBACK_STATUSES, FEEDBACK_KINDS, FEEDBACK_KIND_LABEL, FEEDBACK_SEVERITIES,
  FEEDBACK_SEVERITY_LABEL, FEEDBACK_STATUSES, FEEDBACK_STATUS_LABEL,
  type FeedbackKind, type FeedbackSeverity, type FeedbackStatus,
} from "@priyomka/domain";

export interface FeedbackBookRow {
  readonly id: string;
  readonly createdAt: Date;
  readonly kind: FeedbackKind;
  /** Подпись роли автора («Прораб»): кто писал, без имени. */
  readonly roleLabel: string;
  readonly section: string;
  readonly objectCode: string | null;
  readonly tab: string;
  readonly routeTemplate: string;
  readonly device: string;
  readonly viewportWidth: number | null;
  readonly text: string;
  readonly severityAuto: FeedbackSeverity;
  readonly severity: FeedbackSeverity;
  readonly status: FeedbackStatus;
  readonly note: string | null;
  readonly resolvedAt: Date | null;
  readonly hasScreenshot: boolean;
}

export interface FeedbackBookOptions {
  readonly organization: string;
  /** Пояс организации (`Organization.timeZone`). */
  readonly timeZone: string;
  readonly generatedAt: Date;
}

const DATE_FORMAT = "dd.mm.yyyy hh:mm";

/** Ширина — в знаках; текст замечания и разбора переносится по словам. */
const COLUMNS = [
  { header: "Дата", width: 17 },
  { header: "Вид", width: 16 },
  { header: "Критичность", width: 13 },
  { header: "Состояние", width: 12 },
  { header: "Роль автора", width: 14 },
  { header: "Раздел", width: 16 },
  { header: "Объект", width: 9 },
  { header: "Вкладка", width: 14 },
  { header: "Экран", width: 22 },
  { header: "Устройство", width: 12 },
  { header: "Ширина окна", width: 8 },
  { header: "Замечание", width: 60, wrap: true },
  { header: "Что сделано", width: 40, wrap: true },
  { header: "Закрыто", width: 17 },
  { header: "Критичность (авто)", width: 13 },
  { header: "Снимок", width: 8 },
  { header: "Идентификатор", width: 28 },
] as const;

/**
 * Момент в часах организации — датой, которую Excel покажет как есть.
 *
 * Excel не знает поясов: дата в ячейке — это показания часов. Поэтому в
 * ячейку кладётся момент, сдвинутый так, что его показания по UTC равны
 * показаниям часов организации.
 */
export function wallClock(at: Date, timeZone: string): Date {
  const части = new Intl.DateTimeFormat("en-GB", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const число = (вид: Intl.DateTimeFormatPartTypes): number =>
    Number(части.find((кусок) => кусок.type === вид)?.value ?? "0");
  return new Date(Date.UTC(число("year"), число("month") - 1, число("day"), число("hour"), число("minute"), число("second")));
}

export async function buildFeedbackBook(
  rows: readonly FeedbackBookRow[],
  options: FeedbackBookOptions,
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Приёмка";
  book.created = options.generatedAt;

  const sheet = book.addWorksheet("Замечания", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = COLUMNS.map((column) => ({ header: column.header, width: column.width }));
  const head = sheet.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: "middle", wrapText: true };
  head.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF0F4" } };
  });

  const ordered = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
  for (const row of ordered) {
    const line = sheet.addRow([
      wallClock(row.createdAt, options.timeZone),
      FEEDBACK_KIND_LABEL[row.kind],
      FEEDBACK_SEVERITY_LABEL[row.severity],
      FEEDBACK_STATUS_LABEL[row.status],
      row.roleLabel,
      row.section,
      row.objectCode ?? "",
      row.tab,
      row.routeTemplate,
      row.device,
      row.viewportWidth ?? "",
      row.text,
      row.note ?? "",
      row.resolvedAt === null ? "" : wallClock(row.resolvedAt, options.timeZone),
      FEEDBACK_SEVERITY_LABEL[row.severityAuto],
      row.hasScreenshot ? "есть" : "нет",
      row.id,
    ]);
    line.alignment = { vertical: "top" };
  }
  COLUMNS.forEach((column, index) => {
    if ("wrap" in column) sheet.getColumn(index + 1).alignment = { vertical: "top", wrapText: true };
  });
  for (const index of [1, 14]) sheet.getColumn(index).numFmt = DATE_FORMAT;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  addSummary(book.addWorksheet("Сводка"), ordered, options);

  const buffer = await book.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Числа для еженедельного разбора: открытые — по критичности и по видам. */
function addSummary(sheet: ExcelJS.Worksheet, rows: readonly FeedbackBookRow[], options: FeedbackBookOptions): void {
  const open = rows.filter((row) => !CLOSED_FEEDBACK_STATUSES.has(row.status));
  sheet.columns = [{ width: 32 }, { width: 12 }];
  sheet.addRow([`Замечания о платформе — ${options.organization}`]).font = { bold: true, size: 12 };
  const stamp = sheet.addRow(["Выгружено", wallClock(options.generatedAt, options.timeZone)]);
  stamp.getCell(2).numFmt = DATE_FORMAT;
  sheet.addRow([]);

  const block = (title: string, lines: readonly (readonly [string, number])[]): void => {
    sheet.addRow([title]).font = { bold: true };
    for (const [name, count] of lines) sheet.addRow([name, count]);
    sheet.addRow([]);
  };
  block("Всего", [["замечаний", rows.length], ["открытых", open.length]]);
  block("По состоянию", FEEDBACK_STATUSES.map((status) =>
    [FEEDBACK_STATUS_LABEL[status], rows.filter((row) => row.status === status).length] as const));
  block("Открытые по критичности", FEEDBACK_SEVERITIES.map((severity) =>
    [FEEDBACK_SEVERITY_LABEL[severity], open.filter((row) => row.severity === severity).length] as const));
  block("Открытые по видам", FEEDBACK_KINDS.map((kind) =>
    [FEEDBACK_KIND_LABEL[kind], open.filter((row) => row.kind === kind).length] as const));
}
