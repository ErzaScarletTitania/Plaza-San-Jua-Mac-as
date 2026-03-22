import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const linksFile = path.join(repoRoot, "reference-article-links.txt");
const outputDir = path.join(repoRoot, "reference", "products");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function fileNameFromUrl(url) {
  const match = url.match(/articulo\/(\d+)\/([^/]+)\/(\d+)/);
  if (!match) {
    throw new Error(`No se pudo generar nombre de archivo para ${url}`);
  }
  return `${match[1]}-${match[3]}-${match[2]}.html`;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status} al descargar ${url}`);
  }

  const buffer = await response.arrayBuffer();
  return new TextDecoder("latin1").decode(buffer);
}

async function main() {
  await ensureDir(outputDir);
  const links = (await fs.readFile(linksFile, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const link of links) {
    const target = path.join(outputDir, fileNameFromUrl(link));
    try {
      const html = await fetchHtml(link);
      await fs.writeFile(target, html, "utf8");
      console.log(`OK ${path.basename(target)}`);
    } catch (error) {
      console.error(`FAIL ${link}`);
      console.error(String(error));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
