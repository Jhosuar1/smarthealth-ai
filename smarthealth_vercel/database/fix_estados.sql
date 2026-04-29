-- Ampliar el CHECK constraint para incluir 'pendiente' y 'preparando'
ALTER TABLE formulas DROP CONSTRAINT IF EXISTS formulas_estado_check;
ALTER TABLE formulas ADD CONSTRAINT formulas_estado_check
  CHECK (estado IN ('pendiente','preparando','en_camino','entregado','cancelado'));

-- Actualizar fórmulas existentes sin estado válido
UPDATE formulas SET estado = 'pendiente' WHERE estado NOT IN ('pendiente','preparando','en_camino','entregado','cancelado');
