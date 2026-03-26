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
$selectedOrder = null;
$selectedUser = null;
$statusCatalog = order_status_catalog();

$adminSessionId = (string) ($_SESSION['plaza_admin_id'] ?? '');
if ($adminSessionId !== '') {
    $currentAdmin = find_admin_by_id($adminSessionId);
    if (!$currentAdmin) {
        unset($_SESSION['plaza_admin_id']);
    }
}

if ($currentAdmin && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'update-order-status') {
        $orderId = normalize_text((string) ($_POST['orderId'] ?? ''));
        $nextStatus = normalize_text((string) ($_POST['status'] ?? ''));
        $note = normalize_text((string) ($_POST['note'] ?? ''));

        $updated = update_order_status($orderId, $nextStatus, [
            'author' => (string) ($currentAdmin['email'] ?? 'admin'),
            'note' => $note,
        ]);

        if (!$updated) {
            $errorMessage = 'No se pudo actualizar el estado del pedido.';
        } else {
            $successMessage = 'Estado del pedido actualizado.';
        }
    }
}

if ($currentAdmin) {
    $orders = list_all_orders();
    $users = list_public_users();
    foreach ($orders as $order) {
        $revenue += (float) ($order['total'] ?? 0);
    }

    $selectedOrderId = normalize_text((string) ($_GET['order'] ?? $_POST['orderId'] ?? ''));
    $selectedUserId = normalize_text((string) ($_GET['user'] ?? ''));

    if ($selectedOrderId !== '') {
        $selectedOrder = find_order_by_id($selectedOrderId);
    }

    if ($selectedUserId !== '') {
        $selectedUser = find_user_by_id($selectedUserId);
    }

    if (!$selectedUser && is_array($selectedOrder)) {
        $accountUserId = normalize_text((string) ($selectedOrder['account']['id'] ?? ''));
        $customerEmail = normalize_email((string) ($selectedOrder['customer']['email'] ?? ''));

        if ($accountUserId !== '') {
            $selectedUser = find_user_by_id($accountUserId);
        } elseif ($customerEmail !== '') {
            $selectedUser = find_user_by_email($customerEmail);
        }
    }
}

function esc(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function status_class(string $value): string
{
    return 'status-badge status-badge--' . preg_replace('/[^a-z0-9\-]+/i', '-', strtolower($value));
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
                        <div class="admin-card-actions">
                          <a class="button button--ghost button--compact" href="./?order=<?php echo urlencode((string) ($order['orderId'] ?? '')); ?>">Ver detalle</a>
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
                        <div class="admin-card-actions">
                          <a class="button button--ghost button--compact" href="./?user=<?php echo urlencode((string) ($user['id'] ?? '')); ?>">Ver cliente</a>
                        </div>
                      </li>
                    <?php endforeach; ?>
                  <?php endif; ?>
                </ul>
              </section>
            </div>

            <div class="admin-data-grid">
              <section class="panel-card">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">Detalle de pedido</p>
                    <h3><?php echo $selectedOrder ? esc((string) ($selectedOrder['orderId'] ?? 'Pedido')) : 'Selecciona un pedido'; ?></h3>
                  </div>
                  <?php if ($selectedOrder): ?>
                    <span class="<?php echo esc(status_class((string) ($selectedOrder['status'] ?? 'pending_payment_review'))); ?>">
                      <?php echo esc((string) ($selectedOrder['statusLabel'] ?? 'Pendiente')); ?>
                    </span>
                  <?php endif; ?>
                </div>

                <?php if (!$selectedOrder): ?>
                  <p class="checkout-empty">Elige un pedido de la lista para revisar cliente, items y estado.</p>
                <?php else: ?>
                  <div class="detail-grid">
                    <div class="detail-stack">
                      <div class="detail-card">
                        <p class="eyebrow">Cliente</p>
                        <ul class="meta-list">
                          <li><strong>Nombre:</strong> <?php echo esc((string) ($selectedOrder['customer']['fullName'] ?? '')); ?></li>
                          <li><strong>Correo:</strong> <?php echo esc((string) ($selectedOrder['customer']['email'] ?? '')); ?></li>
                          <li><strong>Telefono:</strong> <?php echo esc((string) ($selectedOrder['customer']['phone'] ?? '')); ?></li>
                          <li><strong>Zona:</strong> <?php echo esc((string) ($selectedOrder['customer']['district'] ?? '')); ?></li>
                          <li><strong>Direccion:</strong> <?php echo esc(trim(((string) ($selectedOrder['customer']['addressLine1'] ?? '')) . ' ' . ((string) ($selectedOrder['customer']['addressLine2'] ?? '')))); ?></li>
                          <li><strong>Referencia:</strong> <?php echo esc((string) ($selectedOrder['customer']['reference'] ?? '')); ?></li>
                        </ul>
                      </div>

                      <div class="detail-card">
                        <p class="eyebrow">Cobro</p>
                        <ul class="meta-list">
                          <li><strong>Metodo:</strong> <?php echo esc((string) ($selectedOrder['customer']['paymentMethod'] ?? '')); ?></li>
                          <li><strong>Subtotal:</strong> S/ <?php echo number_format((float) ($selectedOrder['subtotal'] ?? 0), 2, '.', ','); ?></li>
                          <li><strong>Delivery:</strong> S/ <?php echo number_format((float) ($selectedOrder['deliveryFee'] ?? 0), 2, '.', ','); ?></li>
                          <li><strong>Total:</strong> S/ <?php echo number_format((float) ($selectedOrder['total'] ?? 0), 2, '.', ','); ?></li>
                        </ul>
                        <?php if (((string) ($selectedOrder['customer']['notes'] ?? '')) !== ''): ?>
                          <p class="muted"><?php echo esc((string) $selectedOrder['customer']['notes']); ?></p>
                        <?php endif; ?>
                      </div>
                    </div>

                    <div class="detail-stack">
                      <form class="stack-form admin-inline-form" method="post" action="./index.php?order=<?php echo urlencode((string) ($selectedOrder['orderId'] ?? '')); ?><?php echo $selectedUser ? '&user=' . urlencode((string) ($selectedUser['id'] ?? '')) : ''; ?>">
                        <input type="hidden" name="action" value="update-order-status" />
                        <input type="hidden" name="orderId" value="<?php echo esc((string) ($selectedOrder['orderId'] ?? '')); ?>" />
                        <label>
                          Estado
                          <select name="status" required>
                            <?php foreach ($statusCatalog as $code => $label): ?>
                              <option value="<?php echo esc($code); ?>" <?php echo (($selectedOrder['status'] ?? '') === $code) ? 'selected' : ''; ?>>
                                <?php echo esc($label); ?>
                              </option>
                            <?php endforeach; ?>
                          </select>
                        </label>
                        <label>
                          Nota interna
                          <textarea name="note" rows="3" placeholder="Ejemplo: pago validado, chofer asignado, cliente respondio"><?php echo esc((string) ($selectedOrder['adminNote'] ?? '')); ?></textarea>
                        </label>
                        <button class="button" type="submit">Guardar estado</button>
                      </form>

                      <div class="detail-card">
                        <p class="eyebrow">Items del pedido</p>
                        <ul class="admin-order-items">
                          <?php foreach (($selectedOrder['items'] ?? []) as $item): ?>
                            <li>
                              <div>
                                <strong><?php echo esc((string) ($item['name'] ?? 'Producto')); ?></strong>
                                <?php if (((string) ($item['variantLabel'] ?? '')) !== ''): ?>
                                  <p class="muted"><?php echo esc((string) $item['variantLabel']); ?></p>
                                <?php endif; ?>
                              </div>
                              <div>
                                <strong>x<?php echo (int) ($item['quantity'] ?? 1); ?></strong>
                                <p class="muted">S/ <?php echo number_format((float) ($item['price'] ?? 0), 2, '.', ','); ?></p>
                              </div>
                            </li>
                          <?php endforeach; ?>
                        </ul>
                      </div>

                      <?php if (!empty($selectedOrder['adminHistory']) && is_array($selectedOrder['adminHistory'])): ?>
                        <div class="detail-card">
                          <p class="eyebrow">Historial admin</p>
                          <ul class="admin-history">
                            <?php foreach (array_reverse($selectedOrder['adminHistory']) as $entry): ?>
                              <li>
                                <strong><?php echo esc((string) ($entry['statusLabel'] ?? 'Cambio')); ?></strong>
                                <p class="muted"><?php echo esc((string) ($entry['changedAt'] ?? '')); ?> | <?php echo esc((string) ($entry['author'] ?? '')); ?></p>
                                <?php if (((string) ($entry['note'] ?? '')) !== ''): ?>
                                  <p class="muted"><?php echo esc((string) $entry['note']); ?></p>
                                <?php endif; ?>
                              </li>
                            <?php endforeach; ?>
                          </ul>
                        </div>
                      <?php endif; ?>
                    </div>
                  </div>
                <?php endif; ?>
              </section>

              <section class="panel-card">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">Detalle de cliente</p>
                    <h3><?php echo $selectedUser ? esc((string) ($selectedUser['fullName'] ?? 'Cliente')) : 'Selecciona un cliente'; ?></h3>
                  </div>
                </div>

                <?php if (!$selectedUser): ?>
                  <p class="checkout-empty">Elige un cliente o abre un pedido para autocompletar sus datos guardados.</p>
                <?php else: ?>
                  <div class="detail-stack">
                    <div class="detail-card">
                      <p class="eyebrow">Perfil</p>
                      <ul class="meta-list">
                        <li><strong>Correo:</strong> <?php echo esc((string) ($selectedUser['email'] ?? '')); ?></li>
                        <li><strong>Telefono:</strong> <?php echo esc((string) ($selectedUser['profile']['phone'] ?? '')); ?></li>
                        <li><strong>Distrito:</strong> <?php echo esc((string) ($selectedUser['profile']['district'] ?? '')); ?></li>
                        <li><strong>Direccion:</strong> <?php echo esc(trim(((string) ($selectedUser['profile']['addressLine1'] ?? '')) . ' ' . ((string) ($selectedUser['profile']['addressLine2'] ?? '')))); ?></li>
                        <li><strong>Referencia:</strong> <?php echo esc((string) ($selectedUser['profile']['reference'] ?? '')); ?></li>
                        <li><strong>Alta:</strong> <?php echo esc((string) ($selectedUser['createdAt'] ?? '')); ?></li>
                      </ul>
                    </div>

                    <div class="detail-card">
                      <p class="eyebrow">Atajos</p>
                      <div class="admin-card-actions">
                        <?php if (((string) ($selectedUser['profile']['phone'] ?? '')) !== ''): ?>
                          <a class="button button--ghost button--compact" href="https://wa.me/<?php echo preg_replace('/\D+/', '', (string) ($selectedUser['profile']['phone'] ?? '')); ?>">WhatsApp</a>
                        <?php endif; ?>
                        <a class="button button--ghost button--compact" href="mailto:<?php echo esc((string) ($selectedUser['email'] ?? '')); ?>">Correo</a>
                      </div>
                    </div>
                  </div>
                <?php endif; ?>
              </section>
            </div>
          </section>
        <?php endif; ?>
      </div>
    </main>
  </body>
</html>
