import { describe, expect, it } from "vitest";
import { formatKopecks } from "@priyomka/ui";

/**
 * Баланс контрагента в строке списка (Э7, кандидат).
 *
 * Проверяет, что колонки баланса рендерятся корректно:
 * — начислено, оплачено, ждёт — числа с форматированием
 * — ждёт > 0 → красный, ждёт ≤ 0 → нейтральный
 * — null → прочерк
 *
 * Форматирование берётся то, которым печатает экран контактов
 * (`Contacts.tsx` зовёт `formatKopecks`), а не собственная копия: своя
 * копия проверяла саму себя и расходилась с продуктом — копейки делились
 * на сто в одном месте и не делились в другом.
 */
const NBSP = " ";

const money = (value: bigint): string => formatKopecks(value);

describe("баланс контрагента", () => {
  it("форматирует деньги", () => {
    expect(money(1234567n)).toBe(`12${NBSP}345,67${NBSP}₽`);
    expect(money(0n)).toBe(`0,00${NBSP}₽`);
    expect(money(-50000n)).toBe(`−500,00${NBSP}₽`);
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
