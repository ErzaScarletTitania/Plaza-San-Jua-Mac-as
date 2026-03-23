import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "database", "mysql");
const outputFile = path.join(outputDir, "import-from-json.sql");

function sqlQuote(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  const text = String(value).replace(/\\/g, "\\\\").replace(/'/g, "''");
  return `'${text}'`;
}

function sqlNumber(value, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : Number(fallback).toFixed(2);
}

function sqlBool(value) {
  return value ? "1" : "0";
}

function toSqlDate(value) {
  if (!value) {
    return sqlQuote("1970-01-01 00:00:00");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return sqlQuote("1970-01-01 00:00:00");
  }

  const iso = date.toISOString().slice(0, 19).replace("T", " ");
  return sqlQuote(iso);
}

async function readJson(relativePath, fallback) {
  try {
    const raw = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function readOrderFiles() {
  const dir = path.join(repoRoot, "storage", "orders");
  try {
    const entries = await fs.readdir(dir);
    const orders = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }

      const raw = await fs.readFile(path.join(dir, entry), "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        orders.push(parsed);
      }
    }

    return orders;
  } catch {
    return [];
  }
}

function userStatements(users) {
  const statements = [];

  for (const user of users) {
    statements.push(`INSERT INTO users (
  id, email, full_name, password_hash, social_google_enabled, social_facebook_enabled, created_at, updated_at
) VALUES (
  ${sqlQuote(user.id)},
  ${sqlQuote(user.email)},
  ${sqlQuote(user.fullName)},
  ${sqlQuote(user.passwordHash ?? null)},
  ${sqlBool(user.social?.googleEnabled)},
  ${sqlBool(user.social?.facebookEnabled)},
  ${toSqlDate(user.createdAt)},
  ${toSqlDate(user.updatedAt ?? user.createdAt)}
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  social_google_enabled = VALUES(social_google_enabled),
  social_facebook_enabled = VALUES(social_facebook_enabled),
  updated_at = VALUES(updated_at);`);

    if (user.profile?.addressLine1) {
      statements.push(`INSERT INTO user_addresses (
  user_id, label, phone, district, address_line1, address_line2, reference_text, is_default, created_at, updated_at
) VALUES (
  ${sqlQuote(user.id)},
  'Principal',
  ${sqlQuote(user.profile?.phone ?? null)},
  ${sqlQuote(user.profile?.district ?? null)},
  ${sqlQuote(user.profile?.addressLine1 ?? null)},
  ${sqlQuote(user.profile?.addressLine2 ?? null)},
  ${sqlQuote(user.profile?.reference ?? null)},
  1,
  ${toSqlDate(user.createdAt)},
  ${toSqlDate(user.updatedAt ?? user.createdAt)}
);`);
    }
  }

  return statements;
}

function adminStatements(admins) {
  return admins.map(
    (admin) => `INSERT INTO admins (
  id, email, full_name, password_hash, role, created_at, updated_at
) VALUES (
  ${sqlQuote(admin.id)},
  ${sqlQuote(admin.email)},
  ${sqlQuote(admin.fullName)},
  ${sqlQuote(admin.passwordHash)},
  ${sqlQuote(admin.role ?? "owner")},
  ${toSqlDate(admin.createdAt)},
  ${toSqlDate(admin.updatedAt ?? admin.createdAt)}
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  updated_at = VALUES(updated_at);`,
  );
}

function orderStatements(orders) {
  const statements = [];

  for (const order of orders) {
    const orderSql = `INSERT INTO orders (
  public_order_id, user_id, account_email, customer_name, customer_email, customer_phone, district,
  address_line1, address_line2, reference_text, payment_method, notes, status_code, status_label,
  currency, minimum_order, total, created_at, saved_at
) VALUES (
  ${sqlQuote(order.orderId)},
  ${sqlQuote(order.account?.id ?? null)},
  ${sqlQuote(order.account?.email ?? null)},
  ${sqlQuote(order.customer?.fullName ?? null)},
  ${sqlQuote(order.customer?.email ?? null)},
  ${sqlQuote(order.customer?.phone ?? null)},
  ${sqlQuote(order.customer?.district ?? null)},
  ${sqlQuote(order.customer?.addressLine1 ?? null)},
  ${sqlQuote(order.customer?.addressLine2 ?? null)},
  ${sqlQuote(order.customer?.reference ?? null)},
  ${sqlQuote(order.customer?.paymentMethod ?? null)},
  ${sqlQuote(order.customer?.notes ?? null)},
  ${sqlQuote(order.status ?? "pending_payment_review")},
  ${sqlQuote(order.statusLabel ?? "Pendiente de validacion de pago")},
  ${sqlQuote(order.currency ?? "PEN")},
  ${sqlNumber(order.minimumOrder, 50)},
  ${sqlNumber(order.total, 0)},
  ${toSqlDate(order.createdAt ?? order.savedAt)},
  ${toSqlDate(order.savedAt ?? order.createdAt)}
)
ON DUPLICATE KEY UPDATE
  status_code = VALUES(status_code),
  status_label = VALUES(status_label),
  total = VALUES(total),
  notes = VALUES(notes),
  payment_method = VALUES(payment_method),
  saved_at = VALUES(saved_at);`;

    statements.push(orderSql);

    for (const item of order.items ?? []) {
      statements.push(`INSERT INTO order_items (
  order_id, product_id, product_name, image_url, unit_price, quantity, created_at
) SELECT
  id,
  ${sqlQuote(item.id ?? null)},
  ${sqlQuote(item.name ?? null)},
  ${sqlQuote(item.image ?? null)},
  ${sqlNumber(item.price, 0)},
  ${Math.max(1, Number(item.quantity ?? 1))},
  ${toSqlDate(order.savedAt ?? order.createdAt)}
FROM orders
WHERE public_order_id = ${sqlQuote(order.orderId)};`);
    }

    statements.push(`INSERT INTO payments (
  order_id, provider, channel_reference, amount, currency, status_code, proof_url, created_at, reviewed_at
) SELECT
  id,
  ${sqlQuote(order.customer?.paymentMethod ?? "manual")},
  NULL,
  ${sqlNumber(order.total, 0)},
  ${sqlQuote(order.currency ?? "PEN")},
  ${sqlQuote(order.status ?? "pending_payment_review")},
  NULL,
  ${toSqlDate(order.savedAt ?? order.createdAt)},
  NULL
FROM orders
WHERE public_order_id = ${sqlQuote(order.orderId)};`);
  }

  return statements;
}

async function main() {
  const users = await readJson("storage/users/users.json", []);
  const admins = await readJson("storage/admin/admins.json", []);
  const orders = await readOrderFiles();

  const statements = [
    "-- Export generado desde storage JSON",
    "START TRANSACTION;",
    ...userStatements(Array.isArray(users) ? users : []),
    ...adminStatements(Array.isArray(admins) ? admins : []),
    ...orderStatements(orders),
    "COMMIT;",
    "",
  ];

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputFile, `${statements.join("\n\n")}\n`, "utf8");
  console.log(`SQL de migracion generado en ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
