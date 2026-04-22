#ifndef COMMANDS_H
#define COMMANDS_H

#include "esp_err.h"

#include "app_types.h"

esp_err_t commands_init(void);
esp_err_t commands_execute(const app_command_t *command, command_result_t *result);
esp_err_t commands_execute_schedule(app_schedule_type_t type);

#endif

