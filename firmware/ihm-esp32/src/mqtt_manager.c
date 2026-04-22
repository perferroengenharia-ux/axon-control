#include "mqtt_manager.h"

#include <stdlib.h>
#include <string.h>

#include "esp_check.h"
#include "esp_event.h"
#include "esp_log.h"
#include "mqtt_client.h"

#include "app_state.h"
#include "certs.h"
#include "diagnostics.h"
#include "log_tags.h"
#include "protocol.h"
#include "protocol_topics.h"

static esp_mqtt_client_handle_t s_mqtt_client;
static bool s_mqtt_started;

static void mqtt_event_handler(
    void *handler_args,
    esp_event_base_t base,
    int32_t event_id,
    void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;
    protocol_topic_bundle_t topics = {0};
    (void)handler_args;
    (void)base;

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(LOG_TAG_MQTT, "MQTT conectado");
        app_state_set_mqtt_connected(true);
        diagnostics_set_transport_status(APP_TRANSPORT_CONNECTED);
        diagnostics_set_connection_summary("Cloud MQTT conectado");
        if (protocol_topics_build(&topics) == ESP_OK) {
            esp_mqtt_client_subscribe(s_mqtt_client, topics.commands, 1);
            esp_mqtt_client_subscribe(s_mqtt_client, topics.schedules, 1);
        }
        protocol_publish_full_snapshot();
        break;
    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(LOG_TAG_MQTT, "MQTT desconectado");
        app_state_set_mqtt_connected(false);
        diagnostics_set_transport_status(APP_TRANSPORT_DEGRADED);
        diagnostics_set_connection_summary("Cloud MQTT desconectado");
        break;
    case MQTT_EVENT_DATA: {
        size_t topic_len = (size_t)event->topic_len;
        size_t data_len = (size_t)event->data_len;
        char *topic = calloc(topic_len + 1, sizeof(char));
        char *payload = calloc(data_len + 1, sizeof(char));

        if (topic == NULL || payload == NULL) {
            free(topic);
            free(payload);
            diagnostics_record_error("mqtt_oom", "Memoria insuficiente para mensagem MQTT", true);
            break;
        }

        memcpy(topic, event->topic, topic_len);
        memcpy(payload, event->data, data_len);
        protocol_process_mqtt_message(topic, payload);
        free(topic);
        free(payload);
        break;
    }
    case MQTT_EVENT_ERROR:
        ESP_LOGE(LOG_TAG_MQTT, "Erro MQTT recebido");
        app_state_set_mqtt_connected(false);
        diagnostics_set_transport_status(APP_TRANSPORT_ERROR);
        diagnostics_record_error("mqtt_error", "Erro na camada MQTT", true);
        break;
    default:
        break;
    }
}

esp_err_t mqtt_manager_init(void)
{
    return ESP_OK;
}

esp_err_t mqtt_manager_start(void)
{
    app_runtime_context_t *runtime = app_state_get_context();
    esp_mqtt_client_config_t config = {0};

    if (s_mqtt_started) {
        return ESP_OK;
    }

    if (runtime == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (!runtime->mqtt_config.enabled || runtime->mqtt_config.broker_uri[0] == '\0') {
        ESP_LOGI(LOG_TAG_MQTT, "MQTT desabilitado ou sem broker configurado");
        return ESP_OK;
    }

    config.broker.address.uri = runtime->mqtt_config.broker_uri;
    config.broker.address.port = runtime->mqtt_config.port;
    config.credentials.username = runtime->mqtt_config.username[0] != '\0'
                                      ? runtime->mqtt_config.username
                                      : NULL;
    config.credentials.authentication.password = runtime->mqtt_config.password[0] != '\0'
                                                     ? runtime->mqtt_config.password
                                                     : NULL;
    config.session.keepalive = runtime->mqtt_config.keepalive_sec;
    if (runtime->mqtt_config.use_tls) {
        config.broker.verification.certificate = APP_ROOT_CA_PEM;
    }

    s_mqtt_client = esp_mqtt_client_init(&config);
    if (s_mqtt_client == NULL) {
        return ESP_ERR_NO_MEM;
    }

    ESP_RETURN_ON_ERROR(
        esp_mqtt_client_register_event(s_mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL),
        LOG_TAG_MQTT,
        "mqtt register");
    ESP_RETURN_ON_ERROR(esp_mqtt_client_start(s_mqtt_client), LOG_TAG_MQTT, "mqtt start");
    s_mqtt_started = true;
    diagnostics_set_transport_status(APP_TRANSPORT_CONNECTING);
    diagnostics_set_connection_summary("Conectando ao broker MQTT");
    return ESP_OK;
}

esp_err_t mqtt_manager_stop(void)
{
    if (!s_mqtt_started || s_mqtt_client == NULL) {
        return ESP_OK;
    }

    esp_err_t err = esp_mqtt_client_stop(s_mqtt_client);
    esp_mqtt_client_destroy(s_mqtt_client);
    s_mqtt_client = NULL;
    s_mqtt_started = false;
    app_state_set_mqtt_connected(false);
    return err;
}

bool mqtt_manager_is_connected(void)
{
    app_runtime_context_t *runtime = app_state_get_context();
    return runtime != NULL && runtime->mqtt_connected;
}

esp_err_t mqtt_manager_publish_json(const char *topic, const char *payload, int qos, bool retain)
{
    if (topic == NULL || payload == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (s_mqtt_client == NULL || !mqtt_manager_is_connected()) {
        return ESP_ERR_INVALID_STATE;
    }

    int message_id = esp_mqtt_client_publish(s_mqtt_client, topic, payload, 0, qos, retain);
    return message_id >= 0 ? ESP_OK : ESP_FAIL;
}
