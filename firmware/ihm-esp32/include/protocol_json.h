#ifndef PROTOCOL_JSON_H
#define PROTOCOL_JSON_H

#include "esp_err.h"

#include "app_types.h"

esp_err_t protocol_json_parse_command_request(const char *json, app_command_t *command);
esp_err_t protocol_json_parse_schedule_payload(const char *json, app_schedule_table_t *table);
esp_err_t protocol_json_parse_ota_request(const char *json, ota_request_t *request);

esp_err_t protocol_json_serialize_status(char **out_json);
esp_err_t protocol_json_serialize_state(char **out_json);
esp_err_t protocol_json_serialize_capabilities(char **out_json);
esp_err_t protocol_json_serialize_schedules(char **out_json);
esp_err_t protocol_json_serialize_diagnostics(char **out_json);
esp_err_t protocol_json_serialize_events(char **out_json);
esp_err_t protocol_json_serialize_errors(char **out_json);
esp_err_t protocol_json_serialize_command_ack(
    const app_command_t *command,
    const command_result_t *result,
    char **out_json);

const char *protocol_json_connection_mode_to_string(app_connection_mode_t mode);
const char *protocol_json_ready_state_to_string(app_ready_state_t state);
const char *protocol_json_water_level_to_string(app_water_level_state_t state);
const char *protocol_json_command_status_to_string(app_last_command_status_t status);
const char *protocol_json_peripheral_state_to_string(app_peripheral_state_t state);
const char *protocol_json_transport_status_to_string(app_transport_status_t status);
const char *protocol_json_command_type_to_string(app_command_type_t type);

#endif

