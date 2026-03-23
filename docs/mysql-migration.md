# Migracion a MySQL en InfinityFree

Esta aplicacion hoy funciona con almacenamiento JSON en `storage/`, pero ya tiene una base lista para migrar a la base MySQL de InfinityFree.

## Archivos base

- Esquema: `database/mysql/schema.sql`
- Exportador de datos desde JSON: `scripts/export-json-to-mysql.mjs`
- Helper PDO para PHP: `api/_database.php`

## Credenciales esperadas

Configura estos valores en el entorno PHP cuando hagamos el cambio de runtime:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_CHARSET` opcional, por defecto `utf8mb4`

## Flujo recomendado

1. Crear la base en InfinityFree desde el panel.
2. Abrir phpMyAdmin.
3. Ejecutar `database/mysql/schema.sql`.
4. Generar el export SQL local:

```bash
npm run db:export-sql
```

5. Importar `database/mysql/import-from-json.sql` en phpMyAdmin.
6. Probar lectura de usuarios, admins y pedidos.
7. Cambiar los endpoints PHP desde JSON a PDO/MySQL por bloques.

## Tablas previstas

- `users`
- `user_addresses`
- `admins`
- `orders`
- `order_items`
- `payments`
- `audit_logs`

## Estado actual

Todavia no se ha reemplazado la capa JSON en produccion. El helper PDO y el esquema quedan listos para la siguiente etapa.
