#include "rs485_bridge.h"

#include "esp_log.h"

#include "log_tags.h"

esp_err_t rs485_bridge_init(void)
{
    ESP_LOGI(
        LOG_TAG_RS485,
        "Bridge RS485 inicializado em modo stub. Integre UART/RS485 real neste modulo.");
    return ESP_OK;
}

esp_err_t rs485_bridge_dispatch_command(const app_command_t *command, command_result_t *result)
{
    if (command == NULL || result == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_LOGI(
        LOG_TAG_RS485,
        "Stub RS485 recebeu comando id=%s type=%d. Aqui entra a integracao futura com o MI.",
        command->id,
        command->type);

    return ESP_OK;
}
