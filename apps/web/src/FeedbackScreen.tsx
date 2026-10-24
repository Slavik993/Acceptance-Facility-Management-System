import { useState, useEffect, useCallback } from "react";
import type { FeedbackRow, FeedbackDigest } from "@priyomka/contracts";
import {
  FEEDBACK_KIND_LABEL, FEEDBACK_SEVERITY_LABEL, FEEDBACK_STATUS_LABEL,
  FEEDBACK_KINDS, FEEDBACK_SEVERITIES, FEEDBACK_STATUSES,
  type FeedbackKind, type FeedbackSeverity, type FeedbackStatus,
} from "@priyomka/domain";
import { errorMessage } from "./api.js";

/**
 * Экран «Замечания» — пункт в «Ещё» уровню руководителя.
 *
 * Плитки «Новых», «В работе», «Критичных открытых», «Всего»;
 * отбор по состоянию, критичности и виду;
 * строка: дата, вид, критичность, состояние, роль, экран, объект,
 * устройство, текст, «Что сделано», ссылка на снимок;
 * разбор на месте; «Выгрузить в Excel».
 */

interface FeedbackScreenProps {
  onBack: () => void;
}

export function FeedbackScreen(_props: FeedbackScreenProps): React.JSX.Element {
  const [digest, setDigest] = useState<FeedbackDigest | null>(null);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Отборы
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [filterKind, setFilterKind] = useState<string>("");

  // Разбор
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [reviewSeverity, setReviewSeverity] = useState<string>("");
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Digest
      const digestResp = await fetch("/api/feedback/digest");
      if (!digestResp.ok) throw new Error("Не удалось загрузить сводку");
      const digestData = await digestResp.json();
      setDigest(digestData);

      // Rows
      const params = new URLSearchParams({ page: String(page) });
      if (filterStatus) params.set("status", filterStatus);
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterKind) params.set("kind", filterKind);

      const rowsResp = await fetch(`/api/feedback?${params}`);
      if (!rowsResp.ok) throw new Error("Не удалось загрузить замечания");
      const rowsData = await rowsResp.json();
      setRows(rowsData.rows);
      setTotal(rowsData.total);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterSeverity, filterKind]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id: string) => {
    try {
      const body: Record<string, string> = {};
      if (reviewStatus) body.status = reviewStatus;
      if (reviewSeverity) body.severity = reviewSeverity;
      if (reviewNote) body.note = reviewNote;

      const resp = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message ?? `Код ${resp.status}`);
      }

      // Reload
      await load();
      setReviewingId(null);
      setReviewStatus("");
      setReviewSeverity("");
      setReviewNote("");
    } catch (cause: unknown) {
      alert(errorMessage(cause));
    }
  };

  const handleExport = async () => {
    try {
      const resp = await fetch("/api/feedback/book", { credentials: "include" });
      if (!resp.ok) throw new Error("Не удалось выгрузить");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Замечания.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (cause: unknown) {
      alert(errorMessage(cause));
    }
  };

  if (loading && !digest) {
    return (
      <div className="empty">
        <p className="skeleton skeleton--row" style={{ width: "60%" }} />
        <p className="skeleton skeleton--row" style={{ width: "40%" }} />
      </div>
    );
  }

  if (error && !digest) {
    return (
      <div className="empty">
        <p className="empty__title">Ошибка</p>
        <p className="empty__text">{error}</p>
      </div>
    );
  }

  return (
    <div className="panel">
      {/* Плитки */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <div className="figure">
          <span className="figure__label">Новых</span>
          <span className="figure__value figure__value--h2">{digest?.fresh ?? 0}</span>
        </div>
        <div className="figure">
          <span className="figure__label">В работе</span>
          <span className="figure__value figure__value--h2">{digest?.inWork ?? 0}</span>
        </div>
        <div className="figure">
          <span className="figure__label">Критичных открытых</span>
          <span className="figure__value figure__value--h2">{digest?.criticalOpen ?? 0}</span>
        </div>
        <div className="figure">
          <span className="figure__label">Всего</span>
          <span className="figure__value figure__value--h2">{digest?.total ?? 0}</span>
        </div>
      </div>

      {/* Отборы */}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        <select
          className="input"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ maxWidth: "160px" }}
        >
          <option value="">Все состояния</option>
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s as FeedbackStatus]}</option>
          ))}
        </select>
        <select
          className="input"
          value={filterSeverity}
          onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}
          style={{ maxWidth: "160px" }}
        >
          <option value="">Вся критичность</option>
          {FEEDBACK_SEVERITIES.map((s) => (
            <option key={s} value={s}>{FEEDBACK_SEVERITY_LABEL[s as FeedbackSeverity]}</option>
          ))}
        </select>
        <select
          className="input"
          value={filterKind}
          onChange={(e) => { setFilterKind(e.target.value); setPage(1); }}
          style={{ maxWidth: "160px" }}
        >
          <option value="">Все виды</option>
          {FEEDBACK_KINDS.map((k) => (
            <option key={k} value={k}>{FEEDBACK_KIND_LABEL[k as FeedbackKind]}</option>
          ))}
        </select>
        <button className="btn btn--primary" onClick={handleExport}>
          Выгрузить в Excel
        </button>
      </div>

      {/* Список */}
      <div className="datatable">
        <div className="table-scroll">
          <table className="datatable__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Вид</th>
                <th>Критичность</th>
                <th>Состояние</th>
                <th>Экран</th>
                <th>Текст</th>
                <th>Что сделано</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "var(--space-5)" }}>
                    Замечаний не найдено
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)" }}>
                      {new Date(row.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td>
                      <span className={`pill pill--status-${row.kind.toLowerCase()}`}>
                        {FEEDBACK_KIND_LABEL[row.kind as FeedbackKind]}
                      </span>
                    </td>
                    <td>
                      <span className={`pill pill--status-${row.severity.toLowerCase()}`}>
                        {FEEDBACK_SEVERITY_LABEL[row.severity as FeedbackSeverity]}
                      </span>
                    </td>
                    <td>
                      <span className={`pill pill--status-${row.status.toLowerCase()}`}>
                        {FEEDBACK_STATUS_LABEL[row.status as FeedbackStatus]}
                      </span>
                    </td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[row.section, row.objectCode, row.tab].filter(Boolean).join(" · ")}
                    </td>
                    <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.text}
                    </td>
                    <td style={{ maxWidth: "200px" }}>
                      {reviewingId === row.id ? (
                        <div className="stack stack--tight" style={{ gap: "var(--space-2)" }}>
                          <select
                            className="input"
                            value={reviewStatus}
                            onChange={(e) => setReviewStatus(e.target.value)}
                            style={{ fontSize: "var(--fs-sm)" }}
                          >
                            <option value="">Состояние</option>
                            {FEEDBACK_STATUSES.map((s) => (
                              <option key={s} value={s}>{FEEDBACK_STATUS_LABEL[s as FeedbackStatus]}</option>
                            ))}
                          </select>
                          <select
                            className="input"
                            value={reviewSeverity}
                            onChange={(e) => setReviewSeverity(e.target.value)}
                            style={{ fontSize: "var(--fs-sm)" }}
                          >
                            <option value="">Критичность</option>
                            {FEEDBACK_SEVERITIES.map((s) => (
                              <option key={s} value={s}>{FEEDBACK_SEVERITY_LABEL[s as FeedbackSeverity]}</option>
                            ))}
                          </select>
                          <input
                            className="input"
                            placeholder="Что сделано"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            maxLength={2000}
                            style={{ fontSize: "var(--fs-sm)" }}
                          />
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <button
                              className="btn btn--primary"
                              onClick={() => handleReview(row.id)}
                              style={{ fontSize: "var(--fs-sm)", padding: "var(--space-1) var(--space-2)" }}
                            >
                              Сохранить
                            </button>
                            <button
                              className="btn btn--text"
                              onClick={() => setReviewingId(null)}
                              style={{ fontSize: "var(--fs-sm)" }}
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {row.note ? (
                            <span style={{ fontSize: "var(--fs-sm)", color: "var(--ink-2)" }}>{row.note}</span>
                          ) : (
                            <button
                              className="btn btn--text"
                              onClick={() => setReviewingId(row.id)}
                              style={{ fontSize: "var(--fs-sm)", padding: 0 }}
                            >
                              Разобрать
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {total > 50 && (
          <div className="datatable__foot">
            <div className="datatable__pager">
              <button
                className="btn btn--text"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ opacity: page <= 1 ? 0.5 : 1 }}
              >
                ← Назад
              </button>
              <span className="t-sm" style={{ color: "var(--ink-2)" }}>
                Страница {page} · Всего {total}
              </span>
              <button
                className="btn btn--text"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 50 >= total}
                style={{ opacity: page * 50 >= total ? 0.5 : 1 }}
              >
                Вперёд →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
