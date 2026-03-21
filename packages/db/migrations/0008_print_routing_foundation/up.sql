CREATE TABLE print_sector_routing (
  setor TEXT PRIMARY KEY,
  printer_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_print_sector_routing_printer
  ON print_sector_routing (printer_name, setor);
