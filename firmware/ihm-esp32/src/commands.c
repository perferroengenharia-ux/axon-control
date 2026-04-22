#include "commands.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#include "esp_check.h"
#include "esp_log.h"
#include "esp_random.h"

#include "app_state.h"
#include "capabilities.h"
#include "device_state.h"
#include "diagnostics.h"
#include "log_tags.h"
#include "ota.h"
#include "rs485_bridge.h"
#include "schedules.h"

static void set_result(
    command_result_t *result,
    bool accepted,
    bool applied,
    app_last_command_status_t status,
    const char *code,
    const char *message)
{
    if (result == NULL) {
        return;
    }

    memset(result, 0, sizeof(*result));
    result->accepted = accepted;
    result->applied = applied;
    result->status = status;
    if (code != NULL) {
        strncpy(result->code, code, sizeof(result->code) - 1);
    }
    if (message != NULL) {
        strncpy(result->message, message, sizeof(result->message) - 1);
    }
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

static esp_err_t reject(
    const app_command_t *command,
    command_result_t *result,
    const char *code,
    const char *message)
{
    set_result(result, false, false, APP_LAST_COMMAND_FAILED, code, message);
    ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_command_status(APP_LAST_COMMAND_FAILED));
    ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_error_code(code));
    ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_record_error(code, message, true));
    if (command != NULL) {
        ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_record_command(command, result));
    }
    return ESP_ERR_INVALID_ARG;
}

static esp_err_t apply_frequency_command(
    const app_command_t *command,
    const device_capabilities_t *capabilities,
    command_result_t *result)
{
    if (command->freq_target_hz < capabilities->f_min_hz ||
        command->freq_target_hz > capabilities->f_max_hz) {
        return reject(command, result, "freq_out_of_range", "Frequencia fora de fMinHz e fMaxHz");
    }

    ESP_RETURN_ON_ERROR(device_state_set_target_frequency(command->freq_target_hz), LOG_TAG_COMMANDS, "target");

    device_state_t state = {0};
    ESP_RETURN_ON_ERROR(device_state_get_snapshot(&state), LOG_TAG_COMMANDS, "snapshot");
    if (state.inverter_running) {
        ESP_RETURN_ON_ERROR(
            device_state_set_current_frequency(command->freq_target_hz),
            LOG_TAG_COMMANDS,
            "current");
    }

    set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Frequencia alvo atualizada");
    return ESP_OK;
}

static esp_err_t apply_power_command(app_command_type_t type, command_result_t *result)
{
    device_state_t state = {0};
    ESP_RETURN_ON_ERROR(device_state_get_snapshot(&state), LOG_TAG_COMMANDS, "snapshot");

    if (type == APP_COMMAND_POWER_ON) {
        ESP_RETURN_ON_ERROR(device_state_set_power(true), LOG_TAG_COMMANDS, "power on");
        if (state.freq_target_hz <= 0) {
            ESP_RETURN_ON_ERROR(device_state_set_target_frequency(30), LOG_TAG_COMMANDS, "target default");
            ESP_RETURN_ON_ERROR(device_state_set_current_frequency(30), LOG_TAG_COMMANDS, "current default");
        } else {
            ESP_RETURN_ON_ERROR(
                device_state_set_current_frequency(state.freq_target_hz),
                LOG_TAG_COMMANDS,
                "current apply");
        }
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Climatizador ligado");
    } else {
        ESP_RETURN_ON_ERROR(device_state_set_drain_state(APP_PERIPHERAL_OFF), LOG_TAG_COMMANDS, "drain off");
        ESP_RETURN_ON_ERROR(device_state_set_power(false), LOG_TAG_COMMANDS, "power off");
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Climatizador desligado");
    }

    return ESP_OK;
}

static esp_err_t apply_peripheral_command(
    const app_command_t *command,
    const device_capabilities_t *capabilities,
    command_result_t *result)
{
    const bool enabled = command->enabled;
    const app_peripheral_state_t desired_state = enabled ? APP_PERIPHERAL_ON : APP_PERIPHERAL_OFF;

    switch (command->type) {
    case APP_COMMAND_SET_PUMP:
        if (!capabilities->pump_available) {
            return reject(command, result, "pump_unavailable", "Bomba nao disponivel neste dispositivo");
        }
        ESP_RETURN_ON_ERROR(device_state_set_pump_state(desired_state), LOG_TAG_COMMANDS, "pump");
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", enabled ? "Bomba ligada" : "Bomba desligada");
        return ESP_OK;
    case APP_COMMAND_SET_SWING:
        if (!capabilities->swing_available) {
            return reject(command, result, "swing_unavailable", "Swing nao disponivel neste dispositivo");
        }
        ESP_RETURN_ON_ERROR(device_state_set_swing_state(desired_state), LOG_TAG_COMMANDS, "swing");
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", enabled ? "Swing ligado" : "Swing desligado");
        return ESP_OK;
    default:
        return ESP_ERR_INVALID_ARG;
    }
}

static esp_err_t apply_drain_command(
    const app_command_t *command,
    const device_capabilities_t *capabilities,
    command_result_t *result)
{
    if (!capabilities->drain_available) {
        return reject(command, result, "drain_unavailable", "Dreno nao disponivel neste dispositivo");
    }

    if (command->type == APP_COMMAND_RUN_DRAIN) {
        ESP_RETURN_ON_ERROR(device_state_set_drain_state(APP_PERIPHERAL_ON), LOG_TAG_COMMANDS, "drain on");
        ESP_RETURN_ON_ERROR(device_state_set_ready_state(APP_READY_STATE_DRAINING), LOG_TAG_COMMANDS, "draining");
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Rotina de dreno iniciada");
    } else {
        device_state_t state = {0};
        ESP_RETURN_ON_ERROR(device_state_set_drain_state(APP_PERIPHERAL_OFF), LOG_TAG_COMMANDS, "drain off");
        ESP_RETURN_ON_ERROR(device_state_get_snapshot(&state), LOG_TAG_COMMANDS, "snapshot");
        ESP_RETURN_ON_ERROR(
            device_state_set_ready_state(state.inverter_running ? APP_READY_STATE_RUNNING : APP_READY_STATE_READY),
            LOG_TAG_COMMANDS,
            "ready");
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Rotina de dreno interrompida");
    }

    return ESP_OK;
}

esp_err_t commands_init(void)
{
    return ESP_OK;
}

esp_err_t commands_execute(const app_command_t *command, command_result_t *result)
{
    device_capabilities_t capabilities = {0};
    app_command_t mutable_command = {0};
    esp_err_t err = ESP_OK;

    if (command == NULL || result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memcpy(&mutable_command, command, sizeof(mutable_command));
    ensure_command_identity(&mutable_command);

    ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_command_status(APP_LAST_COMMAND_SENDING));
    ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_error_code(NULL));

    ESP_RETURN_ON_ERROR(capabilities_get_snapshot(&capabilities), LOG_TAG_COMMANDS, "capabilities");

    switch (mutable_command.type) {
    case APP_COMMAND_POWER_ON:
    case APP_COMMAND_POWER_OFF:
        err = apply_power_command(mutable_command.type, result);
        break;
    case APP_COMMAND_SET_FREQUENCY:
        err = apply_frequency_command(&mutable_command, &capabilities, result);
        break;
    case APP_COMMAND_SET_PUMP:
    case APP_COMMAND_SET_SWING:
        err = apply_peripheral_command(&mutable_command, &capabilities, result);
        break;
    case APP_COMMAND_RUN_DRAIN:
    case APP_COMMAND_STOP_DRAIN:
        err = apply_drain_command(&mutable_command, &capabilities, result);
        break;
    case APP_COMMAND_REQUEST_STATUS:
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Status solicitado");
        err = ESP_OK;
        break;
    case APP_COMMAND_REQUEST_CAPABILITIES:
        set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Capacidades solicitadas");
        err = ESP_OK;
        break;
    case APP_COMMAND_SYNC_SCHEDULES:
        err = schedules_set_table(&mutable_command.schedules);
        if (err == ESP_OK) {
            set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "Agendamentos atualizados");
        } else {
            err = reject(
                &mutable_command,
                result,
                "schedule_update_failed",
                "Falha ao salvar agendamentos");
        }
        break;
    case APP_COMMAND_START_OTA:
        err = ota_start(&mutable_command.ota_request);
        if (err == ESP_OK) {
            set_result(result, true, true, APP_LAST_COMMAND_APPLIED, "ok", "OTA iniciada");
        } else {
            err = reject(&mutable_command, result, "ota_start_failed", "Falha ao iniciar OTA");
        }
        break;
    default:
        err = reject(&mutable_command, result, "unsupported_command", "Tipo de comando nao suportado");
        break;
    }

    if (err == ESP_OK) {
        ESP_ERROR_CHECK_WITHOUT_ABORT(rs485_bridge_dispatch_command(&mutable_command, result));
        ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_command_status(result->status));
        ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_touch_last_seen());
        ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_record_command(&mutable_command, result));
        ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_record_event(
            "command_applied",
            APP_EVENT_LEVEL_INFO,
            "Comando aplicado",
            result->message[0] != '\0' ? result->message : "Comando concluido com sucesso"));
    } else if (result->code[0] == '\0') {
        set_result(result, false, false, APP_LAST_COMMAND_FAILED, "command_failed", "Falha ao aplicar comando");
        ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_command_status(APP_LAST_COMMAND_FAILED));
        ESP_ERROR_CHECK_WITHOUT_ABORT(device_state_set_error_code(result->code));
        ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_record_error(result->code, result->message, true));
        ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_record_command(&mutable_command, result));
    }

    return err;
}

esp_err_t commands_execute_schedule(app_schedule_type_t type)
{
    app_command_t command = {0};
    command_result_t result = {0};
    app_runtime_context_t *runtime = app_state_get_context();

    if (runtime != NULL) {
        strncpy(command.device_id, runtime->mqtt_config.device_id, sizeof(command.device_id) - 1);
    }
    command.source = APP_COMMAND_SOURCE_SCHEDULE;
    command.timestamp = time(NULL);

    switch (type) {
    case APP_SCHEDULE_POWER_ON:
        command.type = APP_COMMAND_POWER_ON;
        break;
    case APP_SCHEDULE_POWER_OFF:
        command.type = APP_COMMAND_POWER_OFF;
        break;
    case APP_SCHEDULE_DRAIN_CYCLE:
        command.type = APP_COMMAND_RUN_DRAIN;
        strncpy(command.reason, "schedule", sizeof(command.reason) - 1);
        break;
    default:
        return ESP_ERR_INVALID_ARG;
    }

    return commands_execute(&command, &result);
}
