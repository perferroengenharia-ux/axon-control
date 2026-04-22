#include "local_server.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "esp_check.h"
#include "esp_http_server.h"
#include "esp_log.h"

#include "app_state.h"
#include "diagnostics.h"
#include "log_tags.h"
#include "protocol.h"

static httpd_handle_t s_http_server;

static void format_iso_timestamp(time_t timestamp, char *buffer, size_t buffer_len)
{
    struct tm tm_utc = {0};
    time_t value = timestamp > 0 ? timestamp : time(NULL);
    gmtime_r(&value, &tm_utc);
    strftime(buffer, buffer_len, "%Y-%m-%dT%H:%M:%SZ", &tm_utc);
}

static void set_json_headers(httpd_req_t *req)
{
    app_runtime_context_t *runtime = app_state_get_context();
    httpd_resp_set_type(req, "application/json");
    if (runtime != NULL && runtime->local_server_config.enable_cors) {
        httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
        httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type, Authorization");
        httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
}

static char *clone_text(const char *text)
{
    size_t length = strlen(text);
    char *copy = calloc(length + 1, sizeof(char));
    if (copy != NULL) {
        memcpy(copy, text, length);
    }
    return copy;
}

static esp_err_t respond_json(httpd_req_t *req, const char *status, char *json)
{
    set_json_headers(req);
    httpd_resp_set_status(req, status);
    esp_err_t err = httpd_resp_sendstr(req, json != NULL ? json : "{}");
    free(json);
    return err;
}

static esp_err_t respond_simple_json(httpd_req_t *req, const char *status, const char *json)
{
    set_json_headers(req);
    httpd_resp_set_status(req, status);
    return httpd_resp_sendstr(req, json);
}

static esp_err_t options_handler(httpd_req_t *req)
{
    set_json_headers(req);
    httpd_resp_set_status(req, "204 No Content");
    return httpd_resp_send(req, NULL, 0);
}

static esp_err_t read_request_body(httpd_req_t *req, char **out_body)
{
    int total_len = req->content_len;
    int received = 0;
    char *body = NULL;

    if (out_body == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (total_len <= 0 || total_len > APP_HTTP_BODY_BUFFER_SIZE) {
        return ESP_ERR_INVALID_SIZE;
    }

    body = calloc((size_t)total_len + 1, sizeof(char));
    if (body == NULL) {
        return ESP_ERR_NO_MEM;
    }

    while (received < total_len) {
        int result = httpd_req_recv(req, body + received, total_len - received);
        if (result <= 0) {
            free(body);
            return ESP_FAIL;
        }
        received += result;
    }

    *out_body = body;
    return ESP_OK;
}

static esp_err_t ping_handler(httpd_req_t *req)
{
    char timestamp[32] = {0};
    char response[256] = {0};
    app_runtime_context_t *runtime = app_state_get_context();

    format_iso_timestamp(time(NULL), timestamp, sizeof(timestamp));
    snprintf(
        response,
        sizeof(response),
        "{\"ok\":true,\"message\":\"Servidor local ativo\",\"timestamp\":\"%s\",\"deviceId\":\"%s\"}",
        timestamp,
        runtime != NULL ? runtime->mqtt_config.device_id : "");
    return respond_simple_json(req, "200 OK", response);
}

static esp_err_t status_handler(httpd_req_t *req)
{
    char *json = NULL;
    esp_err_t err = protocol_build_status_json(&json);
    return respond_json(req, err == ESP_OK ? "200 OK" : "500 Internal Server Error", json);
}

static esp_err_t state_handler(httpd_req_t *req)
{
    char *json = NULL;
    esp_err_t err = protocol_build_state_json(&json);
    return respond_json(req, err == ESP_OK ? "200 OK" : "500 Internal Server Error", json);
}

static esp_err_t capabilities_handler(httpd_req_t *req)
{
    char *json = NULL;
    esp_err_t err = protocol_build_capabilities_json(&json);
    return respond_json(req, err == ESP_OK ? "200 OK" : "500 Internal Server Error", json);
}

static esp_err_t schedules_get_handler(httpd_req_t *req)
{
    char *json = NULL;
    esp_err_t err = protocol_build_schedules_json(&json);
    return respond_json(req, err == ESP_OK ? "200 OK" : "500 Internal Server Error", json);
}

static esp_err_t diagnostics_handler(httpd_req_t *req)
{
    char *json = NULL;
    esp_err_t err = protocol_build_diagnostics_json(&json);
    return respond_json(req, err == ESP_OK ? "200 OK" : "500 Internal Server Error", json);
}

static esp_err_t events_handler(httpd_req_t *req)
{
    char *json = NULL;
    esp_err_t err = protocol_build_events_json(&json);
    return respond_json(req, err == ESP_OK ? "200 OK" : "500 Internal Server Error", json);
}

static esp_err_t errors_handler(httpd_req_t *req)
{
    char *json = NULL;
    esp_err_t err = protocol_build_errors_json(&json);
    return respond_json(req, err == ESP_OK ? "200 OK" : "500 Internal Server Error", json);
}

static esp_err_t commands_post_handler(httpd_req_t *req)
{
    char *body = NULL;
    char *response = NULL;
    esp_err_t err = read_request_body(req, &body);

    if (err != ESP_OK) {
        diagnostics_record_error("http_body_invalid", "Falha ao ler corpo da requisicao de comando", true);
        return respond_simple_json(req, "400 Bad Request", "{\"error\":\"invalid_request_body\"}");
    }

    err = protocol_handle_command_json(body, APP_COMMAND_SOURCE_LOCAL, &response);
    free(body);
    if (response == NULL && err != ESP_OK) {
        response = clone_text(
            "{\"error\":{\"code\":\"invalid_command\",\"message\":\"Comando invalido ou malformado\"}}");
    }
    return respond_json(req, err == ESP_OK ? "200 OK" : "400 Bad Request", response);
}

static esp_err_t schedules_post_handler(httpd_req_t *req)
{
    char *body = NULL;
    char *response = NULL;
    esp_err_t err = read_request_body(req, &body);

    if (err != ESP_OK) {
        return respond_simple_json(req, "400 Bad Request", "{\"error\":\"invalid_request_body\"}");
    }

    err = protocol_handle_schedules_json(body, &response);
    free(body);
    if (response == NULL && err != ESP_OK) {
        response = clone_text(
            "{\"error\":{\"code\":\"invalid_schedules\",\"message\":\"Payload de agendamentos invalido\"}}");
    }
    return respond_json(req, err == ESP_OK ? "200 OK" : "400 Bad Request", response);
}

static esp_err_t ota_post_handler(httpd_req_t *req)
{
    char *body = NULL;
    char *response = NULL;
    esp_err_t err = read_request_body(req, &body);

    if (err != ESP_OK) {
        return respond_simple_json(req, "400 Bad Request", "{\"error\":\"invalid_request_body\"}");
    }

    err = protocol_handle_ota_json(body, &response);
    free(body);
    if (response == NULL && err != ESP_OK) {
        response = clone_text(
            "{\"error\":{\"code\":\"invalid_ota_request\",\"message\":\"Requisicao OTA invalida\"}}");
    }
    return respond_json(req, err == ESP_OK ? "200 OK" : "400 Bad Request", response);
}

static esp_err_t register_endpoint(const httpd_uri_t *uri)
{
    return httpd_register_uri_handler(s_http_server, uri);
}

esp_err_t local_server_init(void)
{
    return ESP_OK;
}

esp_err_t local_server_start(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    app_runtime_context_t *runtime = app_state_get_context();

    if (s_http_server != NULL) {
        return ESP_OK;
    }

    if (runtime == NULL || !runtime->local_server_config.enabled) {
        ESP_LOGI(LOG_TAG_LOCAL, "Servidor local desabilitado");
        return ESP_OK;
    }

    config.server_port = runtime->local_server_config.port;
    config.max_uri_handlers = 24;
    config.recv_wait_timeout = 10;
    config.send_wait_timeout = 10;

    ESP_RETURN_ON_ERROR(httpd_start(&s_http_server, &config), LOG_TAG_LOCAL, "httpd start");

    httpd_uri_t routes[] = {
        {.uri = "/api/v1/ping", .method = HTTP_GET, .handler = ping_handler, .user_ctx = NULL},
        {.uri = "/api/v1/status", .method = HTTP_GET, .handler = status_handler, .user_ctx = NULL},
        {.uri = "/api/v1/state", .method = HTTP_GET, .handler = state_handler, .user_ctx = NULL},
        {.uri = "/api/v1/capabilities", .method = HTTP_GET, .handler = capabilities_handler, .user_ctx = NULL},
        {.uri = "/api/v1/schedules", .method = HTTP_GET, .handler = schedules_get_handler, .user_ctx = NULL},
        {.uri = "/api/v1/diagnostics", .method = HTTP_GET, .handler = diagnostics_handler, .user_ctx = NULL},
        {.uri = "/api/v1/events", .method = HTTP_GET, .handler = events_handler, .user_ctx = NULL},
        {.uri = "/api/v1/errors", .method = HTTP_GET, .handler = errors_handler, .user_ctx = NULL},
        {.uri = "/api/v1/commands", .method = HTTP_POST, .handler = commands_post_handler, .user_ctx = NULL},
        {.uri = "/api/v1/schedules", .method = HTTP_POST, .handler = schedules_post_handler, .user_ctx = NULL},
        {.uri = "/api/v1/ota", .method = HTTP_POST, .handler = ota_post_handler, .user_ctx = NULL},
        {.uri = "/api/v1/commands", .method = HTTP_OPTIONS, .handler = options_handler, .user_ctx = NULL},
        {.uri = "/api/v1/schedules", .method = HTTP_OPTIONS, .handler = options_handler, .user_ctx = NULL},
        {.uri = "/api/v1/ota", .method = HTTP_OPTIONS, .handler = options_handler, .user_ctx = NULL},
    };

    for (size_t index = 0; index < sizeof(routes) / sizeof(routes[0]); ++index) {
        ESP_RETURN_ON_ERROR(register_endpoint(&routes[index]), LOG_TAG_LOCAL, "register route");
    }

    app_state_set_local_server_running(true);
    diagnostics_record_event("local_http_started", APP_EVENT_LEVEL_INFO, "Servidor local", "API local iniciada");
    ESP_LOGI(LOG_TAG_LOCAL, "Servidor local iniciado na porta %u", runtime->local_server_config.port);
    return ESP_OK;
}

esp_err_t local_server_stop(void)
{
    if (s_http_server == NULL) {
        return ESP_OK;
    }

    esp_err_t err = httpd_stop(s_http_server);
    s_http_server = NULL;
    app_state_set_local_server_running(false);
    return err;
}

bool local_server_is_running(void)
{
    return s_http_server != NULL;
}
