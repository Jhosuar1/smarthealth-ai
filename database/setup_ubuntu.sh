#!/bin/bash
# ═══════════════════════════════════════════════════════
#  SmartHealth AI — Setup PostgreSQL en Ubuntu
#  Ejecutar: bash database/setup_ubuntu.sh
# ═══════════════════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   SmartHealth AI — Configuración PostgreSQL      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 1. Verificar que PostgreSQL esté instalado
if ! command -v psql &> /dev/null; then
  echo "❌ PostgreSQL no está instalado. Instalando..."
  sudo apt update && sudo apt install -y postgresql postgresql-contrib
else
  echo "✅ PostgreSQL encontrado: $(psql --version)"
fi

# 2. Iniciar el servicio si no está corriendo
if ! sudo systemctl is-active --quiet postgresql; then
  echo "▶  Iniciando PostgreSQL..."
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
fi
echo "✅ Servicio PostgreSQL activo"

# 3. Crear la base de datos usando sudo -u postgres
echo ""
echo "📦 Creando base de datos 'smarthealth'..."
sudo -u postgres psql -c "CREATE DATABASE smarthealth;" 2>/dev/null && \
  echo "✅ Base de datos creada" || \
  echo "ℹ️  La base de datos ya existe (OK)"

# 4. Aplicar el schema
echo ""
echo "📋 Aplicando schema..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
sudo -u postgres psql -d smarthealth -f "$SCRIPT_DIR/schema.sql" && \
  echo "✅ Schema aplicado correctamente" || \
  echo "❌ Error al aplicar el schema"

# 5. Crear usuario de la app (más seguro que usar postgres directamente)
echo ""
echo "👤 Configurando usuario de la aplicación..."
sudo -u postgres psql << 'PSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'smarthealth_user') THEN
    CREATE USER smarthealth_user WITH PASSWORD 'smarthealth2026';
    GRANT ALL PRIVILEGES ON DATABASE smarthealth TO smarthealth_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smarthealth_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smarthealth_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO smarthealth_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO smarthealth_user;
    RAISE NOTICE 'Usuario smarthealth_user creado';
  ELSE
    GRANT ALL PRIVILEGES ON DATABASE smarthealth TO smarthealth_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smarthealth_user;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smarthealth_user;
    RAISE NOTICE 'Usuario smarthealth_user ya existe, permisos actualizados';
  END IF;
END $$;
PSQL

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ ¡Setup completado!                           ║"
echo "║                                                  ║"
echo "║  Actualiza tu archivo .env con:                  ║"
echo "║  DB_USER=smarthealth_user                        ║"
echo "║  DB_PASSWORD=smarthealth2026                     ║"
echo "║  DB_NAME=smarthealth                             ║"
echo "║                                                  ║"
echo "║  Luego ejecuta: cd backend && node server.js     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
