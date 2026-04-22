#ifndef RS485_BRIDGE_H
#define RS485_BRIDGE_H

#include "esp_err.h"

#include "app_types.h"

esp_err_t rs485_bridge_init(void);
esp_err_t rs485_bridge_dispatch_command(const app_command_t *command, command_result_t *result);

#endif

