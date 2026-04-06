-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Zone" (
    "zone_id" TEXT NOT NULL,
    "zone_name" TEXT NOT NULL,
    "zone_type" TEXT NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("zone_id")
);

-- CreateTable
CREATE TABLE "EquipmentMaster" (
    "equipment_id" TEXT NOT NULL,
    "equipment_name" TEXT NOT NULL,
    "equipment_type" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "glb_object_name" TEXT NOT NULL,
    "is_core" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "EquipmentMaster_pkey" PRIMARY KEY ("equipment_id")
);

-- CreateTable
CREATE TABLE "SensorMaster" (
    "sensor_id" TEXT NOT NULL,
    "sensor_name" TEXT NOT NULL,
    "sensor_type" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sample_interval_sec" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "SensorMaster_pkey" PRIMARY KEY ("sensor_id")
);

-- CreateTable
CREATE TABLE "SensorThreshold" (
    "sensor_id" TEXT NOT NULL,
    "normal_value" DOUBLE PRECISION NOT NULL,
    "warning_low" DOUBLE PRECISION NOT NULL,
    "warning_high" DOUBLE PRECISION NOT NULL,
    "critical_low" DOUBLE PRECISION NOT NULL,
    "critical_high" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SensorThreshold_pkey" PRIMARY KEY ("sensor_id")
);

-- CreateTable
CREATE TABLE "ScenarioMaster" (
    "scenario_id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "trigger_equipment_id" TEXT NOT NULL,
    "affected_equipment_ids" TEXT NOT NULL,
    "hazop_id" TEXT,
    "default_duration_sec" INTEGER NOT NULL,
    "phases" TEXT NOT NULL,
    "sensor_data_file" TEXT NOT NULL,
    "playback_speed_options" TEXT NOT NULL,

    CONSTRAINT "ScenarioMaster_pkey" PRIMARY KEY ("scenario_id")
);

-- CreateTable
CREATE TABLE "HazopMaster" (
    "hazop_id" TEXT NOT NULL,
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

    CONSTRAINT "HazopMaster_pkey" PRIMARY KEY ("hazop_id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "event_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "trigger_equipment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL,
    "summary" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "SopCatalog" (
    "sop_id" TEXT NOT NULL,
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
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SopCatalog_pkey" PRIMARY KEY ("sop_id")
);

-- CreateTable
CREATE TABLE "SopEquipmentMap" (
    "map_id" TEXT NOT NULL,
    "sop_id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL DEFAULT '',
    "match_rule" TEXT NOT NULL,
    "event_severity_min" TEXT NOT NULL,
    "camera_preset" TEXT,
    "popup_template" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "SopEquipmentMap_pkey" PRIMARY KEY ("map_id")
);

-- CreateTable
CREATE TABLE "SopExecutionLog" (
    "execution_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "scenario_id" TEXT,
    "sop_id" TEXT NOT NULL,
    "execution_status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "executor_role" TEXT,
    "checked_steps" TEXT,
    "memo" TEXT,

    CONSTRAINT "SopExecutionLog_pkey" PRIMARY KEY ("execution_id")
);

-- CreateTable
CREATE TABLE "ReportDocument" (
    "report_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "scenario_id" TEXT,
    "event_id" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "author_role" TEXT,
    "generated_summary" TEXT,
    "manager_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDocument_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "SettingsMetadata" (
    "setting_id" TEXT NOT NULL,
    "setting_group" TEXT NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "SettingsMetadata_pkey" PRIMARY KEY ("setting_id")
);

-- CreateTable
CREATE TABLE "MockKogasResult" (
    "request_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "target_equipment_id" TEXT NOT NULL,
    "fault_code" TEXT,
    "fault_name" TEXT NOT NULL,
    "diagnosis_confidence" DOUBLE PRECISION NOT NULL,
    "suspected_part" TEXT,
    "sensor_evidence" TEXT,

    CONSTRAINT "MockKogasResult_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "MockKgsResult" (
    "analysis_id" TEXT NOT NULL,
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
    "recommended_action" TEXT,

    CONSTRAINT "MockKgsResult_pkey" PRIMARY KEY ("analysis_id")
);

-- CreateTable
CREATE TABLE "MockKetiResult" (
    "simulation_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "trigger_equipment_id" TEXT NOT NULL,
    "simulation_summary" TEXT,
    "recommended_option_a" TEXT,
    "recommended_option_b" TEXT,
    "expected_stabilization_min" INTEGER,
    "option_a_stabilization_min" INTEGER,
    "option_b_stabilization_min" INTEGER,
    "option_a_risk" TEXT,
    "option_b_risk" TEXT,
    "option_a_detail" TEXT,
    "option_b_detail" TEXT,

    CONSTRAINT "MockKetiResult_pkey" PRIMARY KEY ("simulation_id")
);

-- CreateTable
CREATE TABLE "MockSafetiaHistory" (
    "history_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "last_maintenance_date" TEXT,
    "past_incident_summary" TEXT,
    "linked_sop_id" TEXT,
    "operator_note" TEXT,

    CONSTRAINT "MockSafetiaHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SettingsMetadata_setting_key_key" ON "SettingsMetadata"("setting_key");

-- AddForeignKey
ALTER TABLE "EquipmentMaster" ADD CONSTRAINT "EquipmentMaster_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("zone_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorMaster" ADD CONSTRAINT "SensorMaster_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "EquipmentMaster"("equipment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorThreshold" ADD CONSTRAINT "SensorThreshold_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "SensorMaster"("sensor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HazopMaster" ADD CONSTRAINT "HazopMaster_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "EquipmentMaster"("equipment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopEquipmentMap" ADD CONSTRAINT "SopEquipmentMap_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "SopCatalog"("sop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopExecutionLog" ADD CONSTRAINT "SopExecutionLog_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "EventLog"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopExecutionLog" ADD CONSTRAINT "SopExecutionLog_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "SopCatalog"("sop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDocument" ADD CONSTRAINT "ReportDocument_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "EventLog"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

