#include "storage.h"

#include <string.h>

#include "esp_log.h"
#include "nvs.h"

#include "app_config.h"
#include "log_tags.h"

static esp_err_t load_blob(
    const char *namespace_name,
    const char *key,
    void *buffer,
    size_t expected_size)
{
    nvs_handle_t handle = 0;
    size_t required_size = expected_size;
    esp_err_t err = nvs_open(namespace_name, NVS_READONLY, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_get_blob(handle, key, buffer, &required_size);
    nvs_close(handle);

    if (err != ESP_OK) {
        return err;
    }

    if (required_size != expected_size) {
        memset(buffer, 0, expected_size);
        return ESP_ERR_INVALID_SIZE;
    }

    return ESP_OK;
}

static esp_err_t save_blob(
    const char *namespace_name,
    const char *key,
    const void *buffer,
    size_t size)
{
    nvs_handle_t handle = 0;
    esp_err_t err = nvs_open(namespace_name, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        return err;
    }

    err = nvs_set_blob(handle, key, buffer, size);
    if (err == ESP_OK) {
        err = nvs_commit(handle);
    }

    nvs_close(handle);
    return err;
}

esp_err_t storage_init(void)
{
    ESP_LOGI(LOG_TAG_STORAGE, "Storage pronto para leitura/escrita em NVS");
    return ESP_OK;
}

esp_err_t storage_load_wifi_config(app_wifi_config_t *config)
{
    if (config == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return load_blob(APP_NVS_NAMESPACE_CONFIG, "wifi_cfg", config, sizeof(*config));
}

esp_err_t storage_save_wifi_config(const app_wifi_config_t *config)
{
    if (config == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return save_blob(APP_NVS_NAMESPACE_CONFIG, "wifi_cfg", config, sizeof(*config));
}

esp_err_t storage_load_mqtt_config(app_mqtt_config_t *config)
{
    if (config == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return load_blob(APP_NVS_NAMESPACE_CONFIG, "mqtt_cfg", config, sizeof(*config));
}

esp_err_t storage_save_mqtt_config(const app_mqtt_config_t *config)
{
    if (config == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return save_blob(APP_NVS_NAMESPACE_CONFIG, "mqtt_cfg", config, sizeof(*config));
}

esp_err_t storage_load_local_server_config(app_local_server_config_t *config)
{
    if (config == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return load_blob(APP_NVS_NAMESPACE_CONFIG, "local_cfg", config, sizeof(*config));
}

esp_err_t storage_save_local_server_config(const app_local_server_config_t *config)
{
    if (config == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return save_blob(APP_NVS_NAMESPACE_CONFIG, "local_cfg", config, sizeof(*config));
}

esp_err_t storage_load_schedules(app_schedule_table_t *table)
{
    if (table == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return load_blob(APP_NVS_NAMESPACE_SCHEDULES, "table", table, sizeof(*table));
}

esp_err_t storage_save_schedules(const app_schedule_table_t *table)
{
    if (table == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    return save_blob(APP_NVS_NAMESPACE_SCHEDULES, "table", table, sizeof(*table));
}

