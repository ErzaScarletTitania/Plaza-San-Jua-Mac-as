export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function slugify(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function repairText(value) {
  if (typeof value !== "string") {
    return value;
  }

  const raw = value.trim();
  if (!raw) {
    return raw;
  }

  if (!/[ÃÂâð]/.test(raw)) {
    return raw;
  }

  try {
    const repaired =
      typeof Buffer !== "undefined"
        ? Buffer.from(raw, "latin1").toString("utf8")
        : new TextDecoder().decode(Uint8Array.from([...raw].map((char) => char.charCodeAt(0))));
    return repaired.includes("\uFFFD") ? raw : repaired;
  } catch {
    return raw;
  }
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function cartDataset(product) {
  return {
    productId: String(product.id),
    productName: String(product.name),
    productImage: String(product.image),
    productPrice: String(product.price.current),
  };
}
