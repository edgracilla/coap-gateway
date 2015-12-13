# CoAP Gateway

[![Build Status](https://travis-ci.org/Reekoh/coap-gateway.svg)](https://travis-ci.org/Reekoh/coap-gateway)
![Dependencies](https://img.shields.io/david/Reekoh/coap-gateway.svg)
![Dependencies](https://img.shields.io/david/dev/Reekoh/coap-gateway.svg)
![Built With](https://img.shields.io/badge/built%20with-gulp-red.svg)

CoAP Gateway for the Reekoh IOT platform.

## Description

This plugin provides a way for devices and/or sensors that are connected to the Reekoh Instance to relay/broadcast messages/command to other connected devices.

## Configuration

The following parameters are needed to configure this plugin:

1. Port - The port to use in relaying messages(CoAP uses 5683 as default).
2. Socket Type - Optional. The socket type to use(default udp4).
3. Data Topic - The topic in which the sent data belongs to(default is reekoh/data).
4. Message Topic - The topic in which the message to be sent belongs to(default is reekoh/messages).
5. Group Message Topic - The topic in which the group message to be sent belongs to(defualt is reekoh/groupmessages).
6. Authorized Topics - Other authorized topics the devices can subscribe from and/or publish to.

These parameters are then injected to the plugin from the platform.