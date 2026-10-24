/** Строка экспорта замечаний для исполнителя правок. */
export interface FeedbackExportRow {
  readonly id: string;
  readonly kindLabel: string;
  readonly severityLabel: string;
  readonly statusLabel: string;
  readonly roleLabel: string;
  readonly createdAtLocal: string;
  readonly resolvedAtLocal: string | null;
  readonly section: string;
  readonly objectCode: string | null;
  readonly tab: string;
  readonly route: string;
  readonly device: string;
  readonly viewportWidth: number | null;
  readonly text: string;
  readonly note: string | null;
  readonly screenshot: { readonly type: string; readonly size: number } | null;
}
