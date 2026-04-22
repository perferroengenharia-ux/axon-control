#include "schedules.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#include "esp_check.h"
#include "esp_log.h"
#include "esp_random.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include "commands.h"
#include "log_tags.h"
#include "storage.h"

static app_schedule_table_t s_schedule_table;
static SemaphoreHandle_t s_schedule_lock;
static TaskHandle_t s_schedule_task_handle;
static bool s_schedule_task_running;

static esp_err_t lock_table(void)
{
    if (s_schedule_lock == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (xSemaphoreTake(s_schedule_lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    return ESP_OK;
}

static void unlock_table(void)
{
    xSemaphoreGive(s_schedule_lock);
}

static void ensure_revision(app_schedule_table_t *table)
{
    if (table->revision[0] == '\0') {
        snprintf(table->revision, sizeof(table->revision), "rev-%08" PRIx32, esp_random());
    }
}

static bool is_due_weekly(uint8_t mask, int wday)
{
    if (wday < 0 || wday > 6) {
        return false;
    }
    return (mask & (1U << wday)) != 0U;
}

static bool should_trigger_schedule(const app_schedule_t *schedule, const struct tm *tm_now)
{
    if (!schedule->enabled) {
        return false;
    }

    if (schedule->hour != tm_now->tm_hour || schedule->minute != tm_now->tm_min) {
        return false;
    }

    switch (schedule->recurrence) {
    case APP_SCHEDULE_DAILY:
        return true;
    case APP_SCHEDULE_WEEKLY:
        return is_due_weekly(schedule->days_of_week_mask, tm_now->tm_wday);
    case APP_SCHEDULE_ONE_SHOT:
        return schedule->one_shot_year == (tm_now->tm_year + 1900) &&
               schedule->one_shot_month == (tm_now->tm_mon + 1) &&
               schedule->one_shot_day == tm_now->tm_mday;
    default:
        return false;
    }
}

static bool already_triggered_this_minute(const app_schedule_t *schedule, time_t now)
{
    if (schedule->last_triggered_at == 0) {
        return false;
    }

    return (now - schedule->last_triggered_at) < 60;
}

static void schedules_task(void *arg)
{
    (void)arg;

    while (s_schedule_task_running) {
        time_t now = time(NULL);
        struct tm tm_now = {0};
        bool table_changed = false;

        localtime_r(&now, &tm_now);

        if (lock_table() == ESP_OK) {
            for (size_t index = 0; index < s_schedule_table.count; ++index) {
                app_schedule_t *schedule = &s_schedule_table.items[index];

                if (!should_trigger_schedule(schedule, &tm_now) ||
                    already_triggered_this_minute(schedule, now)) {
                    continue;
                }

                if (commands_execute_schedule(schedule->type) == ESP_OK) {
                    schedule->last_triggered_at = now;
                    schedule->updated_at = now;
                    table_changed = true;
                    ESP_LOGI(LOG_TAG_SCHEDULES, "Agendamento disparado: %s", schedule->id);
                    if (schedule->recurrence == APP_SCHEDULE_ONE_SHOT) {
                        schedule->enabled = false;
                    }
                }
            }

            if (table_changed) {
                (void)storage_save_schedules(&s_schedule_table);
            }

            unlock_table();
        }

        vTaskDelay(pdMS_TO_TICKS(APP_SCHEDULE_TASK_INTERVAL_MS));
    }

    s_schedule_task_handle = NULL;
    vTaskDelete(NULL);
}

esp_err_t schedules_init(void)
{
    if (s_schedule_lock == NULL) {
        s_schedule_lock = xSemaphoreCreateMutex();
        if (s_schedule_lock == NULL) {
            return ESP_ERR_NO_MEM;
        }
    }

    memset(&s_schedule_table, 0, sizeof(s_schedule_table));
    if (storage_load_schedules(&s_schedule_table) != ESP_OK) {
        memset(&s_schedule_table, 0, sizeof(s_schedule_table));
        strncpy(s_schedule_table.revision, "rev-bootstrap", sizeof(s_schedule_table.revision) - 1);
    }

    return ESP_OK;
}

esp_err_t schedules_start(void)
{
    if (s_schedule_task_handle != NULL) {
        return ESP_OK;
    }

    s_schedule_task_running = true;
    BaseType_t result = xTaskCreate(
        schedules_task,
        "schedules_task",
        4096,
        NULL,
        4,
        &s_schedule_task_handle);

    return result == pdPASS ? ESP_OK : ESP_ERR_NO_MEM;
}

esp_err_t schedules_stop(void)
{
    s_schedule_task_running = false;
    return ESP_OK;
}

esp_err_t schedules_get_table(app_schedule_table_t *table)
{
    if (table == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_table(), LOG_TAG_SCHEDULES, "lock");
    *table = s_schedule_table;
    unlock_table();
    return ESP_OK;
}

esp_err_t schedules_set_table(const app_schedule_table_t *table)
{
    if (table == NULL || table->count > APP_MAX_SCHEDULES) {
        return ESP_ERR_INVALID_ARG;
    }

    ESP_RETURN_ON_ERROR(lock_table(), LOG_TAG_SCHEDULES, "lock");
    s_schedule_table = *table;
    ensure_revision(&s_schedule_table);
    for (size_t index = 0; index < s_schedule_table.count; ++index) {
        if (s_schedule_table.items[index].created_at == 0) {
            s_schedule_table.items[index].created_at = time(NULL);
        }
        s_schedule_table.items[index].updated_at = time(NULL);
    }
    unlock_table();

    return storage_save_schedules(&s_schedule_table);
}
