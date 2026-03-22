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

function hasBlockedCategory(name) {
  return /(tecnolog|electrohogar|comput|pc|laptop|tablet|televisor|impresora)/i.test(name);
}

describe("estructura del sitio", () => {
  test("index.html usa la nueva marca y ya no menciona Tottus", () => {
    const dom = new JSDOM(read("index.html"));
    const text = dom.window.document.body.textContent;

    expect(text).toContain("Plaza San Juan");
    expect(text).not.toContain("Tottus");
  });

  test("checkout limita los pagos a los cuatro métodos definidos", () => {
    const dom = new JSDOM(read("checkout/index.html"));
    const options = [...dom.window.document.querySelectorAll("option")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    expect(options).toContain("Yape");
    expect(options).toContain("BCP");
    expect(options).toContain("PayPal");
    expect(options).toContain("Binance USDT BEP20");
    expect(options.join(" ")).not.toContain("Tarjeta");
  });

  test("la cuenta ofrece registro social y el perfil pide dirección de entrega", () => {
    const accountDom = new JSDOM(read("cuenta/index.html"));
    const profileDom = new JSDOM(read("perfil/index.html"));

    const socialButtons = [...accountDom.window.document.querySelectorAll("[data-social-provider]")]
      .map((node) => node.textContent.trim());
    const profileFields = [...profileDom.window.document.querySelectorAll("input, textarea")]
      .map((node) => node.getAttribute("name"));

    expect(socialButtons.join(" ")).toContain("Google");
    expect(socialButtons.join(" ")).toContain("Facebook");
    expect(profileFields).toContain("addressLine1");
    expect(profileFields).toContain("district");
    expect(profileFields).toContain("reference");
  });

  test("los endpoints de pedidos y cuenta existen", () => {
    const files = [
      "api/submit-order.php",
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
      district: "Lima",
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

describe("catálogo generado", () => {
  test("catalog.json existe, tiene productos y excluye categorías bloqueadas", () => {
    const payload = JSON.parse(read("data/catalog.json"));
    expect(payload.products.length).toBeGreaterThan(0);
    expect(payload.categories.length).toBeGreaterThan(0);

    for (const category of payload.categories) {
      expect(hasBlockedCategory(category.name)).toBe(false);
    }

    for (const product of payload.products) {
      expect(product.price.current).toBeGreaterThan(0);
      expect(product.price.current).toBe(Number(product.price.current.toFixed(2)));
      expect(product.name).toBeTruthy();
      expect(product.image).toBeTruthy();
      expect(hasBlockedCategory(product.categories.at(-1)?.name ?? "")).toBe(false);
    }
  });
});
