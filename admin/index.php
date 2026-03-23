<?php

declare(strict_types=1);

require dirname(__DIR__) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . '_auth.php';

header('Content-Type: text/html; charset=utf-8');

$errorMessage = '';
$successMessage = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'logout') {
        unset($_SESSION['plaza_admin_id']);
        session_regenerate_id(true);
        header('Location: ./');
        exit;
    }

    if ($action === 'login') {
        $email = normalize_email((string) ($_POST['email'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            $errorMessage = 'Completa el correo y la contrasena.';
        } else {
            $admin = find_admin_by_email($email);

            if (!$admin || !verify_secret_custom($password, (string) ($admin['passwordHash'] ?? ''))) {
                foreach (load_admins() as $storedAdmin) {
                    if (!is_array($storedAdmin)) {
                        continue;
                    }

                    if (normalize_email((string) ($storedAdmin['email'] ?? '')) !== $email) {
                        continue;
                    }

                    if (!verify_secret_custom($password, (string) ($storedAdmin['passwordHash'] ?? ''))) {
                        continue;
                    }

                    replace_admin($storedAdmin);
                    $admin = $storedAdmin;
                    break;
                }
            }

            if (!$admin || !verify_secret_custom($password, (string) ($admin['passwordHash'] ?? ''))) {
                $errorMessage = 'Credenciales de administracion invalidas.';
            } else {
                session_regenerate_id(true);
                $_SESSION['plaza_admin_id'] = $admin['id'];
                header('Location: ./');
                exit;
            }
        }
    }
}

$currentAdmin = null;
$orders = [];
$users = [];
$revenue = 0.0;

$adminSessionId = (string) ($_SESSION['plaza_admin_id'] ?? '');
if ($adminSessionId !== '') {
    $currentAdmin = find_admin_by_id($adminSessionId);
    if (!$currentAdmin) {
        unset($_SESSION['plaza_admin_id']);
    }
}

if ($currentAdmin) {
    $orders = list_all_orders();
    $users = list_public_users();
    foreach ($orders as $order) {
        $revenue += (float) ($order['total'] ?? 0);
    }
}

function esc(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}
?><!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Administracion | Plaza San Juan Macias</title>
    <meta
      name="description"
      content="Panel base de administracion para revisar pedidos, clientes y estado operativo de Plaza San Juan Macias."
    />
    <meta
      name="keywords"
      content="administracion Plaza San Juan Macias, pedidos, clientes, dashboard ecommerce Callao"
    />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="#c1352a" />
    <link rel="canonical" href="https://plazasanjuanmacias.infinityfree.me/admin/" />
    <link rel="icon" href="../assets/brand/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../styles/main.css" />
  </head>
  <body>
    <div class="utility-bar">
      <div class="shell utility-bar__inner">
        <span>Panel interno para operacion y seguimiento.</span>
        <span>No compartir accesos ni pantallas sensibles.</span>
      </div>
    </div>

    <header class="main-header">
      <div class="shell main-header__inner">
        <a class="brand-block brand-block--logo" href="../">
          <img
            class="brand-logo"
            src="../assets/brand/logo-plaza-san-juan-macias.svg"
            alt="Plaza San Juan Macias"
          />
          <span class="muted">Panel base para pedidos, clientes y operacion.</span>
        </a>
        <div class="search-card">
          <strong>Administracion</strong>
          <span class="muted">Base lista para crecer a dashboard completo.</span>
        </div>
        <nav class="header-actions">
          <a class="header-chip" href="../">Volver a tienda</a>
          <?php if ($currentAdmin): ?>
            <form method="post" action="./index.php">
              <input type="hidden" name="action" value="logout" />
              <button class="header-chip" type="submit">Cerrar sesion</button>
            </form>
          <?php endif; ?>
        </nav>
      </div>
    </header>

    <main class="section">
      <div class="shell admin-layout">
        <?php if (!$currentAdmin): ?>
          <section class="panel-card">
            <p class="eyebrow">Acceso admin</p>
            <h1>Entra con el usuario interno</h1>
            <p class="muted">
              Este acceso ahora funciona server-side, sin depender de JavaScript ni llamadas fetch bloqueadas por el hosting.
            </p>
            <form class="stack-form" method="post" action="./index.php">
              <input type="hidden" name="action" value="login" />
              <label>
                Correo
                <input type="email" name="email" autocomplete="username" required />
              </label>
              <label>
                Contrasena
                <input type="password" name="password" autocomplete="current-password" required />
              </label>
              <button class="button" type="submit">Entrar al panel</button>
            </form>
            <?php if ($errorMessage !== ''): ?>
              <p class="status-text status-text--error"><?php echo esc($errorMessage); ?></p>
            <?php endif; ?>
            <?php if ($successMessage !== ''): ?>
              <p class="status-text"><?php echo esc($successMessage); ?></p>
            <?php endif; ?>
          </section>
        <?php else: ?>
          <section class="panel-card admin-dashboard">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Resumen operativo</p>
                <h2>Panel de <?php echo esc((string) $currentAdmin['fullName']); ?></h2>
              </div>
              <p class="muted"><?php echo esc((string) $currentAdmin['email']); ?> | rol <?php echo esc((string) ($currentAdmin['role'] ?? 'owner')); ?></p>
            </div>

            <div class="admin-kpi-grid">
              <article class="stat-card">
                <p class="eyebrow">Pedidos</p>
                <h3><?php echo count($orders); ?></h3>
                <p class="muted">Pedidos guardados en el backend.</p>
              </article>
              <article class="stat-card">
                <p class="eyebrow">Venta estimada</p>
                <h3>S/ <?php echo number_format($revenue, 2, '.', ','); ?></h3>
                <p class="muted">Suma de pedidos registrados hasta el momento.</p>
              </article>
              <article class="stat-card">
                <p class="eyebrow">Clientes</p>
                <h3><?php echo count($users); ?></h3>
                <p class="muted">Usuarios con cuenta guardada.</p>
              </article>
            </div>

            <div class="admin-data-grid">
              <section class="panel-card">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">Pedidos recientes</p>
                    <h3>Cola operativa</h3>
                  </div>
                </div>
                <ul class="admin-list">
                  <?php if ($orders === []): ?>
                    <li class="checkout-empty">Todavia no hay pedidos para mostrar.</li>
                  <?php else: ?>
                    <?php foreach (array_slice($orders, 0, 10) as $order): ?>
                      <li>
                        <div>
                          <strong><?php echo esc((string) ($order['orderId'] ?? 'Pedido')); ?></strong>
                          <p class="muted"><?php echo esc((string) ($order['customerName'] ?? 'Cliente')); ?></p>
                        </div>
                        <div>
                          <strong>S/ <?php echo number_format((float) ($order['total'] ?? 0), 2, '.', ','); ?></strong>
                          <p class="muted"><?php echo esc((string) ($order['statusLabel'] ?? 'Pendiente')); ?></p>
                        </div>
                      </li>
                    <?php endforeach; ?>
                  <?php endif; ?>
                </ul>
              </section>

              <section class="panel-card">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">Clientes recientes</p>
                    <h3>Base de usuarios</h3>
                  </div>
                </div>
                <ul class="admin-list">
                  <?php if ($users === []): ?>
                    <li class="checkout-empty">Todavia no hay clientes para mostrar.</li>
                  <?php else: ?>
                    <?php foreach (array_slice($users, 0, 10) as $user): ?>
                      <li>
                        <div>
                          <strong><?php echo esc((string) ($user['fullName'] ?? 'Cliente sin nombre')); ?></strong>
                          <p class="muted"><?php echo esc((string) ($user['email'] ?? '')); ?></p>
                        </div>
                        <div>
                          <strong><?php echo esc((string) ($user['district'] ?? 'Sin distrito')); ?></strong>
                          <p class="muted"><?php echo esc((string) ($user['createdAt'] ?? '')); ?></p>
                        </div>
                      </li>
                    <?php endforeach; ?>
                  <?php endif; ?>
                </ul>
              </section>
            </div>
          </section>
        <?php endif; ?>
      </div>
    </main>
  </body>
</html>
