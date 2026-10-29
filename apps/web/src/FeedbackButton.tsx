import { useState, useRef } from "react";
import { useModalDialog } from "./modal.js";
import { useNarrow } from "./media.js";
import {
  FEEDBACK_KINDS, FEEDBACK_KIND_LABEL, FEEDBACK_KIND_HINT,
  FEEDBACK_TEXT_MAX, FEEDBACK_TEXT_HAS_CONTACTS, FEEDBACK_THANKS,
  feedbackHasContacts,
  type FeedbackKind,
} from "@priyomka/domain";

/**
 * Кнопка «Замечание» — виджет в правом нижнем углу.
 *
 * Рисуется для вошедшего пользователя любой роли.
 * На ширине до 480 px — значок без подписи над нижней панелью.
 * Окно — .sheet с ловушкой фокуса, Esc, возврат фокуса.
 */

const ВИДЫ = FEEDBACK_KINDS as readonly FeedbackKind[];

/** Где заказчик находился, когда писал. Читается из разметки. */
function обстановка(): {
  section: string;
  objectCode: string;
  tab: string;
  width: number;
  route: string;
} {
  const текст = (узел: Element | null): string => (узел?.textContent ?? "").trim();
  return {
    section: текст(document.querySelector('[aria-current="page"]'))
      || текст(document.querySelector('.cover .t-h1')) || "",
    objectCode: document.querySelector("[data-project-code]")?.getAttribute("data-project-code") ?? "",
    tab: текст(document.querySelector('[role="tab"][aria-selected="true"]')),
    width: window.innerWidth,
    route: window.location.hash || "#",
  };
}

export function FeedbackButton(): React.JSX.Element {
  const [открыт, setОткрыт] = useState(false);
  const узко = useNarrow();
  const кнопка = useRef<HTMLButtonElement>(null);

  const закрыть = (): void => {
    setОткрыт(false);
  };

  return (
    <>
      <button
        ref={кнопка}
        type="button"
        className={узко ? "btn btn--primary feedback__open feedback__open--icon" : "btn btn--primary feedback__open"}
        aria-label={узко ? "Замечание" : "Замечание о платформе"}
        onClick={() => { setОткрыт(true); }}
      >
        <svg className="icon" aria-hidden="true" style={{ width: 24, height: 24 }}>
          <use href="#i-request" />
        </svg>
        {!узко && "Замечание"}
      </button>
      {открыт && (
        <FeedbackSheet onClose={закрыть} />
      )}
    </>
  );
}

function FeedbackSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { dialog, first } = useModalDialog<HTMLTextAreaElement>(onClose);
  const [вид, setВид] = useState<FeedbackKind>("DEFECT");
  const [текст, setТекст] = useState("");
  const [идёт, setИдёт] = useState(false);
  const [отказ, setОтказ] = useState<string | null>(null);
  const [принято, setПринято] = useState(false);

  const контекст = обстановка();

  const готово = текст.trim().length >= 5 && текст.trim().length <= FEEDBACK_TEXT_MAX;

  const submit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!готово || идёт) return;
    setИдёт(true);
    setОтказ(null);

    // Проверка контактов на клиенте — дублирование серверного правила.
    if (feedbackHasContacts(текст)) {
      setОтказ(FEEDBACK_TEXT_HAS_CONTACTS);
      setИдёт(false);
      return;
    }

    void fetch("/api/feedback", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: вид,
        text: текст.trim(),
        route: контекст.route,
        section: контекст.section,
        objectCode: контекст.objectCode || undefined,
        tab: контекст.tab,
        width: контекст.width,
      }),
    })
      .then(async (ответ) => {
        if (!ответ.ok) {
          const body = (await ответ.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Запрос /api/feedback завершился кодом ${ответ.status}`);
        }
        setПринято(true);
      })
      .catch((причина: unknown) => {
        setОтказ(причина instanceof Error
          ? `Не удалось отправить: ${причина.message}`
          : "Не удалось отправить: связь не установлена.");
      })
      .finally(() => { setИдёт(false); });
  };

  return (
    <>
      <button type="button" className="scrim" aria-label="Закрыть" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Замечание о платформе"
        ref={dialog}
      >
        {/* Ручка листа */}
        <div className="sheet__handle">
          <div className="sheet__handle-bar" />
        </div>

        {/* Заголовок */}
        <div className="sheet__header">
          <h2 className="sheet__title">Замечание о платформе</h2>
          <button
            type="button"
            className="btn btn--text"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="sheet__body">
          {принято ? (
            <div className="stack stack--tight">
              <p className="t-body">{FEEDBACK_THANKS}</p>
              <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
                Готово
              </button>
            </div>
          ) : (
            <form className="stack stack--tight" onSubmit={submit}>
              {/* Виды */}
              <div className="field">
                <span className="field__label">Что это</span>
                <div className="segmented" role="group" aria-label="Вид замечания">
                  {ВИДЫ.map((к) => (
                    <button
                      key={к}
                      type="button"
                      className={`segmented__option ${вид === к ? "segmented__option--active" : ""}`}
                      aria-pressed={вид === к}
                      title={FEEDBACK_KIND_HINT[к]}
                      onClick={() => { setВид(к); }}
                    >
                      {FEEDBACK_KIND_LABEL[к]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Текст */}
              <label className="field">
                <span className="field__label">Замечание</span>
                <textarea
                  ref={first}
                  className="input"
                  value={текст}
                  maxLength={FEEDBACK_TEXT_MAX}
                  rows={5}
                  placeholder="Что не так или чего не хватает"
                  onChange={(event) => {
                    setТекст(event.target.value);
                    setОтказ(null);
                  }}
                />
                <span className="field__hint">
                  Не указывайте имена и телефоны — опишите, что не так и где.
                  <br />
                  {текст.length}/{FEEDBACK_TEXT_MAX}
                </span>
              </label>

              {/* Снимок — пока не поддерживается */}
              <p className="t-sm t-muted">
                Снимок экрана пока недоступен.
              </p>

              {/* Экран */}
              <p className="t-sm">
                <strong>Экран:</strong>{" "}
                {[контекст.section, контекст.objectCode, контекст.tab].filter(Boolean).join(" · ") || "Главная"}
              </p>

              {отказ !== null && <p className="field__error" role="alert">{отказ}</p>}

              <div className="sheet__footer">
                <button
                  type="submit"
                  className="btn btn--primary btn--block"
                  data-loading={идёт || undefined}
                  aria-disabled={идёт || !готово}
                  style={{ opacity: (идёт || !готово) ? 0.6 : 1 }}
                >
                  Отправить
                </button>
                <button type="button" className="btn btn--text btn--block" onClick={onClose}>
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
