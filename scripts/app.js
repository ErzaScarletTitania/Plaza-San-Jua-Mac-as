import {
  buildProfileSummary,
  validateLoginInput,
  validateProfileInput,
  validateRegisterInput,
} from "./account-utils.js";
import { brand, heroSlides, menuGroups, socialAuth } from "./site-data.js";
import { repairText, slugify } from "./storefront-utils.js";

const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: brand.currency,
  minimumFractionDigits: 2,
});

function rootPath() {
  return document.documentElement.dataset.rootPrefix || "./";
}

function sitePath(value) {
  const raw = String(value ?? "");
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw)) {
    return raw;
  }
  return `${rootPath()}${raw.replace(/^(\.\/|\/)+/, "")}`;
}

async function safeJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || "No se pudo completar la solicitud.");
  }
  return body;
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${url}.`);
  }
  return response.json();
}

function query(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function setBrand() {
  document.querySelectorAll("[data-brand]").forEach((node) => {
    node.textContent = brand.name;
  });
  document.querySelectorAll("[data-min-order]").forEach((node) => {
    node.textContent = money.format(brand.minimumOrderPen);
  });
  document.querySelectorAll("[data-service-area]").forEach((node) => {
    node.textContent = brand.serviceArea;
  });
  document.querySelectorAll("[data-whatsapp-number]").forEach((node) => {
    node.textContent = brand.whatsapp;
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
          <p class="eyebrow">${group.title}</p>
          <ul>
            ${group.items
              .map((item) => `<li><a href="${sitePath(item.href)}">${item.label}</a></li>`)
              .join("")}
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
          <div class="hero-card__content">
            <p class="eyebrow">${slide.eyebrow}</p>
            <h2>${slide.title}</h2>
            <p>${slide.text}</p>
            <a class="button" href="${sitePath(slide.href)}">${slide.cta}</a>
          </div>
          <img class="hero-card__art" src="${sitePath(slide.image)}" alt="${slide.title}" />
        </article>
      `,
    )
    .join("");
}

function categoryCardMarkup(category) {
  return `
    <a class="category-card" href="${sitePath(`categorias/${category.slug}/`)}">
      <span>${repairText(category.name)}</span>
      <strong>${category.productCount ?? category.productIds?.length ?? 0} productos</strong>
    </a>
  `;
}

function productCardMarkup(product) {
  const compare = product.price.compareAt
    ? `<span>${money.format(product.price.compareAt)}</span>`
    : "";
  return `
    <article class="product-card">
      <div class="product-card__image">
        <img src="${product.image}" alt="${repairText(product.name)}" loading="lazy" />
      </div>
      <div class="product-card__body">
        <p class="product-card__category">${repairText(product.categoryName)}</p>
        <h3>${repairText(product.name)}</h3>
        <p class="product-card__brand">${repairText(product.brand)}</p>
        <div class="price-block">
          <strong>${money.format(product.price.current)}</strong>
          ${compare}
        </div>
        <div class="product-card__actions">
          <button
            class="button button--ghost"
            type="button"
            data-add-to-cart
            data-product-id="${product.id}"
            data-product-name="${repairText(product.name)}"
            data-product-image="${product.image}"
            data-product-price="${product.price.current}"
          >
            Agregar
          </button>
          <a class="button button--soft" href="${sitePath("checkout/")}">Ir a pagar</a>
        </div>
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
      price: Number(product.price),
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

function hydrateAddToCartButtons() {
  document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
    button.onclick = () => {
      if (button.dataset.adding === "1") {
        return;
      }
      button.dataset.adding = "1";
      button.disabled = true;
      addToCart({
        id: button.dataset.productId,
        name: button.dataset.productName,
        image: button.dataset.productImage,
        price: button.dataset.productPrice,
      });
      window.setTimeout(() => {
        button.dataset.adding = "0";
        button.disabled = false;
      }, 400);
    };
  });
}

async function loadCurrentUser() {
  try {
    return await safeJson(sitePath("api/auth/me.php"));
  } catch {
    return { ok: false, user: null };
  }
}

async function loadCurrentAdmin() {
  try {
    return await safeJson(sitePath("api/admin/me.php"));
  } catch {
    return { ok: false, admin: null };
  }
}

function updateAccountLinks(user) {
  document.querySelectorAll("[data-account-link]").forEach((node) => {
    node.setAttribute("href", user ? sitePath("perfil/") : sitePath("cuenta/"));
  });

  document.querySelectorAll("[data-session-chip]").forEach((node) => {
    node.textContent = user ? `Hola, ${user.profile?.fullName || user.fullName}` : "Mi cuenta";
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

function setStatus(selector, message, state = "ok") {
  const node = document.querySelector(selector);
  if (!node) {
    return;
  }
  node.textContent = message;
  node.dataset.state = state;
}

async function renderHomePage() {
  const categoriesNode = document.querySelector("[data-home-categories]");
  const productsNode = document.querySelector("[data-home-featured-products]");
  if (!categoriesNode && !productsNode) {
    return;
  }

  const payload = await loadJson(sitePath("data/homepage.json"));

  if (categoriesNode) {
    categoriesNode.innerHTML = payload.categories.map(categoryCardMarkup).join("");
  }

  if (productsNode) {
    productsNode.innerHTML = payload.featuredProducts.map(productCardMarkup).join("");
  }

  hydrateAddToCartButtons();
}

async function renderCatalogPage() {
  const grid = document.querySelector("[data-catalog-grid]");
  if (!grid) {
    return;
  }

  const payload = await loadJson(sitePath("data/catalog-summary.json"));
  const categoriesNode = document.querySelector("[data-catalog-categories]");
  const summaryNode = document.querySelector("[data-catalog-summary]");
  const selectedCategory = slugify(query("categoria") || "");
  const search = repairText(query("q") || "").toLowerCase();

  if (categoriesNode) {
    categoriesNode.innerHTML = payload.categories.map(categoryCardMarkup).join("");
  }

  const filtered = payload.products.filter((product) => {
    const matchesCategory = selectedCategory ? product.categorySlug === selectedCategory : true;
    const haystack = `${product.name} ${product.brand} ${product.categoryName}`.toLowerCase();
    const matchesSearch = search ? haystack.includes(search) : true;
    return matchesCategory && matchesSearch;
  });

  const visible =
    !selectedCategory && !search ? filtered.slice(0, 120) : filtered;

  grid.innerHTML = visible.length
    ? visible.map(productCardMarkup).join("")
    : '<article class="empty-card">No encontramos productos con ese filtro. Prueba otra categoría, causa.</article>';

  if (summaryNode) {
    summaryNode.textContent =
      !selectedCategory && !search
        ? `Mostrando ${visible.length} de ${payload.products.length} productos. Entra por categoría para navegar más rápido en ${brand.serviceArea}.`
        : `${filtered.length} productos listos para delivery en ${brand.serviceArea}.`;
  }

  hydrateAddToCartButtons();
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
  fillIfEmpty(form, "email", user?.email || "");
  fillIfEmpty(form, "phone", profile.phone || "");
  fillIfEmpty(form, "district", profile.district || "");
  fillIfEmpty(form, "addressLine1", profile.addressLine1 || "");
  fillIfEmpty(form, "addressLine2", profile.addressLine2 || "");
  fillIfEmpty(form, "reference", profile.reference || "");
}

function renderCheckout(user) {
  const container = document.querySelector("[data-checkout-items]");
  if (!container) {
    return;
  }

  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length ? brand.deliveryFeePen : 0;
  const total = subtotal + deliveryFee;
  const minimumReached = subtotal >= brand.minimumOrderPen;

  container.innerHTML = cart.length
    ? cart.map(checkoutItem).join("")
    : '<li class="checkout-empty">Tu carrito está vacío. Llénalo primero y luego cae a pagar.</li>';

  const totalNode = document.querySelector("[data-checkout-total]");
  if (totalNode) {
    totalNode.textContent = money.format(total);
  }

  const subtotalNode = document.querySelector("[data-checkout-subtotal]");
  if (subtotalNode) {
    subtotalNode.textContent = money.format(subtotal);
  }

  const deliveryNode = document.querySelector("[data-checkout-delivery]");
  if (deliveryNode) {
    deliveryNode.textContent = money.format(deliveryFee);
  }

  const minimumNode = document.querySelector("[data-checkout-minimum]");
  if (minimumNode) {
    minimumNode.textContent = minimumReached
      ? `Pedido mínimo alcanzado: ${money.format(subtotal)} en productos.`
      : `Te faltan ${money.format(brand.minimumOrderPen - subtotal)} para llegar al mínimo de ${money.format(brand.minimumOrderPen)}.`;
    minimumNode.dataset.state = minimumReached ? "ok" : "error";
  }

  const form = document.querySelector("[data-order-form]");
  if (!form) {
    return;
  }

  prefillCheckout(form, user);
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = !minimumReached || !cart.length;
  }

  form.onsubmit = async (event) => {
    event.preventDefault();

    if (!minimumReached) {
      setStatus(
        "[data-order-status]",
        `El pedido mínimo para delivery es ${money.format(brand.minimumOrderPen)}.`,
        "error",
      );
      return;
    }

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
      subtotal: Number(subtotal.toFixed(2)),
      deliveryFee: Number(deliveryFee.toFixed(2)),
      total: Number(total.toFixed(2)),
      currency: brand.currency,
      minimumOrder: brand.minimumOrderPen,
      createdAt: new Date().toISOString(),
    };

    try {
      const result = await safeJson(sitePath("api/submit-order.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCart([]);
      form.reset();
      prefillCheckout(form, user);
      setStatus(
        "[data-order-status]",
        `Pedido ${result.orderId} registrado. Ahora envía el comprobante y nosotros seguimos la jugada.`,
      );
      renderCheckout(user);
    } catch (error) {
      setStatus("[data-order-status]", error.message, "error");
    }
  };
}

function wireLogoutButtons() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.onclick = async () => {
      await fetch(sitePath("api/auth/logout.php"), { method: "POST" }).catch(() => null);
      window.location.href = sitePath("cuenta/");
    };
  });
}

function renderAdminList(container, items, emptyMessage, renderItem) {
  if (!container) {
    return;
  }

  if (!items.length) {
    container.innerHTML = `<li class="checkout-empty">${emptyMessage}</li>`;
    return;
  }

  container.innerHTML = items.map(renderItem).join("");
}

async function renderAdminDashboard() {
  const [ordersPayload, usersPayload] = await Promise.all([
    safeJson(sitePath("api/admin/orders.php")),
    safeJson(sitePath("api/admin/users.php")),
  ]);

  const orderCountNode = document.querySelector("[data-admin-order-count]");
  const revenueNode = document.querySelector("[data-admin-revenue]");
  const userCountNode = document.querySelector("[data-admin-user-count]");
  const ordersList = document.querySelector("[data-admin-orders-list]");
  const usersList = document.querySelector("[data-admin-users-list]");

  if (orderCountNode) {
    orderCountNode.textContent = String(ordersPayload.summary.orderCount ?? 0);
  }
  if (revenueNode) {
    revenueNode.textContent = money.format(Number(ordersPayload.summary.revenuePen ?? 0));
  }
  if (userCountNode) {
    userCountNode.textContent = String(usersPayload.summary.userCount ?? 0);
  }

  renderAdminList(
    ordersList,
    ordersPayload.orders ?? [],
    "Todavia no hay pedidos para mostrar.",
    (order) => `
      <li>
        <div>
          <strong>${order.orderId}</strong>
          <p class="muted">${order.customerName || "Cliente sin nombre"} | ${order.district || "Distrito pendiente"}</p>
        </div>
        <div>
          <strong>${money.format(order.total)}</strong>
          <p class="muted">${order.statusLabel} | ${order.paymentMethod}</p>
        </div>
      </li>
    `,
  );

  renderAdminList(
    usersList,
    usersPayload.users ?? [],
    "Todavia no hay clientes para mostrar.",
    (user) => `
      <li>
        <div>
          <strong>${user.fullName || "Cliente sin nombre"}</strong>
          <p class="muted">${user.email}</p>
        </div>
        <div>
          <strong>${user.district || "Sin distrito"}</strong>
          <p class="muted">${user.createdAt ? new Date(user.createdAt).toLocaleDateString("es-PE") : ""}</p>
        </div>
      </li>
    `,
  );
}

function renderAdminPage(admin) {
  const loginPanel = document.querySelector("[data-admin-login-panel]");
  const loginForm = document.querySelector("[data-admin-login-form]");
  const dashboard = document.querySelector("[data-admin-dashboard]");
  const statusNode = document.querySelector("[data-admin-status]");
  const headingNode = document.querySelector("[data-admin-heading]");
  const subheadingNode = document.querySelector("[data-admin-subheading]");

  if (!loginPanel && !dashboard) {
    return;
  }

  document.querySelectorAll("[data-admin-logout]").forEach((button) => {
    button.onclick = async () => {
      await fetch(sitePath("api/admin/logout.php"), { method: "POST" }).catch(() => null);
      window.location.reload();
    };
  });

  if (loginForm) {
    loginForm.onsubmit = async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);

      try {
        await safeJson(sitePath("api/admin/login.php"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.get("email"),
            password: formData.get("password"),
          }),
        });
        window.location.reload();
      } catch (error) {
        if (statusNode) {
          statusNode.textContent = error.message;
        }
      }
    };
  }

  if (!admin) {
    if (loginPanel) {
      loginPanel.hidden = false;
    }
    if (dashboard) {
      dashboard.hidden = true;
    }
    return;
  }

  if (statusNode) {
    statusNode.textContent = "";
  }
  if (loginPanel) {
    loginPanel.hidden = true;
  }
  if (dashboard) {
    dashboard.hidden = false;
  }
  if (headingNode) {
    headingNode.textContent = `Panel de ${admin.fullName}`;
  }
  if (subheadingNode) {
    subheadingNode.textContent = `${admin.email} | rol ${admin.role || "owner"}`;
  }

  renderAdminDashboard().catch((error) => {
    if (statusNode) {
      statusNode.textContent = error.message;
    }
  });
}

function socialLoginMessage(provider) {
  if (provider === "google" && socialAuth.googleClientId) {
    return "Google está listo para activarse en la siguiente etapa.";
  }
  if (provider === "facebook" && socialAuth.facebookAppId) {
    return "Facebook está listo para activarse en la siguiente etapa.";
  }
  return `La integración con ${provider === "google" ? "Google" : "Facebook"} necesita credenciales reales antes de encenderse.`;
}

function renderAccountPage(user) {
  const loginForm = document.querySelector("[data-login-form]");
  const registerForm = document.querySelector("[data-register-form]");
  if (!loginForm || !registerForm) {
    return;
  }

  if (user) {
    setStatus("[data-auth-status]", "Tu sesión ya está activa. Puedes ir directo a tu perfil.");
  }

  loginForm.onsubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    const errors = validateLoginInput(payload);
    if (errors.length) {
      setStatus("[data-auth-status]", errors[0], "error");
      return;
    }

    try {
      await safeJson(sitePath("api/auth/login.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      window.location.href = sitePath("perfil/");
    } catch (error) {
      setStatus("[data-auth-status]", error.message, "error");
    }
  };

  registerForm.onsubmit = async (event) => {
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
      setStatus("[data-auth-status]", errors[0], "error");
      return;
    }

    try {
      await safeJson(sitePath("api/auth/register.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      window.location.href = sitePath("perfil/");
    } catch (error) {
      setStatus("[data-auth-status]", error.message, "error");
    }
  };

  document.querySelectorAll("[data-social-provider]").forEach((button) => {
    button.onclick = () => {
      setStatus("[data-auth-status]", socialLoginMessage(button.dataset.socialProvider), "error");
    };
  });
}

async function renderOrderHistory() {
  const container = document.querySelector("[data-orders-list]");
  if (!container) {
    return;
  }

  try {
    const payload = await safeJson(sitePath("api/orders/list.php"));
    if (!payload.orders.length) {
      container.innerHTML = '<li class="checkout-empty">Todavía no tienes pedidos guardados.</li>';
      return;
    }

    container.innerHTML = payload.orders
      .map(
        (order) => `
          <li class="order-card">
            <div>
              <strong>${order.orderId}</strong>
              <p class="muted">${new Date(order.savedAt).toLocaleString("es-PE")}</p>
            </div>
            <div>
              <strong>${money.format(order.total)}</strong>
              <p class="muted">${order.statusLabel}</p>
            </div>
          </li>
        `,
      )
      .join("");
  } catch {
    container.innerHTML =
      '<li class="checkout-empty">No pudimos cargar tus pedidos en este momento.</li>';
  }
}

function renderProfilePage(user) {
  const form = document.querySelector("[data-profile-form]");
  if (!form) {
    return;
  }

  if (!user) {
    window.location.href = sitePath("cuenta/");
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
      "Completa tu dirección para dejar el delivery listo.";
  }

  form.onsubmit = async (event) => {
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
      setStatus("[data-profile-status]", errors[0], "error");
      return;
    }

    try {
      const response = await safeJson(sitePath("api/profile/save.php"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (summary) {
        summary.textContent = buildProfileSummary(response.user.profile);
      }
      setStatus("[data-profile-status]", "Perfil actualizado. Ahora tu delivery sale más rápido.");
      updateAccountLinks(response.user);
    } catch (error) {
      setStatus("[data-profile-status]", error.message, "error");
    }
  };

  renderOrderHistory();
}

async function init() {
  setBrand();
  renderMenu();
  renderHero();
  syncCartCount();
  setPaymentDetails();

  const [auth, adminAuth] = await Promise.all([loadCurrentUser(), loadCurrentAdmin()]);
  const currentUser = auth.user ?? null;
  const currentAdmin = adminAuth.admin ?? null;
  updateAccountLinks(currentUser);
  wireLogoutButtons();

  await Promise.all([renderHomePage(), renderCatalogPage()]);
  renderCheckout(currentUser);
  renderAccountPage(currentUser);
  renderProfilePage(currentUser);
  renderAdminPage(currentAdmin);
  hydrateAddToCartButtons();
}

init().catch((error) => {
  console.error(error);
});
