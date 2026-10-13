import { useCallback, useEffect, useState } from "react";
import type { ProjectFile, Role } from "@priyomka/contracts";
import { errorMessage, fetchFiles, uploadFile, deleteFile, fileUrl } from "./api.js";
import { Announce } from "./Announce.js";
import { Пусто } from "./empty.js";
import { useNarrow } from "./media.js";
import { formatDate } from "./status.js";

/**
 * Вкладка «Файлы» объекта (Э7, кандидат).
 *
 * Загружает руководитель и прораб. Все роли видят файлы объекта.
 * Файлы отображаются списком: имя, дата загрузки, описание.
 * Кликабельный — открывает файл в новой вкладке.
 */

const BYTE_LABELS = [
  { min: 1024 * 1024, label: "МБ" },
  { min: 1024, label: "КБ" },
];

const bytesLabel = (bytes: number): string => {
  const entry = BYTE_LABELS.find((b) => bytes >= b.min);
  if (entry === undefined) return `${bytes} Б`;
  const value = (bytes / entry.min).toFixed(1).replace(/\.0$/, "");
  return `${value} ${entry.label}`;
};

export function Files({
  code,
  role,
}: {
  code: string;
  role: Role;
}): React.JSX.Element {
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [объявление, setОбъявление] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [прикреплён, setПрикреплён] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const узко = useNarrow();

  const load = useCallback(() => {
    fetchFiles(code)
      .then((next) => { setFiles(next); setError(null); })
      .catch((cause: unknown) => { setError(errorMessage(cause)); });
  }, [code]);

  useEffect(load, [load]);

  const editable = role === "OWNER" || role === "FOREMAN";

  const handleUpload: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    void uploadFile(code, file, description || null)
      .then(() => {
        load();
        setDescription("");
        setПрикреплён(file.name);
        setОбъявление(`Файл «${file.name}» загружен`);
      })
      .catch((cause: unknown) => { setError(errorMessage(cause)); })
      .finally(() => { setUploading(false); });
    // Сброс input для повторной загрузки того же файла.
    event.target.value = "";
  };

  const handleDelete = (id: string): void => {
    setDeleteId(null);
    void deleteFile(code, id)
      .then(() => {
        load();
        setОбъявление("Файл удалён");
      })
      .catch((cause: unknown) => { setError(errorMessage(cause)); });
  };

  if (error !== null) {
    return <p className="field__error" role="alert">{error}</p>;
  }
  if (files === null) {
    return <p className="t-sm t-muted">Загружаем файлы…</p>;
  }

  return (
    <div className="stack stack--loose">
      <Announce text={объявление} />

      <div className="section-head section-head--action">
        <h2 className="t-h2">Файлы объекта</h2>
        {editable && (
          /* Тот же образец выбора файла, что у импорта сметы и
             обмерного плана: браузерная кнопка «Choose file» на
             английском и не подчиняется оформлению продукта. */
          <label className="filefield">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={handleUpload}
            />
            <span className="filefield__button btn--primary">
              <svg className="icon" aria-hidden="true"><use href="#i-plus" /></svg>
              Прикрепить
            </span>
            <span className="filefield__name">
              {прикреплён ?? "файл не выбран"}
            </span>
          </label>
        )}
      </div>

      {editable && (
        <div className="row row--wrap">
          <label className="field" style={{ flex: "1 1 200px", minWidth: "0" }}>
            <span className="field__label">Описание</span>
            <input
              className="input"
              type="text"
              maxLength={500}
              placeholder="Доп. соглашение, скан и т.д."
              value={description}
              onChange={(event) => { setDescription(event.target.value); }}
            />
          </label>
        </div>
      )}

      {files.length === 0 ? (
        <div className="empty">
          <p className="empty__title">{Пусто("файлы")}</p>
          <p className="empty__text">
            Загрузите договор, скан или фотографию — они появятся в списке ниже.
          </p>
        </div>
      ) : узко ? (
        <ul className="filelist">
          {files.map((file) => (
            <li className="filelist__item" key={file.id}>
              <a
                className="filelist__link"
                href={fileUrl(code, file.id)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg className="icon icon--sm filelist__icon" aria-hidden="true"><use href="#i-document" /></svg>
                <span className="filelist__name">{file.fileName}</span>
              </a>
              <span className="filelist__meta t-sm t-muted">
                {formatDate(file.uploadedAt.slice(0, 10))} · {bytesLabel(file.byteSize)}
              </span>
              {file.description !== null && (
                <span className="filelist__desc t-sm">{file.description}</span>
              )}
              {editable && deleteId === file.id && (
                <div className="filelist__acts">
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => { handleDelete(file.id); }}
                  >
                    Удалить
                  </button>
                  <button
                    type="button"
                    className="btn btn--text"
                    onClick={() => { setDeleteId(null); }}
                  >
                    Отмена
                  </button>
                </div>
              )}
              {editable && deleteId !== file.id && (
                <button
                  type="button"
                  className="btn btn--text"
                  onClick={() => { setDeleteId(file.id); }}
                >
                  Удалить
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <table className="table filetable">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Дата</th>
              <th>Размер</th>
              <th>Описание</th>
              {editable && <th>Действие</th>}
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>
                  <a href={fileUrl(code, file.id)} target="_blank" rel="noopener noreferrer">
                    {file.fileName}
                  </a>
                </td>
                <td>{formatDate(file.uploadedAt.slice(0, 10))}</td>
                <td>{bytesLabel(file.byteSize)}</td>
                <td>{file.description ?? "—"}</td>
                {editable && (
                  <td>
                    {deleteId === file.id ? (
                      <div className="filelist__acts">
                        <button
                          type="button"
                          className="btn btn--danger"
                          onClick={() => { handleDelete(file.id); }}
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          className="btn btn--text"
                          onClick={() => { setDeleteId(null); }}
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--text"
                        onClick={() => { setDeleteId(file.id); }}
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
