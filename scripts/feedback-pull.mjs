/**
 * Замечания о платформе — локально, для разбора и правок.
 *
 * Перенос `tools/feedback-pull.mjs` сайта ProDisser (решение Р-405 его
 * журнала). Исполнитель правок — Claude Code в облачной среде — учётной
 * записи в продукте не имеет и иметь не должен. Ему открыт отдельный вход
 * по ключу: перечень замечаний, снимки, книга Excel и разбор. Больше ключ
 * не открывает ничего.
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/feedback-pull.mjs [каталог] [--open]
 *       перечень и снимки в каталог (по умолчанию ./feedback-export — он в
 *       .gitignore); --open — только «новое» и «в работе»;
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/feedback-pull.mjs book [файл]
 *       книга Excel целиком (по умолчанию ./feedback-export/Замечания.xlsx);
 *
 *   NODE_USE_ENV_PROXY=1 node scripts/feedback-pull.mjs review <id> \
 *       [status=NEW|IN_WORK|DONE|DECLINED] [severity=CRITICAL|HIGH|MEDIUM|LOW] [note="что сделано"]
 *       разбор, как на экране «Замечания».
 *
 * Ключ — переменная `FEEDBACK_EXPORT_TOKEN`, та же строка, что на сервере;
 * в хранилище и в переписку он не попадает. Адрес продукта —
 * `FEEDBACK_EXPORT_URL` (умолчания нет: адрес боевого стенда задаётся при
 * выкате). NODE_USE_ENV_PROXY нужен там, где выход в сеть идёт через
 * прокси: встроенный fetch Node иначе HTTPS_PROXY не читает.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const base = (process.env.FEEDBACK_EXPORT_URL ?? "").replace(/\/+$/u, "");
const token = process.env.FEEDBACK_EXPORT_TOKEN ?? "";

if (base === "") {
  console.error("Не задан адрес продукта: переменная FEEDBACK_EXPORT_URL, например https://priyomka.example.");
  process.exit(2);
}
if (token.length < 32) {
  console.error("Не задан ключ: переменная FEEDBACK_EXPORT_TOKEN (та же строка, что в .env на сервере).");
  process.exit(2);
}

async function call(url, init = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      redirect: "error",
    });
  } catch (error) {
    const cause = error?.cause?.code ?? error?.cause?.message ?? error.message;
    console.error(`Продукт не ответил (${cause}): ${url}`);
    console.error("Проверьте доступ среды к адресу и запуск с NODE_USE_ENV_PROXY=1.");
    process.exit(1);
  }
  if (!response.ok) {
    console.error(`Ответ ${response.status}: ${(await response.text()).slice(0, 300)}`);
    if (response.status === 404) {
      console.error("Ключ не совпал, на сервере не задан FEEDBACK_EXPORT_TOKEN или такого замечания нет.");
    }
    process.exit(1);
  }
  return response;
}

function describe(item) {
  const where = [item.section, item.objectCode, item.tab].filter(Boolean).join(" · ") || item.route;
  const shot = item.screenshotFile ? ` · снимок: ${item.screenshotFile}` : item.screenshot ? " · есть снимок" : "";
  const lines = [
    `— ${item.createdAtLocal} · ${item.kindLabel} · ${item.severityLabel} · ${item.statusLabel} · ${item.roleLabel}`,
    `  ${where} (${item.route}) · ${item.device}${item.viewportWidth ? `, ${item.viewportWidth} px` : ""}${shot} · ${item.id}`,
    ...item.text.split("\n").map((line) => `  ${line}`),
  ];
  if (item.note) lines.push(`  Что сделано: ${item.note}`);
  if (item.resolvedAtLocal) lines.push(`  Закрыто: ${item.resolvedAtLocal}`);
  return lines.join("\n");
}

if (args[0] === "review") {
  const id = args[1];
  if (!id) {
    console.error("Укажите идентификатор замечания: review <id> status=… severity=… note=…");
    process.exit(2);
  }
  const patch = {};
  for (const arg of args.slice(2)) {
    const at = arg.indexOf("=");
    if (at < 1) {
      console.error(`Не понял «${arg}»: ожидается status=…, severity=… или note=…`);
      process.exit(2);
    }
    patch[arg.slice(0, at)] = arg.slice(at + 1);
  }
  const response = await call(`${base}/api/feedback/export/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  const { item } = await response.json();
  console.log("Разбор записан.");
  console.log(describe(item));
  process.exit(0);
}

if (args[0] === "book") {
  const file = path.resolve(args[1] ?? path.join("feedback-export", "Замечания.xlsx"));
  mkdirSync(path.dirname(file), { recursive: true });
  const response = await call(`${base}/api/feedback/export/book`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  console.log(`Книга замечаний: ${file}`);
  process.exit(0);
}

const onlyOpen = args.includes("--open");
const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "feedback-export");
const query = onlyOpen ? "?status=NEW,IN_WORK" : "";
const data = await (await call(`${base}/api/feedback/export${query}`)).json();

mkdirSync(path.join(dir, "screenshots"), { recursive: true });
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
let shots = 0;
for (const item of data.items) {
  if (item.screenshot === null) continue;
  const response = await call(`${base}/api/feedback/export/${encodeURIComponent(item.id)}/screenshot`);
  const file = path.join(dir, "screenshots", `${item.id}.${EXT[item.screenshot.type] ?? "bin"}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  item.screenshotFile = path.relative(dir, file);
  shots += 1;
}
writeFileSync(path.join(dir, "feedback.json"), JSON.stringify(data, null, 2) + "\n");

console.log(`Замечаний: ${data.total}${onlyOpen ? " (открытые)" : ""}; снимков: ${shots}; выгрузка ${data.generatedAtLocal}`);
console.log(`Каталог: ${dir}`);
for (const item of data.items) {
  console.log("");
  console.log(describe(item));
}
