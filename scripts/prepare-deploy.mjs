import fs from "node:fs/promises";
import path from "node:path";

import { brand, seo } from "./site-data.js";
import { cartDataset, escapeHtml, repairText, slugify } from "./storefront-utils.js";

const repoRoot = process.cwd();
const deployDir = path.join(repoRoot, "deploy");
const catalogPath = path.join(repoRoot, "data", "catalog.json");
const items = [
  ".htaccess",
  "index.html",
  "catalogo",
  "checkout",
  "cuenta",
  "perfil",
  "reparto",
  "assets",
  "styles",
  "api",
  "storage",
];
const runtimeScripts = [
  "app.js",
  "site-data.js",
  "account-utils.js",
  "storefront-utils.js",
];

const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const blockedCategoryPattern =
  /(tecnolog|electrohogar|electronica|comput|pc|impresora|televisor|audio|video)/i;
const blockedProductPattern =
  /\b(laptop|notebook|tablet|smart\s?tv|televisor|impresora|pc|computadora|monitor|teclado|mouse|router|celular|smartphone|webcam|parlante|aud[ií]fono)\b/i;

function absoluteUrl(urlPath) {
  const normalized = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  return `${brand.domain}${normalized}`;
}

function ensureTrailingSlash(urlPath) {
  return urlPath.endsWith("/") ? urlPath : `${urlPath}/`;
}

function productUrl(product) {
  return `productos/${product.pageSlug}/`;
}

function categoryUrl(category) {
  return `categorias/${category.slug}/`;
}

function isAllowedProduct(product) {
  const categoryName = repairText(product.categories.at(-1)?.name ?? "");
  const name = repairText(product.name ?? "");
  return !blockedCategoryPattern.test(categoryName) && !blockedProductPattern.test(name);
}

function normalizeProduct(product) {
  const categoryName = repairText(product.categories.at(-1)?.name ?? "General");
  const name = repairText(product.name);
  const description = repairText(product.description || "");
  const longDescription = repairText(product.longDescription || description);
  const image = repairText(product.image || "");
  const pageSlug = `${slugify(product.slug || name)}-${product.id}`;

  return {
    ...product,
    id: String(product.id),
    slug: repairText(product.slug || ""),
    name,
    brand: repairText(product.brand || brand.name),
    description,
    longDescription,
    image,
    gallery: (product.gallery || []).map((entry) => repairText(entry)).filter(Boolean),
    categoryName,
    categorySlug: slugify(categoryName),
    pageSlug,
    url: productUrl({ pageSlug }),
    specs: (product.specifications || []).map((item) => ({
      name: repairText(item.name),
      value: repairText(item.value),
    })),
  };
}

function normalizeCategory(category) {
  const name = repairText(category.name);
  const slug = slugify(name);
  return {
    ...category,
    name,
    slug,
    href: categoryUrl({ slug }),
  };
}

function relativeUrl(prefix, urlPath) {
  return `${prefix}${String(urlPath).replace(/^\/+/, "")}`;
}

function productCardMarkup(product, prefix = "../") {
  const cart = cartDataset(product);
  const compare = product.price.compareAt
    ? `<span>${money.format(product.price.compareAt)}</span>`
    : "";

  return `
    <article class="product-card">
      <a href="${relativeUrl(prefix, product.url)}" class="product-card__image">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
      </a>
      <div class="product-card__body">
        <p class="product-card__category">${escapeHtml(product.categoryName)}</p>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-card__brand">${escapeHtml(product.brand)}</p>
        <div class="price-block">
          <strong>${money.format(product.price.current)}</strong>
          ${compare}
        </div>
        <div class="product-card__actions">
          <button
            class="button button--ghost"
            type="button"
            data-add-to-cart
            data-product-id="${escapeHtml(cart.productId)}"
            data-product-name="${escapeHtml(cart.productName)}"
            data-product-image="${escapeHtml(cart.productImage)}"
            data-product-price="${escapeHtml(cart.productPrice)}"
          >
            Agregar
          </button>
          <a class="button button--soft" href="${relativeUrl(prefix, product.url)}">
            Ver detalle
          </a>
        </div>
      </div>
    </article>
  `;
}

function buildJsonLd(value) {
  return escapeHtml(JSON.stringify(value));
}

function renderHeader(prefix) {
  return `
    <header class="main-header">
      <div class="shell main-header__inner">
        <a class="brand-block brand-block--logo" href="${prefix}">
          <img class="brand-logo" src="${prefix}assets/brand/logo-plaza-san-juan-macias.svg" alt="${brand.name}" />
          <span class="muted">Delivery en ${brand.serviceArea}</span>
        </a>
        <form class="search-card" action="${prefix}catalogo/" method="get">
          <input type="search" name="q" placeholder="Busca productos, marcas o antojos" />
          <button class="button" type="submit">Buscar</button>
        </form>
        <nav class="header-actions">
          <a class="header-chip" href="${prefix}categorias/">Categorías</a>
          <a class="header-chip" href="${prefix}reparto/">Reparto</a>
          <a class="header-chip" data-account-link href="${prefix}cuenta/">
            <span data-session-chip>Mi cuenta</span>
          </a>
          <a class="header-chip" href="${prefix}checkout/">
            Carrito <span data-cart-count>0</span>
          </a>
        </nav>
      </div>
    </header>
  `;
}

function renderFooter(prefix) {
  return `
    <footer class="footer">
      <div class="shell footer-grid">
        <div>
          <img class="footer-logo" src="${prefix}assets/brand/logo-plaza-san-juan-macias.svg" alt="${brand.name}" />
          <p class="muted">
            Delivery con sazón local para ${brand.serviceArea}. Pedido mínimo de S/ ${brand.minimumOrderPen.toFixed(2)} y cero recojo en tienda.
          </p>
        </div>
        <div>
          <strong>Compra</strong>
          <p><a href="${prefix}categorias/">Categorías</a></p>
          <p><a href="${prefix}catalogo/">Catálogo</a></p>
          <p><a href="${prefix}checkout/">Checkout</a></p>
        </div>
        <div>
          <strong>Servicio</strong>
          <p><a href="${prefix}reparto/">Zonas y reparto</a></p>
          <p><a href="https://wa.me/${brand.whatsapp}">WhatsApp</a></p>
          <p><a href="mailto:${brand.email}">Correo</a></p>
        </div>
        <div>
          <strong>Pagos</strong>
          <div class="footer-payment-list">
            <img src="${prefix}assets/payment/yape-badge.svg" alt="Yape" />
            <img src="${prefix}assets/payment/bcp-badge.svg" alt="BCP" />
            <img src="${prefix}assets/payment/paypal-badge.svg" alt="PayPal" />
            <img src="${prefix}assets/payment/binance-badge.svg" alt="Binance" />
          </div>
        </div>
      </div>
    </footer>
  `;
}

function pageLayout({
  prefix,
  title,
  description,
  canonicalPath,
  imagePath,
  mainContent,
  jsonLd,
}) {
  const canonical = absoluteUrl(ensureTrailingSlash(canonicalPath));
  const image = imagePath.startsWith("http")
    ? imagePath
    : absoluteUrl(imagePath.replace(/^\/+/, ""));
  return `<!doctype html>
<html lang="es" data-root-prefix="${prefix}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(seo.keywords)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta name="geo.region" content="PE-CAL" />
    <meta name="geo.placename" content="${escapeHtml(brand.location)}" />
    <meta name="theme-color" content="#c1352a" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="${prefix}assets/brand/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="stylesheet" href="${prefix}styles/main.css" />
    <script type="application/ld+json">${buildJsonLd(jsonLd)}</script>
  </head>
  <body>
    <div class="utility-bar">
      <div class="shell utility-bar__inner">
        <span>Solo delivery para ${brand.serviceArea}.</span>
        <span>Pedido mínimo: S/ ${brand.minimumOrderPen.toFixed(2)}.</span>
      </div>
    </div>
    ${renderHeader(prefix)}
    ${mainContent}
    ${renderFooter(prefix)}
    <script type="module" src="${prefix}scripts/app.js"></script>
  </body>
</html>
`;
}

function collectionJsonLd(category, products) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} | ${brand.name}`,
    description: `Explora ${category.name} con delivery en ${brand.serviceArea}.`,
    url: absoluteUrl(category.href),
    inLanguage: "es-PE",
    isPartOf: absoluteUrl("/"),
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: brand.name, item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Categorías", item: absoluteUrl("categorias/") },
        { "@type": "ListItem", position: 3, name: category.name, item: absoluteUrl(category.href) },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.slice(0, 24).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(product.url),
        name: product.name,
      })),
    },
  };
}

function productJsonLd(product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.gallery.length ? product.gallery : [product.image],
    description: product.description,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: brand.currency,
      price: product.price.current,
      availability: product.stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: absoluteUrl(product.url),
      seller: {
        "@type": "Organization",
        name: brand.name,
      },
    },
  };
}

function categoryPageHtml(category, products) {
  return pageLayout({
    prefix: "../../",
    title: `${category.name} | ${brand.name}`,
    description: `${category.name} con delivery en ${brand.serviceArea}. Compra en ${brand.name} desde S/ ${brand.minimumOrderPen.toFixed(2)}.`,
    canonicalPath: category.href,
    imagePath: "assets/brand/hero-canasta.svg",
    jsonLd: collectionJsonLd(category, products),
    mainContent: `
      <main>
        <section class="page-hero page-hero--category">
          <div class="shell page-hero__split">
            <div class="page-hero__card">
              <p class="eyebrow">Categoría</p>
              <h1>${escapeHtml(category.name)}</h1>
              <p class="muted">
                ${products.length} productos listos para delivery en ${brand.serviceArea}. Eliges, agregas y cierras el pedido sin marearte.
              </p>
              <div class="hero-actions">
                <a class="button" href="../../checkout/">Ir al carrito</a>
                <a class="button button--ghost" href="../../catalogo/">Ver todo el catálogo</a>
              </div>
            </div>
            <img class="hero-illustration" src="../../assets/brand/hero-canasta.svg" alt="${escapeHtml(category.name)}" />
          </div>
        </section>
        <section class="section">
          <div class="shell product-grid">
            ${products.map((product) => productCardMarkup(product, "../../")).join("")}
          </div>
        </section>
      </main>
    `,
  });
}

function productPageHtml(product) {
  const compare = product.price.compareAt
    ? `<span>${money.format(product.price.compareAt)}</span>`
    : "";
  const cart = cartDataset(product);
  return pageLayout({
    prefix: "../../",
    title: `${product.name} | ${brand.name}`,
    description: `${product.name} con delivery en ${brand.serviceArea}. Compra desde ${money.format(product.price.current)} en ${brand.name}.`,
    canonicalPath: product.url,
    imagePath: product.image,
    jsonLd: productJsonLd(product),
    mainContent: `
      <main class="section">
        <div class="shell product-detail-page">
          <nav class="breadcrumb">
            <a href="../../">Inicio</a>
            <span>/</span>
            <a href="../../categorias/${product.categorySlug}/">${escapeHtml(product.categoryName)}</a>
            <span>/</span>
            <strong>${escapeHtml(product.name)}</strong>
          </nav>
          <div class="product-detail">
            <section class="product-detail__media">
              <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />
              <div class="product-gallery">
                ${(product.gallery.length ? product.gallery : [product.image])
                  .slice(0, 4)
                  .map(
                    (image) =>
                      `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`,
                  )
                  .join("")}
              </div>
            </section>
            <section class="product-detail__content">
              <p class="eyebrow">${escapeHtml(product.categoryName)}</p>
              <h1>${escapeHtml(product.name)}</h1>
              <p class="product-card__brand">${escapeHtml(product.brand)}</p>
              <div class="price-block price-block--large">
                <strong>${money.format(product.price.current)}</strong>
                ${compare}
              </div>
              <p class="muted">Delivery en ${brand.serviceArea} desde un pedido mínimo de S/ ${brand.minimumOrderPen.toFixed(2)}.</p>
              <p>${escapeHtml(product.longDescription)}</p>
              <div class="product-actions">
                <button
                  class="button"
                  type="button"
                  data-add-to-cart
                  data-product-id="${escapeHtml(cart.productId)}"
                  data-product-name="${escapeHtml(cart.productName)}"
                  data-product-image="${escapeHtml(cart.productImage)}"
                  data-product-price="${escapeHtml(cart.productPrice)}"
                >
                  Agregar al carrito
                </button>
                <a class="button button--ghost" href="../../checkout/">Ir al checkout</a>
              </div>
              <ul class="spec-list">
                ${product.specs
                  .slice(0, 8)
                  .map(
                    (item) =>
                      `<li><strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(item.value)}</li>`,
                  )
                  .join("")}
              </ul>
            </section>
          </div>
        </div>
      </main>
    `,
  });
}

function categoriesIndexHtml(categories) {
  return pageLayout({
    prefix: "../",
    title: `Categorías | ${brand.name}`,
    description: `Categorías con delivery en ${brand.serviceArea}. Compra despensa, hogar, dormitorio, limpieza, bazar y más en ${brand.name}.`,
    canonicalPath: "categorias/",
    imagePath: "assets/brand/hero-colores.svg",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `Categorías | ${brand.name}`,
      url: absoluteUrl("categorias/"),
      description: `Categorías con delivery en ${brand.serviceArea}.`,
    },
    mainContent: `
      <main>
        <section class="page-hero">
          <div class="shell page-hero__split">
            <div class="page-hero__card">
              <p class="eyebrow">Categorías</p>
              <h1>Todo lo que sale para el barrio, bien ordenado.</h1>
              <p class="muted">
                Navega por las categorías más buscadas y arma tu pedido con precios actualizados y entrega local.
              </p>
            </div>
            <img class="hero-illustration" src="../assets/brand/hero-colores.svg" alt="Categorías Plaza San Juan Macías" />
          </div>
        </section>
        <section class="section">
          <div class="shell category-grid">
            ${categories
              .map(
                (category) => `
              <a class="category-card" href="../${category.href}">
                <span>${escapeHtml(category.name)}</span>
                <strong>${category.productCount} productos</strong>
              </a>
            `,
              )
              .join("")}
          </div>
        </section>
      </main>
    `,
  });
}

function sitemapXml(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((entry) => `  <url><loc>${absoluteUrl(ensureTrailingSlash(entry))}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
}

async function resetDeployDir() {
  await fs.rm(deployDir, { recursive: true, force: true });
  await fs.mkdir(deployDir, { recursive: true });
}

async function copyItem(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(deployDir, relativePath);
  await fs.cp(source, target, { recursive: true });
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function main() {
  await resetDeployDir();
  for (const item of items) {
    await copyItem(item);
  }
  await ensureDir(path.join(deployDir, "scripts"));
  for (const scriptName of runtimeScripts) {
    await fs.copyFile(
      path.join(repoRoot, "scripts", scriptName),
      path.join(deployDir, "scripts", scriptName),
    );
  }

  const rawCatalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const products = rawCatalog.products.filter(isAllowedProduct).map(normalizeProduct);
  const categories = rawCatalog.categories
    .map(normalizeCategory)
    .filter((category) => !blockedCategoryPattern.test(category.name))
    .map((category) => ({
      ...category,
      productCount: products.filter((product) => product.categorySlug === category.slug).length,
    }))
    .filter((category) => category.productCount > 0)
    .sort((left, right) => right.productCount - left.productCount);

  const featuredProducts = categories
    .slice(0, 10)
    .map((category) => products.find((product) => product.categorySlug === category.slug))
    .filter(Boolean);

  const homepage = {
    categories: categories.slice(0, 8),
    featuredProducts,
  };

  const catalogSummary = {
    brand: rawCatalog.brand,
    generatedAt: rawCatalog.generatedAt,
    categories,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      image: product.image,
      price: product.price,
      categoryName: product.categoryName,
      categorySlug: product.categorySlug,
      url: product.url,
    })),
  };

  await ensureDir(path.join(deployDir, "data"));
  await fs.writeFile(
    path.join(deployDir, "data", "homepage.json"),
    `${JSON.stringify(homepage, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(deployDir, "data", "catalog-summary.json"),
    `${JSON.stringify(catalogSummary, null, 2)}\n`,
    "utf8",
  );

  await ensureDir(path.join(deployDir, "categorias"));
  await fs.writeFile(
    path.join(deployDir, "categorias", "index.html"),
    categoriesIndexHtml(categories),
    "utf8",
  );

  for (const category of categories) {
    const targetDir = path.join(deployDir, "categorias", category.slug);
    await ensureDir(targetDir);
    const categoryProducts = products.filter((product) => product.categorySlug === category.slug);
    await fs.writeFile(
      path.join(targetDir, "index.html"),
      categoryPageHtml(category, categoryProducts),
      "utf8",
    );
  }

  await ensureDir(path.join(deployDir, "productos"));
  for (const product of products) {
    const targetDir = path.join(deployDir, "productos", product.pageSlug);
    await ensureDir(targetDir);
    await fs.writeFile(path.join(targetDir, "index.html"), productPageHtml(product), "utf8");
  }

  const sitemapEntries = [
    "",
    "catalogo/",
    "categorias/",
    "checkout/",
    "cuenta/",
    "perfil/",
    "reparto/",
    ...categories.map((category) => category.href),
    ...products.map((product) => product.url),
  ];

  await fs.writeFile(path.join(deployDir, "sitemap.xml"), sitemapXml(sitemapEntries), "utf8");
  await fs.writeFile(
    path.join(deployDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("sitemap.xml")}\n`,
    "utf8",
  );

  console.log(`Deploy listo en ${deployDir}`);
  console.log(`Generadas ${categories.length} categorías y ${products.length} páginas de producto.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
