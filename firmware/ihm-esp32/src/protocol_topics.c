#include "protocol_topics.h"

#include <stdio.h>
#include <string.h>

#include "esp_check.h"
#include "app_state.h"

static esp_err_t write_topic(char *buffer, size_t buffer_len, const char *prefix, const char *device_id, const char *suffix)
{
    int written = snprintf(buffer, buffer_len, "%s/%s/%s", prefix, device_id, suffix);
    if (written < 0 || (size_t)written >= buffer_len) {
        return ESP_ERR_INVALID_SIZE;
    }
    return ESP_OK;
}

static void trim_slashes(const char *input, char *output, size_t output_len)
{
    size_t start = 0;
    size_t end = input != NULL ? strlen(input) : 0;

    while (start < end && input[start] == '/') {
        start++;
    }
    while (end > start && input[end - 1] == '/') {
        end--;
    }

    size_t copy_len = end - start;
    if (copy_len >= output_len) {
        copy_len = output_len - 1;
    }

    if (copy_len > 0) {
        memcpy(output, input + start, copy_len);
    }
    output[copy_len] = '\0';
}

esp_err_t protocol_topics_build(protocol_topic_bundle_t *topics)
{
    char prefix[APP_TOPIC_PREFIX_MAX_LEN + 1] = {0};
    char device_id[APP_DEVICE_ID_MAX_LEN + 1] = {0};
    app_runtime_context_t *runtime = app_state_get_context();

    if (topics == NULL || runtime == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    trim_slashes(runtime->mqtt_config.topic_prefix, prefix, sizeof(prefix));
    trim_slashes(runtime->mqtt_config.device_id, device_id, sizeof(device_id));

    int written = snprintf(topics->base, sizeof(topics->base), "%s/%s", prefix, device_id);
    if (written < 0 || (size_t)written >= sizeof(topics->base)) {
        return ESP_ERR_INVALID_SIZE;
    }

    ESP_RETURN_ON_ERROR(
        write_topic(topics->status, sizeof(topics->status), prefix, device_id, "status"),
        "protocol_topics",
        "status");
    ESP_RETURN_ON_ERROR(
        write_topic(topics->state, sizeof(topics->state), prefix, device_id, "state"),
        "protocol_topics",
        "state");
    ESP_RETURN_ON_ERROR(
        write_topic(topics->capabilities, sizeof(topics->capabilities), prefix, device_id, "capabilities"),
        "protocol_topics",
        "capabilities");
    ESP_RETURN_ON_ERROR(
        write_topic(topics->commands, sizeof(topics->commands), prefix, device_id, "commands"),
        "protocol_topics",
        "commands");
    ESP_RETURN_ON_ERROR(
        write_topic(topics->events, sizeof(topics->events), prefix, device_id, "events"),
        "protocol_topics",
        "events");
    ESP_RETURN_ON_ERROR(
        write_topic(topics->errors, sizeof(topics->errors), prefix, device_id, "errors"),
        "protocol_topics",
        "errors");
    ESP_RETURN_ON_ERROR(
        write_topic(topics->schedules, sizeof(topics->schedules), prefix, device_id, "schedules"),
        "protocol_topics",
        "schedules");

    return ESP_OK;
}

const char *protocol_topics_kind_name(protocol_topic_kind_t kind)
{
    switch (kind) {
    case PROTOCOL_TOPIC_STATUS:
        return "status";
    case PROTOCOL_TOPIC_STATE:
        return "state";
    case PROTOCOL_TOPIC_CAPABILITIES:
        return "capabilities";
    case PROTOCOL_TOPIC_COMMANDS:
        return "commands";
    case PROTOCOL_TOPIC_EVENTS:
        return "events";
    case PROTOCOL_TOPIC_ERRORS:
        return "errors";
    case PROTOCOL_TOPIC_SCHEDULES:
        return "schedules";
    default:
        return "unknown";
    }
}
