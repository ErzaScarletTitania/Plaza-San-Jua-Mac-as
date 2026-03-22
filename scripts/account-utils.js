export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

export function validateRegisterInput(payload) {
  const fullName = normalizeText(payload.fullName);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");
  const confirmPassword = String(payload.confirmPassword ?? "");
  const errors = [];

  if (fullName.length < 3) {
    errors.push("Ingresa un nombre válido.");
  }

  if (!email.includes("@") || email.length < 6) {
    errors.push("Ingresa un correo válido.");
  }

  if (password.length < 8) {
    errors.push("La contraseña debe tener al menos 8 caracteres.");
  }

  if (password !== confirmPassword) {
    errors.push("Las contraseñas no coinciden.");
  }

  return errors;
}

export function validateLoginInput(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");
  const errors = [];

  if (!email.includes("@")) {
    errors.push("Ingresa el correo de tu cuenta.");
  }

  if (!password) {
    errors.push("Ingresa tu contraseña.");
  }

  return errors;
}

export function validateProfileInput(payload) {
  const fullName = normalizeText(payload.fullName);
  const district = normalizeText(payload.district);
  const addressLine1 = normalizeText(payload.addressLine1);
  const phone = normalizeText(payload.phone);
  const errors = [];

  if (fullName.length < 3) {
    errors.push("Completa tu nombre.");
  }

  if (phone.length < 6) {
    errors.push("Completa un teléfono de contacto.");
  }

  if (district.length < 2) {
    errors.push("Completa el distrito.");
  }

  if (addressLine1.length < 6) {
    errors.push("Completa la dirección principal.");
  }

  return errors;
}

export function buildProfileSummary(profile) {
  const lines = [
    normalizeText(profile.fullName),
    normalizeText(profile.addressLine1),
    normalizeText(profile.addressLine2),
    normalizeText(profile.district),
    normalizeText(profile.reference),
  ].filter(Boolean);

  return lines.join(", ");
}
