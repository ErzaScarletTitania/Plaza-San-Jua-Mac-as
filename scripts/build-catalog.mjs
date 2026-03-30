import fs from "node:fs/promises";
import path from "node:path";

import {
  allowedTopLevelCategories,
  isAllowedTopLevelCategoryName,
  isBlockedCategoryName,
  slugify,
} from "./tottus-categories.mjs";

const repoRoot = process.cwd();
const detailedProductsDir = path.join(repoRoot, "reference", "products");
const categoryPagesDir = path.join(repoRoot, "reference", "category-pages");
const outputDir = path.join(repoRoot, "data");
const existingCatalogPath = path.join(outputDir, "catalog.json");
const brandName = "Plaza San Juan Macías";

function extractNextData(html) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  );
  if (!match) {
    throw new Error("No se encontró __NEXT_DATA__ en el archivo");
  }
  return JSON.parse(match[1]);
}

function decodeIfNeeded(value) {
  if (typeof value !== "string") {
    return value;
  }

  const shouldRepair = /Ã.|Â.|â.|ð|\uFFFD/.test(value);
  if (!shouldRepair) {
    return value;
  }

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    return repaired.includes("\uFFFD") ? value : repaired;
  } catch {
    return value;
  }
}

function fixText(value) {
  if (typeof value !== "string") {
    return value;
  }

  return decodeIfNeeded(value)
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\s+/g, " ")
    .replace(/\s+\\$/g, "")
    .trim();
}

function cleanObject(value) {
  if (Array.isArray(value)) {
    return value.map(cleanObject);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [key, cleanObject(innerValue)]),
    );
  }

  return fixText(value);
}

function toNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return 0;
  }

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && !hasDot) {
    const parts = raw.split(",");
    const decimalDigits = parts.at(-1)?.length ?? 0;
    if (decimalDigits === 1 || decimalDigits === 2) {
      return Number.parseFloat(raw.replace(",", "."));
    }
    if (decimalDigits === 3) {
      return Number.parseFloat(parts.join(""));
    }
  }

  if (hasDot && !hasComma) {
    const parts = raw.split(".");
    const decimalDigits = parts.at(-1)?.length ?? 0;
    if (decimalDigits === 1 || decimalDigits === 2) {
      return Number.parseFloat(raw);
    }
    if (decimalDigits === 3) {
      return Number.parseFloat(parts.join(""));
    }
  }

  return Number.parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

function increasePrice(price) {
  return Number((price * 1.1).toFixed(2));
}

function pickPrice(priceEntries, type) {
  const entry = (priceEntries ?? []).find((price) => price.type === type);
  if (!entry || !entry.price || !entry.price.length) {
    return null;
  }
  return toNumber(entry.price[0]);
}

function specMap(specs) {
  return (specs ?? []).map((item) => ({
    id: item.id ?? slugify(item.name),
    name: fixText(item.name),
    value: fixText(item.value),
  }));
}

function inferVariantProfile({ categories = [], name = "", specifications = [], variantId = "", sellerSkuId = "" }) {
  const categoryTrail = categories.map((entry) => fixText(entry.name)).join(" ");
  const sizeSensitive = /\bvestuario\b|\bcalzado\b/i.test(categoryTrail);

  const explicitSizeSpec = specifications.find((item) =>
    /\btalla\b|\bsize\b/i.test(fixText(item.name)),
  );

  const optionLabel = explicitSizeSpec ? `Talla ${fixText(explicitSizeSpec.value)}` : "";

  return {
    variantId: fixText(variantId),
    sellerSkuId: fixText(sellerSkuId),
    variantType: sizeSensitive ? "size" : "default",
    variantLabel: optionLabel,
    requiresVariantSelection: sizeSensitive,
    variantOptions: explicitSizeSpec
      ? [{ id: fixText(variantId || sellerSkuId), label: `Talla ${fixText(explicitSizeSpec.value)}` }]
      : [],
  };
}

function normalizeBrand(value) {
  const cleaned = fixText(value);
  return slugify(cleaned) === "tottus" ? brandName : cleaned;
}

function normalizeTextWithBrand(value) {
  return fixText(value)
    .replaceAll("Tottus Perú", brandName)
    .replaceAll("Tottus Peru", brandName)
    .replaceAll("Tottus.com.pe", brandName)
    .replaceAll("TOTTUS", brandName)
    .replaceAll("Tottus", brandName);
}

function normalizeCategories(entries) {
  const categories = (entries ?? []).map((crumb) => ({
    id: fixText(crumb.id ?? ""),
    name: fixText(crumb.label ?? crumb.name ?? ""),
    link: fixText(crumb.link ?? ""),
  }));

  return categories.filter((category) => category.name);
}

function categoryAllowed(product) {
  const topLevelName = product.categories.at(-1)?.name ?? "";
  if (!topLevelName) {
    return false;
  }

  return isAllowedTopLevelCategoryName(topLevelName) && !isBlockedCategoryName(topLevelName);
}

function normalizeProduct(json) {
  const product = cleanObject(json.props.pageProps.productData);
  const variant = product.variants?.[0];
  const internetPrice = pickPrice(variant?.prices, "internetPrice");
  const normalPrice = pickPrice(variant?.prices, "normalPrice");
  const promoPrice = pickPrice(variant?.prices, "cmrPrice") ?? internetPrice;
  const basePrice = internetPrice ?? promoPrice ?? normalPrice ?? 0;
  const categories = normalizeCategories(product.breadCrumb);
  const specifications = specMap(product.attributes?.specifications);
  const variantProfile = inferVariantProfile({
    categories,
    name: product.name,
    specifications,
    variantId: variant?.id ?? product.primaryVariantId ?? "",
    sellerSkuId: variant?.offerings?.[0]?.sellerSkuId ?? "",
  });

  return {
    id: fixText(product.id),
    variantId: variantProfile.variantId,
    slug: fixText(product.slug),
    name: normalizeTextWithBrand(product.name),
    brand: normalizeBrand(product.brandName),
    description: normalizeTextWithBrand(product.description),
    longDescription: normalizeTextWithBrand(product.longDescription),
    sellerSkuId: variantProfile.sellerSkuId,
    sourceUrl: fixText(
      `https://www.tottus.com.pe/tottus-pe/articulo/${product.id}/${product.slug}/${variant?.id ?? product.primaryVariantId}`,
    ),
    image: fixText(variant?.medias?.[0]?.url ?? product.medias?.[0]?.url ?? ""),
    gallery: (variant?.medias ?? product.medias ?? [])
      .map((media) => fixText(media.url))
      .filter(Boolean),
    categories,
    priceSource: {
      promo: promoPrice,
      internet: internetPrice,
      normal: normalPrice,
    },
    price: {
      current: increasePrice(basePrice),
      originalReference: basePrice,
      compareAt: normalPrice ? increasePrice(normalPrice) : null,
      promoReference: promoPrice,
    },
    stock: variant?.availability?.some((item) => item.hasStock) ?? false,
    specifications,
    variantType: variantProfile.variantType,
    variantLabel: variantProfile.variantLabel,
    requiresVariantSelection: variantProfile.requiresVariantSelection,
    variantOptions: variantProfile.variantOptions,
  };
}

function inferDescription(result, categoryName) {
  const fragments = [
    `Compra ${normalizeTextWithBrand(result.displayName)} en ${brandName}.`,
    categoryName ? `Disponible dentro de la categoría ${categoryName}.` : "",
    result.measurements?.format ? `Presentación: ${fixText(result.measurements.format)}.` : "",
  ];
  return fragments.filter(Boolean).join(" ");
}

function listingCategoryFromFile(fileName) {
  const match = fileName.match(/^(.*)-page-\d+\.html$/);
  if (!match) {
    return null;
  }

  const categorySlug = match[1];
  return allowedTopLevelCategories.find((category) => category.slug === categorySlug) ?? null;
}

function normalizeListingProduct(result, category) {
  const internetPrice = pickPrice(result.prices, "internetPrice");
  const normalPrice = pickPrice(result.prices, "normalPrice");
  const promoPrice = pickPrice(result.prices, "cmrPrice") ?? internetPrice;
  const basePrice = internetPrice ?? promoPrice ?? normalPrice ?? 0;
  const description = inferDescription(result, category.name);
  const specifications = [
    ...(result.measurements?.format
      ? [
          {
            id: "presentacion",
            name: "Presentación",
            value: fixText(result.measurements.format),
          },
        ]
      : []),
    ...(result.measurements?.limit
      ? [
          {
            id: "limite",
            name: "Límite",
            value: fixText(result.measurements.limit),
          },
        ]
      : []),
  ];
  const variantProfile = inferVariantProfile({
    categories: [{ name: category.name }],
    name: result.displayName,
    specifications,
    variantId: result.skuId ?? result.offeringId ?? "",
    sellerSkuId: result.skuId ?? result.offeringId ?? "",
  });

  return {
    id: fixText(result.productId),
    variantId: variantProfile.variantId,
    slug: fixText(result.url).split("/").filter(Boolean).at(-1) ?? "",
    name: normalizeTextWithBrand(result.displayName),
    brand: normalizeBrand(result.brand),
    description,
    longDescription: description,
    sellerSkuId: variantProfile.sellerSkuId,
    sourceUrl: fixText(result.url),
    image: fixText(result.mediaUrls?.[0] ?? ""),
    gallery: (result.mediaUrls ?? []).map((url) => fixText(url)).filter(Boolean),
    categories: [
      {
        id: category.id,
        name: category.name,
        link: category.href,
      },
    ],
    priceSource: {
      promo: promoPrice,
      internet: internetPrice,
      normal: normalPrice,
    },
    price: {
      current: increasePrice(basePrice),
      originalReference: basePrice,
      compareAt: normalPrice ? increasePrice(normalPrice) : null,
      promoReference: promoPrice,
    },
    stock: true,
    specifications,
    variantType: variantProfile.variantType,
    variantLabel: variantProfile.variantLabel,
    requiresVariantSelection: variantProfile.requiresVariantSelection,
    variantOptions: variantProfile.variantOptions,
  };
}

async function readDetailedProducts() {
  let files = [];
  try {
    files = (await fs.readdir(detailedProductsDir))
      .filter((file) => file.endsWith(".html"))
      .sort();
  } catch {
    return [];
  }

  const products = [];

  for (const file of files) {
    const html = await fs.readFile(path.join(detailedProductsDir, file), "utf8");
    const json = extractNextData(html);
    const normalized = normalizeProduct(json);
    if (categoryAllowed(normalized)) {
      products.push(normalized);
    }
  }

  return products;
}

async function readCommittedCatalogProducts() {
  try {
    const payload = JSON.parse(await fs.readFile(existingCatalogPath, "utf8"));
    return Array.isArray(payload.products) ? payload.products : [];
  } catch {
    return [];
  }
}

async function readListingProducts() {
  try {
    const files = (await fs.readdir(categoryPagesDir))
      .filter((file) => file.endsWith(".html"))
      .sort();

    const products = [];

    for (const file of files) {
      const category = listingCategoryFromFile(file);
      if (!category || isBlockedCategoryName(category.name)) {
        continue;
      }

      const html = await fs.readFile(path.join(categoryPagesDir, file), "utf8");
      const json = extractNextData(html);
      const results = cleanObject(json.props.pageProps.results ?? []);

      for (const result of results) {
        products.push(normalizeListingProduct(result, category));
      }
    }

    return products;
  } catch {
    return [];
  }
}

function mergeProducts(listingProducts, detailedProducts) {
  const byId = new Map();

  for (const product of listingProducts) {
    byId.set(product.id, product);
  }

  for (const product of detailedProducts) {
    const current = byId.get(product.id);
    if (!current) {
      byId.set(product.id, product);
      continue;
    }

    byId.set(product.id, {
      ...current,
      ...product,
      gallery: product.gallery.length ? product.gallery : current.gallery,
      categories: product.categories.length ? product.categories : current.categories,
      specifications: product.specifications.length
        ? product.specifications
        : current.specifications,
    });
  }

  return [...byId.values()]
    .filter(categoryAllowed)
    .filter((product) => product.price.current > 0)
    .filter((product) => product.name && product.image)
    .sort((left, right) => {
      const leftCategory = left.categories.at(-1)?.name ?? "";
      const rightCategory = right.categories.at(-1)?.name ?? "";
      return (
        leftCategory.localeCompare(rightCategory, "es") ||
        left.name.localeCompare(right.name, "es")
      );
    });
}

function buildCategoryIndex(products) {
  const categories = new Map();

  for (const product of products) {
    const top = product.categories.at(-1);
    if (!top || isBlockedCategoryName(top.name)) {
      continue;
    }

    if (!categories.has(top.id)) {
      categories.set(top.id, {
        id: top.id,
        name: top.name,
        slug: slugify(top.name),
        productIds: [],
      });
    }

    categories.get(top.id).productIds.push(product.id);
  }

  return [...categories.values()].sort((left, right) => right.productIds.length - left.productIds.length);
}

async function buildCatalog() {
  const listingProducts = await readListingProducts();
  const detailedProducts = await readDetailedProducts();
  let products = mergeProducts(listingProducts, detailedProducts);

  if (!products.length) {
    products = await readCommittedCatalogProducts();
    if (products.length) {
      console.warn(
        "No se encontraron archivos de referencia locales. Se reutilizara data/catalog.json versionado como fallback para CI/deploy.",
      );
    }
  }

  if (!products.length) {
    throw new Error(
      "No hay productos listos para el catálogo. Ejecuta `npm run fetch:reference` y `npm run fetch:catalog` antes de construir.",
    );
  }

  const payload = {
    brand: {
      name: brandName,
      currency: "PEN",
      locale: "es-PE",
    },
    generatedAt: new Date().toISOString(),
    products,
    categories: buildCategoryIndex(products),
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "catalog.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  console.log(`Catálogo generado con ${products.length} productos.`);
}

buildCatalog().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
