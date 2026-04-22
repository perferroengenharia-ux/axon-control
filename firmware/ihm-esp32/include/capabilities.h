#ifndef CAPABILITIES_H
#define CAPABILITIES_H

#include "esp_err.h"

#include "app_types.h"

esp_err_t capabilities_init(void);
esp_err_t capabilities_get_snapshot(device_capabilities_t *capabilities);
esp_err_t capabilities_set_snapshot(const device_capabilities_t *capabilities);

#endif

