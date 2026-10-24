/**
 * Замечания о платформе с кнопки в кабинете: правила без сети и без базы.
 *
 * Перенос механизма сайта ProDisser (решения Р-403 и Р-405 его журнала).
 * Любой вошедший — руководитель, прораб, бухгалтер, заказчик — нажимает
 * кнопку в углу экрана и пишет, что не так, что улучшить, что непонятно
 * или что сделано верно. Замечание ложится в таблицу вместе с обстановкой:
 * раздел, объект, вкладка, адрес экрана, ширина окна. Раз в неделю таблица
 * разбирается, правки идут по порядку критичности.
 *
 * Модуль один на сервер и на экран. Экран показывает человеку ровно то, что
 * ляжет в таблицу, а сервер считает всё заново и клиенту не верит: вид,
 * текст, адрес и ширина проверяются здесь, критичность выводится отсюда же.
 */

// ───────────────────────────── Перечни ───────────────────────────────────

/**
 * Вид замечания. «Работает верно» — не жалоба, а отметка места, которое при
 * доработке трогать нельзя: без неё разбор видит одни дефекты и правит то,
 * что людям как раз нравилось.
 */
export const FEEDBACK_KINDS = ["DEFECT", "IDEA", "COMMENT", "WORKS"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABEL: Readonly<Record<FeedbackKind, string>> = {
  DEFECT: "Ошибка",
  IDEA: "Рекомендация",
  COMMENT: "Комментарий",
  WORKS: "Работает верно",
};

/** Подсказка к виду — для доступного имени и всплывающей строки. */
export const FEEDBACK_KIND_HINT: Readonly<Record<FeedbackKind, string>> = {
  DEFECT: "что работает не так",
  IDEA: "что улучшить или добавить",
  COMMENT: "вопрос или мысль",
  WORKS: "что сделано правильно и должно остаться",
};

export const FEEDBACK_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export const FEEDBACK_SEVERITY_LABEL: Readonly<Record<FeedbackSeverity, string>> = {
  CRITICAL: "критично",
  HIGH: "высокая",
  MEDIUM: "средняя",
  LOW: "низкая",
};

/**
 * Состояние разбора. «Сделано» закрывает и исправленную ошибку, и учтённую
 * отметку «работает верно»: оба значат «по замечанию больше ничего не ждём».
 */
export const FEEDBACK_STATUSES = ["NEW", "IN_WORK", "DONE", "DECLINED"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABEL: Readonly<Record<FeedbackStatus, string>> = {
  NEW: "новое",
  IN_WORK: "в работе",
  DONE: "сделано",
  DECLINED: "отклонено",
};

/** Закрытые состояния: при переходе в них ставится момент закрытия, при возврате — снимается. */
export const CLOSED_FEEDBACK_STATUSES: ReadonlySet<FeedbackStatus> = new Set<FeedbackStatus>(["DONE", "DECLINED"]);

export const isFeedbackKind = (value: unknown): value is FeedbackKind =>
  typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
export const isFeedbackSeverity = (value: unknown): value is FeedbackSeverity =>
  typeof value === "string" && (FEEDBACK_SEVERITIES as readonly string[]).includes(value);
export const isFeedbackStatus = (value: unknown): value is FeedbackStatus =>
  typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);

// ───────────────────────────── Пределы и тексты ──────────────────────────

/** Пределы текста — те же, что у приёмника демонстрации (`12_FEEDBACK.md`). */
export const FEEDBACK_TEXT_MIN = 5;
export const FEEDBACK_TEXT_MAX = 4000;
export const FEEDBACK_NOTE_MAX = 2000;
/** Снимок экрана — до 5 МБ: снимок окна телефона весит 0,3—1,5 МБ, с запасом втрое. */
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
/** Раздел и вкладка — подписи интерфейса, объект — код вида `R-99`. */
const SECTION_MAX = 80;
const TAB_MAX = 80;

export const FEEDBACK_TEXT_TOO_SHORT = "Опишите замечание хотя бы парой слов.";
export const FEEDBACK_TEXT_TOO_LONG = `Замечание длиннее ${String(FEEDBACK_TEXT_MAX)} знаков — сократите его.`;
export const FEEDBACK_TEXT_HAS_CONTACTS =
  "Уберите из замечания телефон, почту или ссылку на мессенджер: замечание описывает платформу, а не человека.";
export const FEEDBACK_KIND_UNKNOWN = "Выберите вид: ошибка, рекомендация, комментарий или «работает верно».";
export const FEEDBACK_THANKS = "Записано. Замечание попало в таблицу вместе с экраном, на котором оно возникло.";

/** Подпись роли для книги и экрана: кто писал, без имени. */
export const FEEDBACK_ROLE_LABEL: Readonly<Record<string, string>> = {
  OWNER: "Руководитель",
  FOREMAN: "Прораб",
  ACCOUNTANT: "Бухгалтер",
  CLIENT: "Заказчик",
};

// ───────────────────────────── Адрес экрана ──────────────────────────────

/** Код объекта: одна—четыре буквы, дефис, номер (`R-99`). */
const OBJECT_CODE = /^\p{L}{1,4}-\d{1,6}$/u;
/** Название раздела, вкладки или отбора в адресе: `projects`, `estimate`. */
const SLUG = /^[a-z][a-z0-9-]{0,39}$/u;
const MAX_SEGMENTS = 4;

/**
 * Шаблон адреса экрана: то, что пишется вместо адреса.
 *
 * Адрес продукта — `#R-99/estimate?draft` (решение 01.10.2026, П-50).
 * Замечания группируются по экрану, а не по объекту: «на вкладке сметы
 * налезает итог» у R-99 и у R-31 — одно замечание о вёрстке. Поэтому код
 * объекта в шаблоне заменяется меткой, а сам код пишется отдельным полем.
 * Отбор после `?` отбрасывается: в нём бывают отметки времени и
 * опознаватели заказчика. Всё, что не похоже на название раздела, — `[id]`.
 */
export function feedbackRouteTemplate(raw: unknown): string {
  let value = typeof raw === "string" ? raw.trim() : "";
  const hash = value.indexOf("#");
  if (hash >= 0) value = value.slice(hash + 1);
  value = value.split("?")[0] ?? "";
  const segments = value.split("/").filter((segment) => segment.length > 0).slice(0, MAX_SEGMENTS);
  const template = segments.map((segment) => {
    if (segment === "[объект]" || segment === "[id]") return segment;
    if (OBJECT_CODE.test(segment)) return "[объект]";
    return SLUG.test(segment) ? segment : "[id]";
  });
  return `#${template.join("/")}`;
}

/** Код объекта в едином виде (`R-99`) либо `null`, если прислано не то. */
export function feedbackObjectCode(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  return OBJECT_CODE.test(value) ? value.toUpperCase() : null;
}

/** Подпись интерфейса: без управляющих знаков, пробелы сведены, длина ограничена. */
function label(raw: unknown, max: number): string {
  const value = typeof raw === "string" ? raw : "";
  // eslint-disable-next-line no-control-regex -- управляющие знаки и есть предмет очистки
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max);
}

// ───────────────────────────── Устройство ────────────────────────────────

/** Ширина окна: целое от 200 до 10000, иначе неизвестна. */
export function parseViewportWidth(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,5}$/u.test(text)) return null;
  const width = Number(text);
  return width >= 200 && width <= 10_000 ? width : null;
}

/** Граница узкой раскладки продукта — 480 px (решение 02.10.2026). */
const NARROW_MAX = 480;
const TABLET_MAX = 1099;

/** Устройство по ширине окна — теми же границами, что у раскладок продукта. */
export function feedbackDevice(width: number | null): string {
  if (width === null) return "не определено";
  if (width <= NARROW_MAX) return "телефон";
  if (width <= TABLET_MAX) return "планшет";
  return "компьютер";
}

// ───────────────────────────── Контакты в тексте ─────────────────────────

const EMAIL = /[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.\p{L}{2,}/u;
/** Имя в мессенджере: собака без знака перед ней — это не адрес почты. */
const HANDLE = /(?:^|[\s(,;:—-])@[A-Za-z][A-Za-z0-9_]{3,}/u;
const MESSENGER_LINK = /\b(?:t\.me|telegram\.me|wa\.me|whatsapp\.com|vk\.com|max\.ru)\b/iu;
/** Последовательность цифр с пробелами, скобками, дефисами и точками. */
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{8,}\d/gu;

/**
 * Есть ли в тексте телефон, почта или ссылка на мессенджер.
 *
 * Замечание описывает экран, а не человека: «заказчик Иванов, +7 900…» в
 * таблице замечаний — персональные данные в документе, который уходит
 * исполнителю правок. Номер ГОСТа и сумма телефоном не считаются: телефон
 * — от десяти до двенадцати цифр в одной записи.
 */
export function feedbackHasContacts(text: string): boolean {
  if (EMAIL.test(text) || HANDLE.test(text) || MESSENGER_LINK.test(text)) return true;
  for (const candidate of text.match(PHONE_CANDIDATE) ?? []) {
    const digits = candidate.replace(/\D/gu, "").length;
    if (digits >= 10 && digits <= 12) return true;
  }
  return false;
}

// ───────────────────────────── Критичность ───────────────────────────────

interface Rule {
  readonly phrase: string;
  /** Слово целиком: «не та» не должно ловить «не так». */
  readonly whole?: true;
}

const rules = (...items: (string | Rule)[]): readonly Rule[] =>
  items.map((item) => (typeof item === "string" ? { phrase: item } : item));

const CRITICAL = rules(
  "не работает", "не открывается", "не отправ", "не загруж", "не сохран", "не могу войти",
  "не пускает", "не приходит код", "не приходит ссылка", "ошибка 500", "сбой", "пропал",
  "потерял", "удалил", "белый экран", "зависает", "не принимает", "не сходится",
);
/**
 * Деньги. Ошибка в сумме, начислении или транше стоит дороже прочих: по
 * этим числам платят бригаде и выставляют акт заказчику (БП-10).
 */
const MONEY = rules("оплат", "деньг", "сумм", "начисл", "транш", "копе", "рубл", "ставк");
// «Ошибк» — основой, а не словом «ошибка»: «показывает ошибки» значит то же.
const HIGH = rules(
  "ошибк", "не видно", "не отображ", "неправильн", "неверн",
  { phrase: "не тот", whole: true }, { phrase: "не та", whole: true },
  "налезает", "обрез", "съехал", "не нажимается", "долго грузится", "не обновля", "дублир",
);
const LOW = rules(
  "опечатк", "предлагаю", "хорошо бы", "было бы удобно", "мелочь", "пожелание", "цвет", "шрифт",
);

/** Текст для сверки: строчные, «ё» как «е», пробелы сведены к одному. */
export function foldFeedbackText(text: string): string {
  return text.toLowerCase().replace(/ё/gu, "е").replace(/\s+/gu, " ");
}

function hit(folded: string, list: readonly Rule[]): boolean {
  return list.some((rule) => {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(rule.phrase, from);
      if (at < 0) return false;
      // Граница слова — по букве, а не `\b`: та опирается на латиницу.
      const before = at === 0 ? "" : folded.charAt(at - 1);
      const after = folded.charAt(at + rule.phrase.length);
      const startOk = !/\p{L}/u.test(before);
      const endOk = rule.whole !== true || !/\p{L}/u.test(after);
      if (startOk && endOk) return true;
      from = at + 1;
    }
  });
}

/**
 * Критичность по правилам при отправке. Итоговую ставит руководитель на
 * разборе; правило лишь ставит замечание в очередь: «не сохраняется
 * приёмка» поднимается наверх раньше, чем «хорошо бы другой шрифт».
 *
 * От тяжёлого к лёгкому, первое сработавшее правило решает. Рекомендация и
 * комментарий на ступень ниже ошибки: «не работает фильтр — предлагаю…» —
 * пожелание, а не авария. Отметка «работает верно» — всегда низкая.
 */
export function feedbackAutoSeverity(text: string, kind: FeedbackKind): FeedbackSeverity {
  if (kind === "WORKS") return "LOW";
  const folded = foldFeedbackText(text);
  const defect = kind === "DEFECT";
  if (hit(folded, CRITICAL)) return defect ? "CRITICAL" : "HIGH";
  if (defect && hit(folded, MONEY)) return "CRITICAL";
  if (hit(folded, HIGH)) return defect ? "HIGH" : "MEDIUM";
  if (hit(folded, LOW)) return "LOW";
  return defect ? "MEDIUM" : "LOW";
}

// ───────────────────────────── Разбор отправки ───────────────────────────

export interface FeedbackInput {
  readonly kind: unknown;
  readonly text: unknown;
  /** Адрес экрана — `location.hash`. */
  readonly route: unknown;
  /** Подпись раздела из разметки (`[aria-current="page"]`). */
  readonly section: unknown;
  /** Код объекта из `[data-project-code]`, если открыта карточка. */
  readonly objectCode: unknown;
  /** Подпись выбранной вкладки (`[role="tab"][aria-selected="true"]`). */
  readonly tab: unknown;
  readonly width: unknown;
}

export interface PreparedFeedback {
  readonly kind: FeedbackKind;
  readonly text: string;
  readonly routeTemplate: string;
  readonly section: string;
  readonly objectCode: string | null;
  readonly tab: string;
  readonly device: string;
  readonly viewportWidth: number | null;
  readonly severityAuto: FeedbackSeverity;
}

export type FeedbackPreparation =
  | { readonly ok: true; readonly value: PreparedFeedback }
  | { readonly ok: false; readonly error: string };

/**
 * Проверить и свести к записи то, что прислала кнопка. Ни одно значение не
 * берётся на веру: шаблон считается из адреса, устройство — из ширины,
 * критичность — из текста и вида. Отказ — значением с текстом для человека.
 */
export function prepareFeedback(input: FeedbackInput): FeedbackPreparation {
  if (!isFeedbackKind(input.kind)) return { ok: false, error: FEEDBACK_KIND_UNKNOWN };
  // Нулевой знак PostgreSQL в тексте не принимает: запись упала бы сбоем
  // базы вместо внятного отказа.
  const text = (typeof input.text === "string" ? input.text : "").replaceAll("\u0000", "").trim();
  if (text.length < FEEDBACK_TEXT_MIN) return { ok: false, error: FEEDBACK_TEXT_TOO_SHORT };
  if (text.length > FEEDBACK_TEXT_MAX) return { ok: false, error: FEEDBACK_TEXT_TOO_LONG };
  if (feedbackHasContacts(text)) return { ok: false, error: FEEDBACK_TEXT_HAS_CONTACTS };

  const width = parseViewportWidth(input.width);
  return {
    ok: true,
    value: {
      kind: input.kind,
      text,
      routeTemplate: feedbackRouteTemplate(input.route),
      section: label(input.section, SECTION_MAX),
      objectCode: feedbackObjectCode(input.objectCode),
      tab: label(input.tab, TAB_MAX),
      device: feedbackDevice(width),
      viewportWidth: width,
      severityAuto: feedbackAutoSeverity(text, input.kind),
    },
  };
}
