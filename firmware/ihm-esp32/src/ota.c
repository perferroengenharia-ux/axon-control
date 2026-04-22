#include "ota.h"

#include <string.h>

#include "esp_check.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include "certs.h"
#include "diagnostics.h"
#include "log_tags.h"

typedef struct {
    bool running;
    int progress_pct;
    char status[APP_OTA_STATUS_MAX_LEN + 1];
    ota_request_t request;
    SemaphoreHandle_t lock;
} ota_context_t;

static ota_context_t s_ota_context;

static void ota_set_status(const char *status, int progress_pct)
{
    if (s_ota_context.lock == NULL) {
        return;
    }

    if (xSemaphoreTake(s_ota_context.lock, pdMS_TO_TICKS(200)) == pdTRUE) {
        strncpy(s_ota_context.status, status, sizeof(s_ota_context.status) - 1);
        s_ota_context.progress_pct = progress_pct;
        xSemaphoreGive(s_ota_context.lock);
    }

    ESP_ERROR_CHECK_WITHOUT_ABORT(diagnostics_set_ota_status(status, progress_pct));
}

static void ota_task(void *arg)
{
    ota_request_t request = *(ota_request_t *)arg;
    esp_http_client_config_t http_config = {
        .url = request.url,
        .cert_pem = request.validate_server_certificate ? APP_ROOT_CA_PEM : NULL,
        .timeout_ms = 10000,
        .keep_alive_enable = true,
    };
    esp_https_ota_config_t ota_config = {
        .http_config = &http_config,
    };

    ota_set_status("downloading", 10);
    ESP_LOGI(LOG_TAG_OTA, "Iniciando OTA via %s", request.url);

    esp_err_t err = esp_https_ota(&ota_config);
    if (err == ESP_OK) {
        ota_set_status("success", 100);
        ESP_LOGI(LOG_TAG_OTA, "OTA concluida com sucesso, reiniciando dispositivo");
        if (xSemaphoreTake(s_ota_context.lock, pdMS_TO_TICKS(200)) == pdTRUE) {
            s_ota_context.running = false;
            xSemaphoreGive(s_ota_context.lock);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart();
    } else {
        ota_set_status("failed", 0);
        ESP_LOGE(LOG_TAG_OTA, "Falha no OTA: %s", esp_err_to_name(err));
        if (xSemaphoreTake(s_ota_context.lock, pdMS_TO_TICKS(200)) == pdTRUE) {
            s_ota_context.running = false;
            xSemaphoreGive(s_ota_context.lock);
        }
    }

    vTaskDelete(NULL);
}

esp_err_t ota_init(void)
{
    memset(&s_ota_context, 0, sizeof(s_ota_context));
    s_ota_context.lock = xSemaphoreCreateMutex();
    if (s_ota_context.lock == NULL) {
        return ESP_ERR_NO_MEM;
    }

    strncpy(s_ota_context.status, "idle", sizeof(s_ota_context.status) - 1);
    s_ota_context.progress_pct = 0;
    s_ota_context.running = false;
    return diagnostics_set_ota_status("idle", 0);
}

esp_err_t ota_start(const ota_request_t *request)
{
    if (request == NULL || request->url[0] == '\0') {
        return ESP_ERR_INVALID_ARG;
    }

    if (strncmp(request->url, "https://", 8) != 0) {
        return ESP_ERR_INVALID_ARG;
    }

    if (xSemaphoreTake(s_ota_context.lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    if (s_ota_context.running) {
        xSemaphoreGive(s_ota_context.lock);
        return ESP_ERR_INVALID_STATE;
    }

    s_ota_context.running = true;
    s_ota_context.request = *request;
    xSemaphoreGive(s_ota_context.lock);

    ota_set_status("starting", 0);

    BaseType_t result = xTaskCreate(
        ota_task,
        "ota_task",
        APP_OTA_TASK_STACK_SIZE,
        &s_ota_context.request,
        APP_OTA_TASK_PRIORITY,
        NULL);

    if (result != pdPASS) {
        if (xSemaphoreTake(s_ota_context.lock, pdMS_TO_TICKS(200)) == pdTRUE) {
            s_ota_context.running = false;
            xSemaphoreGive(s_ota_context.lock);
        }
        ota_set_status("failed", 0);
        return ESP_ERR_NO_MEM;
    }

    return ESP_OK;
}

bool ota_is_running(void)
{
    bool running = false;

    if (s_ota_context.lock == NULL) {
        return false;
    }

    if (xSemaphoreTake(s_ota_context.lock, pdMS_TO_TICKS(200)) == pdTRUE) {
        running = s_ota_context.running;
        xSemaphoreGive(s_ota_context.lock);
    }

    return running;
}

esp_err_t ota_get_status(char *status, size_t status_len, int *progress_pct)
{
    if (status == NULL || progress_pct == NULL || status_len == 0) {
        return ESP_ERR_INVALID_ARG;
    }

    if (xSemaphoreTake(s_ota_context.lock, pdMS_TO_TICKS(200)) != pdTRUE) {
        return ESP_ERR_TIMEOUT;
    }

    strncpy(status, s_ota_context.status, status_len - 1);
    status[status_len - 1] = '\0';
    *progress_pct = s_ota_context.progress_pct;

    xSemaphoreGive(s_ota_context.lock);
    return ESP_OK;
}
