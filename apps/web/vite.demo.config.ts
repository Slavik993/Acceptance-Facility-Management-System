import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Подмена слоя доступа к данным. Экраны продукта импортируют `./api.js`;
 * в демонстрационной сборке этот запрос разрешается в `api.demo.ts`.
 * Сами экраны не изменяются и не знают о подмене.
 *
 * **Адрес разрешения берётся у самого Vite, а не сшивается вручную.**
 * Переключатель роли импортирует `./api.demo.js` прямо, минуя подмену, —
 * и раньше подмена отдавала ему иной идентификатор модуля, чем прямой
 * импорт. В сборке оказывалось две копии `api.demo.ts`: переключатель писал
 * роль в одну, приложение читало из другой, и роль не менялась ни разу —
 * при этом переключатель на экране работал и выглядел исправным. Сборщик
 * сворачивал выбор роли в константу «владелец», и демонстрация показывала
 * заказчику глазами руководителя.
 *
 * Теперь оба импорта разрешаются одним и тем же запросом к резолверу Vite,
 * модуль в сборке один, и роль меняется по-настоящему.
 */
const demoApi = (): Plugin => ({
  name: "priyomka-demo-api",
  enforce: "pre",
  async resolveId(source, importer) {
    if (source !== "./api.js" || importer === undefined) return null;
    if (importer.includes("api.demo")) return null;
    const разрешено = await this.resolve("./api.demo.js", importer, { skipSelf: true });
    return разрешено?.id ?? null;
  },
});

export default defineConfig({
  plugins: [demoApi(), react()],
  base: "./",
  build: {
    outDir: "dist-demo",
    rollupOptions: { input: resolve(import.meta.dirname, "index.demo.html") },
  },
});
