'use strict';

var async    = require('async'),
	platform = require('./platform'),
	isEmpty  = require('lodash.isempty'),
	server;

platform.once('close', function () {
	let d = require('domain').create();

	d.once('error', function (error) {
		console.error(error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(function () {
		server.close(() => {
			platform.notifyClose();
			d.exit();
		});
	});
});

platform.once('ready', function (options) {
	let config = require('./config.json'),
		coap   = require('coap');

	if (isEmpty(options.data_url))
		options.data_url = config.data_url.default;

	if (isEmpty(options.message_url))
		options.message_url = config.message_url.default;

	if (isEmpty(options.groupmessage_url))
		options.groupmessage_url = config.groupmessage_url.default;

	server = coap.createServer();

	server.on('request', (request, response) => {
		let payload = request.payload.toString();

		async.waterfall([
			async.constant(payload || '{}'),
			async.asyncify(JSON.parse)
		], (error, payloadObj) => {
			if (error || isEmpty(payloadObj.device)) {
				response.code = '4.00';
				response.end('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.\n');

				return platform.handleException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));
			}

			platform.requestDeviceInfo(payloadObj.device, (error, requestId) => {
				setTimeout(() => {
					response.code = '4.01';
					response.end('Device not registered.\n');

					platform.removeAllListeners(requestId);
				}, 5000);

				platform.once(requestId, (deviceInfo) => {
					if (isEmpty(deviceInfo)) {
						response.code = '4.01';
						response.end('Device not registered.\n');

						return platform.log(JSON.stringify({
							title: 'CoAP Gateway - Access Denied. Device not registered.',
							device: payloadObj.device
						}));
					}

					let url = request.url.split('/')[1];

					if (url === options.data_url) {
						platform.processData(payloadObj.device, payload);

						response.code = '2.05';
						response.end('Data Received\n');

						platform.log(JSON.stringify({
							title: 'CoAP Gateway - Data Received',
							device: payloadObj.device,
							data: payloadObj
						}));
					}
					else if (url === options.message_url) {
						if (isEmpty(payloadObj.target) || isEmpty(payloadObj.message)) return platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is a registered Device ID. "message" is the payload.'));

						platform.sendMessageToDevice(payloadObj.target, payloadObj.message);

						response.code = '2.05';
						response.end('Message Received\n');

						platform.log(JSON.stringify({
							title: 'CoAP Gateway - Message Received',
							source: payloadObj.device,
							target: payloadObj.target,
							message: payloadObj.message
						}));
					}
					else if (url === options.groupmessage_url) {
						if (isEmpty(payloadObj.target) || isEmpty(payloadObj.message)) return platform.handleException(new Error('Invalid group message or command. Group messages must be a valid JSON String with "target" and "message" fields. "target" is a device group id or name. "message" is the payload.'));

						platform.sendMessageToGroup(payloadObj.target, payloadObj.message);

						response.code = '2.05';
						response.end('Group Message Received\n');

						platform.log(JSON.stringify({
							title: 'CoAP Gateway - Group Message Received',
							source: payloadObj.device,
							target: payloadObj.target,
							message: payloadObj.message
						}));
					}
					else {
						response.code = '4.04';
						response.end('Endpoint not found.\n');
						platform.handleException(new Error(`Invalid url specified. URL: ${url}`));
					}
				});
			});
		});
	});

	server.listen(options.port, () => {
		platform.log(`CoAP Gateway initialized on port ${options.port}`);
		platform.notifyReady();
	});
});