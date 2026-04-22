#ifndef DIAGNOSTICS_H
#define DIAGNOSTICS_H

#include <stdbool.h>

#include "esp_err.h"

#include "app_types.h"

esp_err_t diagnostics_init(void);
esp_err_t diagnostics_get_snapshot(diagnostics_info_t *diagnostics);
esp_err_t diagnostics_get_events(app_event_list_t *events);
esp_err_t diagnostics_get_errors(app_error_list_t *errors);
esp_err_t diagnostics_update_uptime(void);
esp_err_t diagnostics_set_connection_summary(const char *summary);
esp_err_t diagnostics_set_transport_status(app_transport_status_t status);
esp_err_t diagnostics_set_last_sync_now(void);
esp_err_t diagnostics_record_event(
    const char *code,
    app_event_level_t level,
    const char *title,
    const char *message);
esp_err_t diagnostics_record_error(const char *code, const char *message, bool recoverable);
esp_err_t diagnostics_record_command(const app_command_t *command, const command_result_t *result);
esp_err_t diagnostics_set_ota_status(const char *status, int progress_pct);

#endif

