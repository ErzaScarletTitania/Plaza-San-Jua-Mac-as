import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";

import {
  buildProfileSummary,
  validateLoginInput,
  validateProfileInput,
  validateRegisterInput,
} from "../scripts/account-utils.js";

const repoRoot = process.cwd();
const deployRoot = path.join(repoRoot, "deploy");
const publicHtmlFiles = [
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

  test("checkout limits payment methods to the four approved options", () => {
    const dom = domFrom("deploy/checkout/index.html");
    const options = [...dom.window.document.querySelectorAll("option")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    expect(options).toContain("Yape");
    expect(options).toContain("BCP");
    expect(options).toContain("PayPal");
    expect(options).toContain("Binance USDT BEP20");
    expect(options.join(" ")).not.toContain("Tarjeta");
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
    expect(html).toContain("Solo delivery, sin recojo");
    expect(badgeAlts).toContain("Yape");
    expect(badgeAlts).toContain("BCP");
    expect(badgeAlts).toContain("PayPal");
    expect(badgeAlts).toContain("Binance");
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
    }
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
      expect(document.querySelector('meta[property="og:title"]')).not.toBeNull();
      expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();
    }
  });

  test("deploy contains robots, sitemap, reparto page and generated brand assets", () => {
    const files = [
      "deploy/robots.txt",
      "deploy/sitemap.xml",
      "deploy/reparto/index.html",
      "deploy/assets/brand/logo-plaza-san-juan-macias.svg",
      "deploy/assets/brand/hero-canasta.svg",
      "deploy/assets/brand/hero-reparto.svg",
      "deploy/assets/brand/hero-colores.svg",
      "deploy/assets/payment/yape-badge.svg",
      "deploy/assets/payment/bcp-badge.svg",
      "deploy/assets/payment/paypal-badge.svg",
      "deploy/assets/payment/binance-badge.svg",
      "deploy/assets/payment/yape-qr.svg",
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
  });

  test("yape QR generator only encodes the phone number payload", () => {
    const generator = read("scripts/generate-yape-qr.mjs");

    expect(generator).toContain('const payload = "944537419";');
    expect(generator).not.toContain("Pago manual");
    expect(generator).not.toContain("Plaza San Juan");
  });
});

describe("backend and account utilities", () => {
  test("critical PHP endpoints exist for auth, profile and orders", () => {
    const files = [
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
});
