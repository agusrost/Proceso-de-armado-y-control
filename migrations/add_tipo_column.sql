-- Agregar la columna tipo a la tabla pausas si no existe
ALTER TABLE pausas ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'armado';

-- Actualizar todas las pausas existentes sin tipo para que tengan tipo='armado'
UPDATE pausas SET tipo = 'armado' WHERE tipo IS NULL;