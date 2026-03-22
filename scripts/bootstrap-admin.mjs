import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);

function takeFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return "";
  }
  return String(args[index + 1] ?? "").trim();
}

export function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const digest = createHash("sha256")
    .update(`${salt}|${value}`, "utf8")
    .digest("hex");

  return `sha256$${salt}$${digest}`;
}

export async function provisionAdminFile({
  email,
  password,
  fullName = "Admin Plaza San Juan Macias",
  targetRoot = process.cwd(),
}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Debes indicar email y password para el admin.");
  }

  const storageDir = path.join(targetRoot, "storage", "admin");
  const targetFile = path.join(storageDir, "admins.json");

  let admins = [];
  try {
    const raw = await fs.readFile(targetFile, "utf8");
    const parsed = JSON.parse(raw);
    admins = Array.isArray(parsed) ? parsed : [];
  } catch {
    admins = [];
  }

  const now = new Date().toISOString();
  const nextAdmin = {
    id: `ADM-${randomBytes(6).toString("hex")}`,
    email: normalizedEmail,
    fullName,
    passwordHash: hashPassword(normalizedPassword),
    role: "owner",
    createdAt: now,
    updatedAt: now,
  };

  const existingIndex = admins.findIndex((admin) => admin.email === normalizedEmail);
  if (existingIndex >= 0) {
    nextAdmin.id = admins[existingIndex].id || nextAdmin.id;
    nextAdmin.createdAt = admins[existingIndex].createdAt || now;
    admins[existingIndex] = nextAdmin;
  } else {
    admins.push(nextAdmin);
  }

  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(targetFile, `${JSON.stringify(admins, null, 2)}\n`, "utf8");

  return { targetFile, admins };
}

export async function runBootstrapCli(args = process.argv.slice(2), env = process.env) {
  const email = (takeFlag(args, "--email") || env.ADMIN_EMAIL || "").toLowerCase();
  const password = takeFlag(args, "--password") || env.ADMIN_PASSWORD || "";
  const fullName = takeFlag(args, "--name") || env.ADMIN_NAME || "Admin Plaza San Juan Macias";
  const targetRoot = takeFlag(args, "--target-root")
    ? path.resolve(process.cwd(), takeFlag(args, "--target-root"))
    : process.cwd();

  if (!email || !password) {
    throw new Error(
      'Uso: node scripts/bootstrap-admin.mjs --email admin@dominio.com --password clave --name "Nombre" --target-root ./deploy',
    );
  }

  return provisionAdminFile({ email, password, fullName, targetRoot });
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  runBootstrapCli()
    .then(({ targetFile, admins }) => {
      const latest = admins.at(-1);
      console.log(`Admin listo en ${targetFile} para ${latest?.email ?? "admin"}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
