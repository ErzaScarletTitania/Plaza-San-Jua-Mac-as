import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const repoRoot = process.cwd();
const targetDir = path.join(repoRoot, "assets", "payment");
const targetFile = path.join(targetDir, "yape-qr.svg");

const payload =
  "Plaza San Juan Macías|Yape|944537419|Pago manual|Enviar comprobante con tu número de pedido";

await fs.mkdir(targetDir, { recursive: true });
const svg = await QRCode.toString(payload, {
  type: "svg",
  margin: 1,
  color: {
    dark: "#13490a",
    light: "#ffffff",
  },
});

await fs.writeFile(targetFile, svg, "utf8");
console.log(`QR generado en ${targetFile}`);
