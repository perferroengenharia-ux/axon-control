#ifndef PROTOCOL_H
#define PROTOCOL_H

#include "esp_err.h"

#include "app_types.h"

esp_err_t protocol_init(void);
esp_err_t protocol_handle_command_json(
    const char *json,
    app_command_source_t source,
    char **response_json);
esp_err_t protocol_handle_schedules_json(const char *json, char **response_json);
esp_err_t protocol_handle_ota_json(const char *json, char **response_json);
esp_err_t protocol_process_mqtt_message(const char *topic, const char *payload);

esp_err_t protocol_build_status_json(char **out_json);
esp_err_t protocol_build_state_json(char **out_json);
esp_err_t protocol_build_capabilities_json(char **out_json);
esp_err_t protocol_build_schedules_json(char **out_json);
esp_err_t protocol_build_diagnostics_json(char **out_json);
esp_err_t protocol_build_events_json(char **out_json);
esp_err_t protocol_build_errors_json(char **out_json);

esp_err_t protocol_publish_status(void);
esp_err_t protocol_publish_state(void);
esp_err_t protocol_publish_capabilities(void);
esp_err_t protocol_publish_schedules(void);
esp_err_t protocol_publish_events(void);
esp_err_t protocol_publish_errors(void);
esp_err_t protocol_publish_diagnostics(void);
esp_err_t protocol_publish_full_snapshot(void);

#endif

