#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include <stdbool.h>

#include "esp_err.h"

esp_err_t mqtt_manager_init(void);
esp_err_t mqtt_manager_start(void);
esp_err_t mqtt_manager_stop(void);
bool mqtt_manager_is_connected(void);
esp_err_t mqtt_manager_publish_json(const char *topic, const char *payload, int qos, bool retain);

#endif

