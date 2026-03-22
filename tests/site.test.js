import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { JSDOM } from "jsdom";

import {
  buildProfileSummary,
  validateLoginInput,
  validateProfileInput,
  validateRegisterInput,
} from "../scripts/account-utils.js";

const repoRoot = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function domFrom(file) {
  return new JSDOM(read(file));
}

function hasBlockedCategory(name) {
  return /(tecnolog|electrohogar|comput|pc|televisor|impresora)/i.test(name);
}

function hasBlockedProduct(name) {
  return /\b(laptop|notebook|tablet|smart\s?tv|televisor|impresora|pc|computadora|monitor)\b/i.test(
    name,
  );
}

describe("estructura pública", () => {
  test("homepage usa la nueva marca y no menciona Tottus", () => {
    const dom = domFrom("index.html");
    const title = dom.window.document.title;
    const html = dom.serialize();

    expect(title).toContain("Plaza San Juan Macías");
    expect(html).not.toContain("Tottus");
  });

  test("checkout limita los pagos a los cuatro métodos definidos", () => {
    const dom = domFrom("checkout/index.html");
    const options = [...dom.window.document.querySelectorAll("option")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    expect(options).toContain("Yape");
    expect(options).toContain("BCP");
    expect(options).toContain("PayPal");
    expect(options).toContain("Binance USDT BEP20");
    expect(options.join(" ")).not.toContain("Tarjeta");
  });

  test("cuenta ofrece login social y perfil pide dirección de entrega", () => {
    const accountDom = domFrom("cuenta/index.html");
    const profileDom = domFrom("perfil/index.html");

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

describe("catálogo generado", () => {
  test("catalog-summary en deploy existe y excluye categorías y productos bloqueados", () => {
    const payload = JSON.parse(read("deploy/data/catalog-summary.json"));

    expect(payload.products.length).toBeGreaterThan(0);
    expect(payload.categories.length).toBeGreaterThan(0);

    for (const category of payload.categories) {
      expect(hasBlockedCategory(category.name)).toBe(false);
    }

    for (const product of payload.products) {
      expect(product.price.current).toBeGreaterThan(0);
      expect(product.price.current).toBe(Number(product.price.current.toFixed(2)));
      expect(hasBlockedProduct(product.name)).toBe(false);
      expect(hasBlockedCategory(product.categoryName)).toBe(false);
    }
  });

  test("la categoría dormitorio generada contiene productos y acciones de compra", () => {
    const dom = domFrom("deploy/categorias/dormitorio/index.html");
    const productCards = dom.window.document.querySelectorAll(".product-card");
    const addButtons = dom.window.document.querySelectorAll("[data-add-to-cart]");

    expect(productCards.length).toBeGreaterThan(0);
    expect(addButtons.length).toBeGreaterThan(0);
  });

  test("se generan páginas SEO básicas de despliegue", () => {
    expect(fs.existsSync(path.join(repoRoot, "deploy", "sitemap.xml"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "deploy", "robots.txt"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "deploy", "reparto", "index.html"))).toBe(true);
  });
});

describe("backend", () => {
  test("los endpoints clave existen", () => {
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
      expect(fs.existsSync(path.join(repoRoot, file))).toBe(true);
    }
  });
});

describe("utilidades de cuenta", () => {
  test("validación de registro detecta errores básicos", () => {
    expect(
      validateRegisterInput({
        fullName: "A",
        email: "correo",
        password: "123",
        confirmPassword: "456",
      }).length,
    ).toBeGreaterThan(0);
  });

  test("validación de login requiere correo y contraseña", () => {
    expect(validateLoginInput({ email: "", password: "" }).length).toBeGreaterThan(0);
  });

  test("resumen de perfil concatena los datos útiles", () => {
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

  test("validación de perfil exige nombre, teléfono y dirección", () => {
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
