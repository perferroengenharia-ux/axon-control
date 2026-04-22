#ifndef APP_TYPES_H
#define APP_TYPES_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <time.h>

#include "app_config.h"

typedef enum {
    APP_CONNECTION_MODE_CLOUD = 0,
    APP_CONNECTION_MODE_LOCAL_LAN,
    APP_CONNECTION_MODE_LOCAL_AP,
    APP_CONNECTION_MODE_SIMULATION,
} app_connection_mode_t;

typedef enum {
    APP_READY_STATE_READY = 0,
    APP_READY_STATE_STARTING,
    APP_READY_STATE_RUNNING,
    APP_READY_STATE_STOPPING,
    APP_READY_STATE_DRAINING,
    APP_READY_STATE_FAULT,
    APP_READY_STATE_OFFLINE,
} app_ready_state_t;

typedef enum {
    APP_WATER_LEVEL_OK = 0,
    APP_WATER_LEVEL_LOW,
    APP_WATER_LEVEL_DISABLED,
    APP_WATER_LEVEL_UNKNOWN,
} app_water_level_state_t;

typedef enum {
    APP_LAST_COMMAND_IDLE = 0,
    APP_LAST_COMMAND_SENDING,
    APP_LAST_COMMAND_APPLIED,
    APP_LAST_COMMAND_FAILED,
} app_last_command_status_t;

typedef enum {
    APP_PERIPHERAL_OFF = 0,
    APP_PERIPHERAL_ON,
    APP_PERIPHERAL_UNAVAILABLE,
    APP_PERIPHERAL_UNKNOWN,
} app_peripheral_state_t;

typedef enum {
    APP_TRANSPORT_IDLE = 0,
    APP_TRANSPORT_CONNECTING,
    APP_TRANSPORT_CONNECTED,
    APP_TRANSPORT_DEGRADED,
    APP_TRANSPORT_ERROR,
} app_transport_status_t;

typedef enum {
    APP_DRAIN_MODE_TIMED = 0,
    APP_DRAIN_MODE_UNTIL_SENSOR,
    APP_DRAIN_MODE_HYBRID,
    APP_DRAIN_MODE_DISABLED,
} app_drain_mode_t;

typedef enum {
    APP_PUMP_LOGIC_LINKED = 0,
    APP_PUMP_LOGIC_INDEPENDENT,
    APP_PUMP_LOGIC_FORCED_ON,
    APP_PUMP_LOGIC_FORCED_OFF,
} app_pump_logic_mode_t;

typedef enum {
    APP_WATER_SENSOR_MODE_NORMAL = 0,
    APP_WATER_SENSOR_MODE_INVERTED,
    APP_WATER_SENSOR_MODE_DISABLED,
} app_water_sensor_mode_t;

typedef enum {
    APP_RESUME_LAST_STATE = 0,
    APP_RESUME_ALWAYS_OFF,
    APP_RESUME_ALWAYS_ON,
} app_resume_mode_t;

typedef enum {
    APP_AUTO_RESET_ENABLED = 0,
    APP_AUTO_RESET_DISABLED,
} app_auto_reset_mode_t;

typedef enum {
    APP_COMMAND_POWER_ON = 0,
    APP_COMMAND_POWER_OFF,
    APP_COMMAND_SET_FREQUENCY,
    APP_COMMAND_SET_PUMP,
    APP_COMMAND_SET_SWING,
    APP_COMMAND_RUN_DRAIN,
    APP_COMMAND_STOP_DRAIN,
    APP_COMMAND_REQUEST_STATUS,
    APP_COMMAND_REQUEST_CAPABILITIES,
    APP_COMMAND_SYNC_SCHEDULES,
    APP_COMMAND_START_OTA,
} app_command_type_t;

typedef enum {
    APP_COMMAND_SOURCE_MQTT = 0,
    APP_COMMAND_SOURCE_LOCAL,
    APP_COMMAND_SOURCE_SCHEDULE,
    APP_COMMAND_SOURCE_INTERNAL,
} app_command_source_t;

typedef enum {
    APP_SCHEDULE_POWER_ON = 0,
    APP_SCHEDULE_POWER_OFF,
    APP_SCHEDULE_DRAIN_CYCLE,
} app_schedule_type_t;

typedef enum {
    APP_SCHEDULE_ONE_SHOT = 0,
    APP_SCHEDULE_DAILY,
    APP_SCHEDULE_WEEKLY,
} app_schedule_recurrence_t;

typedef enum {
    APP_EVENT_LEVEL_INFO = 0,
    APP_EVENT_LEVEL_WARNING,
    APP_EVENT_LEVEL_ERROR,
} app_event_level_t;

typedef struct {
    bool sta_enabled;
    char sta_ssid[APP_SSID_MAX_LEN + 1];
    char sta_password[APP_WIFI_PASSWORD_MAX_LEN + 1];
    bool ap_fallback_enabled;
    char ap_ssid[APP_SSID_MAX_LEN + 1];
    char ap_password[APP_WIFI_PASSWORD_MAX_LEN + 1];
    uint8_t max_retry;
} app_wifi_config_t;

typedef struct {
    bool enabled;
    bool use_tls;
    char broker_uri[APP_URI_MAX_LEN + 1];
    uint16_t port;
    char username[APP_USERNAME_MAX_LEN + 1];
    char password[APP_PASSWORD_MAX_LEN + 1];
    char topic_prefix[APP_TOPIC_PREFIX_MAX_LEN + 1];
    char device_id[APP_DEVICE_ID_MAX_LEN + 1];
    uint16_t keepalive_sec;
} app_mqtt_config_t;

typedef struct {
    bool enabled;
    uint16_t port;
    bool enable_cors;
} app_local_server_config_t;

typedef struct {
    int f_min_hz;
    int f_max_hz;
    bool pump_available;
    bool swing_available;
    bool drain_available;
    bool water_sensor_enabled;
    app_drain_mode_t drain_mode;
    int drain_time_sec;
    int drain_return_delay_sec;
    app_pump_logic_mode_t pump_logic_mode;
    app_water_sensor_mode_t water_sensor_mode;
    int pre_wet_sec;
    int dry_panel_sec;
    int dry_panel_freq_hz;
    app_resume_mode_t resume_mode;
    app_auto_reset_mode_t auto_reset_mode;
} device_capabilities_t;

typedef struct {
    bool device_online;
    app_connection_mode_t connection_mode;
    bool inverter_running;
    int freq_current_hz;
    int freq_target_hz;
    app_peripheral_state_t pump_state;
    app_peripheral_state_t swing_state;
    app_peripheral_state_t drain_state;
    app_water_level_state_t water_level_state;
    time_t last_seen;
    app_last_command_status_t last_command_status;
    char last_error_code[APP_CODE_MAX_LEN + 1];
    app_ready_state_t ready_state;
} device_state_t;

typedef struct {
    char id[APP_COMMAND_ID_MAX_LEN + 1];
    char device_id[APP_DEVICE_ID_MAX_LEN + 1];
    app_event_level_t level;
    char title[APP_TITLE_MAX_LEN + 1];
    char message[APP_MESSAGE_MAX_LEN + 1];
    char code[APP_CODE_MAX_LEN + 1];
    time_t created_at;
} app_event_record_t;

typedef struct {
    char id[APP_COMMAND_ID_MAX_LEN + 1];
    char device_id[APP_DEVICE_ID_MAX_LEN + 1];
    char code[APP_CODE_MAX_LEN + 1];
    char message[APP_MESSAGE_MAX_LEN + 1];
    time_t created_at;
    bool recoverable;
} app_error_record_t;

typedef struct {
    size_t count;
    app_event_record_t items[APP_MAX_EVENTS];
} app_event_list_t;

typedef struct {
    size_t count;
    app_error_record_t items[APP_MAX_ERRORS];
} app_error_list_t;

typedef struct {
    char url[APP_URI_MAX_LEN + 1];
    bool validate_server_certificate;
} ota_request_t;

typedef struct {
    char id[APP_SCHEDULE_ID_MAX_LEN + 1];
    char device_id[APP_DEVICE_ID_MAX_LEN + 1];
    app_schedule_type_t type;
    app_schedule_recurrence_t recurrence;
    bool enabled;
    uint8_t hour;
    uint8_t minute;
    uint8_t days_of_week_mask;
    int one_shot_year;
    int one_shot_month;
    int one_shot_day;
    time_t created_at;
    time_t updated_at;
    time_t last_triggered_at;
} app_schedule_t;

typedef struct {
    char revision[APP_REVISION_MAX_LEN + 1];
    size_t count;
    app_schedule_t items[APP_MAX_SCHEDULES];
} app_schedule_table_t;

typedef struct {
    char id[APP_COMMAND_ID_MAX_LEN + 1];
    char device_id[APP_DEVICE_ID_MAX_LEN + 1];
    app_command_type_t type;
    app_command_source_t source;
    time_t timestamp;
    int freq_target_hz;
    bool enabled;
    bool include_diagnostics;
    char reason[APP_REASON_MAX_LEN + 1];
    ota_request_t ota_request;
    app_schedule_table_t schedules;
} app_command_t;

typedef struct {
    bool accepted;
    bool applied;
    app_last_command_status_t status;
    char code[APP_CODE_MAX_LEN + 1];
    char message[APP_MESSAGE_MAX_LEN + 1];
} command_result_t;

typedef struct {
    char firmware_version[32];
    uint64_t uptime_sec;
    char connection_summary[APP_MESSAGE_MAX_LEN + 1];
    app_transport_status_t transport_status;
    time_t last_sync_at;
    char last_error_code[APP_CODE_MAX_LEN + 1];
    char last_error_message[APP_MESSAGE_MAX_LEN + 1];
    char last_command_id[APP_COMMAND_ID_MAX_LEN + 1];
    app_command_type_t last_command_type;
    time_t last_command_time;
    char ota_status[APP_OTA_STATUS_MAX_LEN + 1];
    int ota_progress_pct;
    app_event_list_t events;
    app_error_list_t errors;
} diagnostics_info_t;

#endif

