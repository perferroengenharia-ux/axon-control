#include "protocol_json.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "cJSON.h"
#include "esp_check.h"

#include "app_state.h"
#include "capabilities.h"
#include "device_state.h"
#include "diagnostics.h"
#include "schedules.h"

static void format_iso_timestamp(time_t timestamp, char *buffer, size_t buffer_len)
{
    struct tm tm_utc = {0};
    time_t value = timestamp > 0 ? timestamp : time(NULL);
    gmtime_r(&value, &tm_utc);
    strftime(buffer, buffer_len, "%Y-%m-%dT%H:%M:%SZ", &tm_utc);
}

static void write_two_digits(char *buffer, unsigned value)
{
    buffer[0] = (char)('0' + ((value / 10U) % 10U));
    buffer[1] = (char)('0' + (value % 10U));
}

static void format_hh_mm(uint8_t hour, uint8_t minute, char *buffer, size_t buffer_len)
{
    unsigned safe_hour = hour <= 23U ? hour : 23U;
    unsigned safe_minute = minute <= 59U ? minute : 59U;

    if (buffer == NULL || buffer_len < 6) {
        return;
    }

    write_two_digits(buffer, safe_hour);
    buffer[2] = ':';
    write_two_digits(buffer + 3, safe_minute);
    buffer[5] = '\0';
}

static void format_yyyy_mm_dd(int year, int month, int day, char *buffer, size_t buffer_len)
{
    unsigned safe_year = (year >= 0 && year <= 9999) ? (unsigned)year : 1970U;
    unsigned safe_month = (month >= 1 && month <= 12) ? (unsigned)month : 1U;
    unsigned safe_day = (day >= 1 && day <= 31) ? (unsigned)day : 1U;

    if (buffer == NULL || buffer_len < 11) {
        return;
    }

    buffer[0] = (char)('0' + ((safe_year / 1000U) % 10U));
    buffer[1] = (char)('0' + ((safe_year / 100U) % 10U));
    buffer[2] = (char)('0' + ((safe_year / 10U) % 10U));
    buffer[3] = (char)('0' + (safe_year % 10U));
    buffer[4] = '-';
    write_two_digits(buffer + 5, safe_month);
    buffer[7] = '-';
    write_two_digits(buffer + 8, safe_day);
    buffer[10] = '\0';
}

static cJSON *create_metadata_root(void)
{
    char timestamp[32] = {0};
    cJSON *root = NULL;
    app_runtime_context_t *runtime = app_state_get_context();

    if (runtime == NULL) {
        return NULL;
    }

    root = cJSON_CreateObject();
    if (root == NULL) {
        return NULL;
    }

    format_iso_timestamp(time(NULL), timestamp, sizeof(timestamp));
    cJSON_AddStringToObject(root, "schema", APP_PROTOCOL_SCHEMA_VERSION);
    cJSON_AddStringToObject(root, "deviceId", runtime->mqtt_config.device_id);
    cJSON_AddStringToObject(root, "timestamp", timestamp);
    cJSON_AddStringToObject(root, "source", "ihm");
    return root;
}

static char *print_json(cJSON *root)
{
    char *json = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json;
}

static const char *drain_mode_to_string(app_drain_mode_t mode)
{
    switch (mode) {
    case APP_DRAIN_MODE_TIMED:
        return "timed";
    case APP_DRAIN_MODE_UNTIL_SENSOR:
        return "until-sensor";
    case APP_DRAIN_MODE_HYBRID:
        return "hybrid";
    case APP_DRAIN_MODE_DISABLED:
    default:
        return "disabled";
    }
}

static const char *pump_logic_to_string(app_pump_logic_mode_t mode)
{
    switch (mode) {
    case APP_PUMP_LOGIC_LINKED:
        return "linked";
    case APP_PUMP_LOGIC_INDEPENDENT:
        return "independent";
    case APP_PUMP_LOGIC_FORCED_ON:
        return "forced-on";
    case APP_PUMP_LOGIC_FORCED_OFF:
    default:
        return "forced-off";
    }
}

static const char *water_sensor_mode_to_string(app_water_sensor_mode_t mode)
{
    switch (mode) {
    case APP_WATER_SENSOR_MODE_NORMAL:
        return "normal";
    case APP_WATER_SENSOR_MODE_INVERTED:
        return "inverted";
    case APP_WATER_SENSOR_MODE_DISABLED:
    default:
        return "disabled";
    }
}

static const char *resume_mode_to_string(app_resume_mode_t mode)
{
    switch (mode) {
    case APP_RESUME_LAST_STATE:
        return "resume-last-state";
    case APP_RESUME_ALWAYS_OFF:
        return "always-off";
    case APP_RESUME_ALWAYS_ON:
    default:
        return "always-on";
    }
}

static const char *auto_reset_mode_to_string(app_auto_reset_mode_t mode)
{
    switch (mode) {
    case APP_AUTO_RESET_ENABLED:
        return "enabled";
    case APP_AUTO_RESET_DISABLED:
    default:
        return "disabled";
    }
}

static const char *event_level_to_string(app_event_level_t level)
{
    switch (level) {
    case APP_EVENT_LEVEL_INFO:
        return "info";
    case APP_EVENT_LEVEL_WARNING:
        return "warning";
    case APP_EVENT_LEVEL_ERROR:
    default:
        return "error";
    }
}

static const char *schedule_type_to_string(app_schedule_type_t type)
{
    switch (type) {
    case APP_SCHEDULE_POWER_ON:
        return "power-on";
    case APP_SCHEDULE_POWER_OFF:
        return "power-off";
    case APP_SCHEDULE_DRAIN_CYCLE:
    default:
        return "drain-cycle";
    }
}

static const char *schedule_recurrence_to_string(app_schedule_recurrence_t recurrence)
{
    switch (recurrence) {
    case APP_SCHEDULE_ONE_SHOT:
        return "one-shot";
    case APP_SCHEDULE_DAILY:
        return "daily";
    case APP_SCHEDULE_WEEKLY:
    default:
        return "weekly";
    }
}

static cJSON *create_status_object(const device_state_t *state)
{
    cJSON *status = cJSON_CreateObject();
    char last_seen[32] = {0};

    cJSON_AddBoolToObject(status, "deviceOnline", state->device_online);
    cJSON_AddStringToObject(
        status,
        "connectionMode",
        protocol_json_connection_mode_to_string(state->connection_mode));
    if (state->last_seen > 0) {
        format_iso_timestamp(state->last_seen, last_seen, sizeof(last_seen));
        cJSON_AddStringToObject(status, "lastSeen", last_seen);
    } else {
        cJSON_AddNullToObject(status, "lastSeen");
    }
    cJSON_AddStringToObject(status, "readyState", protocol_json_ready_state_to_string(state->ready_state));
    return status;
}

static cJSON *create_state_object(const device_state_t *state)
{
    cJSON *state_json = create_status_object(state);
    if (state_json == NULL) {
        return NULL;
    }

    cJSON_AddBoolToObject(state_json, "inverterRunning", state->inverter_running);
    cJSON_AddNumberToObject(state_json, "freqCurrentHz", state->freq_current_hz);
    cJSON_AddNumberToObject(state_json, "freqTargetHz", state->freq_target_hz);
    cJSON_AddStringToObject(
        state_json,
        "pumpState",
        protocol_json_peripheral_state_to_string(state->pump_state));
    cJSON_AddStringToObject(
        state_json,
        "swingState",
        protocol_json_peripheral_state_to_string(state->swing_state));
    cJSON_AddStringToObject(
        state_json,
        "drainState",
        protocol_json_peripheral_state_to_string(state->drain_state));
    cJSON_AddStringToObject(
        state_json,
        "waterLevelState",
        protocol_json_water_level_to_string(state->water_level_state));
    cJSON_AddStringToObject(
        state_json,
        "lastCommandStatus",
        protocol_json_command_status_to_string(state->last_command_status));
    if (state->last_error_code[0] != '\0') {
        cJSON_AddStringToObject(state_json, "lastErrorCode", state->last_error_code);
    } else {
        cJSON_AddNullToObject(state_json, "lastErrorCode");
    }
    return state_json;
}

static cJSON *create_capabilities_object(const device_capabilities_t *capabilities)
{
    cJSON *caps = cJSON_CreateObject();
    cJSON_AddNumberToObject(caps, "fMinHz", capabilities->f_min_hz);
    cJSON_AddNumberToObject(caps, "fMaxHz", capabilities->f_max_hz);
    cJSON_AddBoolToObject(caps, "pumpAvailable", capabilities->pump_available);
    cJSON_AddBoolToObject(caps, "swingAvailable", capabilities->swing_available);
    cJSON_AddBoolToObject(caps, "drainAvailable", capabilities->drain_available);
    cJSON_AddBoolToObject(caps, "waterSensorEnabled", capabilities->water_sensor_enabled);
    cJSON_AddStringToObject(caps, "drainMode", drain_mode_to_string(capabilities->drain_mode));
    cJSON_AddNumberToObject(caps, "drainTimeSec", capabilities->drain_time_sec);
    cJSON_AddNumberToObject(caps, "drainReturnDelaySec", capabilities->drain_return_delay_sec);
    cJSON_AddStringToObject(caps, "pumpLogicMode", pump_logic_to_string(capabilities->pump_logic_mode));
    cJSON_AddStringToObject(
        caps,
        "waterSensorMode",
        water_sensor_mode_to_string(capabilities->water_sensor_mode));
    cJSON_AddNumberToObject(caps, "preWetSec", capabilities->pre_wet_sec);
    cJSON_AddNumberToObject(caps, "dryPanelSec", capabilities->dry_panel_sec);
    cJSON_AddNumberToObject(caps, "dryPanelFreqHz", capabilities->dry_panel_freq_hz);
    cJSON_AddStringToObject(caps, "resumeMode", resume_mode_to_string(capabilities->resume_mode));
    cJSON_AddStringToObject(caps, "autoResetMode", auto_reset_mode_to_string(capabilities->auto_reset_mode));
    return caps;
}

static cJSON *create_schedule_object(const app_schedule_t *schedule)
{
    char time_text[6] = {0};
    char created_at[32] = {0};
    char updated_at[32] = {0};
    cJSON *schedule_json = cJSON_CreateObject();
    cJSON *days = cJSON_CreateArray();

    format_hh_mm(schedule->hour, schedule->minute, time_text, sizeof(time_text));
    format_iso_timestamp(schedule->created_at, created_at, sizeof(created_at));
    format_iso_timestamp(schedule->updated_at, updated_at, sizeof(updated_at));

    cJSON_AddStringToObject(schedule_json, "id", schedule->id);
    cJSON_AddStringToObject(schedule_json, "deviceId", schedule->device_id);
    cJSON_AddStringToObject(schedule_json, "type", schedule_type_to_string(schedule->type));
    cJSON_AddStringToObject(
        schedule_json,
        "recurrence",
        schedule_recurrence_to_string(schedule->recurrence));
    cJSON_AddBoolToObject(schedule_json, "enabled", schedule->enabled);
    cJSON_AddStringToObject(schedule_json, "time", time_text);

    for (int day = 0; day < 7; ++day) {
        if ((schedule->days_of_week_mask & (1U << day)) != 0U) {
            cJSON_AddItemToArray(days, cJSON_CreateNumber(day));
        }
    }
    cJSON_AddItemToObject(schedule_json, "daysOfWeek", days);

    if (schedule->recurrence == APP_SCHEDULE_ONE_SHOT && schedule->one_shot_year > 0) {
        char one_shot_date[11] = {0};
        format_yyyy_mm_dd(
            schedule->one_shot_year,
            schedule->one_shot_month,
            schedule->one_shot_day,
            one_shot_date,
            sizeof(one_shot_date));
        cJSON_AddStringToObject(schedule_json, "oneShotDate", one_shot_date);
    } else {
        cJSON_AddNullToObject(schedule_json, "oneShotDate");
    }

    cJSON_AddStringToObject(schedule_json, "createdAt", created_at);
    cJSON_AddStringToObject(schedule_json, "updatedAt", updated_at);
    return schedule_json;
}

static cJSON *create_error_object(const app_error_record_t *error)
{
    char created_at[32] = {0};
    cJSON *error_json = cJSON_CreateObject();

    format_iso_timestamp(error->created_at, created_at, sizeof(created_at));
    cJSON_AddStringToObject(error_json, "id", error->id);
    cJSON_AddStringToObject(error_json, "deviceId", error->device_id);
    cJSON_AddStringToObject(error_json, "code", error->code);
    cJSON_AddStringToObject(error_json, "message", error->message);
    cJSON_AddStringToObject(error_json, "createdAt", created_at);
    cJSON_AddBoolToObject(error_json, "recoverable", error->recoverable);
    return error_json;
}

static app_command_type_t command_type_from_string(const char *type)
{
    if (strcmp(type, "power-on") == 0) {
        return APP_COMMAND_POWER_ON;
    }
    if (strcmp(type, "power-off") == 0) {
        return APP_COMMAND_POWER_OFF;
    }
    if (strcmp(type, "set-frequency") == 0) {
        return APP_COMMAND_SET_FREQUENCY;
    }
    if (strcmp(type, "set-pump") == 0) {
        return APP_COMMAND_SET_PUMP;
    }
    if (strcmp(type, "set-swing") == 0) {
        return APP_COMMAND_SET_SWING;
    }
    if (strcmp(type, "run-drain") == 0) {
        return APP_COMMAND_RUN_DRAIN;
    }
    if (strcmp(type, "stop-drain") == 0) {
        return APP_COMMAND_STOP_DRAIN;
    }
    if (strcmp(type, "request-status") == 0) {
        return APP_COMMAND_REQUEST_STATUS;
    }
    if (strcmp(type, "request-capabilities") == 0) {
        return APP_COMMAND_REQUEST_CAPABILITIES;
    }
    if (strcmp(type, "sync-schedules") == 0) {
        return APP_COMMAND_SYNC_SCHEDULES;
    }
    if (strcmp(type, "start-ota") == 0) {
        return APP_COMMAND_START_OTA;
    }
    return APP_COMMAND_REQUEST_STATUS;
}

static bool is_known_command_type(const char *type)
{
    return strcmp(type, "power-on") == 0 || strcmp(type, "power-off") == 0 ||
           strcmp(type, "set-frequency") == 0 || strcmp(type, "set-pump") == 0 ||
           strcmp(type, "set-swing") == 0 || strcmp(type, "run-drain") == 0 ||
           strcmp(type, "stop-drain") == 0 || strcmp(type, "request-status") == 0 ||
           strcmp(type, "request-capabilities") == 0 || strcmp(type, "sync-schedules") == 0 ||
           strcmp(type, "start-ota") == 0;
}

static app_schedule_type_t schedule_type_from_string(const char *type)
{
    if (strcmp(type, "power-on") == 0) {
        return APP_SCHEDULE_POWER_ON;
    }
    if (strcmp(type, "power-off") == 0) {
        return APP_SCHEDULE_POWER_OFF;
    }
    return APP_SCHEDULE_DRAIN_CYCLE;
}

static app_schedule_recurrence_t schedule_recurrence_from_string(const char *recurrence)
{
    if (strcmp(recurrence, "one-shot") == 0) {
        return APP_SCHEDULE_ONE_SHOT;
    }
    if (strcmp(recurrence, "daily") == 0) {
        return APP_SCHEDULE_DAILY;
    }
    return APP_SCHEDULE_WEEKLY;
}

static esp_err_t parse_time_string(const char *time_text, uint8_t *hour, uint8_t *minute)
{
    int parsed_hour = 0;
    int parsed_minute = 0;

    if (time_text == NULL || hour == NULL || minute == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (sscanf(time_text, "%d:%d", &parsed_hour, &parsed_minute) != 2) {
        return ESP_ERR_INVALID_ARG;
    }

    if (parsed_hour < 0 || parsed_hour > 23 || parsed_minute < 0 || parsed_minute > 59) {
        return ESP_ERR_INVALID_ARG;
    }

    *hour = (uint8_t)parsed_hour;
    *minute = (uint8_t)parsed_minute;
    return ESP_OK;
}

static esp_err_t parse_schedule_object(cJSON *json, app_schedule_t *schedule)
{
    cJSON *value = NULL;
    cJSON *days = NULL;
    app_runtime_context_t *runtime = app_state_get_context();

    if (json == NULL || schedule == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memset(schedule, 0, sizeof(*schedule));

    value = cJSON_GetObjectItemCaseSensitive(json, "id");
    if (cJSON_IsString(value) && value->valuestring != NULL) {
        strncpy(schedule->id, value->valuestring, sizeof(schedule->id) - 1);
    }

    value = cJSON_GetObjectItemCaseSensitive(json, "deviceId");
    if (cJSON_IsString(value) && value->valuestring != NULL) {
        strncpy(schedule->device_id, value->valuestring, sizeof(schedule->device_id) - 1);
    } else if (runtime != NULL) {
        strncpy(schedule->device_id, runtime->mqtt_config.device_id, sizeof(schedule->device_id) - 1);
    }

    value = cJSON_GetObjectItemCaseSensitive(json, "type");
    if (!cJSON_IsString(value) || value->valuestring == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    schedule->type = schedule_type_from_string(value->valuestring);

    value = cJSON_GetObjectItemCaseSensitive(json, "recurrence");
    if (!cJSON_IsString(value) || value->valuestring == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    schedule->recurrence = schedule_recurrence_from_string(value->valuestring);

    value = cJSON_GetObjectItemCaseSensitive(json, "enabled");
    schedule->enabled = !cJSON_IsBool(value) || cJSON_IsTrue(value);

    value = cJSON_GetObjectItemCaseSensitive(json, "time");
    if (!cJSON_IsString(value) || parse_time_string(value->valuestring, &schedule->hour, &schedule->minute) != ESP_OK) {
        return ESP_ERR_INVALID_ARG;
    }

    days = cJSON_GetObjectItemCaseSensitive(json, "daysOfWeek");
    if (cJSON_IsArray(days)) {
        size_t days_count = (size_t)cJSON_GetArraySize(days);
        for (size_t index = 0; index < days_count; ++index) {
            cJSON *day_item = cJSON_GetArrayItem(days, (int)index);
            if (cJSON_IsNumber(day_item) && day_item->valueint >= 0 && day_item->valueint <= 6) {
                schedule->days_of_week_mask |= (uint8_t)(1U << day_item->valueint);
            }
        }
    }

    value = cJSON_GetObjectItemCaseSensitive(json, "oneShotDate");
    if (cJSON_IsString(value) && value->valuestring != NULL && schedule->recurrence == APP_SCHEDULE_ONE_SHOT) {
        if (sscanf(
                value->valuestring,
                "%d-%d-%d",
                &schedule->one_shot_year,
                &schedule->one_shot_month,
                &schedule->one_shot_day) != 3) {
            return ESP_ERR_INVALID_ARG;
        }
    }

    schedule->created_at = time(NULL);
    schedule->updated_at = time(NULL);
    return ESP_OK;
}

static esp_err_t parse_schedule_table_from_json_object(cJSON *root, app_schedule_table_t *table)
{
    cJSON *revision = NULL;
    cJSON *schedules = NULL;

    if (root == NULL || table == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memset(table, 0, sizeof(*table));

    revision = cJSON_GetObjectItemCaseSensitive(root, "revision");
    if (cJSON_IsString(revision) && revision->valuestring != NULL) {
        strncpy(table->revision, revision->valuestring, sizeof(table->revision) - 1);
    }

    schedules = cJSON_GetObjectItemCaseSensitive(root, "schedules");
    if (!cJSON_IsArray(schedules)) {
        return ESP_ERR_INVALID_ARG;
    }

    table->count = (size_t)cJSON_GetArraySize(schedules);
    if (table->count > APP_MAX_SCHEDULES) {
        return ESP_ERR_INVALID_SIZE;
    }

    for (size_t index = 0; index < table->count; ++index) {
        ESP_RETURN_ON_ERROR(
            parse_schedule_object(cJSON_GetArrayItem(schedules, (int)index), &table->items[index]),
            "protocol_json",
            "schedule item");
    }

    return ESP_OK;
}

static esp_err_t serialize_and_assign(cJSON *root, char **out_json)
{
    char *json = NULL;

    if (root == NULL || out_json == NULL) {
        cJSON_Delete(root);
        return ESP_ERR_INVALID_ARG;
    }

    json = print_json(root);
    if (json == NULL) {
        return ESP_ERR_NO_MEM;
    }

    *out_json = json;
    return ESP_OK;
}

esp_err_t protocol_json_parse_command_request(const char *json, app_command_t *command)
{
    cJSON *root = NULL;
    cJSON *message = NULL;
    cJSON *payload = NULL;
    cJSON *value = NULL;
    app_runtime_context_t *runtime = app_state_get_context();

    if (json == NULL || command == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memset(command, 0, sizeof(*command));
    root = cJSON_Parse(json);
    if (root == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    message = cJSON_GetObjectItemCaseSensitive(root, "command");
    if (!cJSON_IsObject(message)) {
        message = root;
    }

    value = cJSON_GetObjectItemCaseSensitive(message, "id");
    if (cJSON_IsString(value) && value->valuestring != NULL) {
        strncpy(command->id, value->valuestring, sizeof(command->id) - 1);
    }

    value = cJSON_GetObjectItemCaseSensitive(message, "deviceId");
    if (cJSON_IsString(value) && value->valuestring != NULL) {
        strncpy(command->device_id, value->valuestring, sizeof(command->device_id) - 1);
    } else if (runtime != NULL) {
        strncpy(command->device_id, runtime->mqtt_config.device_id, sizeof(command->device_id) - 1);
    }

    value = cJSON_GetObjectItemCaseSensitive(message, "type");
    if (!cJSON_IsString(value) || value->valuestring == NULL) {
        cJSON_Delete(root);
        return ESP_ERR_INVALID_ARG;
    }
    if (!is_known_command_type(value->valuestring)) {
        cJSON_Delete(root);
        return ESP_ERR_INVALID_ARG;
    }
    command->type = command_type_from_string(value->valuestring);
    command->timestamp = time(NULL);

    payload = cJSON_GetObjectItemCaseSensitive(message, "payload");
    if (!cJSON_IsObject(payload)) {
        payload = NULL;
    }

    switch (command->type) {
    case APP_COMMAND_SET_FREQUENCY:
        value = cJSON_GetObjectItemCaseSensitive(payload, "freqTargetHz");
        if (!cJSON_IsNumber(value)) {
            cJSON_Delete(root);
            return ESP_ERR_INVALID_ARG;
        }
        command->freq_target_hz = value->valueint;
        break;
    case APP_COMMAND_SET_PUMP:
    case APP_COMMAND_SET_SWING:
        value = cJSON_GetObjectItemCaseSensitive(payload, "enabled");
        if (!cJSON_IsBool(value)) {
            cJSON_Delete(root);
            return ESP_ERR_INVALID_ARG;
        }
        command->enabled = cJSON_IsTrue(value);
        break;
    case APP_COMMAND_RUN_DRAIN:
    case APP_COMMAND_STOP_DRAIN:
        value = cJSON_GetObjectItemCaseSensitive(payload, "reason");
        if (cJSON_IsString(value) && value->valuestring != NULL) {
            strncpy(command->reason, value->valuestring, sizeof(command->reason) - 1);
        }
        break;
    case APP_COMMAND_REQUEST_STATUS:
        value = cJSON_GetObjectItemCaseSensitive(payload, "includeDiagnostics");
        command->include_diagnostics = cJSON_IsBool(value) && cJSON_IsTrue(value);
        break;
    case APP_COMMAND_SYNC_SCHEDULES:
        if (payload == NULL || parse_schedule_table_from_json_object(payload, &command->schedules) != ESP_OK) {
            cJSON_Delete(root);
            return ESP_ERR_INVALID_ARG;
        }
        break;
    case APP_COMMAND_START_OTA:
        value = cJSON_GetObjectItemCaseSensitive(payload, "url");
        if (!cJSON_IsString(value) || value->valuestring == NULL) {
            cJSON_Delete(root);
            return ESP_ERR_INVALID_ARG;
        }
        strncpy(command->ota_request.url, value->valuestring, sizeof(command->ota_request.url) - 1);
        value = cJSON_GetObjectItemCaseSensitive(payload, "validateServerCertificate");
        command->ota_request.validate_server_certificate =
            !cJSON_IsBool(value) || cJSON_IsTrue(value);
        break;
    default:
        break;
    }

    cJSON_Delete(root);
    return ESP_OK;
}

esp_err_t protocol_json_parse_schedule_payload(const char *json, app_schedule_table_t *table)
{
    cJSON *root = NULL;
    esp_err_t err = ESP_OK;

    if (json == NULL || table == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    root = cJSON_Parse(json);
    if (root == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    err = parse_schedule_table_from_json_object(root, table);
    cJSON_Delete(root);
    return err;
}

esp_err_t protocol_json_parse_ota_request(const char *json, ota_request_t *request)
{
    cJSON *root = NULL;
    cJSON *value = NULL;

    if (json == NULL || request == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memset(request, 0, sizeof(*request));
    root = cJSON_Parse(json);
    if (root == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    value = cJSON_GetObjectItemCaseSensitive(root, "url");
    if (!cJSON_IsString(value) || value->valuestring == NULL) {
        cJSON_Delete(root);
        return ESP_ERR_INVALID_ARG;
    }
    strncpy(request->url, value->valuestring, sizeof(request->url) - 1);

    value = cJSON_GetObjectItemCaseSensitive(root, "validateServerCertificate");
    request->validate_server_certificate = !cJSON_IsBool(value) || cJSON_IsTrue(value);

    cJSON_Delete(root);
    return ESP_OK;
}

esp_err_t protocol_json_serialize_status(char **out_json)
{
    cJSON *root = create_metadata_root();
    device_state_t state = {0};

    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }
    ESP_RETURN_ON_ERROR(device_state_get_snapshot(&state), "protocol_json", "status");
    cJSON_AddItemToObject(root, "status", create_status_object(&state));
    return serialize_and_assign(root, out_json);
}

esp_err_t protocol_json_serialize_state(char **out_json)
{
    cJSON *root = create_metadata_root();
    device_state_t state = {0};

    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }
    ESP_RETURN_ON_ERROR(device_state_get_snapshot(&state), "protocol_json", "state");
    cJSON_AddItemToObject(root, "state", create_state_object(&state));
    return serialize_and_assign(root, out_json);
}

esp_err_t protocol_json_serialize_capabilities(char **out_json)
{
    cJSON *root = create_metadata_root();
    device_capabilities_t capabilities = {0};

    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }
    ESP_RETURN_ON_ERROR(capabilities_get_snapshot(&capabilities), "protocol_json", "caps");
    cJSON_AddItemToObject(root, "capabilities", create_capabilities_object(&capabilities));
    return serialize_and_assign(root, out_json);
}

esp_err_t protocol_json_serialize_schedules(char **out_json)
{
    cJSON *root = create_metadata_root();
    cJSON *schedules_json = cJSON_CreateArray();
    app_schedule_table_t table = {0};

    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }
    ESP_RETURN_ON_ERROR(schedules_get_table(&table), "protocol_json", "schedules");
    for (size_t index = 0; index < table.count; ++index) {
        cJSON_AddItemToArray(schedules_json, create_schedule_object(&table.items[index]));
    }
    cJSON_AddItemToObject(root, "schedules", schedules_json);
    if (table.revision[0] != '\0') {
        cJSON_AddStringToObject(root, "revision", table.revision);
    }
    return serialize_and_assign(root, out_json);
}

esp_err_t protocol_json_serialize_diagnostics(char **out_json)
{
    cJSON *root = create_metadata_root();
    cJSON *diagnostics_json = cJSON_CreateObject();
    diagnostics_info_t diagnostics = {0};
    char timestamp[32] = {0};

    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }
    ESP_RETURN_ON_ERROR(diagnostics_get_snapshot(&diagnostics), "protocol_json", "diagnostics");

    cJSON_AddStringToObject(diagnostics_json, "firmwareVersion", diagnostics.firmware_version);
    cJSON_AddStringToObject(diagnostics_json, "connectionSummary", diagnostics.connection_summary);
    cJSON_AddStringToObject(
        diagnostics_json,
        "transportStatus",
        protocol_json_transport_status_to_string(diagnostics.transport_status));

    if (diagnostics.last_sync_at > 0) {
        format_iso_timestamp(diagnostics.last_sync_at, timestamp, sizeof(timestamp));
        cJSON_AddStringToObject(diagnostics_json, "lastSyncAt", timestamp);
    } else {
        cJSON_AddNullToObject(diagnostics_json, "lastSyncAt");
    }

    if (diagnostics.last_error_message[0] != '\0') {
        cJSON_AddStringToObject(diagnostics_json, "lastErrorMessage", diagnostics.last_error_message);
    } else {
        cJSON_AddNullToObject(diagnostics_json, "lastErrorMessage");
    }

    if (diagnostics.last_error_code[0] != '\0') {
        cJSON_AddStringToObject(diagnostics_json, "lastErrorCode", diagnostics.last_error_code);
    } else {
        cJSON_AddNullToObject(diagnostics_json, "lastErrorCode");
    }

    if (diagnostics.last_command_id[0] != '\0') {
        cJSON_AddStringToObject(diagnostics_json, "lastCommandId", diagnostics.last_command_id);
        cJSON_AddStringToObject(
            diagnostics_json,
            "lastCommandType",
            protocol_json_command_type_to_string(diagnostics.last_command_type));
    } else {
        cJSON_AddNullToObject(diagnostics_json, "lastCommandId");
        cJSON_AddNullToObject(diagnostics_json, "lastCommandType");
    }

    if (diagnostics.last_command_time > 0) {
        format_iso_timestamp(diagnostics.last_command_time, timestamp, sizeof(timestamp));
        cJSON_AddStringToObject(diagnostics_json, "lastCommandTime", timestamp);
    } else {
        cJSON_AddNullToObject(diagnostics_json, "lastCommandTime");
    }

    cJSON_AddStringToObject(diagnostics_json, "otaStatus", diagnostics.ota_status);
    cJSON_AddNumberToObject(diagnostics_json, "otaProgressPct", diagnostics.ota_progress_pct);
    cJSON_AddNumberToObject(diagnostics_json, "uptimeSec", (double)diagnostics.uptime_sec);

    cJSON_AddItemToObject(root, "diagnostics", diagnostics_json);
    return serialize_and_assign(root, out_json);
}

esp_err_t protocol_json_serialize_events(char **out_json)
{
    cJSON *root = create_metadata_root();
    cJSON *events_json = cJSON_CreateArray();
    app_event_list_t events = {0};

    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }
    ESP_RETURN_ON_ERROR(diagnostics_get_events(&events), "protocol_json", "events");
    for (size_t index = 0; index < events.count; ++index) {
        char created_at[32] = {0};
        cJSON *item = cJSON_CreateObject();
        format_iso_timestamp(events.items[index].created_at, created_at, sizeof(created_at));
        cJSON_AddStringToObject(item, "id", events.items[index].id);
        cJSON_AddStringToObject(item, "deviceId", events.items[index].device_id);
        cJSON_AddStringToObject(item, "level", event_level_to_string(events.items[index].level));
        cJSON_AddStringToObject(item, "title", events.items[index].title);
        cJSON_AddStringToObject(item, "message", events.items[index].message);
        if (events.items[index].code[0] != '\0') {
            cJSON_AddStringToObject(item, "code", events.items[index].code);
        }
        cJSON_AddStringToObject(item, "createdAt", created_at);
        cJSON_AddItemToArray(events_json, item);
    }
    cJSON_AddItemToObject(root, "events", events_json);
    return serialize_and_assign(root, out_json);
}

esp_err_t protocol_json_serialize_errors(char **out_json)
{
    cJSON *root = create_metadata_root();
    cJSON *errors_json = cJSON_CreateArray();
    app_error_list_t errors = {0};

    if (root == NULL) {
        return ESP_ERR_NO_MEM;
    }
    ESP_RETURN_ON_ERROR(diagnostics_get_errors(&errors), "protocol_json", "errors");
    for (size_t index = 0; index < errors.count; ++index) {
        cJSON_AddItemToArray(errors_json, create_error_object(&errors.items[index]));
    }
    cJSON_AddItemToObject(root, "errors", errors_json);
    return serialize_and_assign(root, out_json);
}

esp_err_t protocol_json_serialize_command_ack(
    const app_command_t *command,
    const command_result_t *result,
    char **out_json)
{
    cJSON *root = create_metadata_root();
    device_state_t state = {0};

    if (root == NULL || command == NULL || result == NULL) {
        cJSON_Delete(root);
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(device_state_get_snapshot(&state), "protocol_json", "ack state");

    cJSON_AddStringToObject(root, "id", command->id);
    cJSON_AddStringToObject(root, "type", protocol_json_command_type_to_string(command->type));
    cJSON_AddBoolToObject(root, "accepted", result->accepted);
    cJSON_AddBoolToObject(root, "applied", result->applied);
    cJSON_AddStringToObject(root, "status", protocol_json_command_status_to_string(result->status));
    cJSON_AddItemToObject(root, "state", create_state_object(&state));

    if (result->status == APP_LAST_COMMAND_FAILED) {
        app_error_record_t error = {0};
        app_runtime_context_t *runtime = app_state_get_context();
        strncpy(error.id, command->id, sizeof(error.id) - 1);
        if (runtime != NULL) {
            strncpy(error.device_id, runtime->mqtt_config.device_id, sizeof(error.device_id) - 1);
        }
        strncpy(error.code, result->code, sizeof(error.code) - 1);
        strncpy(error.message, result->message, sizeof(error.message) - 1);
        error.created_at = time(NULL);
        error.recoverable = true;
        cJSON_AddItemToObject(root, "error", create_error_object(&error));
    } else {
        cJSON_AddNullToObject(root, "error");
    }

    return serialize_and_assign(root, out_json);
}

const char *protocol_json_connection_mode_to_string(app_connection_mode_t mode)
{
    switch (mode) {
    case APP_CONNECTION_MODE_CLOUD:
        return "cloud";
    case APP_CONNECTION_MODE_LOCAL_LAN:
        return "local-lan";
    case APP_CONNECTION_MODE_LOCAL_AP:
        return "local-ap";
    case APP_CONNECTION_MODE_SIMULATION:
    default:
        return "simulation";
    }
}

const char *protocol_json_ready_state_to_string(app_ready_state_t state)
{
    switch (state) {
    case APP_READY_STATE_READY:
        return "ready";
    case APP_READY_STATE_STARTING:
        return "starting";
    case APP_READY_STATE_RUNNING:
        return "running";
    case APP_READY_STATE_STOPPING:
        return "stopping";
    case APP_READY_STATE_DRAINING:
        return "draining";
    case APP_READY_STATE_FAULT:
        return "fault";
    case APP_READY_STATE_OFFLINE:
    default:
        return "offline";
    }
}

const char *protocol_json_water_level_to_string(app_water_level_state_t state)
{
    switch (state) {
    case APP_WATER_LEVEL_OK:
        return "ok";
    case APP_WATER_LEVEL_LOW:
        return "low";
    case APP_WATER_LEVEL_DISABLED:
        return "disabled";
    case APP_WATER_LEVEL_UNKNOWN:
    default:
        return "unknown";
    }
}

const char *protocol_json_command_status_to_string(app_last_command_status_t status)
{
    switch (status) {
    case APP_LAST_COMMAND_IDLE:
        return "idle";
    case APP_LAST_COMMAND_SENDING:
        return "sending";
    case APP_LAST_COMMAND_APPLIED:
        return "applied";
    case APP_LAST_COMMAND_FAILED:
    default:
        return "failed";
    }
}

const char *protocol_json_peripheral_state_to_string(app_peripheral_state_t state)
{
    switch (state) {
    case APP_PERIPHERAL_ON:
        return "on";
    case APP_PERIPHERAL_OFF:
        return "off";
    case APP_PERIPHERAL_UNAVAILABLE:
        return "unavailable";
    case APP_PERIPHERAL_UNKNOWN:
    default:
        return "unknown";
    }
}

const char *protocol_json_transport_status_to_string(app_transport_status_t status)
{
    switch (status) {
    case APP_TRANSPORT_IDLE:
        return "idle";
    case APP_TRANSPORT_CONNECTING:
        return "connecting";
    case APP_TRANSPORT_CONNECTED:
        return "connected";
    case APP_TRANSPORT_DEGRADED:
        return "degraded";
    case APP_TRANSPORT_ERROR:
    default:
        return "error";
    }
}

const char *protocol_json_command_type_to_string(app_command_type_t type)
{
    switch (type) {
    case APP_COMMAND_POWER_ON:
        return "power-on";
    case APP_COMMAND_POWER_OFF:
        return "power-off";
    case APP_COMMAND_SET_FREQUENCY:
        return "set-frequency";
    case APP_COMMAND_SET_PUMP:
        return "set-pump";
    case APP_COMMAND_SET_SWING:
        return "set-swing";
    case APP_COMMAND_RUN_DRAIN:
        return "run-drain";
    case APP_COMMAND_STOP_DRAIN:
        return "stop-drain";
    case APP_COMMAND_REQUEST_STATUS:
        return "request-status";
    case APP_COMMAND_REQUEST_CAPABILITIES:
        return "request-capabilities";
    case APP_COMMAND_SYNC_SCHEDULES:
        return "sync-schedules";
    case APP_COMMAND_START_OTA:
    default:
        return "start-ota";
    }
}
