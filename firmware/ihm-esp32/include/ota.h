#ifndef OTA_H
#define OTA_H

#include <stdbool.h>

#include "esp_err.h"

#include "app_types.h"

esp_err_t ota_init(void);
esp_err_t ota_start(const ota_request_t *request);
bool ota_is_running(void);
esp_err_t ota_get_status(char *status, size_t status_len, int *progress_pct);

#endif

