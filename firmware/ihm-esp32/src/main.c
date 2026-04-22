#include <stdbool.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#include "app_state.h"
#include "capabilities.h"
#include "commands.h"
#include "device_state.h"
#include "diagnostics.h"
#include "local_server.h"
#include "log_tags.h"
#include "mqtt_manager.h"
#include "ota.h"
#include "protocol.h"
#include "rs485_bridge.h"
#include "schedules.h"
#include "storage.h"
#include "wifi_manager.h"

static void bootstrap_state_from_capabilities(void)
{
    device_capabilities_t capabilities = {0};

    if (capabilities_get_snapshot(&capabilities) != ESP_OK) {
        return;
    }

    device_state_set_target_frequency(capabilities.f_min_hz);
    device_state_set_current_frequency(0);
    device_state_set_pump_state(capabilities.pump_available ? APP_PERIPHERAL_OFF : APP_PERIPHERAL_UNAVAILABLE);
    device_state_set_swing_state(capabilities.swing_available ? APP_PERIPHERAL_OFF : APP_PERIPHERAL_UNAVAILABLE);
    device_state_set_drain_state(capabilities.drain_available ? APP_PERIPHERAL_OFF : APP_PERIPHERAL_UNAVAILABLE);
    device_state_set_water_level_state(
        capabilities.water_sensor_enabled ? APP_WATER_LEVEL_OK : APP_WATER_LEVEL_DISABLED);
}

static void telemetry_task(void *arg)
{
    TickType_t last_wake = xTaskGetTickCount();
    uint32_t diagnostics_elapsed_ms = 0;
    (void)arg;

    while (true) {
        diagnostics_update_uptime();
        app_state_refresh_device_connection_mode();
        device_state_touch_last_seen();

        protocol_publish_status();
        protocol_publish_state();

        diagnostics_elapsed_ms += APP_STATUS_PUBLISH_INTERVAL_MS;
        if (diagnostics_elapsed_ms >= APP_DIAGNOSTICS_PUBLISH_INTERVAL_MS) {
            diagnostics_elapsed_ms = 0;
            protocol_publish_capabilities();
            protocol_publish_schedules();
            protocol_publish_events();
            protocol_publish_errors();
        }

        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(APP_STATUS_PUBLISH_INTERVAL_MS));
    }
}

void app_main(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    ESP_ERROR_CHECK(storage_init());
    ESP_ERROR_CHECK(device_state_init());
    ESP_ERROR_CHECK(app_state_init());
    ESP_ERROR_CHECK(capabilities_init());
    bootstrap_state_from_capabilities();
    ESP_ERROR_CHECK(diagnostics_init());
    ESP_ERROR_CHECK(commands_init());
    ESP_ERROR_CHECK(rs485_bridge_init());
    ESP_ERROR_CHECK(ota_init());
    ESP_ERROR_CHECK(schedules_init());
    ESP_ERROR_CHECK(protocol_init());
    ESP_ERROR_CHECK(schedules_start());
    ESP_ERROR_CHECK(wifi_manager_init());
    ESP_ERROR_CHECK(wifi_manager_start());
    ESP_ERROR_CHECK(local_server_init());
    ESP_ERROR_CHECK(local_server_start());
    ESP_ERROR_CHECK(mqtt_manager_init());
    ESP_ERROR_CHECK(mqtt_manager_start());

    diagnostics_record_event(
        "boot_complete",
        APP_EVENT_LEVEL_INFO,
        "Firmware pronto",
        "Inicializacao principal concluida");

    BaseType_t task_ok = xTaskCreate(
        telemetry_task,
        "telemetry_task",
        APP_MAIN_TASK_STACK_SIZE,
        NULL,
        4,
        NULL);

    if (task_ok != pdPASS) {
        ESP_LOGE(LOG_TAG_MAIN, "Falha ao criar telemetry_task");
    }

    ESP_LOGI(LOG_TAG_MAIN, "Firmware IHM ESP32-S3 iniciado com sucesso");
}
