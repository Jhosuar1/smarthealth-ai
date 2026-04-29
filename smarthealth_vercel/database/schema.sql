-- ═══════════════════════════════════════════════════════
--  SmartHealth AI — Schema PostgreSQL
--  Ejecutar: psql -U postgres -d smarthealth -f schema.sql
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(80)  NOT NULL,
  apellido      VARCHAR(80)  NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('paciente','medico','farmacia','admin','superadmin')),
  avatar        VARCHAR(5)   NOT NULL DEFAULT '??',
  color         VARCHAR(10)  NOT NULL DEFAULT '#0057ff',
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  registro_prof VARCHAR(50),
  creado_en     TIMESTAMP    NOT NULL DEFAULT NOW(),
  ultimo_login  TIMESTAMP
);

-- TOKENS RECUPERACION
CREATE TABLE IF NOT EXISTS tokens_recuperacion (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo    VARCHAR(20) NOT NULL,
  expira_en TIMESTAMP   NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  usado     BOOLEAN     NOT NULL DEFAULT FALSE
);

-- CITAS
CREATE TABLE IF NOT EXISTS citas (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  medico_nom   VARCHAR(120) NOT NULL,
  especialidad VARCHAR(80)  NOT NULL,
  centro       VARCHAR(120) NOT NULL,
  fecha        DATE         NOT NULL,
  hora         TIME         NOT NULL,
  modalidad    VARCHAR(20)  NOT NULL CHECK (modalidad IN ('Presencial','Virtual')),
  prioridad    VARCHAR(20)  NOT NULL CHECK (prioridad IN ('critica','alta','media','baja')),
  motivo       TEXT         NOT NULL,
  estado       VARCHAR(20)  NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','cancelada','completada')),
  creado_en    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- FORMULAS
CREATE TABLE IF NOT EXISTS formulas (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hash                VARCHAR(30) NOT NULL UNIQUE,
  paciente_id         UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  medico_id           UUID        NOT NULL REFERENCES usuarios(id),
  diagnostico         VARCHAR(200) NOT NULL,
  observaciones       TEXT,
  tipo_entrega        VARCHAR(20) NOT NULL CHECK (tipo_entrega IN ('domicilio','retiro')),
  farmacia            VARCHAR(80),
  estado              VARCHAR(20) NOT NULL DEFAULT 'en_camino' CHECK (estado IN ('en_camino','entregado','cancelado')),
  rating              SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  rating_comentario   TEXT,
  creado_en           TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- FORMULA_MEDICAMENTOS
CREATE TABLE IF NOT EXISTS formula_medicamentos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID        NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  nombre     VARCHAR(120) NOT NULL,
  dosis      VARCHAR(80)  NOT NULL,
  duracion   VARCHAR(40)  NOT NULL,
  orden      SMALLINT    NOT NULL DEFAULT 1
);

-- INVENTARIO
CREATE TABLE IF NOT EXISTS inventario (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         VARCHAR(120) NOT NULL,
  presentacion   VARCHAR(80)  NOT NULL,
  farmacia       VARCHAR(80)  NOT NULL,
  stock          INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_min      INTEGER      NOT NULL DEFAULT 20,
  precio         INTEGER      NOT NULL DEFAULT 0,
  vencimiento    DATE,
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMP    NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- NOTIFICACIONES
CREATE TABLE IF NOT EXISTS notificaciones (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensaje   TEXT        NOT NULL,
  tipo      VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (tipo IN ('ok','info','warn','err')),
  leida     BOOLEAN     NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- AUDITORIA
CREATE TABLE IF NOT EXISTS auditoria (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  user_nombre VARCHAR(160),
  accion      TEXT        NOT NULL,
  tabla       VARCHAR(50),
  ip          VARCHAR(45),
  creado_en   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_citas_pac     ON citas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha   ON citas(fecha);
CREATE INDEX IF NOT EXISTS idx_form_pac      ON formulas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_form_estado   ON formulas(estado);
CREATE INDEX IF NOT EXISTS idx_inv_farm      ON inventario(farmacia);
CREATE INDEX IF NOT EXISTS idx_notif_user    ON notificaciones(user_id, leida);
CREATE INDEX IF NOT EXISTS idx_audit_fecha   ON auditoria(creado_en DESC);

-- TRIGGER: actualizar timestamp inventario
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inv_updated ON inventario;
CREATE TRIGGER trg_inv_updated
  BEFORE UPDATE ON inventario
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- VISTA: stock critico
CREATE OR REPLACE VIEW v_stock_critico AS
  SELECT nombre, presentacion, farmacia, stock, stock_min,
    CASE WHEN stock = 0 THEN 'sin_stock' WHEN stock <= stock_min THEN 'bajo' ELSE 'ok' END AS estado
  FROM inventario WHERE activo = TRUE AND stock <= stock_min ORDER BY stock ASC;

-- VISTA: citas hoy
CREATE OR REPLACE VIEW v_citas_hoy AS
  SELECT c.*, u.nombre || ' ' || u.apellido AS paciente_nombre
  FROM citas c JOIN usuarios u ON u.id = c.paciente_id
  WHERE c.fecha = CURRENT_DATE AND c.estado = 'activa'
  ORDER BY c.hora ASC;

-- ════ DATOS INICIALES ════
-- Contraseña demo123 en bcrypt (generada con bcryptjs rounds=10)
INSERT INTO usuarios (nombre,apellido,email,password,rol,avatar,color) VALUES
  ('Ana',    'Correa',  'paciente@demo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'paciente',   'AC','#0057ff'),
  ('Carlos', 'Mejia',   'medico@demo.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'medico',     'CM','#8b5cf6'),
  ('Gloria', 'Ruiz',    'farmacia@demo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'farmacia',   'GR','#10b981'),
  ('Admin',  'Sistema', 'admin@demo.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin',      'AS','#ef4444'),
  ('Super',  'Admin',   'super@demo.com',    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'superadmin', 'SA','#f59e0b')
ON CONFLICT (email) DO NOTHING;

INSERT INTO inventario (nombre,presentacion,farmacia,stock,stock_min,precio,vencimiento) VALUES
  ('Losartan Potasico','50mg x 30 tab', 'Cruz Verde', 142,20,8500, '2027-01-15'),
  ('Metformina',       '850mg x 60 tab','Cruz Verde', 87, 20,12000,'2026-12-01'),
  ('Atorvastatina',    '20mg x 30 tab', 'Cruz Verde', 34, 25,9200, '2026-09-10'),
  ('Amoxicilina',      '500mg x 21 cap','Cruz Verde', 216,30,7800, '2027-03-01'),
  ('Ibuprofeno',       '400mg x 20 tab','Cruz Verde', 0,  30,5500, '2026-11-01'),
  ('Omeprazol',        '20mg x 30 cap', 'Cruz Verde', 61, 20,6200, '2026-10-05'),
  ('Acido Folico',     '1mg x 30 tab',  'Cruz Verde', 178,20,3200, '2027-06-01'),
  ('Losartan Potasico','50mg x 30 tab', 'Comfamiliar',45, 20,8800, '2027-02-01'),
  ('Metformina',       '850mg x 60 tab','Comfamiliar',12, 20,12500,'2026-11-20'),
  ('Ibuprofeno',       '400mg x 20 tab','Comfamiliar',89, 30,5200, '2027-01-01'),
  ('Losartan Potasico','50mg x 30 tab', 'La Rebaja',  0,  20,8200, '2026-08-01'),
  ('Metformina',       '850mg x 60 tab','La Rebaja',  54, 20,11800,'2027-04-01')
ON CONFLICT DO NOTHING;
