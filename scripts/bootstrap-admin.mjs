import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

const args = process.argv.slice(2);

function takeFlag(flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return "";
  }
  return String(args[index + 1] ?? "").trim();
}

const email = takeFlag("--email").toLowerCase();
const password = takeFlag("--password");
const fullName = takeFlag("--name") || "Admin Plaza San Juan Macias";

if (!email || !password) {
  console.error("Uso: node scripts/bootstrap-admin.mjs --email admin@dominio.com --password clave --name \"Nombre\"");
  process.exit(1);
}

const repoRoot = process.cwd();
const storageDir = path.join(repoRoot, "storage", "admin");
const targetFile = path.join(storageDir, "admins.json");

async function readAdmins() {
  try {
    const raw = await fs.readFile(targetFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const digest = createHash("sha256")
    .update(`${salt}|${value}`, "utf8")
    .digest("hex");

  return `sha256$${salt}$${digest}`;
}

const admins = await readAdmins();
const now = new Date().toISOString();
const nextAdmin = {
  id: `ADM-${randomBytes(6).toString("hex")}`,
  email,
  fullName,
  passwordHash: hashPassword(password),
  role: "owner",
  createdAt: now,
  updatedAt: now,
};

const existingIndex = admins.findIndex((admin) => admin.email === email);
if (existingIndex >= 0) {
  nextAdmin.id = admins[existingIndex].id || nextAdmin.id;
  nextAdmin.createdAt = admins[existingIndex].createdAt || now;
  admins[existingIndex] = nextAdmin;
} else {
  admins.push(nextAdmin);
}

await fs.mkdir(storageDir, { recursive: true });
await fs.writeFile(targetFile, `${JSON.stringify(admins, null, 2)}\n`, "utf8");

console.log(`Admin listo en ${targetFile} para ${email}`);
