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

function productWhatsappHref(product) {
  const message = encodeURIComponent(
    `Hola, quiero confirmar la talla de ${repairText(product.name)} en Plaza San Juan Macias.`,
  );
  return `https://wa.me/${brand.whatsapp}?text=${message}`;
}

function orderWhatsappHref(orderId, customerName, paymentMethod = "") {
  const message = encodeURIComponent(
    `Hola, soy ${customerName || "cliente"}. Ya registré el pedido ${orderId} en Plaza San Juan Macias${paymentMethod ? ` con ${paymentMethod}` : ""} y quiero enviar el comprobante / dar seguimiento.`,
  );
  return `https://wa.me/${brand.whatsapp}?text=${message}`;
}

function paymentMethodGuidance(paymentMethod) {
  switch (repairText(paymentMethod)) {
    case "Yape":
      return "Paga con Yape y luego envia la captura o constancia por WhatsApp para validar tu pedido.";
    case "BCP":
      return "Haz la transferencia a BCP y comparte el comprobante por WhatsApp o en notas del pedido.";
    case "PayPal":
      return "Paga al correo de PayPal y luego envianos la confirmacion para validar el pedido.";
    case "Binance USDT BEP20":
      return "Transfiere al wallet BEP20 y comparte el hash o captura para validar el pago.";
    case "Tarjeta credito/debito":
      return "Despues de registrar el pedido te enviaremos un link de cobro seguro para pagar con tarjeta.";
    case "Google Pay":
      return "Despues de registrar el pedido te enviaremos un link de cobro compatible para completar con Google Pay.";
    default:
      return "Elige un metodo para ver como se coordina el pago y el comprobante.";
  }
}

function productCardMarkup(product) {
  const compare = product.price.compareAt
    ? `<span>${money.format(product.price.compareAt)}</span>`
    : "";
  const variantText = product.variantLabel || (product.requiresVariantSelection ? "Requiere talla" : "");
  const variantLabel = variantText
    ? `<p class="product-card__variant">${repairText(variantText)}</p>`
    : "";
  const variantOptions = Array.isArray(product.variantOptions) ? product.variantOptions : [];
  const hasVariantOptions = product.requiresVariantSelection && variantOptions.length > 0;
  const variantPicker = hasVariantOptions
    ? `
        <label class="variant-picker">
          <span>Selecciona talla</span>
          <select data-variant-select data-default-variant-type="${product.variantType ?? "size"}">
            <option value="">Elige una talla</option>
            ${variantOptions
              .map(
                (option) =>
                  `<option value="${option.id}" data-variant-label="${repairText(option.label)}">${repairText(option.label)}</option>`,
              )
              .join("")}
          </select>
        </label>
      `
    : product.requiresVariantSelection
      ? `<p class="product-card__helper">Coordina la talla por WhatsApp antes de agregar este producto.</p>`
      : "";
  const addButtonLabel = product.requiresVariantSelection
    ? hasVariantOptions
      ? "Agregar con talla"
      : "Talla por confirmar"
    : "Agregar";
  const addButtonDisabled = product.requiresVariantSelection && !hasVariantOptions ? "disabled" : "";
  const secondaryAction = product.requiresVariantSelection && !hasVariantOptions
    ? `<a class="button button--soft" href="${productWhatsappHref(product)}" target="_blank" rel="noreferrer">WhatsApp talla</a>`
    : `<a class="button button--soft" href="${sitePath("checkout/")}">Ir a pagar</a>`;

  return `
    <article class="product-card">
      <div class="product-card__image">
        <img src="${product.image}" alt="${repairText(product.name)}" loading="lazy" />
      </div>
      <div class="product-card__body">
        <p class="product-card__category">${repairText(product.categoryName)}</p>
        <h3>${repairText(product.name)}</h3>
        <p class="product-card__brand">${repairText(product.brand)}</p>
        ${variantLabel}
        <div class="price-block">
          <strong>${money.format(product.price.current)}</strong>
          ${compare}
        </div>
        ${variantPicker}
        <div class="product-card__actions">
          <button
            class="button button--ghost"
            type="button"
            data-add-to-cart
            data-product-id="${product.id}"
            data-product-name="${repairText(product.name)}"
            data-product-image="${product.image}"
            data-product-price="${product.price.current}"
            data-product-variant-id="${product.variantId ?? ""}"
            data-product-variant-label="${repairText(product.variantLabel ?? "")}"
            data-product-variant-type="${product.variantType ?? "default"}"
            data-product-requires-variant="${product.requiresVariantSelection ? "1" : "0"}"
            ${addButtonDisabled}
          >
            ${addButtonLabel}
          </button>
          ${secondaryAction}
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

function cartItemKey(product) {
  return [product.id, product.variantId || "default"].join("::");
}

function addToCart(product) {
  if (product.requiresVariantSelection && !product.variantLabel) {
    throw new Error("Selecciona o confirma la talla antes de agregar este producto.");
  }
  const cart = getCart();
  const key = cartItemKey(product);
  const existing = cart.find((item) => cartItemKey(item) === key);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      key,
      name: product.name,
      image: product.image,
      price: Number(product.price),
      variantId: product.variantId || "",
      variantLabel: product.variantLabel || "",
      variantType: product.variantType || "default",
      requiresVariantSelection: Boolean(product.requiresVariantSelection),
      quantity: 1,
    });
  }
  setCart(cart);
}

function updateCartItemQuantity(key, quantity) {
  const nextQuantity = Math.max(0, Number(quantity) || 0);
  const cart = getCart()
    .map((item) => ({ ...item, key: item.key || cartItemKey(item) }))
    .filter((item) => item.key !== key || nextQuantity > 0)
    .map((item) =>
      item.key === key
        ? {
            ...item,
            quantity: nextQuantity,
          }
        : item,
    );
  setCart(cart);
}

function removeCartItem(key) {
  const cart = getCart()
    .map((item) => ({ ...item, key: item.key || cartItemKey(item) }))
    .filter((item) => item.key !== key);
  setCart(cart);
}

function syncCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(count);
  });
}

function hydrateAddToCartButtons() {
  document.querySelectorAll(".product-card, .product-detail__content").forEach((card) => {
    const select = card.querySelector("[data-variant-select]");
    const button = card.querySelector("[data-add-to-cart]");
    if (!select || !button) {
      return;
    }

    button.disabled = !select.value;
    select.onchange = () => {
      const option = select.options[select.selectedIndex];
      button.dataset.productVariantId = select.value;
      button.dataset.productVariantLabel = option?.dataset.variantLabel || "";
      button.dataset.productVariantType = select.dataset.defaultVariantType || "size";
      button.disabled = !select.value;
    };
  });

  document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
    button.onclick = () => {
      if (button.dataset.adding === "1") {
        return;
      }
      button.dataset.adding = "1";
      button.disabled = true;
      try {
        addToCart({
          id: button.dataset.productId,
          name: button.dataset.productName,
          image: button.dataset.productImage,
          price: button.dataset.productPrice,
          variantId: button.dataset.productVariantId,
          variantLabel: button.dataset.productVariantLabel,
          variantType: button.dataset.productVariantType,
          requiresVariantSelection: button.dataset.productRequiresVariant === "1",
        });
      } catch (error) {
        setStatus("[data-order-status]", error.message, "error");
      }
      window.setTimeout(() => {
        button.dataset.adding = "0";
        const siblingSelect = button.closest(".product-card, .product-detail__content")?.querySelector("[data-variant-select]");
        button.disabled =
          button.dataset.productRequiresVariant === "1"
            ? Boolean(siblingSelect) && !siblingSelect.value
            : false;
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
  const resultsNoteNode = document.querySelector("[data-catalog-results-note]");
  const categoryFilterNode = document.querySelector("[data-catalog-category-filter]");
  const brandFilterNode = document.querySelector("[data-catalog-brand-filter]");
  const sortNode = document.querySelector("[data-catalog-sort]");
  const searchNode = document.querySelector("[data-catalog-search]");
  const selectedCategory = slugify(query("categoria") || "");
  const selectedBrand = repairText(query("marca") || "").toLowerCase();
  const selectedSort = repairText(query("orden") || "relevancia").toLowerCase();
  const search = repairText(query("q") || "").toLowerCase();

  if (categoriesNode) {
    categoriesNode.innerHTML = payload.categories.map(categoryCardMarkup).join("");
  }

  if (categoryFilterNode) {
    categoryFilterNode.innerHTML = [
      '<option value="">Todas</option>',
      ...payload.categories.map(
        (category) =>
          `<option value="${category.slug}" ${category.slug === selectedCategory ? "selected" : ""}>${repairText(category.name)}</option>`,
      ),
    ].join("");
  }

  if (searchNode) {
    searchNode.value = repairText(query("q") || "");
  }

  const filtered = payload.products.filter((product) => {
    const matchesCategory = selectedCategory ? product.categorySlug === selectedCategory : true;
    const matchesBrand = selectedBrand ? repairText(product.brand).toLowerCase() === selectedBrand : true;
    const haystack = `${product.name} ${product.brand} ${product.categoryName}`.toLowerCase();
    const matchesSearch = search ? haystack.includes(search) : true;
    return matchesCategory && matchesBrand && matchesSearch;
  });

  const visibleBrands = Array.from(
    new Set(
      filtered
        .map((product) => repairText(product.brand))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "es")),
    ),
  );

  if (brandFilterNode) {
    brandFilterNode.innerHTML = [
      '<option value="">Todas</option>',
      ...visibleBrands.map(
        (brandName) =>
          `<option value="${brandName}" ${brandName.toLowerCase() === selectedBrand ? "selected" : ""}>${brandName}</option>`,
      ),
    ].join("");
  }

  if (sortNode) {
    sortNode.value = selectedSort;
  }

  const sorted = [...filtered];
  if (selectedSort === "precio-asc") {
    sorted.sort((left, right) => left.price.current - right.price.current);
  } else if (selectedSort === "precio-desc") {
    sorted.sort((left, right) => right.price.current - left.price.current);
  } else if (selectedSort === "nombre-asc") {
    sorted.sort((left, right) => left.name.localeCompare(right.name, "es"));
  }

  const visible =
    !selectedCategory && !selectedBrand && !search ? sorted.slice(0, 120) : sorted;

  grid.innerHTML = visible.length
    ? visible.map(productCardMarkup).join("")
    : '<article class="empty-card">No encontramos productos con ese filtro. Prueba otra categoría, causa.</article>';

  if (summaryNode) {
    summaryNode.textContent =
      !selectedCategory && !selectedBrand && !search
        ? `Mostrando ${visible.length} de ${payload.products.length} productos. Entra por categoría para navegar más rápido en ${brand.serviceArea}.`
        : `${filtered.length} productos listos para delivery en ${brand.serviceArea}.`;
  }

  if (resultsNoteNode) {
    const activeFilters = [
      selectedCategory ? `categoría ${selectedCategory.replaceAll("-", " ")}` : "",
      selectedBrand ? `marca ${selectedBrand}` : "",
      search ? `búsqueda "${search}"` : "",
    ].filter(Boolean);

    resultsNoteNode.textContent = activeFilters.length
      ? `Filtros activos: ${activeFilters.join(", ")}. Orden actual: ${selectedSort.replace("-", " ")}.`
      : "Ajusta el filtro y te dejamos solo lo que sí calza con tu compra.";
  }

  hydrateAddToCartButtons();
}

function checkoutItem(item) {
  const variantText = item.variantLabel || (item.requiresVariantSelection ? "Talla pendiente" : "");
  const variantBlock = variantText
    ? `<p class="checkout-item__variant">${variantText}</p>`
    : "";
  return `
    <li class="checkout-item" data-cart-item-key="${item.key || cartItemKey(item)}">
      <img src="${item.image}" alt="${item.name}" />
      <div>
        <strong>${item.name}</strong>
        ${variantBlock}
        <div class="quantity-controls">
          <button type="button" class="quantity-button" data-decrease-qty data-cart-item-key="${item.key || cartItemKey(item)}">-</button>
          <span>Cantidad: ${item.quantity}</span>
          <button type="button" class="quantity-button" data-increase-qty data-cart-item-key="${item.key || cartItemKey(item)}">+</button>
          <button type="button" class="button button--ghost button--compact" data-remove-item data-cart-item-key="${item.key || cartItemKey(item)}">Quitar</button>
        </div>
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
  const pendingVariantItems = cart.filter(
    (item) => item.requiresVariantSelection && !repairText(item.variantLabel || ""),
  );

  container.innerHTML = cart.length
    ? cart.map(checkoutItem).join("")
    : '<li class="checkout-empty">Tu carrito está vacío. Llénalo primero y luego cae a pagar.</li>';

  container.querySelectorAll("[data-decrease-qty]").forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.cartItemKey;
      const item = getCart().find((entry) => (entry.key || cartItemKey(entry)) === key);
      if (!item) {
        return;
      }
      updateCartItemQuantity(key, item.quantity - 1);
      renderCheckout(user);
    };
  });

  container.querySelectorAll("[data-increase-qty]").forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.cartItemKey;
      const item = getCart().find((entry) => (entry.key || cartItemKey(entry)) === key);
      if (!item) {
        return;
      }
      updateCartItemQuantity(key, item.quantity + 1);
      renderCheckout(user);
    };
  });

  container.querySelectorAll("[data-remove-item]").forEach((button) => {
    button.onclick = () => {
      removeCartItem(button.dataset.cartItemKey);
      renderCheckout(user);
    };
  });

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
    minimumNode.textContent = pendingVariantItems.length
      ? `Antes de cerrar, define la talla de ${pendingVariantItems.length} producto(s) de vestuario o coordínala por WhatsApp.`
      : minimumReached
        ? `Pedido mínimo alcanzado: ${money.format(subtotal)} en productos.`
        : `Te faltan ${money.format(brand.minimumOrderPen - subtotal)} para llegar al mínimo de ${money.format(brand.minimumOrderPen)}.`;
    minimumNode.dataset.state = pendingVariantItems.length ? "error" : minimumReached ? "ok" : "error";
  }

  const variantWarningNode = document.querySelector("[data-checkout-variant-warning]");
  if (variantWarningNode) {
    if (pendingVariantItems.length) {
      const links = pendingVariantItems
        .map(
          (item) =>
            `<a href="${productWhatsappHref(item)}" target="_blank" rel="noreferrer">${repairText(item.name)}</a>`,
        )
        .join(", ");
      variantWarningNode.innerHTML = `Tienes productos con talla pendiente: ${links}. Confirma la talla antes de registrar el pedido.`;
      variantWarningNode.hidden = false;
    } else {
      variantWarningNode.innerHTML = "";
      variantWarningNode.hidden = true;
    }
  }

  const form = document.querySelector("[data-order-form]");
  if (!form) {
    return;
  }
  const whatsappLink = document.querySelector("[data-order-whatsapp]");
  const paymentMethodField = form.elements.namedItem("paymentMethod");
  const paymentGuidanceNode = document.querySelector("[data-payment-guidance]");

  prefillCheckout(form, user);
  if (paymentGuidanceNode && paymentMethodField) {
    paymentGuidanceNode.textContent = paymentMethodGuidance(paymentMethodField.value);
    paymentMethodField.onchange = () => {
      paymentGuidanceNode.textContent = paymentMethodGuidance(paymentMethodField.value);
    };
  }
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = !minimumReached || !cart.length || pendingVariantItems.length > 0;
  }

  form.onsubmit = async (event) => {
    event.preventDefault();

    if (pendingVariantItems.length) {
      setStatus(
        "[data-order-status]",
        "No puedes cerrar el pedido mientras haya productos con talla pendiente.",
        "error",
      );
      if (whatsappLink) {
        whatsappLink.hidden = true;
      }
      return;
    }

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
      if (whatsappLink) {
        whatsappLink.href = orderWhatsappHref(
          result.orderId,
          String(payload.customer.fullName || ""),
          String(payload.customer.paymentMethod || ""),
        );
        whatsappLink.hidden = false;
      }
      renderCheckout(user);
    } catch (error) {
      setStatus("[data-order-status]", error.message, "error");
      if (whatsappLink) {
        whatsappLink.hidden = true;
      }
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
              <p class="muted">${order.statusLabel} | ${order.paymentMethod}</p>
            </div>
            <div class="order-card__actions">
              <a
                class="button button--ghost button--compact"
                href="${orderWhatsappHref(order.orderId, order.customerName || 'cliente', order.paymentMethod || '')}"
                target="_blank"
                rel="noreferrer"
              >
                Seguimiento por WhatsApp
              </a>
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

export { renderOrderHistory };
