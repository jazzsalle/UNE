-- CreateTable
CREATE TABLE "Zone" (
    "zone_id" TEXT NOT NULL PRIMARY KEY,
    "zone_name" TEXT NOT NULL,
    "zone_type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EquipmentMaster" (
    "equipment_id" TEXT NOT NULL PRIMARY KEY,
    "equipment_name" TEXT NOT NULL,
    "equipment_type" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "glb_object_name" TEXT NOT NULL,
    "is_core" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    CONSTRAINT "EquipmentMaster_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone" ("zone_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SensorMaster" (
    "sensor_id" TEXT NOT NULL PRIMARY KEY,
    "sensor_name" TEXT NOT NULL,
    "sensor_type" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sample_interval_sec" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "SensorMaster_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "EquipmentMaster" ("equipment_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SensorThreshold" (
    "sensor_id" TEXT NOT NULL PRIMARY KEY,
    "normal_value" REAL NOT NULL,
    "warning_low" REAL NOT NULL,
    "warning_high" REAL NOT NULL,
    "critical_low" REAL NOT NULL,
    "critical_high" REAL NOT NULL,
    CONSTRAINT "SensorThreshold_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "SensorMaster" ("sensor_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScenarioMaster" (
    "scenario_id" TEXT NOT NULL PRIMARY KEY,
    "scenario_name" TEXT NOT NULL,
    "trigger_equipment_id" TEXT NOT NULL,
    "affected_equipment_ids" TEXT NOT NULL,
    "hazop_id" TEXT,
    "default_duration_sec" INTEGER NOT NULL,
    "phases" TEXT NOT NULL,
    "sensor_data_file" TEXT NOT NULL,
    "playback_speed_options" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "HazopMaster" (
    "hazop_id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "process_parameter" TEXT NOT NULL,
    "deviation" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "event_scenario" TEXT NOT NULL,
    "hazard_scenario" TEXT NOT NULL,
    "preventive_action" TEXT NOT NULL,
    "emergency_response" TEXT NOT NULL,
    "linked_sop_id" TEXT,
    "risk_level" TEXT NOT NULL,
    "kgs_impact_score" INTEGER,
    CONSTRAINT "HazopMaster_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "EquipmentMaster" ("equipment_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventLog" (
    "event_id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "trigger_equipment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL,
    "summary" TEXT,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME
);

-- CreateTable
CREATE TABLE "SopCatalog" (
    "sop_id" TEXT NOT NULL PRIMARY KEY,
    "sop_name" TEXT NOT NULL,
    "sop_category" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "target_space_id" TEXT,
    "target_equipment_id" TEXT,
    "linked_hazop_id" TEXT,
    "priority" INTEGER NOT NULL,
    "camera_preset" TEXT,
    "popup_template" TEXT,
    "estimated_duration_min" INTEGER,
    "auto_open_popup" BOOLEAN NOT NULL DEFAULT false,
    "broadcast_action" TEXT,
    "steps" TEXT NOT NULL,
    "keywords" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- CreateTable
CREATE TABLE "SopEquipmentMap" (
    "map_id" TEXT NOT NULL PRIMARY KEY,
    "sop_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "match_rule" TEXT NOT NULL,
    "event_severity_min" TEXT NOT NULL,
    "camera_preset" TEXT,
    "popup_template" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    CONSTRAINT "SopEquipmentMap_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "SopCatalog" ("sop_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SopExecutionLog" (
    "execution_id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "scenario_id" TEXT,
    "sop_id" TEXT NOT NULL,
    "execution_status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "executor_role" TEXT,
    "checked_steps" TEXT,
    "memo" TEXT,
    CONSTRAINT "SopExecutionLog_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "EventLog" ("event_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SopExecutionLog_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "SopCatalog" ("sop_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportDocument" (
    "report_id" TEXT NOT NULL PRIMARY KEY,
    "template_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "scenario_id" TEXT,
    "event_id" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "author_role" TEXT,
    "generated_summary" TEXT,
    "manager_comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ReportDocument_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "EventLog" ("event_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettingsMetadata" (
    "setting_id" TEXT NOT NULL PRIMARY KEY,
    "setting_group" TEXT NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "MockKogasResult" (
    "request_id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "target_equipment_id" TEXT NOT NULL,
    "fault_code" TEXT,
    "fault_name" TEXT NOT NULL,
    "diagnosis_confidence" REAL NOT NULL,
    "suspected_part" TEXT,
    "sensor_evidence" TEXT
);

-- CreateTable
CREATE TABLE "MockKgsResult" (
    "analysis_id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "trigger_equipment_id" TEXT NOT NULL,
    "affected_equipment_id" TEXT NOT NULL,
    "impact_type" TEXT NOT NULL,
    "impact_score" INTEGER NOT NULL,
    "risk_level" TEXT NOT NULL,
    "predicted_after_sec" INTEGER,
    "color_2d" TEXT,
    "color_3d" TEXT,
    "hazop_id" TEXT,
    "recommended_action" TEXT
);

-- CreateTable
CREATE TABLE "MockKetiResult" (
    "simulation_id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "trigger_equipment_id" TEXT NOT NULL,
    "simulation_summary" TEXT,
    "recommended_option_a" TEXT,
    "recommended_option_b" TEXT,
    "expected_stabilization_min" INTEGER
);

-- CreateTable
CREATE TABLE "MockSafetiaHistory" (
    "history_id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "last_maintenance_date" TEXT,
    "past_incident_summary" TEXT,
    "linked_sop_id" TEXT,
    "operator_note" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "SettingsMetadata_setting_key_key" ON "SettingsMetadata"("setting_key");
