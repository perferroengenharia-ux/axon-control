#include "protocol.h"

#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "esp_check.h"
#include "esp_log.h"
#include "esp_random.h"

#include "app_state.h"
#include "commands.h"
#include "diagnostics.h"
#include "log_tags.h"
#include "mqtt_manager.h"
#include "protocol_json.h"
#include "protocol_topics.h"

static void ensure_command_identity(app_command_t *command);
static esp_err_t finalize_command(
    const app_command_t *command,
    const command_result_t *result,
    char **response_json);
static esp_err_t execute_schedule_sync(
    const char *json,
    app_command_source_t source,
    char **response_json)
{
    app_command_t command = {0};
    command_result_t result = {0};
    esp_err_t err = protocol_json_parse_schedule_payload(json, &command.schedules);

    if (err != ESP_OK) {
        return err;
    }

    command.type = APP_COMMAND_SYNC_SCHEDULES;
    command.source = source;
    ensure_command_identity(&command);

    (void)commands_execute(&command, &result);
    return finalize_command(&command, &result, response_json);
}

static void ensure_command_identity(app_command_t *command)
{
    app_runtime_context_t *runtime = app_state_get_context();

    if (command->id[0] == '\0') {
        snprintf(command->id, sizeof(command->id), "cmd-%08" PRIx32, esp_random());
    }

    if (command->device_id[0] == '\0' && runtime != NULL) {
        strncpy(command->device_id, runtime->mqtt_config.device_id, sizeof(command->device_id) - 1);
    }

    if (command->timestamp == 0) {
        command->timestamp = time(NULL);
    }
}

static esp_err_t publish_payload(
    protocol_topic_kind_t topic_kind,
    esp_err_t (*builder)(char **json_payload))
{
    char *json = NULL;
    protocol_topic_bundle_t topics = {0};
    const char *topic = NULL;
    esp_err_t err = builder(&json);

    if (err != ESP_OK) {
        return err;
    }

    err = protocol_topics_build(&topics);
    if (err != ESP_OK) {
        free(json);
        return err;
    }

    switch (topic_kind) {
    case PROTOCOL_TOPIC_STATUS:
        topic = topics.status;
        break;
    case PROTOCOL_TOPIC_STATE:
        topic = topics.state;
        break;
    case PROTOCOL_TOPIC_CAPABILITIES:
        topic = topics.capabilities;
        break;
    case PROTOCOL_TOPIC_EVENTS:
        topic = topics.events;
        break;
    case PROTOCOL_TOPIC_ERRORS:
        topic = topics.errors;
        break;
    case PROTOCOL_TOPIC_SCHEDULES:
        topic = topics.schedules;
        break;
    default:
        free(json);
        return ESP_ERR_INVALID_ARG;
    }

    err = mqtt_manager_publish_json(topic, json, 1, false);
    free(json);
    return err;
}

static esp_err_t finalize_command(
    const app_command_t *command,
    const command_result_t *result,
    char **response_json)
{
    if (response_json != NULL) {
        ESP_RETURN_ON_ERROR(
            protocol_json_serialize_command_ack(command, result, response_json),
            "protocol",
            "ack");
    }

    ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_set_last_sync_now());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_status());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_state());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_events());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_errors());

    if (command->type == APP_COMMAND_REQUEST_CAPABILITIES) {
        ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_capabilities());
    }

    if (command->type == APP_COMMAND_SYNC_SCHEDULES) {
        ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_schedules());
    }

    return result->status == APP_LAST_COMMAND_FAILED ? ESP_FAIL : ESP_OK;
}

esp_err_t protocol_init(void)
{
    return ESP_OK;
}

esp_err_t protocol_handle_command_json(
    const char *json,
    app_command_source_t source,
    char **response_json)
{
    app_command_t command = {0};
    command_result_t result = {0};
    esp_err_t err = protocol_json_parse_command_request(json, &command);

    if (err != ESP_OK) {
        return err;
    }

    command.source = source;
    ensure_command_identity(&command);

    (void)commands_execute(&command, &result);
    return finalize_command(&command, &result, response_json);
}

esp_err_t protocol_handle_schedules_json(const char *json, char **response_json)
{
    return execute_schedule_sync(json, APP_COMMAND_SOURCE_LOCAL, response_json);
}

esp_err_t protocol_handle_ota_json(const char *json, char **response_json)
{
    app_command_t command = {0};
    command_result_t result = {0};
    esp_err_t err = protocol_json_parse_ota_request(json, &command.ota_request);

    if (err != ESP_OK) {
        return err;
    }

    command.type = APP_COMMAND_START_OTA;
    command.source = APP_COMMAND_SOURCE_LOCAL;
    ensure_command_identity(&command);

    (void)commands_execute(&command, &result);
    return finalize_command(&command, &result, response_json);
}

esp_err_t protocol_process_mqtt_message(const char *topic, const char *payload)
{
    protocol_topic_bundle_t topics = {0};
    char *response_json = NULL;
    esp_err_t err = protocol_topics_build(&topics);

    if (err != ESP_OK || topic == NULL || payload == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (strcmp(topic, topics.commands) == 0) {
        err = protocol_handle_command_json(payload, APP_COMMAND_SOURCE_MQTT, &response_json);
    } else if (strcmp(topic, topics.schedules) == 0) {
        err = execute_schedule_sync(payload, APP_COMMAND_SOURCE_MQTT, &response_json);
    } else {
        return ESP_ERR_NOT_SUPPORTED;
    }

    if (response_json != NULL) {
        ESP_LOGI(LOG_TAG_PROTOCOL, "ACK local do comando MQTT: %s", response_json);
        free(response_json);
    }

    return err;
}

esp_err_t protocol_build_status_json(char **out_json)
{
    return protocol_json_serialize_status(out_json);
}

esp_err_t protocol_build_state_json(char **out_json)
{
    return protocol_json_serialize_state(out_json);
}

esp_err_t protocol_build_capabilities_json(char **out_json)
{
    return protocol_json_serialize_capabilities(out_json);
}

esp_err_t protocol_build_schedules_json(char **out_json)
{
    return protocol_json_serialize_schedules(out_json);
}

esp_err_t protocol_build_diagnostics_json(char **out_json)
{
    return protocol_json_serialize_diagnostics(out_json);
}

esp_err_t protocol_build_events_json(char **out_json)
{
    return protocol_json_serialize_events(out_json);
}

esp_err_t protocol_build_errors_json(char **out_json)
{
    return protocol_json_serialize_errors(out_json);
}

esp_err_t protocol_publish_status(void)
{
    return publish_payload(PROTOCOL_TOPIC_STATUS, protocol_json_serialize_status);
}

esp_err_t protocol_publish_state(void)
{
    return publish_payload(PROTOCOL_TOPIC_STATE, protocol_json_serialize_state);
}

esp_err_t protocol_publish_capabilities(void)
{
    return publish_payload(PROTOCOL_TOPIC_CAPABILITIES, protocol_json_serialize_capabilities);
}

esp_err_t protocol_publish_schedules(void)
{
    return publish_payload(PROTOCOL_TOPIC_SCHEDULES, protocol_json_serialize_schedules);
}

esp_err_t protocol_publish_events(void)
{
    return publish_payload(PROTOCOL_TOPIC_EVENTS, protocol_json_serialize_events);
}

esp_err_t protocol_publish_errors(void)
{
    return publish_payload(PROTOCOL_TOPIC_ERRORS, protocol_json_serialize_errors);
}

esp_err_t protocol_publish_diagnostics(void)
{
    return ESP_ERR_NOT_SUPPORTED;
}

esp_err_t protocol_publish_full_snapshot(void)
{
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_status());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_state());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_capabilities());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_schedules());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_events());
    ESP_ERROR_CHECK_WITHOUT_ABORT(protocol_publish_errors());
    return ESP_OK;
}
