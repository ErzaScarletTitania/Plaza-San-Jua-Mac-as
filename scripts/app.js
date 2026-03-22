import {
  buildProfileSummary,
  normalizeText,
  validateLoginInput,
  validateProfileInput,
  validateRegisterInput,
} from "./account-utils.js";
import { brand, heroSlides, menuGroups, socialAuth } from "./site-data.js";

const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

function rootPath() {
  const pathname = window.location.pathname;
  const levels = pathname.replace(/\/$/, "").split("/").filter(Boolean).length - 1;
  return levels > 0 ? "../".repeat(levels) : "./";
}

function pageName() {
  const parts = window.location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  return parts.at(-1) || "home";
}

function query(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function slugify(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function safeJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.message || "No se pudo completar la solicitud.");
  }

  return body;
}

async function loadCatalog() {
  const response = await fetch(`${rootPath()}data/catalog.json`);
  if (!response.ok) {
    throw new Error("No se pudo cargar el catálogo.");
  }
  return response.json();
}

async function loadCurrentUser() {
  try {
    return await safeJson(`${rootPath()}api/auth/me.php`);
  } catch {
    return { ok: false, user: null };
  }
}

function setBrand() {
  document.querySelectorAll("[data-brand]").forEach((node) => {
    node.textContent = brand.name;
  });
}

function renderMenu() {
  const container = document.querySelector("[data-menu-groups]");
  if (!container) {
    return;
  }

  container.innerHTML = menuGroups
    .map(
      (group) => `
        <article class="menu-group">
          <h3>${group.title}</h3>
          <ul>
            ${group.items.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

function renderHero() {
  const container = document.querySelector("[data-hero]");
  if (!container) {
    return;
  }

  container.innerHTML = heroSlides
    .map(
      (slide) => `
        <article class="hero-card">
          <p class="eyebrow">${slide.eyebrow}</p>
          <h2>${slide.title}</h2>
          <p>${slide.text}</p>
          <a class="button" href="${slide.href}">${slide.cta}</a>
        </article>
      `,
    )
    .join("");
}

function productCard(product) {
  const category = product.categories.at(-1)?.name ?? "General";
  return `
    <article class="product-card">
      <a href="${rootPath()}producto/?id=${product.id}" class="product-card__image">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
      </a>
      <div class="product-card__body">
        <p class="product-card__category">${category}</p>
        <h3>${product.name}</h3>
        <p class="product-card__brand">${product.brand}</p>
        <div class="price-block">
          <strong>${money.format(product.price.current)}</strong>
          ${
            product.price.compareAt
              ? `<span>${money.format(product.price.compareAt)}</span>`
              : ""
          }
        </div>
        <button class="button button--ghost" type="button" data-add-to-cart="${product.id}">
          Agregar
        </button>
      </div>
    </article>
  `;
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("plaza-cart") ?? "[]");
  } catch {
    return [];
  }
}

function setCart(items) {
  localStorage.setItem("plaza-cart", JSON.stringify(items));
  syncCartCount();
}

function addToCart(product) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price.current,
      quantity: 1,
    });
  }

  setCart(cart);
}

function syncCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(count);
  });
}

function wireAddToCart(products) {
  document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = products.find((item) => item.id === button.dataset.addToCart);
      if (product) {
        addToCart(product);
      }
    });
  });
}

function renderFeaturedProducts(catalog) {
  const container = document.querySelector("[data-featured-products]");
  if (!container) {
    return;
  }

  container.innerHTML = catalog.products.slice(0, 8).map(productCard).join("");
  wireAddToCart(catalog.products);
}

function renderCategoryHighlights(catalog) {
  const container = document.querySelector("[data-category-highlights]");
  if (!container) {
    return;
  }

  container.innerHTML = catalog.categories
    .slice(0, 8)
    .map(
      (category) => `
        <a class="highlight-card" href="${rootPath()}catalogo/?categoria=${category.slug}">
          <span>${category.name}</span>
          <strong>${category.productIds.length} productos</strong>
        </a>
      `,
    )
    .join("");
}

function renderCatalogPage(catalog) {
  const container = document.querySelector("[data-catalog-grid]");
  if (!container) {
    return;
  }

  const selectedCategory = query("categoria");
  const search = normalizeText(query("q")).toLowerCase();
  const filtered = catalog.products.filter((product) => {
    const categorySlug = slugify(product.categories.at(-1)?.name ?? "");
    const matchesCategory = selectedCategory ? categorySlug === selectedCategory : true;
    const haystack = `${product.name} ${product.brand} ${product.description}`.toLowerCase();
    const matchesSearch = search ? haystack.includes(search) : true;
    return matchesCategory && matchesSearch;
  });

  container.innerHTML = filtered.length
    ? filtered.map(productCard).join("")
    : '<article class="empty-card">No encontramos productos con ese filtro.</article>';
  wireAddToCart(catalog.products);

  const summary = document.querySelector("[data-catalog-summary]");
  if (summary) {
    summary.textContent = `${filtered.length} productos listos para compra manual.`;
  }
}

function renderProductPage(catalog) {
  const target = document.querySelector("[data-product-detail]");
  if (!target) {
    return;
  }

  const id = query("id");
  const product = catalog.products.find((item) => item.id === id) ?? catalog.products[0];
  if (!product) {
    return;
  }

  document.title = `${product.name} | ${brand.name}`;
  target.innerHTML = `
    <section class="product-detail__media">
      <img src="${product.image}" alt="${product.name}" />
      <div class="product-gallery">
        ${product.gallery
          .slice(0, 4)
          .map((image) => `<img src="${image}" alt="${product.name}" loading="lazy" />`)
          .join("")}
      </div>
    </section>
    <section class="product-detail__content">
      <p class="eyebrow">${product.categories.at(-1)?.name ?? "General"}</p>
      <h1>${product.name}</h1>
      <p class="product-card__brand">${product.brand}</p>
      <div class="price-block price-block--large">
        <strong>${money.format(product.price.current)}</strong>
        ${
          product.price.compareAt
            ? `<span>${money.format(product.price.compareAt)}</span>`
            : ""
        }
      </div>
      <p>${product.longDescription}</p>
      <div class="product-actions">
        <button class="button" type="button" data-add-to-cart="${product.id}">
          Agregar al carrito
        </button>
        <a class="button button--ghost" href="${rootPath()}checkout/">Ir al checkout</a>
      </div>
      <ul class="spec-list">
        ${product.specifications
          .slice(0, 6)
          .map((item) => `<li><strong>${item.name}:</strong> ${item.value}</li>`)
          .join("")}
      </ul>
    </section>
  `;

  wireAddToCart(catalog.products);
}

function checkoutItem(item) {
  return `
    <li class="checkout-item">
      <img src="${item.image}" alt="${item.name}" />
      <div>
        <strong>${item.name}</strong>
        <p>Cantidad: ${item.quantity}</p>
      </div>
      <span>${money.format(item.price * item.quantity)}</span>
    </li>
  `;
}

function fillIfEmpty(form, name, value) {
  const field = form.elements.namedItem(name);
  if (field && !field.value && value) {
    field.value = value;
  }
}

function prefillCheckout(form, user) {
  const profile = user?.profile ?? {};
  fillIfEmpty(form, "fullName", profile.fullName || user?.fullName || "");
  fillIfEmpty(form, "phone", profile.phone || "");
  fillIfEmpty(form, "district", profile.district || "");
  fillIfEmpty(form, "addressLine1", profile.addressLine1 || "");
  fillIfEmpty(form, "addressLine2", profile.addressLine2 || "");
  fillIfEmpty(form, "reference", profile.reference || "");
  fillIfEmpty(form, "email", user?.email || "");
}

function renderCheckout(user) {
  const container = document.querySelector("[data-checkout-items]");
  if (!container) {
    return;
  }

  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  container.innerHTML = cart.length
    ? cart.map(checkoutItem).join("")
    : '<li class="checkout-empty">Tu carrito está vacío.</li>';

  const totalNode = document.querySelector("[data-checkout-total]");
  if (totalNode) {
    totalNode.textContent = money.format(total);
  }

  const form = document.querySelector("[data-order-form]");
  if (!form) {
    return;
  }

  prefillCheckout(form, user);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      customer: {
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        district: formData.get("district"),
        addressLine1: formData.get("addressLine1"),
        addressLine2: formData.get("addressLine2"),
        reference: formData.get("reference"),
        paymentMethod: formData.get("paymentMethod"),
        notes: formData.get("notes"),
      },
      account: user
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
      items: cart,
      total: Number(total.toFixed(2)),
      createdAt: new Date().toISOString(),
    };

    const status = document.querySelector("[data-order-status]");
    const fallbackRecord = () => {
      const records = JSON.parse(localStorage.getItem("plaza-order-records") ?? "[]");
      records.push(payload);
      localStorage.setItem("plaza-order-records", JSON.stringify(records));
    };

    try {
      const response = await fetch(`${rootPath()}api/submit-order.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("No se pudo registrar el pedido.");
      }

      const body = await response.json();
      setCart([]);
      status.textContent = `Pedido ${body.orderId} registrado. Envía tu comprobante para completar la validación manual.`;
      form.reset();
      prefillCheckout(form, user);
    } catch {
      fallbackRecord();
      status.textContent =
        "No se pudo registrar en el servidor. El pedido quedó guardado localmente para no perder la información.";
    }
  });
}

function setPaymentDetails() {
  document.querySelectorAll("[data-yape-number]").forEach((node) => {
    node.textContent = brand.yape;
  });
  document.querySelectorAll("[data-bcp-account]").forEach((node) => {
    node.textContent = brand.bcp;
  });
  document.querySelectorAll("[data-paypal-email]").forEach((node) => {
    node.textContent = brand.email;
  });
  document.querySelectorAll("[data-binance-wallet]").forEach((node) => {
    node.textContent = brand.binance;
  });
}

function updateAccountLinks(user) {
  document.querySelectorAll("[data-account-link]").forEach((node) => {
    node.textContent = user ? "Mi perfil" : "Ingresar";
    node.setAttribute("href", user ? `${rootPath()}perfil/` : `${rootPath()}cuenta/`);
  });

  document.querySelectorAll("[data-session-chip]").forEach((node) => {
    node.textContent = user ? `Hola, ${user.profile?.fullName || user.fullName}` : "Mi cuenta";
  });
}

function wireLogoutButtons() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      await fetch(`${rootPath()}api/auth/logout.php`, { method: "POST" }).catch(() => null);
      window.location.href = `${rootPath()}cuenta/`;
    });
  });
}

function setFormStatus(selector, message, isError = false) {
  const node = document.querySelector(selector);
  if (!node) {
    return;
  }

  node.textContent = message;
  node.dataset.state = isError ? "error" : "ok";
}

function socialLoginMessage(provider) {
  if (provider === "google" && socialAuth.googleClientId) {
    return "Google está configurado para una siguiente etapa de activación.";
  }

  if (provider === "facebook" && socialAuth.facebookAppId) {
    return "Facebook está configurado para una siguiente etapa de activación.";
  }

  return `La integración con ${
    provider === "google" ? "Google" : "Facebook"
  } requiere credenciales de aplicación para activarse.`;
}

function renderAccountPage(user) {
  const loginForm = document.querySelector("[data-login-form]");
  const registerForm = document.querySelector("[data-register-form]");
  const statusSelector = "[data-auth-status]";

  if (!loginForm || !registerForm) {
    return;
  }

  if (user) {
    setFormStatus(statusSelector, "Tu sesión ya está activa. Puedes ir a tu perfil.");
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
    };
    const errors = validateLoginInput(payload);

    if (errors.length) {
      setFormStatus(statusSelector, errors[0], true);
      return;
    }

    try {
      await safeJson(`${rootPath()}api/auth/login.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      window.location.href = `${rootPath()}perfil/`;
    } catch (error) {
      setFormStatus(statusSelector, error.message, true);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const payload = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    };
    const errors = validateRegisterInput(payload);

    if (errors.length) {
      setFormStatus(statusSelector, errors[0], true);
      return;
    }

    try {
      await safeJson(`${rootPath()}api/auth/register.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setFormStatus(statusSelector, "Cuenta creada. Ya puedes completar tu perfil.");
      window.location.href = `${rootPath()}perfil/`;
    } catch (error) {
      setFormStatus(statusSelector, error.message, true);
    }
  });

  document.querySelectorAll("[data-social-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      setFormStatus(statusSelector, socialLoginMessage(button.dataset.socialProvider), true);
    });
  });
}

function renderProfilePage(user) {
  const form = document.querySelector("[data-profile-form]");
  if (!form) {
    return;
  }

  if (!user) {
    window.location.href = `${rootPath()}cuenta/`;
    return;
  }

  const profile = user.profile ?? {};
  fillIfEmpty(form, "fullName", profile.fullName || user.fullName || "");
  fillIfEmpty(form, "email", user.email || "");
  fillIfEmpty(form, "phone", profile.phone || "");
  fillIfEmpty(form, "district", profile.district || "");
  fillIfEmpty(form, "addressLine1", profile.addressLine1 || "");
  fillIfEmpty(form, "addressLine2", profile.addressLine2 || "");
  fillIfEmpty(form, "reference", profile.reference || "");

  const summary = document.querySelector("[data-profile-summary]");
  if (summary) {
    summary.textContent =
      buildProfileSummary({ ...profile, fullName: profile.fullName || user.fullName }) ||
      "Completa tu información para dejar lista la dirección de entrega.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = {
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      district: formData.get("district"),
      addressLine1: formData.get("addressLine1"),
      addressLine2: formData.get("addressLine2"),
      reference: formData.get("reference"),
    };
    const errors = validateProfileInput(payload);

    if (errors.length) {
      setFormStatus("[data-profile-status]", errors[0], true);
      return;
    }

    try {
      const response = await safeJson(`${rootPath()}api/profile/save.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setFormStatus("[data-profile-status]", "Perfil actualizado correctamente.");
      if (summary) {
        summary.textContent = buildProfileSummary(response.user.profile);
      }
      updateAccountLinks(response.user);
    } catch (error) {
      setFormStatus("[data-profile-status]", error.message, true);
    }
  });
}

async function init() {
  setBrand();
  renderMenu();
  renderHero();
  syncCartCount();
  setPaymentDetails();

  const auth = await loadCurrentUser();
  const currentUser = auth.user ?? null;
  updateAccountLinks(currentUser);
  wireLogoutButtons();
  renderAccountPage(currentUser);
  renderProfilePage(currentUser);
  renderCheckout(currentUser);

  const needsCatalog = [
    "[data-featured-products]",
    "[data-category-highlights]",
    "[data-catalog-grid]",
    "[data-product-detail]",
  ].some((selector) => document.querySelector(selector));

  if (!needsCatalog) {
    return;
  }

  const catalog = await loadCatalog();
  renderFeaturedProducts(catalog);
  renderCategoryHighlights(catalog);
  renderCatalogPage(catalog);
  renderProductPage(catalog);
}

init().catch((error) => {
  console.error(error);
  if (pageName() === "cuenta" || pageName() === "perfil") {
    setFormStatus("[data-auth-status]", error.message, true);
  }
});
