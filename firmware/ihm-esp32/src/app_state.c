#include "app_state.h"

#include <stdio.h>
#include <string.h>

#include "esp_log.h"
#include "esp_mac.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "device_state.h"
#include "log_tags.h"
#include "storage.h"

static app_runtime_context_t s_runtime;
static SemaphoreHandle_t s_runtime_lock;

static void fill_default_device_id(char *device_id, size_t device_id_len)
{
    uint8_t mac[6] = {0};
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    snprintf(device_id, device_id_len, "ihm-%02X%02X%02X", mac[3], mac[4], mac[5]);
}

static void fill_default_ap_ssid(char *ap_ssid, size_t ap_ssid_len)
{
    uint8_t mac[6] = {0};
    esp_read_mac(mac, ESP_MAC_WIFI_SOFTAP);
    snprintf(ap_ssid, ap_ssid_len, "%s-%02X%02X%02X", APP_AP_SSID_PREFIX, mac[3], mac[4], mac[5]);
}

static void load_or_default_wifi_config(app_wifi_config_t *config)
{
    memset(config, 0, sizeof(*config));
    config->sta_enabled = false;
    config->ap_fallback_enabled = APP_WIFI_AP_FALLBACK_DEFAULT;
    config->max_retry = APP_WIFI_MAXIMUM_RETRY;
    strncpy(config->sta_ssid, APP_WIFI_STA_SSID_DEFAULT, sizeof(config->sta_ssid) - 1);
    strncpy(config->sta_password, APP_WIFI_STA_PASSWORD_DEFAULT, sizeof(config->sta_password) - 1);
    strncpy(config->ap_password, APP_AP_PASSWORD_DEFAULT, sizeof(config->ap_password) - 1);
    fill_default_ap_ssid(config->ap_ssid, sizeof(config->ap_ssid));

    if (storage_load_wifi_config(config) == ESP_OK) {
        return;
    }

    if (config->ap_ssid[0] == '\0') {
        fill_default_ap_ssid(config->ap_ssid, sizeof(config->ap_ssid));
    }
}

static void load_or_default_mqtt_config(app_mqtt_config_t *config)
{
    memset(config, 0, sizeof(*config));
    config->enabled = APP_MQTT_ENABLED_DEFAULT;
    config->use_tls = APP_MQTT_USE_TLS_DEFAULT;
    config->port = config->use_tls ? 8883 : 1883;
    config->keepalive_sec = APP_MQTT_KEEPALIVE_SEC_DEFAULT;
    strncpy(config->broker_uri, APP_MQTT_URI_DEFAULT, sizeof(config->broker_uri) - 1);
    strncpy(config->username, APP_MQTT_USERNAME_DEFAULT, sizeof(config->username) - 1);
    strncpy(config->password, APP_MQTT_PASSWORD_DEFAULT, sizeof(config->password) - 1);
    strncpy(config->topic_prefix, APP_TOPIC_PREFIX_DEFAULT, sizeof(config->topic_prefix) - 1);
    fill_default_device_id(config->device_id, sizeof(config->device_id));

    if (storage_load_mqtt_config(config) != ESP_OK) {
        return;
    }

    if (config->device_id[0] == '\0') {
        fill_default_device_id(config->device_id, sizeof(config->device_id));
    }

    if (config->topic_prefix[0] == '\0') {
        strncpy(config->topic_prefix, APP_TOPIC_PREFIX_DEFAULT, sizeof(config->topic_prefix) - 1);
    }
}

static void load_or_default_local_server_config(app_local_server_config_t *config)
{
    memset(config, 0, sizeof(*config));
    config->enabled = true;
    config->port = APP_LOCAL_SERVER_PORT_DEFAULT;
    config->enable_cors = APP_LOCAL_SERVER_ENABLE_CORS_DEFAULT;

    (void)storage_load_local_server_config(config);
}

esp_err_t app_state_init(void)
{
    if (s_runtime_lock == NULL) {
        s_runtime_lock = xSemaphoreCreateMutex();
        if (s_runtime_lock == NULL) {
            return ESP_ERR_NO_MEM;
        }
    }

    memset(&s_runtime, 0, sizeof(s_runtime));

    load_or_default_wifi_config(&s_runtime.wifi_config);
    load_or_default_mqtt_config(&s_runtime.mqtt_config);
    load_or_default_local_server_config(&s_runtime.local_server_config);

    s_runtime.wifi_sta_connected = false;
    s_runtime.wifi_ap_active = false;
    s_runtime.mqtt_connected = false;
    s_runtime.local_server_running = false;

    ESP_LOGI(
        LOG_TAG_APP_STATE,
        "Runtime pronto: deviceId=%s topicPrefix=%s mqttEnabled=%d",
        s_runtime.mqtt_config.device_id,
        s_runtime.mqtt_config.topic_prefix,
        s_runtime.mqtt_config.enabled);

    return app_state_refresh_device_connection_mode();
}

app_runtime_context_t *app_state_get_context(void)
{
    return &s_runtime;
}

static esp_err_t set_flag(bool *target, bool value)
{
    if (s_runtime_lock == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (xSemaphoreTake(s_runtime_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    *target = value;

    xSemaphoreGive(s_runtime_lock);
    return app_state_refresh_device_connection_mode();
}

esp_err_t app_state_set_wifi_sta_connected(bool connected)
{
    return set_flag(&s_runtime.wifi_sta_connected, connected);
}

esp_err_t app_state_set_wifi_ap_active(bool active)
{
    return set_flag(&s_runtime.wifi_ap_active, active);
}

esp_err_t app_state_set_mqtt_connected(bool connected)
{
    return set_flag(&s_runtime.mqtt_connected, connected);
}

esp_err_t app_state_set_local_server_running(bool running)
{
    return set_flag(&s_runtime.local_server_running, running);
}

app_connection_mode_t app_state_resolve_connection_mode(void)
{
    if (s_runtime.mqtt_connected) {
        return APP_CONNECTION_MODE_CLOUD;
    }

    if (s_runtime.wifi_sta_connected) {
        return APP_CONNECTION_MODE_LOCAL_LAN;
    }

    if (s_runtime.wifi_ap_active) {
        return APP_CONNECTION_MODE_LOCAL_AP;
    }

    return APP_CONNECTION_MODE_LOCAL_AP;
}

esp_err_t app_state_refresh_device_connection_mode(void)
{
    device_state_t snapshot = {0};
    app_connection_mode_t connection_mode = app_state_resolve_connection_mode();
    bool online = s_runtime.mqtt_connected || s_runtime.wifi_sta_connected || s_runtime.wifi_ap_active;

    ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_connection_mode(connection_mode));
    ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_online(online));
    ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_get_snapshot(&snapshot));

    if (!online) {
        ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_ready_state(APP_READY_STATE_OFFLINE));
    } else if (snapshot.ready_state == APP_READY_STATE_OFFLINE) {
        ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_ready_state(
            snapshot.inverter_running ? APP_READY_STATE_RUNNING : APP_READY_STATE_READY));
    }

    return ESP_OK;
}

