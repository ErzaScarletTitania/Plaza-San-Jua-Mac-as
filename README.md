# Plaza San Juan Macías

Sitio de comercio electrónico static-first para `plazasanjuanmacias.infinityfree.me`.

## Flujo principal

1. `npm run fetch:reference`
   Descarga y guarda las páginas de producto de referencia enlazadas desde la fuente base guardada.

2. `npm run fetch:catalog`
   Descarga páginas de categorías permitidas y amplía el catálogo sin tecnología ni PCs.

3. `npm run build`
   Genera el catálogo local y el QR de Yape.

4. `npm run test`
   Ejecuta las verificaciones automáticas del sitio.

5. `npm run verify`
   Ejecuta pruebas y prepara la carpeta `deploy/` antes de publicar.

## Publicación

La carpeta del repositorio es publicable como sitio static-first. Los endpoints PHP guardan:

- pedidos en `storage/orders/`
- usuarios en `storage/users/users.json`

## CI/CD con GitHub Actions

El flujo `.github/workflows/deploy.yml` hace esto en cada push a `main`:

1. instala dependencias con `npm ci`
2. ejecuta `npm run verify`
3. genera la carpeta `deploy/`
4. publica `deploy/` por FTP a InfinityFree

### Secrets requeridos en GitHub

Configura estos secretos del repositorio:

- `FTP_SERVER`: `ftpupload.net`
- `FTP_USERNAME`: tu usuario FTP de InfinityFree
- `FTP_PASSWORD`: tu contraseña FTP de InfinityFree
- `FTP_SERVER_DIR`: `/htdocs/`

Con esos secretos, cualquier commit enviado a `main` quedará versionado y luego desplegado automáticamente al sitio en vivo.

## Cuenta de usuario

- Registro e inicio de sesión con PHP y sesiones.
- Perfil con nombre, teléfono y dirección de entrega.
- Botones preparados para integración futura con Google y Facebook.

## Pagos

- Yape: `944537419`
- BCP: `19299856955008`
- PayPal manual: `liliet.polanco.peru@gmail.com`
- Binance USDT BEP20: `0xfba76497f467c0112232497aacfbd6013935acb2`
