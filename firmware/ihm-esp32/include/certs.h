#ifndef CERTS_H
#define CERTS_H

/*
 * Substitua o conteudo abaixo pelo certificado CA PEM real do broker MQTT
 * e, se desejar, reutilize o mesmo CA para HTTPS OTA.
 *
 * Exemplo:
 * -----BEGIN CERTIFICATE-----
 * MIID...
 * -----END CERTIFICATE-----
 */
static const char APP_ROOT_CA_PEM[] =
    "-----BEGIN CERTIFICATE-----\n"
    "REPLACE_WITH_REAL_CA_CERTIFICATE\n"
    "-----END CERTIFICATE-----\n";

#endif

