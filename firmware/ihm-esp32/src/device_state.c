#include "device_state.h"

#include <string.h>
#include <time.h>

#include "esp_check.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static device_state_t s_state;
static SemaphoreHandle_t s_state_lock;
static const char *TAG = "device_state";

static esp_err_t with_lock(void)
{
    if (s_state_lock == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (xSemaphoreTake(s_state_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    return ESP_OK;
}

static void release_lock(void)
{
    xSemaphoreGive(s_state_lock);
}

esp_err_t device_state_init(void)
{
    if (s_state_lock == NULL) {
        s_state_lock = xSemaphoreCreateMutex();
        if (s_state_lock == NULL) {
            return ESP_ERR_NO_MEM;
        }
    }

    memset(&s_state, 0, sizeof(s_state));
    s_state.device_online = false;
    s_state.connection_mode = APP_CONNECTION_MODE_LOCAL_AP;
    s_state.inverter_running = false;
    s_state.freq_current_hz = 0;
    s_state.freq_target_hz = 30;
    s_state.pump_state = APP_PERIPHERAL_OFF;
    s_state.swing_state = APP_PERIPHERAL_OFF;
    s_state.drain_state = APP_PERIPHERAL_OFF;
    s_state.water_level_state = APP_WATER_LEVEL_UNKNOWN;
    s_state.last_seen = time(NULL);
    s_state.last_command_status = APP_LAST_COMMAND_IDLE;
    s_state.last_error_code[0] = '\0';
    s_state.ready_state = APP_READY_STATE_OFFLINE;

    return ESP_OK;
}

esp_err_t device_state_get_snapshot(device_state_t *state)
{
    if (state == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_get_snapshot lock failed");
    memcpy(state, &s_state, sizeof(*state));
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_online(bool online)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_online lock failed");
    s_state.device_online = online;
    if (!online) {
        s_state.ready_state = APP_READY_STATE_OFFLINE;
    }
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_connection_mode(app_connection_mode_t mode)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_connection_mode lock failed");
    s_state.connection_mode = mode;
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_power(bool running)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_power lock failed");
    s_state.inverter_running = running;
    s_state.ready_state = running ? APP_READY_STATE_RUNNING : APP_READY_STATE_READY;
    if (!running) {
        s_state.freq_current_hz = 0;
        if (s_state.drain_state == APP_PERIPHERAL_OFF) {
            s_state.pump_state = APP_PERIPHERAL_OFF;
        }
    } else if (s_state.freq_current_hz <= 0) {
        s_state.freq_current_hz = s_state.freq_target_hz;
    }
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_current_frequency(int frequency_hz)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_current_frequency lock failed");
    s_state.freq_current_hz = frequency_hz;
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_target_frequency(int frequency_hz)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_target_frequency lock failed");
    s_state.freq_target_hz = frequency_hz;
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_pump_state(app_peripheral_state_t state)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_pump_state lock failed");
    s_state.pump_state = state;
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_swing_state(app_peripheral_state_t state)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_swing_state lock failed");
    s_state.swing_state = state;
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_drain_state(app_peripheral_state_t state)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_drain_state lock failed");
    s_state.drain_state = state;
    if (state == APP_PERIPHERAL_ON) {
        s_state.ready_state = APP_READY_STATE_DRAINING;
    }
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_water_level_state(app_water_level_state_t state)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_water_level_state lock failed");
    s_state.water_level_state = state;
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_command_status(app_last_command_status_t status)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_command_status lock failed");
    s_state.last_command_status = status;
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_error_code(const char *error_code)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_error_code lock failed");
    if (error_code == NULL) {
        s_state.last_error_code[0] = '\0';
    } else {
        strncpy(s_state.last_error_code, error_code, sizeof(s_state.last_error_code) - 1);
        s_state.last_error_code[sizeof(s_state.last_error_code) - 1] = '\0';
    }
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_set_ready_state(app_ready_state_t ready_state)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_set_ready_state lock failed");
    s_state.ready_state = ready_state;
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}

esp_err_t device_state_touch_last_seen(void)
{
    ESP_RETURN_ON_ERROR(with_lock(), TAG, "device_state_touch_last_seen lock failed");
    s_state.last_seen = time(NULL);
    release_lock();
    return ESP_OK;
}
