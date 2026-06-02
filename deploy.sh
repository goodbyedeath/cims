#!/usr/bin/env bash
# deploy.sh — CIMS production deployment script
# Usage: bash deploy.sh [--skip-build] [--skip-migrate]
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

SKIP_BUILD=0
SKIP_MIGRATE=0
for arg in "$@"; do
  [[ "$arg" == "--skip-build"   ]] && SKIP_BUILD=1
  [[ "$arg" == "--skip-migrate" ]] && SKIP_MIGRATE=1
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " CIMS Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Maintenance mode
echo "[1/9] Enabling maintenance mode..."
php artisan down --render="errors.503" --retry=30 || true

# 2. Pre-deploy backup
echo "[2/9] Backing up database..."
php artisan db:backup --keep=7 || echo "  ⚠  Backup failed — continuing anyway"

# 3. Composer
echo "[3/9] Installing PHP dependencies..."
COMPOSER_MEMORY_LIMIT=-1 composer install --no-dev --optimize-autoloader --no-interaction

# 4. NPM build
if [[ $SKIP_BUILD -eq 0 ]]; then
  echo "[4/9] Building frontend assets..."
  npm ci --prefer-offline
  RAYON_NUM_THREADS=1 GOMAXPROCS=1 npm run build
else
  echo "[4/9] Skipping frontend build (--skip-build)"
fi

# 5. Migrations
if [[ $SKIP_MIGRATE -eq 0 ]]; then
  echo "[5/9] Running migrations..."
  php artisan migrate --force --no-interaction
else
  echo "[5/9] Skipping migrations (--skip-migrate)"
fi

# 6. Clear all stale caches
echo "[6/9] Clearing caches..."
php artisan view:clear
php artisan route:clear
php artisan config:clear
php artisan event:clear
php artisan cache:clear

# 7. Warm caches
echo "[7/9] Warming caches..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# 8. File permissions
echo "[8/9] Setting permissions..."
chmod -R 755 storage bootstrap/cache
chmod -R 644 storage/logs 2>/dev/null || true

# 9. Bring up
echo "[9/9] Disabling maintenance mode..."
php artisan up

echo ""
echo "✓ Deploy complete — $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
