#include "diagnostics.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

#include "esp_check.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "app_state.h"
#include "log_tags.h"

static diagnostics_info_t s_diagnostics;
static SemaphoreHandle_t s_diagnostics_lock;
static uint64_t s_boot_time_us;

static void generate_record_id(char *buffer, size_t buffer_len, const char *prefix)
{
    snprintf(buffer, buffer_len, "%s-%08" PRIx32, prefix, esp_random());
}

static esp_err_t lock_diagnostics(void)
{
    if (s_diagnostics_lock == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (xSemaphoreTake(s_diagnostics_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    return ESP_OK;
}

static void unlock_diagnostics(void)
{
    xSemaphoreGive(s_diagnostics_lock);
}

static void append_event(const app_event_record_t *record)
{
    if (s_diagnostics.events.count < APP_MAX_EVENTS) {
        s_diagnostics.events.items[s_diagnostics.events.count++] = *record;
        return;
    }

    memmove(
        &s_diagnostics.events.items[0],
        &s_diagnostics.events.items[1],
        sizeof(s_diagnostics.events.items[0]) * (APP_MAX_EVENTS - 1));
    s_diagnostics.events.items[APP_MAX_EVENTS - 1] = *record;
}

static void append_error(const app_error_record_t *record)
{
    if (s_diagnostics.errors.count < APP_MAX_ERRORS) {
        s_diagnostics.errors.items[s_diagnostics.errors.count++] = *record;
        return;
    }

    memmove(
        &s_diagnostics.errors.items[0],
        &s_diagnostics.errors.items[1],
        sizeof(s_diagnostics.errors.items[0]) * (APP_MAX_ERRORS - 1));
    s_diagnostics.errors.items[APP_MAX_ERRORS - 1] = *record;
}

esp_err_t diagnostics_init(void)
{
    if (s_diagnostics_lock == NULL) {
        s_diagnostics_lock = xSemaphoreCreateMutex();
        if (s_diagnostics_lock == NULL) {
            return ESP_ERR_NO_MEM;
        }
    }

    memset(&s_diagnostics, 0, sizeof(s_diagnostics));
    s_boot_time_us = esp_timer_get_time();
    strncpy(s_diagnostics.firmware_version, APP_FIRMWARE_VERSION, sizeof(s_diagnostics.firmware_version) - 1);
    strncpy(s_diagnostics.connection_summary, "Inicializando firmware", sizeof(s_diagnostics.connection_summary) - 1);
    strncpy(s_diagnostics.ota_status, "idle", sizeof(s_diagnostics.ota_status) - 1);
    s_diagnostics.transport_status = APP_TRANSPORT_IDLE;
    s_diagnostics.last_command_type = APP_COMMAND_REQUEST_STATUS;
    s_diagnostics.ota_progress_pct = 0;

    return ESP_OK;
}

esp_err_t diagnostics_get_snapshot(diagnostics_info_t *diagnostics)
{
    if (diagnostics == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "snapshot lock falhou");
    *diagnostics = s_diagnostics;
    unlock_diagnostics();
    return ESP_OK;
}

esp_err_t diagnostics_get_events(app_event_list_t *events)
{
    if (events == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "events lock falhou");
    *events = s_diagnostics.events;
    unlock_diagnostics();
    return ESP_OK;
}

esp_err_t diagnostics_get_errors(app_error_list_t *errors)
{
    if (errors == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "errors lock falhou");
    *errors = s_diagnostics.errors;
    unlock_diagnostics();
    return ESP_OK;
}

esp_err_t diagnostics_update_uptime(void)
{
    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "uptime lock falhou");
    s_diagnostics.uptime_sec = (esp_timer_get_time() - s_boot_time_us) / 1000000ULL;
    unlock_diagnostics();
    return ESP_OK;
}

esp_err_t diagnostics_set_connection_summary(const char *summary)
{
    if (summary == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "summary lock falhou");
    strncpy(s_diagnostics.connection_summary, summary, sizeof(s_diagnostics.connection_summary) - 1);
    unlock_diagnostics();
    return ESP_OK;
}

esp_err_t diagnostics_set_transport_status(app_transport_status_t status)
{
    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "transport lock falhou");
    s_diagnostics.transport_status = status;
    unlock_diagnostics();
    return ESP_OK;
}

esp_err_t diagnostics_set_last_sync_now(void)
{
    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "sync lock falhou");
    s_diagnostics.last_sync_at = time(NULL);
    unlock_diagnostics();
    return ESP_OK;
}

esp_err_t diagnostics_record_event(
    const char *code,
    app_event_level_t level,
    const char *title,
    const char *message)
{
    app_event_record_t record = {0};
    app_runtime_context_t *runtime = app_state_get_context();

    if (title == NULL || message == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    generate_record_id(record.id, sizeof(record.id), "evt");
    if (runtime != NULL) {
        strncpy(record.device_id, runtime->mqtt_config.device_id, sizeof(record.device_id) - 1);
    }
    if (code != NULL) {
        strncpy(record.code, code, sizeof(record.code) - 1);
    }
    strncpy(record.title, title, sizeof(record.title) - 1);
    strncpy(record.message, message, sizeof(record.message) - 1);
    record.level = level;
    record.created_at = time(NULL);

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "event lock falhou");
    append_event(&record);
    unlock_diagnostics();

    return ESP_OK;
}

esp_err_t diagnostics_record_error(const char *code, const char *message, bool recoverable)
{
    app_error_record_t record = {0};
    app_runtime_context_t *runtime = app_state_get_context();

    if (code == NULL || message == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    generate_record_id(record.id, sizeof(record.id), "err");
    if (runtime != NULL) {
        strncpy(record.device_id, runtime->mqtt_config.device_id, sizeof(record.device_id) - 1);
    }
    strncpy(record.code, code, sizeof(record.code) - 1);
    strncpy(record.message, message, sizeof(record.message) - 1);
    record.created_at = time(NULL);
    record.recoverable = recoverable;

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "error lock falhou");
    append_error(&record);
    strncpy(s_diagnostics.last_error_code, code, sizeof(s_diagnostics.last_error_code) - 1);
    strncpy(s_diagnostics.last_error_message, message, sizeof(s_diagnostics.last_error_message) - 1);
    unlock_diagnostics();

    return ESP_OK;
}

esp_err_t diagnostics_record_command(const app_command_t *command, const command_result_t *result)
{
    if (command == NULL || result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "command lock falhou");
    strncpy(s_diagnostics.last_command_id, command->id, sizeof(s_diagnostics.last_command_id) - 1);
    s_diagnostics.last_command_type = command->type;
    s_diagnostics.last_command_time = time(NULL);
    if (result->status == APP_LAST_COMMAND_FAILED) {
        strncpy(s_diagnostics.last_error_code, result->code, sizeof(s_diagnostics.last_error_code) - 1);
        strncpy(
            s_diagnostics.last_error_message,
            result->message,
            sizeof(s_diagnostics.last_error_message) - 1);
    }
    unlock_diagnostics();

    return ESP_OK;
}

esp_err_t diagnostics_set_ota_status(const char *status, int progress_pct)
{
    if (status == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_diagnostics(), LOG_TAG_DIAGNOSTICS, "ota lock falhou");
    strncpy(s_diagnostics.ota_status, status, sizeof(s_diagnostics.ota_status) - 1);
    s_diagnostics.ota_progress_pct = progress_pct;
    unlock_diagnostics();
    return ESP_OK;
}
