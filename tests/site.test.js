import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, test } from "vitest";
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";

import {
  buildProfileSummary,
  validateLoginInput,
  validateProfileInput,
  validateRegisterInput,
} from "../scripts/account-utils.js";
import { provisionAdminFile } from "../scripts/bootstrap-admin.mjs";
import { renderRuntimeConfig } from "../scripts/render-runtime-config.mjs";

const repoRoot = process.cwd();
const deployRoot = path.join(repoRoot, "deploy");
const publicHtmlFiles = [
  "deploy/admin/index.html",
  "deploy/index.html",
  "deploy/catalogo/index.html",
  "deploy/checkout/index.html",
  "deploy/cuenta/index.html",
  "deploy/perfil/index.html",
  "deploy/reparto/index.html",
  "deploy/categorias/index.html",
  "deploy/categorias/dormitorio/index.html",
  "deploy/categorias/abarrotes/index.html",
  "deploy/categorias/limpieza/index.html",
];

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function domFrom(file) {
  return new JSDOM(read(file));
}

function exists(file) {
  return fs.existsSync(path.join(repoRoot, file));
}

function hasBlockedCategory(name) {
  return /(tecnolog|electrohogar|comput|pc|televisor|impresora)/i.test(name);
}

function hasBlockedProduct(name) {
  return /\b(laptop|notebook|tablet|smart\s?tv|televisor|impresora|pc|computadora|monitor)\b/i.test(
    name,
  );
}

function parseJson(file) {
  return JSON.parse(read(file));
}

function readWorkflow(file) {
  return read(`.github/workflows/${file}`);
}

describe("public storefront regression coverage", () => {
  test("homepage keeps Plaza San Juan Macias branding and removes Tottus", () => {
    const dom = domFrom("deploy/index.html");
    const title = dom.window.document.title;
    const html = dom.serialize();

    expect(title).toContain("Plaza San Juan");
    expect(html).not.toContain("Tottus");
  });

  test("public HTML does not leak technology categories or blocked terms", () => {
    const blockedPattern =
      /(tecnolog|electrohogar|smart\s?tv|televisor|impresora|notebook|computadora)/i;

    for (const file of publicHtmlFiles) {
      expect(read(file)).not.toMatch(blockedPattern);
    }
  });

  test("homepage menu and hero render targets remain wired to local commerce flows", () => {
    const dom = domFrom("deploy/index.html");
    const links = [...dom.window.document.querySelectorAll("a")].map((node) =>
      node.getAttribute("href"),
    );

    expect(links).toContain("./categorias/");
    expect(links).toContain("./reparto/");
    expect(links).toContain("./checkout/");
    expect(links).not.toContain("./producto/");
  });

  test("public UI labels use Delivery wording instead of Reparto", () => {
    for (const file of publicHtmlFiles) {
      const html = read(file);
      expect(html).not.toContain(">Reparto<");
      expect(html).not.toContain("Zonas y reparto");
    }
  });

  test("checkout limits payment methods to the six approved options", () => {
    const dom = domFrom("deploy/checkout/index.html");
    const options = [...dom.window.document.querySelectorAll("option")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    expect(options).toContain("Yape");
    expect(options).toContain("BCP");
    expect(options).toContain("PayPal");
    expect(options).toContain("Binance USDT BEP20");
    expect(options).toContain("Tarjeta credito/debito");
    expect(options).toContain("Google Pay");
    expect(options.join(" ")).not.toContain("Efectivo");
  });

  test("checkout shows payment logos, min order and delivery-only messaging", () => {
    const dom = domFrom("deploy/checkout/index.html");
    const html = dom.serialize();
    const badgeAlts = [...dom.window.document.querySelectorAll("img")]
      .map((node) => node.getAttribute("alt"))
      .filter(Boolean)
      .join(" ");

    expect(html).toContain("S/ 50.00");
    expect(html).toContain("Delivery fijo");
    expect(html).toContain("Solo delivery, sin recojo");
    expect(badgeAlts).toContain("Yape");
    expect(badgeAlts).toContain("BCP");
    expect(badgeAlts).toContain("PayPal");
    expect(badgeAlts).toContain("Binance");
    expect(badgeAlts).toContain("Tarjeta");
    expect(badgeAlts).toContain("Google Pay");
    expect(html).toContain("data-checkout-subtotal");
    expect(html).toContain("data-checkout-delivery");
    expect(html).toContain("data-checkout-variant-warning");
    expect(html).toContain("data-order-whatsapp");
    expect(html).toContain("data-payment-guidance");
    expect(html).toContain("data-delivery-map");
    expect(html).toContain("data-map-selection-status");
  });

  test("account and profile keep login, social buttons and delivery fields", () => {
    const accountDom = domFrom("deploy/cuenta/index.html");
    const profileDom = domFrom("deploy/perfil/index.html");

    const socialButtons = [...accountDom.window.document.querySelectorAll("[data-social-provider]")]
      .map((node) => node.textContent.trim())
      .join(" ");
    const profileFields = [...profileDom.window.document.querySelectorAll("input, textarea")]
      .map((node) => node.getAttribute("name"))
      .filter(Boolean);

    expect(socialButtons).toContain("Google");
    expect(socialButtons).toContain("Facebook");
    expect(profileFields).toContain("addressLine1");
    expect(profileFields).toContain("district");
    expect(profileFields).toContain("reference");
  });
});

describe("catalog and category regressions", () => {
  test("deploy catalog summary excludes blocked categories and blocked product names", () => {
    const payload = parseJson("deploy/data/catalog-summary.json");

    expect(payload.products.length).toBeGreaterThan(1000);
    expect(payload.categories.length).toBeGreaterThan(10);

    for (const category of payload.categories) {
      expect(hasBlockedCategory(category.name)).toBe(false);
      expect(category.productCount).toBeGreaterThan(0);
    }

    for (const product of payload.products) {
      expect(product.price.current).toBeGreaterThan(0);
      expect(product.price.current).toBe(Number(product.price.current.toFixed(2)));
      expect(hasBlockedCategory(product.categoryName)).toBe(false);
      expect(hasBlockedProduct(product.name)).toBe(false);
      expect(Object.hasOwn(product, "variantId")).toBe(true);
      expect(Object.hasOwn(product, "variantType")).toBe(true);
      expect(Object.hasOwn(product, "variantLabel")).toBe(true);
      expect(Object.hasOwn(product, "requiresVariantSelection")).toBe(true);
      expect(Array.isArray(product.variantOptions)).toBe(true);
    }
  });

  test("catalog summary flags size-sensitive products for future variant selection", () => {
    const payload = parseJson("deploy/data/catalog-summary.json");
    const sizeProducts = payload.products.filter(
      (product) => product.variantType === "size" && product.requiresVariantSelection,
    );
    const categories = new Set(sizeProducts.map((product) => product.categoryName));

    expect(sizeProducts.length).toBeGreaterThan(10);
    expect([...categories].every((name) => /vestuario|calzado/i.test(name))).toBe(true);
  });

  test("critical generated categories are not empty and keep add-to-cart actions", () => {
    const categoryFiles = [
      "deploy/categorias/dormitorio/index.html",
      "deploy/categorias/abarrotes/index.html",
      "deploy/categorias/limpieza/index.html",
    ];

    for (const file of categoryFiles) {
      const dom = domFrom(file);
      const productCards = dom.window.document.querySelectorAll(".product-card");
      const addButtons = dom.window.document.querySelectorAll("[data-add-to-cart]");
      const payLinks = [...dom.window.document.querySelectorAll(".product-card__actions a")].map((node) =>
        node.getAttribute("href"),
      );

      expect(productCards.length).toBeGreaterThan(0);
      expect(addButtons.length).toBeGreaterThan(0);
      expect(payLinks.every((href) => href === "../../checkout/")).toBe(true);
    }
  });

  test("homepage featured products also keep working commerce actions", () => {
    const summary = parseJson("deploy/data/homepage.json");
    const dom = domFrom("deploy/index.html");

    expect(summary.categories.length).toBeGreaterThan(3);
    expect(summary.featuredProducts.length).toBeGreaterThan(3);
    expect(dom.window.document.querySelector("[data-home-featured-products]")).not.toBeNull();
    expect(dom.window.document.querySelector("[data-home-categories]")).not.toBeNull();
    expect(dom.window.document.querySelector("[data-home-promo-banners]")).not.toBeNull();
  });

  test("catalog page exposes search, category, brand and sort discovery controls", () => {
    const dom = domFrom("deploy/catalogo/index.html");
    const document = dom.window.document;

    expect(document.querySelector("[data-catalog-filters]")).not.toBeNull();
    expect(document.querySelector("[data-catalog-search]")).not.toBeNull();
    expect(document.querySelector("[data-catalog-category-filter]")).not.toBeNull();
    expect(document.querySelector("[data-catalog-brand-filter]")).not.toBeNull();
    expect(document.querySelector("[data-catalog-sort]")).not.toBeNull();
    expect(document.body.textContent).toContain("Precio: menor a mayor");
    expect(document.body.textContent).toContain("Nombre: A-Z");
  });
});

describe("seo and runtime packaging regressions", () => {
  test("seo essentials exist on homepage and key category pages", () => {
    const files = ["deploy/index.html", "deploy/categorias/dormitorio/index.html"];

    for (const file of files) {
      const dom = domFrom(file);
      const document = dom.window.document;

      expect(document.querySelector('meta[name="viewport"]')).not.toBeNull();
      expect(document.querySelector('meta[name="description"]')).not.toBeNull();
      expect(document.querySelector('meta[name="keywords"]')).not.toBeNull();
      expect(document.querySelector('link[rel="canonical"]')).not.toBeNull();
      expect(document.querySelector('link[rel="alternate"][hreflang="es-PE"]')).not.toBeNull();
      expect(document.querySelector('meta[property="og:title"]')).not.toBeNull();
      expect(document.querySelector('meta[property="og:locale"]')).not.toBeNull();
      expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();
    }
  });

  test("admin page stays out of search indexing", () => {
    const dom = domFrom("deploy/admin/index.html");
    const robots = dom.window.document.querySelector('meta[name="robots"]');

    expect(robots).not.toBeNull();
    expect(robots.getAttribute("content")).toBe("noindex,nofollow");
  });

  test("static admin entry redirects immediately to the php panel", () => {
    const adminHtml = read("deploy/admin/index.html");

    expect(adminHtml).toContain('method="post" action="./index.php"');
    expect(adminHtml).toContain('name="action" value="login"');
    expect(adminHtml).toContain('name="email"');
    expect(adminHtml).toContain('name="password"');
  });

  test("deploy contains robots, sitemap, reparto page and generated brand assets", () => {
    const files = [
      "deploy/.htaccess",
      "deploy/admin/.htaccess",
      "deploy/admin/index.html",
      "deploy/admin/index.php",
      "deploy/index.html",
      "deploy/robots.txt",
      "deploy/sitemap.xml",
      "deploy/reparto/index.html",
      "deploy/assets/brand/logo-plaza-san-juan-macias.svg",
      "deploy/assets/brand/hero-canasta.svg",
      "deploy/assets/brand/hero-reparto.svg",
      "deploy/assets/brand/hero-colores.svg",
      "deploy/assets/payment/yape-badge.png",
      "deploy/assets/payment/bcp-badge.svg",
      "deploy/assets/payment/paypal-badge.svg",
      "deploy/assets/payment/binance-badge.svg",
      "deploy/assets/payment/card-badge.svg",
      "deploy/assets/payment/google-pay-badge.svg",
      "deploy/assets/payment/yape-qr.jpeg",
    ];

    for (const file of files) {
      expect(exists(file)).toBe(true);
    }
  });

  test("deploy scripts only expose runtime files needed by the storefront", () => {
    const scriptsDir = path.join(deployRoot, "scripts");
    const files = fs.readdirSync(scriptsDir).sort();

    expect(files).toEqual([
      "account-utils.js",
      "app.js",
      "site-data.js",
      "storefront-utils.js",
    ]);
  });

  test("responsive CSS breakpoints remain present", () => {
    const css = read("styles/main.css");

    expect(css).toContain("@media (max-width: 1080px)");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain(".product-grid");
    expect(css).toContain(".checkout-layout");
    expect(css).toContain("height: 240px;");
    expect(css).toContain("overflow: hidden;");
    expect(css).toContain("max-width: 26ch;");
    expect(css).toContain("max-height: 280px;");
    expect(css).toContain("padding: 28px 176px 28px 28px;");
    expect(css).toContain("width: min(28%, 140px);");
    expect(css).toContain("max-height: 110px;");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 118px));");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain(".admin-dashboard .section-heading");
  });

  test("yape assets use the provided fixed logo and qr files", () => {
    const pkg = parseJson("package.json");
    const checkoutHtml = read("deploy/checkout/index.html");
    const publicHtml = publicHtmlFiles.map((file) => read(file)).join("\n");

    expect(pkg.scripts.build).toBe("node scripts/build-catalog.mjs");
    expect(pkg.scripts.verify).toBe("npm run build && npm run prepare:deploy && npm run test");
    expect(checkoutHtml).toContain("../assets/payment/yape-badge.png");
    expect(checkoutHtml).toContain("../assets/payment/yape-qr.jpeg");
    expect(publicHtml).not.toContain("yape-badge.svg");
  });

  test("category promo artwork no longer contains cropped text inside the svg", () => {
    const heroColors = read("assets/brand/hero-colores.svg");
    const heroCanasta = read("assets/brand/hero-canasta.svg");
    const heroReparto = read("assets/brand/hero-reparto.svg");

    expect(heroColors).not.toContain("<text");
    expect(heroColors).toContain("<circle");
    expect(heroCanasta).not.toContain("<text");
    expect(heroReparto).not.toContain("<text");
  });

  test("delivery page includes the expanded covered areas", () => {
    const repartoHtml = read("deploy/reparto/index.html");
    const homeHtml = read("deploy/index.html");
    const categoryHtml = read("deploy/categorias/gaseosas-aguas-y-jugos/index.html");

    expect(repartoHtml).toContain("200 Millas");
    expect(repartoHtml).toContain("Los Portales del Aeropuerto");
    expect(homeHtml).toContain("200 Millas");
    expect(homeHtml).toContain("Los Portales del Aeropuerto");
    expect(categoryHtml).toContain("200 Millas");
    expect(categoryHtml).toContain("Los Portales del Aeropuerto");
  });

  test("deploy workflows preserve hidden files and validate artifacts before FTP publish", () => {
    const stagingWorkflow = readWorkflow("deploy-staging.yml");
    const productionWorkflow = readWorkflow("deploy-production.yml");

    for (const workflow of [stagingWorkflow, productionWorkflow]) {
      expect(workflow).toContain("include-hidden-files: true");
      expect(workflow).toContain("if-no-files-found: error");
      expect(workflow).toContain("needs: verify");
      expect(workflow).toContain("Provision admin credentials");
      expect(workflow).toContain("node scripts/bootstrap-admin.mjs --target-root ./deploy");
      expect(workflow).toContain("ADMIN_EMAIL");
      expect(workflow).toContain("ADMIN_PASSWORD");
      expect(workflow).toContain("ADMIN_NAME");
      expect(workflow).toContain("test -f deploy/index.html");
      expect(workflow).toContain("test -f deploy/.htaccess");
      expect(workflow).toContain("test -f deploy/checkout/index.html");
      expect(workflow).toContain("test -f deploy/assets/payment/yape-qr.jpeg");
      expect(workflow).toContain("test -f deploy/storage/admin/admins.json");
    }

    expect(productionWorkflow).toContain("Provision MySQL runtime config into production artifact");
    expect(productionWorkflow).toContain("node scripts/render-runtime-config.mjs --target-root ./deploy");
    expect(productionWorkflow).toContain("DB_HOST: ${{ secrets.DB_HOST }}");
    expect(productionWorkflow).toContain("DB_NAME: ${{ secrets.DB_NAME }}");
    expect(productionWorkflow).toContain("DB_USER: ${{ secrets.DB_USER }}");
    expect(productionWorkflow).toContain("DB_PASSWORD: ${{ secrets.DB_PASSWORD }}");
    expect(productionWorkflow).toContain("test -f deploy/api/_runtime-config.php");
  });

  test("ci and deploy workflows enforce serialized runs per target branch", () => {
    const ciWorkflow = readWorkflow("ci.yml");
    const stagingWorkflow = readWorkflow("deploy-staging.yml");
    const productionWorkflow = readWorkflow("deploy-production.yml");

    expect(ciWorkflow).toContain("cancel-in-progress: true");
    expect(stagingWorkflow).toContain("group: deploy-staging");
    expect(stagingWorkflow).toContain("cancel-in-progress: true");
    expect(productionWorkflow).toContain("group: deploy-production");
    expect(productionWorkflow).toContain("cancel-in-progress: true");
  });

  test("mysql migration foundation files exist", () => {
    const files = [
      "api/_database.php",
      "api/_mysql_schema.php",
      "api/admin/migrate-mysql.php",
      "database/mysql/schema.sql",
      "docs/mysql-migration.md",
      "scripts/export-json-to-mysql.mjs",
      "scripts/render-runtime-config.mjs",
    ];

    for (const file of files) {
      expect(exists(file)).toBe(true);
    }
  });
});

describe("backend and account utilities", () => {
  test("critical PHP endpoints exist for auth, profile and orders", () => {
    const files = [
      "api/admin/login.php",
      "api/admin/logout.php",
      "api/admin/me.php",
      "api/admin/orders.php",
      "api/admin/users.php",
      "api/submit-order.php",
      "api/orders/list.php",
      "api/auth/register.php",
      "api/auth/login.php",
      "api/auth/logout.php",
      "api/auth/me.php",
      "api/profile/save.php",
    ];

    for (const file of files) {
      expect(exists(file)).toBe(true);
    }
  });

  test("admin page exposes login form and dashboard placeholders", () => {
    const dom = domFrom("deploy/admin/index.php");
    const document = dom.window.document;

    expect(document.querySelector('form[method="post"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Acceso admin");
    expect(document.body.textContent).toContain("Pedidos recientes");
    expect(document.body.textContent).toContain("Clientes recientes");
  });

  test("server-side admin page exists and prioritizes php over static html", () => {
    const adminHtaccess = read("admin/.htaccess");
    const adminPhp = read("admin/index.php");

    expect(adminHtaccess).toContain("DirectoryIndex index.php index.html");
    expect(adminPhp).toContain("method=\"post\" action=\"./index.php\"");
    expect(adminPhp).not.toContain("require_logged_in_admin()");
    expect(adminPhp).toContain("find_admin_by_id($adminSessionId)");
    expect(adminPhp).toContain("Content-Type: text/html; charset=utf-8");
    expect(adminPhp).toContain("load_admins()");
    expect(adminPhp).toContain("replace_admin($storedAdmin)");
    expect(adminPhp).toContain("update_order_status(");
    expect(adminPhp).toContain("name=\"action\" value=\"update-order-status\"");
    expect(adminPhp).toContain("class=\"stack-form admin-filter-form\"");
    expect(adminPhp).toContain("name=\"status\"");
    expect(adminPhp).toContain("name=\"q\"");
    expect(adminPhp).toContain("WhatsApp cliente");
    expect(adminPhp).toContain("Notificar estado por WhatsApp");
    expect(adminPhp).toContain("function whatsapp_link(string $phone, string $message): string");
    expect(adminPhp).toContain("Detalle de pedido");
    expect(adminPhp).toContain("Detalle de cliente");
  });

  test("admin orders endpoint supports listing and status updates", () => {
    const endpoint = read("api/admin/orders.php");

    expect(endpoint).toContain("$_SERVER['REQUEST_METHOD'] === 'POST'");
    expect(endpoint).toContain("decode_json_request()");
    expect(endpoint).toContain("update_order_status($orderId, $status");
    expect(endpoint).toContain("$_SERVER['REQUEST_METHOD'] === 'GET'");
  });

  test("admin bootstrap script is available in package scripts", () => {
    const pkg = parseJson("package.json");
    const bootstrapSource = read("scripts/bootstrap-admin.mjs");

    expect(pkg.scripts["bootstrap:admin"]).toBe("node scripts/bootstrap-admin.mjs");
    expect(bootstrapSource).toContain("admins.json");
    expect(bootstrapSource).toContain("sha256$");
    expect(bootstrapSource).toContain("env.ADMIN_EMAIL");
    expect(bootstrapSource).toContain("--target-root");
  });

  test("mysql export script is available in package scripts", () => {
    const pkg = parseJson("package.json");
    const exporter = read("scripts/export-json-to-mysql.mjs");

    expect(pkg.scripts["db:export-sql"]).toBe("node scripts/export-json-to-mysql.mjs");
    expect(exporter).toContain("import-from-json.sql");
    expect(exporter).toContain("INSERT INTO users");
    expect(exporter).toContain("INSERT INTO orders");
    expect(exporter).toContain("INSERT INTO admins");
  });

  test("mysql sync script is available in package scripts", () => {
    const pkg = parseJson("package.json");
    const syncScript = read("scripts/sync-json-to-mysql.mjs");

    expect(pkg.scripts["db:sync:mysql"]).toBe("node scripts/sync-json-to-mysql.mjs");
    expect(syncScript).toContain('mysql2/promise');
    expect(syncScript).toContain("schema.sql");
    expect(syncScript).toContain("import-from-json.sql");
    expect(syncScript).toContain("ADMIN_EMAIL");
    expect(syncScript).toContain("INSERT INTO admins");
  });

  test("mysql schema defines the expected ecommerce tables", () => {
    const schema = read("database/mysql/schema.sql");

    expect(schema).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS user_addresses");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS admins");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS orders");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS order_items");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS payments");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS audit_logs");
  });

  test("php database helper reads mysql env configuration", () => {
    const helper = read("api/_database.php");

    expect(helper).toContain("_runtime-config.php");
    expect(helper).toContain("runtime_config()");
    expect(helper).toContain("DB_HOST");
    expect(helper).toContain("DB_PORT");
    expect(helper).toContain("DB_NAME");
    expect(helper).toContain("DB_USER");
    expect(helper).toContain("DB_PASSWORD");
    expect(helper).toContain("new PDO");
  });

  test("server-side mysql migration endpoint is protected behind admin auth", () => {
    const schemaHelper = read("api/_mysql_schema.php");
    const migrationEndpoint = read("api/admin/migrate-mysql.php");

    expect(schemaHelper).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(schemaHelper).toContain("CREATE TABLE IF NOT EXISTS orders");
    expect(migrationEndpoint).toContain("require_logged_in_admin()");
    expect(migrationEndpoint).toContain("db_is_configured()");
    expect(migrationEndpoint).toContain("mysql_schema_sql()");
    expect(migrationEndpoint).toContain("persist_order(");
  });

  test("auth helper exposes order detail and admin status update primitives", () => {
    const helper = read("api/_auth.php");

    expect(helper).toContain("function order_status_catalog(): array");
    expect(helper).toContain("function find_order_by_id(string $orderId): ?array");
    expect(helper).toContain("function update_order_status(string $orderId, string $statusCode, array $meta = []): ?array");
    expect(helper).toContain("'out_for_delivery' => 'En camino'");
    expect(helper).toContain("'delivered' => 'Entregado'");
    expect(helper).toContain("'cancelled' => 'Cancelado'");
  });

  test("admin login endpoint can recover from stale mysql admin hashes using local admin storage", () => {
    const loginEndpoint = read("api/admin/login.php");

    expect(loginEndpoint).toContain("foreach (load_admins() as $storedAdmin)");
    expect(loginEndpoint).toContain("replace_admin($storedAdmin);");
    expect(loginEndpoint).toContain("Credenciales de administracion invalidas.");
  });

  test("submit-order backend persists delivery fee totals and variant metadata", () => {
    const endpoint = read("api/submit-order.php");

    expect(endpoint).toContain("'Tarjeta credito/debito'");
    expect(endpoint).toContain("'Google Pay'");
    expect(endpoint).toContain("$deliveryFee = 5.0;");
    expect(endpoint).toContain("'variantId' => normalize_text((string) ($item['variantId'] ?? ''))");
    expect(endpoint).toContain("'variantLabel' => normalize_text((string) ($item['variantLabel'] ?? ''))");
    expect(endpoint).toContain("'variantType' => normalize_text((string) ($item['variantType'] ?? ''))");
    expect(endpoint).toContain("'requiresVariantSelection' => (bool) ($item['requiresVariantSelection'] ?? false)");
    expect(endpoint).toContain("'subtotal' => $computedSubtotal");
    expect(endpoint).toContain("'deliveryFee' => $deliveryFee");
    expect(endpoint).toContain("'total' => $computedTotal");
  });

  test("runtime config renderer can provision mysql credentials into a target deploy directory", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "psjm-runtime-"));
    const targetRoot = path.join(tempRoot, "deploy");

    await renderRuntimeConfig({
      targetRoot,
      dbHost: "sql110.infinityfree.com",
      dbPort: "3306",
      dbName: "if0_41165587_san_juan_macias",
      dbUser: "if0_41165587",
      dbPassword: "feZQuGJeav",
      dbCharset: "utf8mb4",
    });

    const created = fs.readFileSync(path.join(targetRoot, "api", "_runtime-config.php"), "utf8");
    expect(created).toContain("'DB_HOST' => \"sql110.infinityfree.com\"");
    expect(created).toContain("'DB_PORT' => \"3306\"");
    expect(created).toContain("'DB_NAME' => \"if0_41165587_san_juan_macias\"");
    expect(created).toContain("'DB_USER' => \"if0_41165587\"");
    expect(created).toContain("'DB_PASSWORD' => \"feZQuGJeav\"");
    expect(created).toContain("'DB_CHARSET' => \"utf8mb4\"");
  });

  test("admin bootstrap script can provision an admin file into a target deploy directory", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "psjm-admin-"));
    const targetRoot = path.join(tempRoot, "deploy");
    fs.mkdirSync(path.join(targetRoot, "storage", "admin"), { recursive: true });

    return provisionAdminFile({
      email: "liliet.polanco.peru@gmail.com",
      password: "qwerty12345/",
      fullName: "Administrador",
      targetRoot,
    }).then(() => {
      const created = JSON.parse(
        fs.readFileSync(path.join(targetRoot, "storage", "admin", "admins.json"), "utf8"),
      );

      expect(created).toHaveLength(1);
      expect(created[0].email).toBe("liliet.polanco.peru@gmail.com");
      expect(created[0].fullName).toBe("Administrador");
      expect(created[0].role).toBe("owner");
      expect(created[0].passwordHash).toContain("sha256$");
      expect(created[0].passwordHash).not.toContain("qwerty12345/");
    });
  });

  test("register validation catches basic invalid input", () => {
    expect(
      validateRegisterInput({
        fullName: "A",
        email: "correo",
        password: "123",
        confirmPassword: "456",
      }).length,
    ).toBeGreaterThan(0);
  });

  test("login validation requires email and password", () => {
    expect(validateLoginInput({ email: "", password: "" }).length).toBeGreaterThan(0);
  });

  test("profile summary concatenates useful delivery fields", () => {
    const summary = buildProfileSummary({
      fullName: "Liliet Polanco",
      addressLine1: "Av. Siempre Viva 742",
      district: "Callao",
      reference: "Puerta verde",
    });

    expect(summary).toContain("Liliet Polanco");
    expect(summary).toContain("Av. Siempre Viva 742");
    expect(summary).toContain("Puerta verde");
  });

  test("profile validation requires name, phone and address", () => {
    expect(
      validateProfileInput({
        fullName: "",
        phone: "",
        district: "",
        addressLine1: "",
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe("frontend runtime regressions", () => {
  test("single add-to-cart click increments the cart once after homepage hydration", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="./"><body><span data-cart-count>0</span><div data-home-featured-products></div></body></html>`,
      { url: "https://example.com/" },
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesión activa." }),
          };
        }

        if (href.endsWith("data/homepage.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              featuredProducts: [
                {
                  id: "prd-1",
                  name: "Juego de sábanas clásico",
                  image: "https://example.com/sabana.jpg",
                  categoryName: "Dormitorio",
                  brand: "Casa Viva",
                  price: {
                    current: 39.9,
                    compareAt: null,
                  },
                },
              ],
            }),
          };
        }

        if (href.endsWith("data/catalog-summary.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              products: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const button = dom.window.document.querySelector("[data-add-to-cart]");
      const cartCount = dom.window.document.querySelector("[data-cart-count]");

      expect(button).not.toBeNull();
      button.click();

      const cart = JSON.parse(dom.window.localStorage.getItem("plaza-cart"));
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(1);
      expect(cartCount.textContent).toBe("1");
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("vestuario category exposes the pending size notice on size-sensitive products", () => {
    const html = read("deploy/categorias/vestuario/index.html");

    expect(html).toContain("Requiere talla");
    expect(html).toContain("WhatsApp talla");
  });

  test("rapid duplicate add events are throttled so one user action does not add twice", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="./"><body><span data-cart-count>0</span><div data-home-featured-products></div></body></html>`,
      { url: "https://example.com/" },
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesión activa." }),
          };
        }

        if (href.endsWith("data/homepage.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              featuredProducts: [
                {
                  id: "prd-cisne",
                  name: "Colchon Cisne Clasico",
                  image: "https://example.com/cisne.jpg",
                  categoryName: "Dormitorio",
                  brand: "Cisne",
                  price: {
                    current: 199.9,
                    compareAt: null,
                  },
                },
              ],
            }),
          };
        }

        if (href.endsWith("data/catalog-summary.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              products: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-throttle=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const button = dom.window.document.querySelector("[data-add-to-cart]");
      button.click();
      button.click();

      const cart = JSON.parse(dom.window.localStorage.getItem("plaza-cart"));
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(1);
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("checkout quantity controls recalculate totals and can remove items", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="../"><body>
        <span data-cart-count>0</span>
        <p data-checkout-minimum></p>
        <p data-checkout-variant-warning hidden></p>
        <ul data-checkout-items></ul>
        <strong data-checkout-subtotal></strong>
        <strong data-checkout-delivery></strong>
        <strong data-checkout-total></strong>
        <form data-order-form><button type="submit">Registrar</button></form>
        <p data-order-status></p>
      </body></html>`,
      { url: "https://example.com/checkout/" },
    );

    dom.window.localStorage.setItem(
      "plaza-cart",
      JSON.stringify([
        {
          id: "ropa-1",
          key: "ropa-1::talla-m",
          name: "Polo deportivo",
          image: "https://example.com/polo.jpg",
          price: 12,
          variantId: "talla-m",
          variantLabel: "Talla M",
          variantType: "size",
          requiresVariantSelection: true,
          quantity: 1,
        },
      ]),
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesion activa." }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-checkout=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const subtotalNode = dom.window.document.querySelector("[data-checkout-subtotal]");
      const deliveryNode = dom.window.document.querySelector("[data-checkout-delivery]");
      const totalNode = dom.window.document.querySelector("[data-checkout-total]");

      expect(dom.window.document.body.textContent).toContain("Talla M");
      expect(subtotalNode.textContent).toContain("12.00");
      expect(deliveryNode.textContent).toContain("5.00");
      expect(totalNode.textContent).toContain("17.00");

      dom.window.document.querySelector("[data-increase-qty]").click();
      expect(JSON.parse(dom.window.localStorage.getItem("plaza-cart"))[0].quantity).toBe(2);
      expect(subtotalNode.textContent).toContain("24.00");
      expect(totalNode.textContent).toContain("29.00");

      dom.window.document.querySelector("[data-decrease-qty]").click();
      expect(JSON.parse(dom.window.localStorage.getItem("plaza-cart"))[0].quantity).toBe(1);
      expect(totalNode.textContent).toContain("17.00");

      dom.window.document.querySelector("[data-remove-item]").click();
      expect(JSON.parse(dom.window.localStorage.getItem("plaza-cart"))).toEqual([]);
      expect(totalNode.textContent).toContain("0.00");
      expect(deliveryNode.textContent).toContain("0.00");
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("size-sensitive products without a defined size stay blocked from add-to-cart", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="./"><body><span data-cart-count>0</span><div data-home-featured-products></div><p data-order-status></p></body></html>`,
      { url: "https://example.com/" },
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesion activa." }),
          };
        }

        if (href.endsWith("data/homepage.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              featuredProducts: [
                {
                  id: "vest-1",
                  name: "Ballerina Mujer Redwood",
                  image: "https://example.com/ballerina.jpg",
                  categoryName: "Vestuario",
                  brand: "Redwood",
                  price: {
                    current: 59.9,
                    compareAt: null,
                  },
                  variantType: "size",
                  variantId: "vest-1",
                  variantLabel: "",
                  requiresVariantSelection: true,
                  variantOptions: [],
                },
              ],
            }),
          };
        }

        if (href.endsWith("data/catalog-summary.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              products: [],
            }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-size-block=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const button = dom.window.document.querySelector("[data-add-to-cart]");

      expect(dom.window.document.body.textContent).toContain("Coordina la talla por WhatsApp");
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain("Talla por confirmar");
      expect(dom.window.localStorage.getItem("plaza-cart")).toBeNull();
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("successful checkout exposes a WhatsApp follow-up link with the order id", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="../"><body>
        <span data-cart-count>0</span>
        <p data-checkout-minimum></p>
        <p data-checkout-variant-warning hidden></p>
        <ul data-checkout-items></ul>
        <strong data-checkout-subtotal></strong>
        <strong data-checkout-delivery></strong>
        <strong data-checkout-total></strong>
        <form data-order-form>
          <div data-delivery-map></div>
          <div data-delivery-pin hidden></div>
          <p data-map-selection-status></p>
          <button type="button" data-map-clear></button>
          <button type="button" data-map-shortcut data-map-x="0.5" data-map-y="0.5"></button>
          <input name="fullName" value="Liliet Polanco" />
          <input name="email" value="liliet.polanco.peru@gmail.com" />
          <input name="phone" value="944537419" />
          <input name="district" value="San Juan Macias" />
          <input name="addressLine1" value="Mz A Lt 1" />
          <input name="addressLine2" value="" />
          <textarea name="reference"></textarea>
          <input name="deliveryPinZone" value="" />
          <input name="deliveryPinLabel" value="" />
          <input name="deliveryPinLatitude" value="" />
          <input name="deliveryPinLongitude" value="" />
          <input name="deliveryPinX" value="" />
          <input name="deliveryPinY" value="" />
          <select name="paymentMethod"><option value="Yape" selected>Yape</option></select>
          <textarea name="notes"></textarea>
          <button type="submit">Registrar</button>
          <p data-order-status></p>
          <a data-order-whatsapp hidden></a>
        </form>
      </body></html>`,
      { url: "https://example.com/checkout/" },
    );

    dom.window.localStorage.setItem(
      "plaza-cart",
      JSON.stringify([
        {
          id: "prd-1",
          key: "prd-1::default",
          name: "Azucar Rubia",
          image: "https://example.com/azucar.jpg",
          price: 60,
          variantId: "",
          variantLabel: "",
          variantType: "default",
          requiresVariantSelection: false,
          quantity: 1,
        },
      ]),
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    let submittedPayload = null;
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url, options) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesion activa." }),
          };
        }

        if (href.endsWith("api/submit-order.php")) {
          expect(options.method).toBe("POST");
          submittedPayload = JSON.parse(String(options.body));
          return {
            ok: true,
            json: async () => ({ orderId: "PSJM-TEST-001" }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-whatsapp=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const map = dom.window.document.querySelector("[data-delivery-map]");
      Object.defineProperty(map, "getBoundingClientRect", {
        value: () => ({
          left: 20,
          top: 10,
          width: 300,
          height: 240,
          right: 320,
          bottom: 250,
        }),
      });
      map.dispatchEvent(
        new dom.window.MouseEvent("click", {
          bubbles: true,
          clientX: 210,
          clientY: 90,
        }),
      );

      const form = dom.window.document.querySelector("[data-order-form]");
      form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const whatsappLink = dom.window.document.querySelector("[data-order-whatsapp]");
      expect(whatsappLink.hidden).toBe(false);
      expect(whatsappLink.href).toContain("wa.me/51944537419");
      expect(decodeURIComponent(whatsappLink.href)).toContain("PSJM-TEST-001");
      expect(decodeURIComponent(whatsappLink.href)).toContain("Yape");
      expect(submittedPayload.customer.deliveryPin.zone).toBe("San Juan Macias");
      expect(submittedPayload.customer.deliveryPin.label).toContain("franja norte");
      expect(submittedPayload.customer.reference).toContain("[Pin mapa]");
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("checkout map pin autocompletes delivery zone, address base and reference", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="../"><body>
        <span data-cart-count>0</span>
        <p data-checkout-minimum></p>
        <p data-checkout-variant-warning hidden></p>
        <ul data-checkout-items></ul>
        <strong data-checkout-subtotal></strong>
        <strong data-checkout-delivery></strong>
        <strong data-checkout-total></strong>
        <form data-order-form>
          <div data-delivery-map></div>
          <div data-delivery-pin hidden></div>
          <p data-map-selection-status></p>
          <button type="button" data-map-clear>Limpiar</button>
          <button type="button" data-map-shortcut data-map-x="0.16" data-map-y="0.5">200 Millas</button>
          <input name="fullName" value="Cliente Demo" />
          <input name="email" value="cliente@example.com" />
          <input name="phone" value="944537419" />
          <input name="district" value="" />
          <input name="addressLine1" value="" />
          <input name="addressLine2" value="" />
          <textarea name="reference"></textarea>
          <input name="deliveryPinZone" value="" />
          <input name="deliveryPinLabel" value="" />
          <input name="deliveryPinLatitude" value="" />
          <input name="deliveryPinLongitude" value="" />
          <input name="deliveryPinX" value="" />
          <input name="deliveryPinY" value="" />
          <select name="paymentMethod"><option value="Yape" selected>Yape</option></select>
          <textarea name="notes"></textarea>
          <button type="submit">Registrar</button>
          <p data-order-status></p>
          <a data-order-whatsapp hidden></a>
        </form>
      </body></html>`,
      { url: "https://example.com/checkout/" },
    );

    dom.window.localStorage.setItem(
      "plaza-cart",
      JSON.stringify([
        {
          id: "prd-2",
          key: "prd-2::default",
          name: "Leche Gloria",
          image: "https://example.com/leche.jpg",
          price: 55,
          variantId: "",
          variantLabel: "",
          variantType: "default",
          requiresVariantSelection: false,
          quantity: 1,
        },
      ]),
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesion activa." }),
          };
        }

        if (href.endsWith("api/admin/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesion admin." }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-checkout-map=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const map = dom.window.document.querySelector("[data-delivery-map]");
      const pin = dom.window.document.querySelector("[data-delivery-pin]");
      const status = dom.window.document.querySelector("[data-map-selection-status]");

      Object.defineProperty(map, "getBoundingClientRect", {
        value: () => ({
          left: 0,
          top: 0,
          width: 300,
          height: 240,
          right: 300,
          bottom: 240,
        }),
      });

      map.dispatchEvent(
        new dom.window.MouseEvent("click", {
          bubbles: true,
          clientX: 40,
          clientY: 120,
        }),
      );

      expect(dom.window.document.querySelector('[name="district"]').value).toBe("200 Millas");
      expect(dom.window.document.querySelector('[name="addressLine1"]').value).toContain("200 Millas, Callao");
      expect(dom.window.document.querySelector('[name="reference"]').value).toContain("[Pin mapa]");
      expect(dom.window.document.querySelector('[name="deliveryPinLatitude"]').value).not.toBe("");
      expect(dom.window.document.querySelector('[name="deliveryPinLongitude"]').value).not.toBe("");
      expect(pin.hidden).toBe(false);
      expect(status.textContent).toContain("200 Millas");

      dom.window.document.querySelector("[data-map-clear]").click();
      expect(dom.window.document.querySelector('[name="deliveryPinZone"]').value).toBe("");
      expect(dom.window.document.querySelector('[name="reference"]').value).toBe("");
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("profile order history exposes WhatsApp follow-up actions per order", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="../"><body>
        <span data-cart-count>0</span>
        <ul data-orders-list></ul>
      </body></html>`,
      { url: "https://example.com/perfil/" },
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesion activa." }),
          };
        }

        if (href.endsWith("api/admin/me.php")) {
          return {
            ok: false,
            json: async () => ({ message: "Sin sesion admin." }),
          };
        }

        if (href.endsWith("data/homepage.json")) {
          return {
            ok: true,
            json: async () => ({ categories: [], featuredProducts: [] }),
          };
        }

        if (href.endsWith("data/catalog-summary.json")) {
          return {
            ok: true,
            json: async () => ({ categories: [], products: [] }),
          };
        }

        if (href.endsWith("api/orders/list.php")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              orders: [
                {
                  orderId: "PSJM-ORDER-123",
                  savedAt: "2026-03-26T12:00:00.000Z",
                  total: 55,
                  statusLabel: "Pago por validar",
                  paymentMethod: "Google Pay",
                  customerName: "Liliet Polanco",
                },
              ],
            }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-profile-orders=${Date.now()}`;
      const appModule = await import(appUrl);
      await appModule.renderOrderHistory();

      const container = dom.window.document.querySelector("[data-orders-list]");
      const whatsappLink = container.querySelector("a");

      expect(container.textContent).toContain("Pago por validar | Google Pay");
      expect(container.textContent).toContain("Seguimiento por WhatsApp");
      expect(whatsappLink).not.toBeNull();
      expect(whatsappLink.href).toContain("wa.me/51944537419");
      expect(decodeURIComponent(whatsappLink.href)).toContain("PSJM-ORDER-123");
      expect(decodeURIComponent(whatsappLink.href)).toContain("Google Pay");
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("catalog runtime applies category, brand and sort filters", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="../"><body>
        <span data-cart-count>0</span>
        <div data-catalog-categories></div>
        <p data-catalog-summary></p>
        <p data-catalog-results-note></p>
        <select data-catalog-category-filter></select>
        <select data-catalog-brand-filter></select>
        <select data-catalog-sort>
          <option value="relevancia">Relevancia</option>
          <option value="precio-asc">Precio: menor a mayor</option>
          <option value="precio-desc">Precio: mayor a menor</option>
          <option value="nombre-asc">Nombre: A-Z</option>
        </select>
        <input data-catalog-search />
        <div data-catalog-grid></div>
      </body></html>`,
      { url: "https://example.com/catalogo/?categoria=abarrotes&marca=Marca%20A&orden=precio-desc&q=arroz" },
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return { ok: false, json: async () => ({ message: "Sin sesion activa." }) };
        }

        if (href.endsWith("api/admin/me.php")) {
          return { ok: false, json: async () => ({ message: "Sin sesion admin." }) };
        }

        if (href.endsWith("data/homepage.json")) {
          return { ok: true, json: async () => ({ categories: [], featuredProducts: [] }) };
        }

        if (href.endsWith("data/catalog-summary.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [
                { name: "Abarrotes", slug: "abarrotes", productCount: 2 },
                { name: "Limpieza", slug: "limpieza", productCount: 1 },
              ],
              products: [
                {
                  id: "a1",
                  name: "Arroz Superior",
                  image: "https://example.com/arroz-a.jpg",
                  categoryName: "Abarrotes",
                  categorySlug: "abarrotes",
                  brand: "Marca A",
                  price: { current: 11, compareAt: null },
                },
                {
                  id: "a2",
                  name: "Arroz Extra",
                  image: "https://example.com/arroz-b.jpg",
                  categoryName: "Abarrotes",
                  categorySlug: "abarrotes",
                  brand: "Marca A",
                  price: { current: 17, compareAt: null },
                },
                {
                  id: "l1",
                  name: "Lejia Hogar",
                  image: "https://example.com/lejia.jpg",
                  categoryName: "Limpieza",
                  categorySlug: "limpieza",
                  brand: "Marca B",
                  price: { current: 9, compareAt: null },
                },
              ],
            }),
          };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-catalog-filters=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const grid = dom.window.document.querySelector("[data-catalog-grid]");
      const summary = dom.window.document.querySelector("[data-catalog-summary]");
      const note = dom.window.document.querySelector("[data-catalog-results-note]");
      const brandFilter = dom.window.document.querySelector("[data-catalog-brand-filter]");
      const categoryFilter = dom.window.document.querySelector("[data-catalog-category-filter]");
      const sortFilter = dom.window.document.querySelector("[data-catalog-sort]");

      expect(grid.textContent).toContain("Arroz Extra");
      expect(grid.textContent).toContain("Arroz Superior");
      expect(grid.textContent).not.toContain("Lejia Hogar");
      expect(grid.textContent.indexOf("Arroz Extra")).toBeLessThan(grid.textContent.indexOf("Arroz Superior"));
      expect(summary.textContent).toContain("2 productos listos para delivery");
      expect(note.textContent).toContain('búsqueda "arroz"');
      expect(categoryFilter.value).toBe("abarrotes");
      expect(brandFilter.value).toBe("Marca A");
      expect(sortFilter.value).toBe("precio-desc");
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });

  test("homepage renders promoted product banners with images and commerce CTAs", async () => {
    const dom = new JSDOM(
      `<!doctype html><html data-root-prefix="./"><body>
        <span data-cart-count>0</span>
        <div data-home-categories></div>
        <div data-home-featured-products></div>
        <div data-home-promo-banners></div>
      </body></html>`,
      { url: "https://example.com/" },
    );

    const previousGlobals = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      FormData: globalThis.FormData,
      URLSearchParams: globalThis.URLSearchParams,
      fetch: globalThis.fetch,
    };

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      FormData: dom.window.FormData,
      URLSearchParams: dom.window.URLSearchParams,
      fetch: async (url) => {
        const href = String(url);

        if (href.endsWith("api/auth/me.php")) {
          return { ok: false, json: async () => ({ message: "Sin sesion activa." }) };
        }

        if (href.endsWith("api/admin/me.php")) {
          return { ok: false, json: async () => ({ message: "Sin sesion admin." }) };
        }

        if (href.endsWith("data/homepage.json")) {
          return {
            ok: true,
            json: async () => ({
              categories: [],
              featuredProducts: [
                {
                  id: "p1",
                  name: "Arroz Costeño",
                  image: "https://example.com/arroz.jpg",
                  categoryName: "Abarrotes",
                  brand: "Costeño",
                  price: { current: 7.5, compareAt: 8.2 },
                },
                {
                  id: "p2",
                  name: "Aceite Familiar",
                  image: "https://example.com/aceite.jpg",
                  categoryName: "Abarrotes",
                  brand: "Primor",
                  price: { current: 12.9, compareAt: null },
                },
                {
                  id: "p3",
                  name: "Detergente Activo",
                  image: "https://example.com/detergente.jpg",
                  categoryName: "Limpieza",
                  brand: "Activo",
                  price: { current: 9.9, compareAt: null },
                },
              ],
            }),
          };
        }

        if (href.endsWith("data/catalog-summary.json")) {
          return { ok: true, json: async () => ({ categories: [], products: [] }) };
        }

        throw new Error(`Unexpected fetch: ${href}`);
      },
    });

    try {
      const appUrl = `${pathToFileURL(path.join(repoRoot, "scripts", "app.js")).href}?runtime-test-home-banners=${Date.now()}`;
      await import(appUrl);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const banners = dom.window.document.querySelectorAll(".promo-banner");
      expect(banners).toHaveLength(3);
      expect(banners[0].textContent).toContain("Arroz Costeño");
      expect(banners[0].querySelector("img").getAttribute("src")).toBe("https://example.com/arroz.jpg");
      expect(banners[0].textContent).toContain("Agregar");
      expect(banners[0].textContent).toContain("Agregar y pagar");
    } finally {
      Object.assign(globalThis, previousGlobals);
      dom.window.close();
    }
  });
});
