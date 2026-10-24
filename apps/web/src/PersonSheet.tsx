import { useState } from "react";
import type { ProjectSummary } from "@priyomka/contracts";
import { invitePerson, errorMessage } from "./api.js";
import { useModalDialog } from "./modal.js";

/**
 * Лист «Новый человек» (этап Э8, ДР-11).
 *
 * Открывается шагом «Вход заказчику» блока «Выполнено N из M» на «Обзоре»
 * и выдаёт вход заказчику: имя, роль «Заказчик», привязка к объекту.
 *
 * Токен входа возвращается и показывается — ссылка для входа заказчика.
 */

export function PersonSheet({
  project,
  onClose,
}: {
  project: ProjectSummary;
  onClose: () => void;
}): React.JSX.Element {
  const { dialog, first } = useModalDialog<HTMLInputElement>(onClose);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const ready = name.trim().length >= 2;

  const submit: React.SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);

    void invitePerson({
      name: name.trim(),
      role: "CLIENT",
      email: null,
      phone: null,
      clientId: project.client.id,
    })
      .then((issued) => {
        setToken(issued.token);
        setBusy(false);
      })
      .catch((cause: unknown) => {
        setError(errorMessage(cause));
        setBusy(false);
      });
  };

  return (
    <>
      <button type="button" className="scrim" aria-label="Закрыть" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Новый человек" ref={dialog}>
        <p className="t-h3">Новый человек</p>

        {token !== null ? (
          <div className="stack stack--tight">
            <p className="t-sm">
              Вход выдан. Отправьте эту ссылку человеку:
            </p>
            <p className="t-sm t-muted">
              <code style={{ wordBreak: "break-all" }}>
                {window.location.origin}#?token={token}
              </code>
            </p>
            <button type="button" className="btn btn--text btn--block" onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <form className="stack stack--tight" onSubmit={submit}>
            <div className="field">
              <span className="field__label">Имя</span>
              <input
                className="input"
                value={name}
                maxLength={200}
                placeholder="Имя заказчика"
                onChange={(event) => { setName(event.target.value); }}
                ref={first}
                autoFocus
              />
              <span className="field__hint">
                Роль «Заказчик», объект «{project.code}»
              </span>
            </div>

            {error !== null && <p className="field__error" role="alert">{error}</p>}

            <button
              type="submit"
              className="btn btn--primary btn--block"
              data-loading={busy || undefined}
              disabled={busy || !ready}
            >
              Выдать вход
            </button>
            <button type="button" className="btn btn--text btn--block" onClick={onClose}>
              Отмена
            </button>
          </form>
        )}
      </div>
    </>
  );
}
