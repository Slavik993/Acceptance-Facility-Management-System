// Выдержка из app/src/lib/disk/registry.ts (коммит f702268): таблица «Замечания.xlsx» зеркала на Яндекс Диске.
/**
 * Замечания с виджета (решение Р-403): по этой таблице раз в неделю
 * делаются точечные правки, и её же руководитель выгружает с экрана
 * разбора. Людей в ней нет по устройству — ни учётной записи, ни адреса,
 * ни строки браузера замечание не хранит, страница записана шаблоном.
 */
export async function feedbackTable(): Promise<Table> {
  const rows = await prisma.feedback.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return table(
    'Замечания.xlsx', 'zamechaniya.csv',
    ['Дата (МСК)', 'Область', 'Страница', 'Устройство', 'Ширина окна', 'Замечание',
     'Критичность (авто)', 'Критичность', 'Состояние', 'Что сделано', 'Закрыто (МСК)',
     'Снимок', 'Идентификатор'],
    rows.map((r) => [
      moment(r.createdAt), AREA_LABEL[r.area], r.pathTemplate, r.device, r.viewportWidth ?? '',
      r.text, SEVERITY_LABEL[r.severityAuto], SEVERITY_LABEL[r.severity], STATUS_LABEL[r.status],
      r.note ?? '', moment(r.resolvedAt), r.screenshotKey === null ? 'нет' : 'есть', r.id,
    ]),
  );
}
