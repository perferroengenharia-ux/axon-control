#include "capabilities.h"

#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static device_capabilities_t s_capabilities;
static SemaphoreHandle_t s_capabilities_lock;

esp_err_t capabilities_init(void)
{
    if (s_capabilities_lock == NULL) {
        s_capabilities_lock = xSemaphoreCreateMutex();
        if (s_capabilities_lock == NULL) {
            return ESP_ERR_NO_MEM;
        }
    }

    memset(&s_capabilities, 0, sizeof(s_capabilities));
    s_capabilities.f_min_hz = 20;
    s_capabilities.f_max_hz = 60;
    s_capabilities.pump_available = true;
    s_capabilities.swing_available = true;
    s_capabilities.drain_available = true;
    s_capabilities.water_sensor_enabled = true;
    s_capabilities.drain_mode = APP_DRAIN_MODE_TIMED;
    s_capabilities.drain_time_sec = 45;
    s_capabilities.drain_return_delay_sec = 10;
    s_capabilities.pump_logic_mode = APP_PUMP_LOGIC_LINKED;
    s_capabilities.water_sensor_mode = APP_WATER_SENSOR_MODE_NORMAL;
    s_capabilities.pre_wet_sec = 20;
    s_capabilities.dry_panel_sec = 45;
    s_capabilities.dry_panel_freq_hz = 28;
    s_capabilities.resume_mode = APP_RESUME_LAST_STATE;
    s_capabilities.auto_reset_mode = APP_AUTO_RESET_ENABLED;

    return ESP_OK;
}

esp_err_t capabilities_get_snapshot(device_capabilities_t *capabilities)
{
    if (capabilities == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (xSemaphoreTake(s_capabilities_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    memcpy(capabilities, &s_capabilities, sizeof(*capabilities));

    xSemaphoreGive(s_capabilities_lock);
    return ESP_OK;
}

esp_err_t capabilities_set_snapshot(const device_capabilities_t *capabilities)
{
    if (capabilities == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (xSemaphoreTake(s_capabilities_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    memcpy(&s_capabilities, capabilities, sizeof(s_capabilities));

    xSemaphoreGive(s_capabilities_lock);
    return ESP_OK;
}

