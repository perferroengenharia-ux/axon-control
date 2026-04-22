#include "wifi_manager.h"

#include <string.h>

#include "esp_check.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"

#include "app_state.h"
#include "diagnostics.h"
#include "log_tags.h"

static bool s_wifi_initialized;
static bool s_sta_connected;
static bool s_ap_active;
static int s_retry_count;
static esp_event_handler_instance_t s_wifi_event_instance;
static esp_event_handler_instance_t s_ip_event_instance;

static void wifi_event_handler(
    void *arg,
    esp_event_base_t event_base,
    int32_t event_id,
    void *event_data)
{
    app_runtime_context_t *runtime = app_state_get_context();
    (void)arg;
    (void)event_base;
    (void)event_data;

    if (runtime == NULL) {
        return;
    }

    switch (event_id) {
    case WIFI_EVENT_STA_START:
        if (runtime->wifi_config.sta_enabled && runtime->wifi_config.sta_ssid[0] != '\0') {
            ESP_LOGI(LOG_TAG_WIFI, "Wi-Fi STA iniciado, conectando em %s", runtime->wifi_config.sta_ssid);
            esp_wifi_connect();
            diagnostics_set_connection_summary("Conectando no Wi-Fi STA");
        }
        break;
    case WIFI_EVENT_STA_DISCONNECTED:
        s_sta_connected = false;
        app_state_set_wifi_sta_connected(false);
        diagnostics_set_connection_summary("Wi-Fi STA desconectado");
        if (s_retry_count < runtime->wifi_config.max_retry) {
            s_retry_count++;
            esp_wifi_connect();
            diagnostics_set_transport_status(APP_TRANSPORT_DEGRADED);
        } else {
            diagnostics_set_transport_status(APP_TRANSPORT_ERROR);
            diagnostics_record_error("wifi_sta_disconnected", "Falha persistente na conexao Wi-Fi", true);
        }
        break;
    case WIFI_EVENT_AP_START:
        s_ap_active = true;
        app_state_set_wifi_ap_active(true);
        diagnostics_record_event("ap_started", APP_EVENT_LEVEL_INFO, "AP ativo", "Ponto de acesso local iniciado");
        break;
    case WIFI_EVENT_AP_STOP:
        s_ap_active = false;
        app_state_set_wifi_ap_active(false);
        diagnostics_record_event("ap_stopped", APP_EVENT_LEVEL_WARNING, "AP parado", "Ponto de acesso local interrompido");
        break;
    default:
        break;
    }
}

static void ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    (void)arg;
    (void)event_base;
    (void)event_data;

    if (event_id == IP_EVENT_STA_GOT_IP) {
        s_retry_count = 0;
        s_sta_connected = true;
        app_state_set_wifi_sta_connected(true);
        diagnostics_set_connection_summary("Wi-Fi STA conectado");
        diagnostics_set_transport_status(APP_TRANSPORT_CONNECTED);
        diagnostics_record_event("wifi_connected", APP_EVENT_LEVEL_INFO, "Wi-Fi conectado", "Conexao STA estabelecida");
    }
}

esp_err_t wifi_manager_init(void)
{
    if (s_wifi_initialized) {
        return ESP_OK;
    }

    ESP_ERROR_CHECK_WITHOUT_ABORT(esp_netif_init());
    esp_err_t loop_err = esp_event_loop_create_default();
    if (loop_err != ESP_OK && loop_err != ESP_ERR_INVALID_STATE) {
        return loop_err;
    }
    if (loop_err == ESP_ERR_INVALID_STATE) {
        ESP_LOGW(LOG_TAG_WIFI, "Event loop default ja existente");
    }

    esp_netif_create_default_wifi_sta();
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(esp_wifi_init(&cfg), LOG_TAG_WIFI, "wifi init");
    ESP_RETURN_ON_ERROR(
        esp_event_handler_instance_register(
            WIFI_EVENT,
            ESP_EVENT_ANY_ID,
            &wifi_event_handler,
            NULL,
            &s_wifi_event_instance),
        LOG_TAG_WIFI,
        "wifi handler");
    ESP_RETURN_ON_ERROR(
        esp_event_handler_instance_register(
            IP_EVENT,
            IP_EVENT_STA_GOT_IP,
            &ip_event_handler,
            NULL,
            &s_ip_event_instance),
        LOG_TAG_WIFI,
        "ip handler");

    ESP_RETURN_ON_ERROR(esp_wifi_set_storage(WIFI_STORAGE_RAM), LOG_TAG_WIFI, "wifi storage");
    ESP_RETURN_ON_ERROR(esp_wifi_set_ps(WIFI_PS_NONE), LOG_TAG_WIFI, "wifi ps");

    s_wifi_initialized = true;
    diagnostics_set_transport_status(APP_TRANSPORT_CONNECTING);
    return ESP_OK;
}

esp_err_t wifi_manager_start(void)
{
    app_runtime_context_t *runtime = app_state_get_context();
    wifi_mode_t mode = WIFI_MODE_NULL;
    wifi_config_t sta_config = {0};
    wifi_config_t ap_config = {0};

    if (!s_wifi_initialized || runtime == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (runtime->wifi_config.sta_enabled && runtime->wifi_config.sta_ssid[0] != '\0') {
        mode = runtime->wifi_config.ap_fallback_enabled ? WIFI_MODE_APSTA : WIFI_MODE_STA;
        strncpy((char *)sta_config.sta.ssid, runtime->wifi_config.sta_ssid, sizeof(sta_config.sta.ssid) - 1);
        strncpy(
            (char *)sta_config.sta.password,
            runtime->wifi_config.sta_password,
            sizeof(sta_config.sta.password) - 1);
        sta_config.sta.failure_retry_cnt = runtime->wifi_config.max_retry;
        sta_config.sta.threshold.authmode = runtime->wifi_config.sta_password[0] != '\0'
                                                ? WIFI_AUTH_WPA2_PSK
                                                : WIFI_AUTH_OPEN;
        sta_config.sta.pmf_cfg.capable = true;
        sta_config.sta.pmf_cfg.required = false;
    } else if (runtime->wifi_config.ap_fallback_enabled) {
        mode = WIFI_MODE_AP;
    } else {
        return ESP_ERR_INVALID_STATE;
    }

    if (runtime->wifi_config.ap_fallback_enabled) {
        strncpy((char *)ap_config.ap.ssid, runtime->wifi_config.ap_ssid, sizeof(ap_config.ap.ssid) - 1);
        strncpy(
            (char *)ap_config.ap.password,
            runtime->wifi_config.ap_password,
            sizeof(ap_config.ap.password) - 1);
        ap_config.ap.ssid_len = strlen(runtime->wifi_config.ap_ssid);
        ap_config.ap.max_connection = 4;
        ap_config.ap.authmode = runtime->wifi_config.ap_password[0] != '\0'
                                    ? WIFI_AUTH_WPA_WPA2_PSK
                                    : WIFI_AUTH_OPEN;
    }

    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(mode), LOG_TAG_WIFI, "wifi mode");
    if (mode == WIFI_MODE_STA || mode == WIFI_MODE_APSTA) {
        ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &sta_config), LOG_TAG_WIFI, "sta cfg");
    }
    if (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA) {
        ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_AP, &ap_config), LOG_TAG_WIFI, "ap cfg");
    }

    ESP_RETURN_ON_ERROR(esp_wifi_start(), LOG_TAG_WIFI, "wifi start");
    diagnostics_record_event("wifi_started", APP_EVENT_LEVEL_INFO, "Wi-Fi iniciado", "Pilha Wi-Fi inicializada");
    return ESP_OK;
}

esp_err_t wifi_manager_stop(void)
{
    if (!s_wifi_initialized) {
        return ESP_OK;
    }

    s_sta_connected = false;
    s_ap_active = false;
    app_state_set_wifi_sta_connected(false);
    app_state_set_wifi_ap_active(false);
    return esp_wifi_stop();
}

bool wifi_manager_is_sta_connected(void)
{
    return s_sta_connected;
}

bool wifi_manager_is_ap_active(void)
{
    return s_ap_active;
}
