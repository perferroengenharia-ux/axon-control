#ifndef PROTOCOL_TOPICS_H
#define PROTOCOL_TOPICS_H

#include "esp_err.h"

#include "app_types.h"

typedef enum {
    PROTOCOL_TOPIC_STATUS = 0,
    PROTOCOL_TOPIC_STATE,
    PROTOCOL_TOPIC_CAPABILITIES,
    PROTOCOL_TOPIC_COMMANDS,
    PROTOCOL_TOPIC_EVENTS,
    PROTOCOL_TOPIC_ERRORS,
    PROTOCOL_TOPIC_SCHEDULES,
} protocol_topic_kind_t;

typedef struct {
    char base[APP_URI_MAX_LEN + 1];
    char status[APP_URI_MAX_LEN + 1];
    char state[APP_URI_MAX_LEN + 1];
    char capabilities[APP_URI_MAX_LEN + 1];
    char commands[APP_URI_MAX_LEN + 1];
    char events[APP_URI_MAX_LEN + 1];
    char errors[APP_URI_MAX_LEN + 1];
    char schedules[APP_URI_MAX_LEN + 1];
} protocol_topic_bundle_t;

esp_err_t protocol_topics_build(protocol_topic_bundle_t *topics);
const char *protocol_topics_kind_name(protocol_topic_kind_t kind);

#endif

