# Plaza San Juan Macias

Sitio de comercio electronico static-first para `plazasanjuanmacias.infinityfree.me`.

## Flujo principal

1. `npm run fetch:reference`
   Descarga y guarda las paginas de producto de referencia enlazadas desde la fuente base guardada.

2. `npm run fetch:catalog`
   Descarga paginas de categorias permitidas y amplia el catalogo sin tecnologia ni PCs.

3. `npm run build`
   Genera el catalogo local y el QR de Yape.

4. `npm run test`
   Ejecuta las verificaciones automaticas del sitio.

5. `npm run verify`
   Ejecuta pruebas y prepara la carpeta `deploy/` antes de publicar.

6. `npm run db:export-sql`
   Genera `database/mysql/import-from-json.sql` para migrar usuarios, admins y pedidos desde `storage/` hacia MySQL.

## Publicacion

La carpeta del repositorio es publicable como sitio static-first. Los endpoints PHP guardan:

- pedidos en `storage/orders/`
- usuarios en `storage/users/users.json`
- admins en `storage/admin/admins.json`

## MySQL para InfinityFree

La base para migrar a MySQL ya esta preparada:

- esquema SQL en `database/mysql/schema.sql`
- helper PDO en `api/_database.php`
- exportador de datos en `scripts/export-json-to-mysql.mjs`
- guia en `docs/mysql-migration.md`

## CI/CD con GitHub Actions

Los workflows actuales hacen esto:

1. instalan dependencias con `npm ci`
2. ejecutan `npm run verify`
3. generan la carpeta `deploy/`
4. provisionan el admin desde secretos de GitHub
5. publican `deploy/` por FTP a InfinityFree

### Secrets requeridos en GitHub

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR_STAGING`
- `FTP_SERVER_DIR_PRODUCTION`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

## Cuenta de usuario

- Registro e inicio de sesion con PHP y sesiones.
- Perfil con nombre, telefono y direccion de entrega.
- Botones preparados para integracion futura con Google y Facebook.

## Pagos

- Yape: `944537419`
- BCP: `19299856955008`
- PayPal manual: `liliet.polanco.peru@gmail.com`
- Binance USDT BEP20: `0xfba76497f467c0112232497aacfbd6013935acb2`
