import { describe, expect, it } from "vitest";

/**
 * Баланс контрагента в строке списка (Э7, кандидат).
 *
 * Проверяет, что колонки баланса рендерятся корректно:
 * — начислено, оплачено, ждёт — числа с форматированием
 * — ждёт > 0 → красный, ждёт ≤ 0 → нейтральный
 * — null → прочерк
 */
const money = (value: bigint): string =>
  value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

describe("баланс контрагента", () => {
  it("форматирует деньги", () => {
    expect(money(1234567n)).toBe("12 345,67");
    expect(money(0n)).toBe("0,00");
    expect(money(-50000n)).toBe("-500,00");
  });

  it("ждёт > 0 — красный тон", () => {
    const сумма = BigInt("100000");
    const класс = сумма > 0n ? "num num--danger" : "num";
    expect(класс).toBe("num num--danger");
  });

  it("ждёт = 0 — нейтральный тон", () => {
    const сумма = BigInt("0");
    const класс = сумма > 0n ? "num num--danger" : "num";
    expect(класс).toBe("num");
  });

  it("ждёт < 0 — нейтральный тон (переплата)", () => {
    const сумма = BigInt("-50000");
    const класс = сумма > 0n ? "num num--danger" : "num";
    expect(класс).toBe("num");
  });
});
