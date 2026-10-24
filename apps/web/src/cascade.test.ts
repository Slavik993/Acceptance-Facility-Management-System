import { describe, expect, it } from "vitest";
import { daysBetween, shiftDay } from "@priyomka/domain";

/**
 * Каскадный сдвиг этапов (Э7, кандидат).
 *
 * Проверяет:
 * - daysBetween считает разницу дат
 * - shiftDay сдвигает день на N суток
 * - каскад: последующие этапы сдвигаются на ту же разницу
 */
describe("каскадный сдвиг", () => {
  it("считает разницу между датами", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-08", "2026-01-01")).toBe(-7);
  });

  it("сдвигает день на N суток", () => {
    expect(shiftDay("2026-01-01", 7)).toBe("2026-01-08");
    expect(shiftDay("2026-01-08", -7)).toBe("2026-01-01");
    expect(shiftDay("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("каскад: все последующие сдвигаются на ту же разницу", () => {
    const этапы = [
      { id: "1", startsOn: "2026-01-01", endsOn: "2026-01-07", order: 0 },
      { id: "2", startsOn: "2026-01-08", endsOn: "2026-01-14", order: 1 },
      { id: "3", startsOn: "2026-01-15", endsOn: "2026-01-21", order: 2 },
    ];
    // Сдвигаем этап 1 на +3 дня
    const delta = 3;
    const found = этапы.findIndex((s) => s.id === "1");
    const результат = этапы.map((s, i) => {
      if (i <= found) return s;
      return {
        ...s,
        startsOn: shiftDay(s.startsOn, delta),
        endsOn: shiftDay(s.endsOn, delta),
      };
    });
    expect(результат[0]?.startsOn).toBe("2026-01-01"); // не сдвинут
    expect(результат[1]?.startsOn).toBe("2026-01-11"); // +3
    expect(результат[1]?.endsOn).toBe("2026-01-17");   // +3
    expect(результат[2]?.startsOn).toBe("2026-01-18"); // +3
    expect(результат[2]?.endsOn).toBe("2026-01-24");   // +3
  });

  it("каскад с отрицательным сдвигом", () => {
    const этапы = [
      { id: "1", startsOn: "2026-01-01", endsOn: "2026-01-07", order: 0 },
      { id: "2", startsOn: "2026-01-08", endsOn: "2026-01-14", order: 1 },
    ];
    const delta = -2;
    const found = этапы.findIndex((s) => s.id === "1");
    const результат = этапы.map((s, i) => {
      if (i <= found) return s;
      return {
        ...s,
        startsOn: shiftDay(s.startsOn, delta),
        endsOn: shiftDay(s.endsOn, delta),
      };
    });
    expect(результат[1]?.startsOn).toBe("2026-01-06");
    expect(результат[1]?.endsOn).toBe("2026-01-12");
  });

  it("каскад: сдвиг на 0 ничего не меняет", () => {
    const этапы = [
      { id: "1", startsOn: "2026-01-01", endsOn: "2026-01-07" },
      { id: "2", startsOn: "2026-01-08", endsOn: "2026-01-14" },
    ];
    const delta = 0;
    const found = этапы.findIndex((s) => s.id === "1");
    const результат = этапы.map((s, i) => {
      if (i <= found) return s;
      return {
        ...s,
        startsOn: shiftDay(s.startsOn, delta),
        endsOn: shiftDay(s.endsOn, delta),
      };
    });
    expect(результат[1]?.startsOn).toBe("2026-01-08");
    expect(результат[1]?.endsOn).toBe("2026-01-14");
  });
});
