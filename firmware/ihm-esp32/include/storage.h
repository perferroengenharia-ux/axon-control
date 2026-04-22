#ifndef STORAGE_H
#define STORAGE_H

#include "esp_err.h"

#include "app_types.h"

esp_err_t storage_init(void);

esp_err_t storage_load_wifi_config(app_wifi_config_t *config);
esp_err_t storage_save_wifi_config(const app_wifi_config_t *config);

esp_err_t storage_load_mqtt_config(app_mqtt_config_t *config);
esp_err_t storage_save_mqtt_config(const app_mqtt_config_t *config);

esp_err_t storage_load_local_server_config(app_local_server_config_t *config);
esp_err_t storage_save_local_server_config(const app_local_server_config_t *config);

esp_err_t storage_load_schedules(app_schedule_table_t *table);
esp_err_t storage_save_schedules(const app_schedule_table_t *table);

#endif

