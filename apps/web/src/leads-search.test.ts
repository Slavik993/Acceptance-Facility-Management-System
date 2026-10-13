import { describe, expect, it } from "vitest";
import type { LeadCard } from "@priyomka/contracts";

/**
 * Поиск по воронке заявок (Э7, кандидат).
 *
 * Проверяет функцию `ищет`: номер, имя, телефон, регистр, пробелы.
 */
typefixture const заявка = (
  number: number,
  name: string,
  phone: string,
): LeadCard => ({
  id: "00000000-0000-0000-0000-000000000001",
  number,
  name,
  phone,
  address: null,
  note: null,
  stage: "FIRST_CONTACT",
  outcome: "OPEN",
  lostReason: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  repairTypeId: null,
  guideline: null,
  tasks: [],
  projectCode: null,
  anonymizedAt: null,
});

const ищет = (карточка: LeadCard, запрос: string): boolean => {
  if (запрос === "") return true;
  const q = запрос.toLowerCase().replace(/\s+/gu, " ").trim();
  const поле = (v: string | null): string => (v ?? "").toLowerCase().replace(/\s+/gu, " ").trim();
  return (
    поле(String(карточка.number)).includes(q) ||
    поле(карточка.name).includes(q) ||
    поле(карточка.phone).includes(q)
  );
};

describe("поиск по заявкам", () => {
  it("пустой запрос находит всё", () => {
    const карточка = заявка(1001, "Ирина Ковалёва", "9001234567");
    expect(ищет(карточка, "")).toBe(true);
  });

  it("ищет по номеру", () => {
    const карточка = заявка(1001, "Ирина", "9001234567");
    expect(ищет(карточка, "1001")).toBe(true);
    expect(ищет(карточка, "10")).toBe(true);
    expect(ищет(карточка, "999")).toBe(false);
  });

  it("ищет по имени, без учёта регистра", () => {
    const карточка = заявка(1001, "Ирина Ковалёва", "9001234567");
    expect(ищет(карточка, "ирина")).toBe(true);
    expect(ищет(карточка, "ИРИНА")).toBe(true);
    expect(ищет(карточка, "Ковалёва")).toBe(true);
    expect(ищет(карточка, "иванов")).toBe(false);
  });

  it("ищет по телефону", () => {
    const карточка = заявка(1001, "Ирина", "9001234567");
    expect(ищет(карточка, "900")).toBe(true);
    expect(ищет(карточка, "1234567")).toBe(true);
    expect(ищет(карточка, "800")).toBe(false);
  });

  it("нормализует пробелы", () => {
    const карточка = заявка(1001, "Ирина    Ковалёва", "900 123 45 67");
    expect(ищет(карточка, "Ирина Ковалёва")).toBe(true);
    expect(ищет(карточка, "Ирина    Ковалёва")).toBe(true);
    expect(ищет(карточка, "900 123")).toBe(true);
  });
});
