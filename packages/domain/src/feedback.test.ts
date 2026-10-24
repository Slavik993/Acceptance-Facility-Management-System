import { describe, expect, it } from "vitest";
import {
  FEEDBACK_KINDS, FEEDBACK_KIND_HINT, FEEDBACK_KIND_LABEL, FEEDBACK_SEVERITIES, FEEDBACK_SEVERITY_LABEL,
  FEEDBACK_STATUSES, FEEDBACK_STATUS_LABEL, FEEDBACK_TEXT_HAS_CONTACTS, FEEDBACK_TEXT_MAX,
  FEEDBACK_TEXT_TOO_LONG, FEEDBACK_TEXT_TOO_SHORT, FEEDBACK_KIND_UNKNOWN, CLOSED_FEEDBACK_STATUSES,
  feedbackAutoSeverity, feedbackDevice, feedbackHasContacts, feedbackObjectCode, feedbackRouteTemplate,
  isFeedbackKind, isFeedbackSeverity, isFeedbackStatus, parseViewportWidth, prepareFeedback,
  type FeedbackInput,
} from "./feedback.js";

const input = (patch: Partial<FeedbackInput> = {}): FeedbackInput => ({
  kind: "DEFECT",
  text: "Итог раздела налезает на соседнюю колонку",
  route: "#R-99/estimate",
  section: "Объекты",
  objectCode: "R-99",
  tab: "Смета",
  width: "1440",
  ...patch,
});

describe("замечания: перечни", () => {
  it("у каждого вида, критичности и состояния есть подпись", () => {
    for (const kind of FEEDBACK_KINDS) {
      expect(FEEDBACK_KIND_LABEL[kind].length).toBeGreaterThan(0);
      expect(FEEDBACK_KIND_HINT[kind].length).toBeGreaterThan(0);
    }
    for (const severity of FEEDBACK_SEVERITIES) expect(FEEDBACK_SEVERITY_LABEL[severity].length).toBeGreaterThan(0);
    for (const status of FEEDBACK_STATUSES) expect(FEEDBACK_STATUS_LABEL[status].length).toBeGreaterThan(0);
  });

  it("закрыты только «сделано» и «отклонено»", () => {
    expect([...CLOSED_FEEDBACK_STATUSES].sort()).toEqual(["DECLINED", "DONE"]);
  });

  it("проверки перечней не пропускают чужое", () => {
    expect(isFeedbackKind("WORKS")).toBe(true);
    expect(isFeedbackKind("works")).toBe(false);
    expect(isFeedbackSeverity("CRITICAL")).toBe(true);
    expect(isFeedbackSeverity(1)).toBe(false);
    expect(isFeedbackStatus("DONE")).toBe(true);
    expect(isFeedbackStatus("FIXED")).toBe(false);
  });
});

describe("замечания: шаблон адреса экрана", () => {
  it("код объекта заменяется меткой, вкладка остаётся", () => {
    expect(feedbackRouteTemplate("#R-99/estimate")).toBe("#[объект]/estimate");
    expect(feedbackRouteTemplate("#R-31")).toBe("#[объект]");
    expect(feedbackRouteTemplate("#r-7/acceptance")).toBe("#[объект]/acceptance");
  });

  it("отбор после «?» не записывается", () => {
    expect(feedbackRouteTemplate("#R-99/expenses?draft")).toBe("#[объект]/expenses");
    expect(feedbackRouteTemplate("#R-99/report?since=2026-10-24T10:00:00Z")).toBe("#[объект]/report");
  });

  it("полный адрес сводится к части после «#»", () => {
    expect(feedbackRouteTemplate("https://priyomka.example/#projects")).toBe("#projects");
  });

  it("пустой адрес — главный экран", () => {
    expect(feedbackRouteTemplate("")).toBe("#");
    expect(feedbackRouteTemplate("#")).toBe("#");
    expect(feedbackRouteTemplate(undefined)).toBe("#");
  });

  it("всё, что не похоже на название раздела, — [id]", () => {
    expect(feedbackRouteTemplate("#leads/89001234567")).toBe("#leads/[id]");
    expect(feedbackRouteTemplate("#Иванов")).toBe("#[id]");
    expect(feedbackRouteTemplate("#a/b/c/d/e/f")).toBe("#a/b/c/d");
  });

  it("второй проход шаблон не меняет", () => {
    for (const raw of ["#R-99/estimate", "#leads/89001234567", "#projects"]) {
      const once = feedbackRouteTemplate(raw);
      expect(feedbackRouteTemplate(once)).toBe(once);
    }
  });
});

describe("замечания: объект и устройство", () => {
  it("код объекта приводится к одному виду, прочее отвергается", () => {
    expect(feedbackObjectCode(" r-99 ")).toBe("R-99");
    expect(feedbackObjectCode("R-99/estimate")).toBeNull();
    expect(feedbackObjectCode("")).toBeNull();
    expect(feedbackObjectCode(99)).toBeNull();
  });

  it("ширина окна — целое от 200 до 10000", () => {
    expect(parseViewportWidth("390")).toBe(390);
    expect(parseViewportWidth(1440)).toBe(1440);
    expect(parseViewportWidth("199")).toBeNull();
    expect(parseViewportWidth("12px")).toBeNull();
    expect(parseViewportWidth(null)).toBeNull();
  });

  it("устройство — по границам раскладок продукта", () => {
    expect(feedbackDevice(390)).toBe("телефон");
    expect(feedbackDevice(480)).toBe("телефон");
    expect(feedbackDevice(481)).toBe("планшет");
    expect(feedbackDevice(1099)).toBe("планшет");
    expect(feedbackDevice(1100)).toBe("компьютер");
    expect(feedbackDevice(null)).toBe("не определено");
  });
});

describe("замечания: контакты в тексте", () => {
  it("телефон, почта, имя и ссылка на мессенджер находятся", () => {
    expect(feedbackHasContacts("позвоните +7 900 000-00-00")).toBe(true);
    expect(feedbackHasContacts("8 (900) 000 00 00")).toBe(true);
    expect(feedbackHasContacts("пишите ivanov@mail.ru")).toBe(true);
    expect(feedbackHasContacts("я в телеграме @ivanov_prorab")).toBe(true);
    expect(feedbackHasContacts("ссылка t.me/ivanov")).toBe(true);
  });

  it("суммы, количества и номера норм телефоном не считаются", () => {
    expect(feedbackHasContacts("итог 3 760 000 ₽ не сходится")).toBe(false);
    expect(feedbackHasContacts("ГОСТ Р 7.0.11-2011")).toBe(false);
    expect(feedbackHasContacts("принято 406,91 м²")).toBe(false);
  });
});

describe("замечания: критичность по правилам", () => {
  it("авария в ошибке — критично, в рекомендации — высокая", () => {
    expect(feedbackAutoSeverity("Не сохраняется приёмка позиции", "DEFECT")).toBe("CRITICAL");
    expect(feedbackAutoSeverity("Фильтр не работает, предлагаю убрать", "IDEA")).toBe("HIGH");
  });

  it("деньги в ошибке — критично, в рекомендации — по прочим правилам", () => {
    expect(feedbackAutoSeverity("В транше другая сумма", "DEFECT")).toBe("CRITICAL");
    expect(feedbackAutoSeverity("Хорошо бы показывать сумму крупнее", "IDEA")).toBe("LOW");
  });

  it("основа слова ловит формы, граница слова — по букве", () => {
    expect(feedbackAutoSeverity("Показывает ошибки при входе", "DEFECT")).toBe("HIGH");
    expect(feedbackAutoSeverity("Поставка материалов не отражена", "DEFECT")).toBe("MEDIUM");
    expect(feedbackAutoSeverity("Открылся не тот объект", "DEFECT")).toBe("HIGH");
    expect(feedbackAutoSeverity("Что-то не так с отступом", "DEFECT")).toBe("MEDIUM");
  });

  it("лёгкие слова опускают до низкой, «ё» равна «е»", () => {
    expect(feedbackAutoSeverity("Опечатка в заголовке", "DEFECT")).toBe("LOW");
    expect(feedbackAutoSeverity("Итог съёхал вправо", "DEFECT")).toBe("HIGH");
    expect(feedbackAutoSeverity("Зависает при сохранении", "DEFECT")).toBe("CRITICAL");
  });

  it("без признаков: ошибка — средняя, прочее — низкая; «работает верно» — всегда низкая", () => {
    expect(feedbackAutoSeverity("Непонятная подпись у кнопки", "DEFECT")).toBe("MEDIUM");
    expect(feedbackAutoSeverity("Непонятная подпись у кнопки", "COMMENT")).toBe("LOW");
    expect(feedbackAutoSeverity("Сбой исправили, теперь всё не работает как надо", "WORKS")).toBe("LOW");
  });
});

describe("замечания: разбор отправки", () => {
  it("правильная отправка сводится к записи", () => {
    const prepared = prepareFeedback(input());
    expect(prepared).toEqual({
      ok: true,
      value: {
        kind: "DEFECT",
        text: "Итог раздела налезает на соседнюю колонку",
        routeTemplate: "#[объект]/estimate",
        section: "Объекты",
        objectCode: "R-99",
        tab: "Смета",
        device: "компьютер",
        viewportWidth: 1440,
        severityAuto: "HIGH",
      },
    });
  });

  it("вид вне перечня — отказ с текстом", () => {
    expect(prepareFeedback(input({ kind: "BUG" }))).toEqual({ ok: false, error: FEEDBACK_KIND_UNKNOWN });
  });

  it("короткий, длинный и с контактом текст — отказы", () => {
    expect(prepareFeedback(input({ text: "  да " }))).toEqual({ ok: false, error: FEEDBACK_TEXT_TOO_SHORT });
    expect(prepareFeedback(input({ text: "а".repeat(FEEDBACK_TEXT_MAX + 1) }))).toEqual({ ok: false, error: FEEDBACK_TEXT_TOO_LONG });
    expect(prepareFeedback(input({ text: "Перезвоните 89000000000" }))).toEqual({ ok: false, error: FEEDBACK_TEXT_HAS_CONTACTS });
  });

  it("нулевой знак вырезается, подписи чистятся и обрезаются", () => {
    const prepared = prepareFeedback(input({
      text: "Итог\u0000 раздела",
      section: "  Объекты\n\tи заявки  ",
      tab: "в".repeat(200),
      objectCode: "R-99/estimate",
      width: "abc",
    }));
    if (!prepared.ok) throw new Error(prepared.error);
    expect(prepared.value.text).toBe("Итог раздела");
    expect(prepared.value.section).toBe("Объекты и заявки");
    expect(prepared.value.tab).toHaveLength(80);
    expect(prepared.value.objectCode).toBeNull();
    expect(prepared.value.device).toBe("не определено");
  });
});
