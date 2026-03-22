import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const deployDir = path.join(repoRoot, "deploy");
const items = [
  ".htaccess",
  "index.html",
  "catalogo",
  "producto",
  "checkout",
  "cuenta",
  "perfil",
  "assets",
  "data",
  "scripts",
  "styles",
  "api",
  "storage",
];

async function resetDeployDir() {
  await fs.rm(deployDir, { recursive: true, force: true });
  await fs.mkdir(deployDir, { recursive: true });
}

async function copyItem(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(deployDir, relativePath);
  await fs.cp(source, target, { recursive: true });
}

async function main() {
  await resetDeployDir();

  for (const item of items) {
    await copyItem(item);
  }

  console.log(`Deploy listo en ${deployDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
