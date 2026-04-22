#ifndef SCHEDULES_H
#define SCHEDULES_H

#include <stdbool.h>

#include "esp_err.h"

#include "app_types.h"

esp_err_t schedules_init(void);
esp_err_t schedules_start(void);
esp_err_t schedules_stop(void);
esp_err_t schedules_get_table(app_schedule_table_t *table);
esp_err_t schedules_set_table(const app_schedule_table_t *table);

#endif

