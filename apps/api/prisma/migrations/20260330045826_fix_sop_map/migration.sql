-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SopEquipmentMap" (
    "map_id" TEXT NOT NULL PRIMARY KEY,
    "sop_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL DEFAULT '',
    "match_rule" TEXT NOT NULL,
    "event_severity_min" TEXT NOT NULL,
    "camera_preset" TEXT,
    "popup_template" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    CONSTRAINT "SopEquipmentMap_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "SopCatalog" ("sop_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SopEquipmentMap" ("camera_preset", "equipment_id", "event_severity_min", "is_primary", "map_id", "match_rule", "popup_template", "sop_id", "sort_order", "space_id") SELECT "camera_preset", "equipment_id", "event_severity_min", "is_primary", "map_id", "match_rule", "popup_template", "sop_id", "sort_order", "space_id" FROM "SopEquipmentMap";
DROP TABLE "SopEquipmentMap";
ALTER TABLE "new_SopEquipmentMap" RENAME TO "SopEquipmentMap";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
