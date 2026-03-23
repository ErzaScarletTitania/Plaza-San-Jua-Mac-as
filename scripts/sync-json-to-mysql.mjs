import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

import { hashPassword } from "./bootstrap-admin.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const thisFile = fileURLToPath(import.meta.url);

function takeFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return "";
  }
  return String(args[index + 1] ?? "").trim();
}

function pick(args, env, flag, envName, fallback = "") {
  return takeFlag(args, flag) || env[envName] || fallback;
}

async function readIfExists(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

export async function syncJsonToMysql({
  host,
  port = 3306,
  database,
  user,
  password,
  charset = "utf8mb4",
  adminEmail = "",
  adminPassword = "",
  adminName = "Administrador",
}) {
  if (!host || !database || !user) {
    throw new Error("Debes indicar host, database y user para sincronizar MySQL.");
  }

  const schemaFile = path.join(repoRoot, "database", "mysql", "schema.sql");
  const importFile = path.join(repoRoot, "database", "mysql", "import-from-json.sql");

  await execFileAsync(process.execPath, [path.join(repoRoot, "scripts", "export-json-to-mysql.mjs")], {
    cwd: repoRoot,
  });

  const schemaSql = await fs.readFile(schemaFile, "utf8");
  const importSql = await readIfExists(importFile);

  const connection = await mysql.createConnection({
    host,
    port: Number(port),
    user,
    password,
    database,
    charset,
    multipleStatements: true,
  });

  try {
    if (schemaSql.trim()) {
      await connection.query(schemaSql);
    }

    if (importSql.trim()) {
      await connection.query(importSql);
    }

    if (adminEmail && adminPassword) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const adminId = `ADM-${Date.now().toString(36).slice(-8)}`;
      const passwordHash = hashPassword(adminPassword);

      await connection.execute(
        `INSERT INTO admins (
          id, email, full_name, password_hash, role, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'owner', ?, ?)
        ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          updated_at = VALUES(updated_at)`,
        [adminId, adminEmail.toLowerCase(), adminName, passwordHash, now, now],
      );
    }

    const [adminRows] = await connection.query("SELECT COUNT(*) AS count FROM admins");
    const [userRows] = await connection.query("SELECT COUNT(*) AS count FROM users");
    const [orderRows] = await connection.query("SELECT COUNT(*) AS count FROM orders");

    return {
      admins: Number(adminRows[0]?.count ?? 0),
      users: Number(userRows[0]?.count ?? 0),
      orders: Number(orderRows[0]?.count ?? 0),
      importFile,
    };
  } finally {
    await connection.end();
  }
}

export async function runSyncCli(args = process.argv.slice(2), env = process.env) {
  return syncJsonToMysql({
    host: pick(args, env, "--host", "DB_HOST"),
    port: pick(args, env, "--port", "DB_PORT", "3306"),
    database: pick(args, env, "--database", "DB_NAME"),
    user: pick(args, env, "--user", "DB_USER"),
    password: pick(args, env, "--password", "DB_PASSWORD"),
    charset: pick(args, env, "--charset", "DB_CHARSET", "utf8mb4"),
    adminEmail: pick(args, env, "--admin-email", "ADMIN_EMAIL"),
    adminPassword: pick(args, env, "--admin-password", "ADMIN_PASSWORD"),
    adminName: pick(args, env, "--admin-name", "ADMIN_NAME", "Administrador"),
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  runSyncCli()
    .then((summary) => {
      console.log(
        `MySQL sincronizado. admins=${summary.admins} users=${summary.users} orders=${summary.orders} sql=${summary.importFile}`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
