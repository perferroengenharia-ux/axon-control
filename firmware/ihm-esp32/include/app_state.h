#ifndef APP_STATE_H
#define APP_STATE_H

#include <stdbool.h>

#include "esp_err.h"

#include "app_types.h"

typedef struct {
    app_wifi_config_t wifi_config;
    app_mqtt_config_t mqtt_config;
    app_local_server_config_t local_server_config;
    bool wifi_sta_connected;
    bool wifi_ap_active;
    bool mqtt_connected;
    bool local_server_running;
} app_runtime_context_t;

esp_err_t app_state_init(void);
app_runtime_context_t *app_state_get_context(void);

esp_err_t app_state_set_wifi_sta_connected(bool connected);
esp_err_t app_state_set_wifi_ap_active(bool active);
esp_err_t app_state_set_mqtt_connected(bool connected);
esp_err_t app_state_set_local_server_running(bool running);

app_connection_mode_t app_state_resolve_connection_mode(void);
esp_err_t app_state_refresh_device_connection_mode(void);

#endif

