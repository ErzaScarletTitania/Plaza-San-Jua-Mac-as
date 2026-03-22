import fs from "node:fs/promises";
import path from "node:path";

import { allowedTopLevelCategories } from "./tottus-categories.mjs";

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "reference", "category-pages");
const delayMs = Number.parseInt(process.env.FETCH_DELAY_MS ?? "150", 10);
const maxPagesPerCategory = Number.parseInt(process.env.MAX_CATEGORY_PAGES ?? "5", 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractNextData(html) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  );
  if (!match) {
    throw new Error("No se encontró __NEXT_DATA__ en la categoría");
  }
  return JSON.parse(match[1]);
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

function is404Error(error) {
  return String(error?.message ?? "").includes("Error 404");
}

function categoryPageUrl(category, page) {
  if (page === 1) {
    return category.href;
  }

  const url = new URL(category.href);
  url.searchParams.set("page", String(page));
  return url.toString();
}

async function fetchCategory(category) {
  const pageOneHtml = await fetchHtml(categoryPageUrl(category, 1));
  const pageOneJson = extractNextData(pageOneHtml);
  const pagination = pageOneJson.props.pageProps.pagination;
  const totalPages = Math.ceil((pagination.count ?? 0) / (pagination.perPage ?? 48));
  const pagesToFetch =
    maxPagesPerCategory > 0 ? Math.min(totalPages, maxPagesPerCategory) : totalPages;

  const manifestEntry = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    totalPages,
    pagesFetched: pagesToFetch,
    totalProducts: pagination.count ?? 0,
  };

  await fs.writeFile(
    path.join(outputDir, `${category.slug}-page-1.html`),
    pageOneHtml,
    "utf8",
  );

  console.log(`${category.name}: página 1/${pagesToFetch}`);

  for (let page = 2; page <= pagesToFetch; page += 1) {
    await sleep(delayMs);
    try {
      const html = await fetchHtml(categoryPageUrl(category, page));
      await fs.writeFile(path.join(outputDir, `${category.slug}-page-${page}.html`), html, "utf8");
      manifestEntry.pagesFetched = page;
      console.log(`${category.name}: página ${page}/${pagesToFetch}`);
    } catch (error) {
      if (is404Error(error)) {
        console.warn(`${category.name}: la página ${page} no existe, se detiene en ${page - 1}.`);
        break;
      }

      throw error;
    }
  }

  return manifestEntry;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const manifest = [];
  for (const category of allowedTopLevelCategories) {
    try {
      const entry = await fetchCategory(category);
      manifest.push(entry);
    } catch (error) {
      console.error(`${category.name}: ${String(error)}`);
    }
  }

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
