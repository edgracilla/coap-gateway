'use strict';

var async             = require('async'),
	platform          = require('./platform'),
	isEmpty           = require('lodash.isempty'),
	clients           = {},
	authorizedDevices = {},
	server;

platform.on('adddevice', function (device) {
	if (!isEmpty(device) && !isEmpty(device._id)) {
		authorizedDevices[device._id] = device;
		platform.log(`Successfully added ${device._id} to the pool of authorized devices.`);
	}
	else
		platform.handleException(new Error(`Device data invalid. Device not added. ${device}`));
});

platform.on('removedevice', function (device) {
	if (!isEmpty(device) && !isEmpty(device._id)) {
		delete authorizedDevices[device._id];
		platform.log(`Successfully added ${device._id} from the pool of authorized devices.`);
	}
	else
		platform.handleException(new Error(`Device data invalid. Device not removed. ${device}`));
});

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

platform.once('ready', function (options, registeredDevices) {
	let keyBy  = require('lodash.keyby'),
		config = require('./config.json'),
		coap   = require('coap');

	if (!isEmpty(registeredDevices))
		authorizedDevices = keyBy(registeredDevices, '_id');

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
			if (error || isEmpty(payloadObj.device)) return platform.handleException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));

			if (isEmpty(authorizedDevices[payloadObj.device])) {
				return platform.log(JSON.stringify({
					title: 'CoAP Gateway - Access Denied. Unauthorized Device',
					device: payloadObj.device
				}));
			}

			let url = request.url.split('/')[1];

			if (url === options.data_url) {
				platform.processData(payloadObj.device, payload);

				platform.log(JSON.stringify({
					title: 'CoAP Gateway - Data Received',
					device: payloadObj.device,
					data: payloadObj
				}));

				if (isEmpty(clients[payloadObj.device]))
					clients[payloadObj.device] = response;
			}
			else if (url === options.message_url) {
				if (isEmpty(payloadObj.target) || isEmpty(payloadObj.message)) return platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is a registered Device ID. "message" is the payload.'));

				platform.sendMessageToDevice(payloadObj.target, payloadObj.message);

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

				platform.log(JSON.stringify({
					title: 'CoAP Gateway - Group Message Received',
					source: payloadObj.device,
					target: payloadObj.target,
					message: payloadObj.message
				}));
			}
			else
				platform.handleException(new Error(`Invalid url specified. URL: ${url}`));
		});
	});

	server.listen(options.port, () => {
		platform.log(`CoAP Gateway initialized on port ${options.port}`);
		platform.notifyReady();
	});
});