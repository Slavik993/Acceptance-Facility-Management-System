import { useEffect, useState } from "react";
import type { CurrentUser, Organization, ProjectSummary } from "@priyomka/contracts";
import { fetchOrganization } from "./api.js";

/**
 * Экран первого входа заказчика (этап Э8, ДР-11).
 *
 * Показывается заказчику, пока `User.lastSeenAt` пуст: значит, он ещё не заходил.
 * Три текстовых блока без иллюстраций:
 * 1. «Что вы здесь видите» — вкладки объекта строкой на каждую.
 * 2. «Что нужно от вас» — смотреть ход работ, подписывать акты, не пересылать ссылку.
 * 3. «Как связаться» — организация (название, телефон, почта) и имя прораба.
 *
 * Ключевое действие — «Перейти к объекту»: открывает обзор его объекта.
 *
 * Повторно открывается из «Ещё → Как пользоваться».
 */

export function FirstLogin({
  user,
  project,
  onContinue,
  onHowTo,
}: {
  user: CurrentUser;
  project: ProjectSummary | null;
  onContinue: () => void;
  onHowTo: () => void;
}): React.JSX.Element {
  const [seen, setSeen] = useState(false);

  /* Связаться с организацией: вошедшему доступны только её
     название, а телефон и почта — полная карточка организации,
     один запрос на экран. */
  const [organization, setOrganization] = useState<Organization | null>(null);
  useEffect(() => {
    void fetchOrganization()
      .then(setOrganization)
      .catch(() => setOrganization(null));
  }, []);

  /* Строка связи: название организации, телефон и почта —
     непустые звенья через точку с запятой. */
  const связать = organization === null
    ? user.organization.name
    : [organization.name, organization.phone, organization.email]
        .filter((значение) => значение !== null)
        .join(" · ");

  /* Отмечаем, что заказчик видел экран: при первом нажатии «Перейти»
     ставим отметку захода, чтобы повторно экран не показывался. */
  const handleContinue = (): void => {
    if (seen) return;
    setSeen(true);
    onContinue();
  };

  return (
    <div className="stack stack--loose" role="dialog" aria-label="Первый вход">
      <div className="panel panel--pad">
        <h1 className="t-h2">Добро пожаловать в «Приёмку»</h1>
        {project !== null && (
          <p className="t-sm t-muted">
            Объект {project.code} · {project.address}
          </p>
        )}
      </div>

      {/* Блок 1: что видит заказчик */}
      <section className="panel panel--pad stack stack--tight">
        <h2 className="t-h3">Что вы здесь видите</h2>
        <p className="t-sm"><b>Обзор</b> — состояние объекта и что нового с прошлого входа.</p>
        <p className="t-sm"><b>Работа</b> — этапы и сроки; «принято» — то, что прораб проверил и отметил.</p>
        <p className="t-sm"><b>Смета</b> — итог для вас и позиции работ.</p>
        <p className="t-sm"><b>Отчёт</b> — снимки выполненной работы по дням.</p>
        <p className="t-sm"><b>Документы</b> — акты выполненных работ для печати.</p>
      </section>

      {/* Блок 2: что нужно от заказчика */}
      <section className="panel panel--pad stack stack--tight">
        <h2 className="t-h3">Что нужно от вас</h2>
        <p className="t-sm">Смотреть ход работ, когда удобно: новое собирается в начале «Обзора».</p>
        <p className="t-sm">Подписывать акты на бумаге — их приносит прораб; подписанный экземпляр появится в «Документах».</p>
        <p className="t-sm">Ссылку для входа не пересылайте: она равна доступу к вашему объекту.</p>
      </section>

      {/* Блок 3: как связаться */}
      <section className="panel panel--pad stack stack--tight">
        <h2 className="t-h3">Как связаться</h2>
        {project !== null && (
          <>
            <p className="t-sm">{связать}</p>
            {project.foreman !== null && (
              <p className="t-sm">Прораб объекта: {project.foreman.name}</p>
            )}
          </>
        )}
      </section>

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={handleContinue}
        disabled={seen}
      >
        {seen ? "Загрузка…" : "Перейти к объекту"}
      </button>

      <button
        type="button"
        className="btn btn--text btn--block"
        onClick={onHowTo}
      >
        Ещё → Как пользоваться
      </button>
    </div>
  );
}
