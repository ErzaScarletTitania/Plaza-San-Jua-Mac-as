import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export async function renderRuntimeConfig({
  targetRoot = process.cwd(),
  dbHost,
  dbPort = "3306",
  dbName,
  dbUser,
  dbPassword,
  dbCharset = "utf8mb4",
}) {
  const targetFile = path.join(targetRoot, "api", "_runtime-config.php");
  const payload = `<?php

return [
    'db' => [
        'DB_HOST' => ${JSON.stringify(dbHost)},
        'DB_PORT' => ${JSON.stringify(dbPort)},
        'DB_NAME' => ${JSON.stringify(dbName)},
        'DB_USER' => ${JSON.stringify(dbUser)},
        'DB_PASSWORD' => ${JSON.stringify(dbPassword)},
        'DB_CHARSET' => ${JSON.stringify(dbCharset)},
    ],
];
`;

  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, payload, "utf8");
  return targetFile;
}

export async function runRuntimeConfigCli(args = process.argv.slice(2), env = process.env) {
  const targetRoot = takeFlag(args, "--target-root")
    ? path.resolve(process.cwd(), takeFlag(args, "--target-root"))
    : process.cwd();

  const config = {
    targetRoot,
    dbHost: pick(args, env, "--db-host", "DB_HOST"),
    dbPort: pick(args, env, "--db-port", "DB_PORT", "3306"),
    dbName: pick(args, env, "--db-name", "DB_NAME"),
    dbUser: pick(args, env, "--db-user", "DB_USER"),
    dbPassword: pick(args, env, "--db-password", "DB_PASSWORD"),
    dbCharset: pick(args, env, "--db-charset", "DB_CHARSET", "utf8mb4"),
  };

  if (!config.dbHost || !config.dbName || !config.dbUser) {
    throw new Error("Debes indicar DB_HOST, DB_NAME y DB_USER para generar la configuracion.");
  }

  return renderRuntimeConfig(config);
}

if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  runRuntimeConfigCli()
    .then((targetFile) => {
      console.log(`Configuracion runtime generada en ${targetFile}`);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
