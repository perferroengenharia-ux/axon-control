#ifndef LOCAL_SERVER_H
#define LOCAL_SERVER_H

#include <stdbool.h>

#include "esp_err.h"

esp_err_t local_server_init(void);
esp_err_t local_server_start(void);
esp_err_t local_server_stop(void);
bool local_server_is_running(void);

#endif

