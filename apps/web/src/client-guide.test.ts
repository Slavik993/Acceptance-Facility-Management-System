import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Памятка заказчику (ДР-11) называет только существующие вкладки и органы.
 *
 * Памятка показывается заказчику при первом входе и повторно —
 * «Ещё → Как пользоваться». Продукт меняется: вкладку переименуют,
 * и текст на экране будет называть вкладку, которой нет.
 *
 * Названия вкладок набраны тегом `<b>` в HTML-файле; каждое обязано
 * стоять в списке вкладок карточки (`TABS` в `ProjectCard.tsx`).
 */
const КОРЕНЬ = new URL("./", import.meta.url).pathname;
const ПАМЯТКА = readFileSync(new URL("../../../design/zakazchik.html", import.meta.url), "utf8");

const безКомментариев = (текст: string): string => текст
  .replace(/\{\/\*[\s\S]*?\*\/\}/gu, "")
  .replace(/\/\*[\s\S]*?\*\//gu, "")
  .replace(/^\s*\/\/.*$/gmu, "");

const исходники = readdirSync(КОРЕНЬ)
  .filter((имя) => /\.tsx?$/u.test(имя) && !имя.includes(".test.") && !имя.startsWith("api."))
  .map((имя) => безКомментариев(readFileSync(`${КОРЕНЬ}${имя}`, "utf8")))
  .join("\n");

const вкладки = [...ПАМЯТКА.matchAll(/<b>([^<]+)<\/b>/gu)]
  .map((пара) => (пара[1] ?? "").trim());

describe("памятка заказчику", () => {
  it("названы вкладки: правило проверяет не пустое место", () => {
    expect(вкладки.length).toBeGreaterThan(3);
  });

  it("каждая вкладка найдена в списке вкладок карточки", () => {
    const нет = [...new Set(вкладки)].filter((вкладка) =>
      !исходники.includes(`"${вкладка}"`) && !исходники.includes(`'${вкладка}'`)
      && !new RegExp(`>\\s*${вкладка}\\s*<`, "u").test(исходники));
    expect(нет).toEqual([]);
  });

  it("текст «Перейти к объекту» найден в компоненте первого входа", () => {
    const firstLogin = readFileSync(new URL("./FirstLogin.tsx", import.meta.url), "utf8");
    expect(firstLogin).toContain("Перейти к объекту");
  });

  it("пункт «Как пользоваться» найден в меню", () => {
    expect(исходники).toContain("Как пользоваться");
  });
});
