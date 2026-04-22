#ifndef DEVICE_STATE_H
#define DEVICE_STATE_H

#include <stdbool.h>

#include "esp_err.h"

#include "app_types.h"

esp_err_t device_state_init(void);
esp_err_t device_state_get_snapshot(device_state_t *state);
esp_err_t device_state_set_online(bool online);
esp_err_t device_state_set_connection_mode(app_connection_mode_t mode);
esp_err_t device_state_set_power(bool running);
esp_err_t device_state_set_current_frequency(int frequency_hz);
esp_err_t device_state_set_target_frequency(int frequency_hz);
esp_err_t device_state_set_pump_state(app_peripheral_state_t state);
esp_err_t device_state_set_swing_state(app_peripheral_state_t state);
esp_err_t device_state_set_drain_state(app_peripheral_state_t state);
esp_err_t device_state_set_water_level_state(app_water_level_state_t state);
esp_err_t device_state_set_command_status(app_last_command_status_t status);
esp_err_t device_state_set_error_code(const char *error_code);
esp_err_t device_state_set_ready_state(app_ready_state_t ready_state);
esp_err_t device_state_touch_last_seen(void);

#endif

