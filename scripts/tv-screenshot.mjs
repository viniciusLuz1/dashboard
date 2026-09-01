// Tira screenshots da TV em 1920×1080 sem precisar de uma TV.
// Uso: node scripts/tv-screenshot.mjs [url] [prefixo] [esperaMs]
//   node scripts/tv-screenshot.mjs                              → /tmp/tv-gate.png + /tmp/tv-tela.png
//   node scripts/tv-screenshot.mjs "http://localhost:3000/tv?demo=30" /tmp/demo 26000
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/tv";
const prefixo = process.argv[3] ?? "/tmp/tv";
const esperaMs = Number(process.argv[4] ?? 2500);

// channel: "chrome" usa o Google Chrome instalado — sem baixar browser.
const navegador = await chromium.launch({ channel: "chrome" });
const pagina = await navegador.newPage({
  viewport: { width: 1920, height: 1080 },
});

await pagina.goto(url, { waitUntil: "networkidle" });
await pagina.screenshot({ path: `${prefixo}-gate.png` });

const botao = pagina.getByRole("button", { name: "ATIVAR SOM" });
if ((await botao.count()) > 0) {
  await botao.click();
}

await pagina.waitForTimeout(esperaMs);
await pagina.screenshot({ path: `${prefixo}-tela.png` });

const contagem = await pagina
  .locator(".hero__contagem")
  .textContent()
  .catch(() => null);
const erros = [];
pagina.on("pageerror", (erro) => erros.push(String(erro)));
console.log(`contagem na tela: ${contagem ?? "(sem herói)"}`);
if (erros.length) console.error("erros de página:", erros);

await navegador.close();
