import http from "node:http";
import process from "node:process";
import console from "node:console";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
try {
  await stat(resolve(root, "index.html"));
} catch {
  console.error(
    "빌드 파일이 없습니다. npm ci 후 npm run build를 실행해 주세요.",
  );
  process.exit(1);
}
const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1:5173").pathname,
    );
    const file = resolve(
      root,
      pathname === "/" ? "index.html" : "." + pathname,
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const bytes = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch {
    res
      .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      .end("파일을 찾을 수 없습니다.");
  }
});
server.on("error", (err) => {
  console.error(
    err.code === "EADDRINUSE"
      ? "5173 포트를 사용 중입니다. 기존 서버를 종료하고 다시 실행해 주세요."
      : err.message,
  );
  process.exit(1);
});
server.listen(5173, "127.0.0.1", () =>
  console.log(
    "Personal Task 실행 중: http://127.0.0.1:5173\n종료하려면 Ctrl+C를 누르세요.",
  ),
);
