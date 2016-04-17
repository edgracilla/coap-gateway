'use strict';

var platform          = require('./platform'),
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
	let domain = require('domain'),
		keyBy  = require('lodash.keyby'),
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
		let d = domain.create();

		d.once('error', function (error) {
			platform.handleException(error);
			d.exit();
		});

		d.run(function () {
			let url        = request.url.split('/')[1],
				payload    = request.payload.toString(),
				payloadObj = JSON.parse(request.payload);

			if (isEmpty(payloadObj.device)) {
				platform.handleException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));

				return d.exit();
			}

			if (isEmpty(authorizedDevices[payloadObj.device])) {
				platform.log(JSON.stringify({
					title: 'CoAP Gateway - Access Denied. Unauthorized Device',
					device: payloadObj.device
				}));

				return d.exit();
			}

			if (url === options.data_url) {
				platform.processData(payloadObj.device, payload);

				platform.log(JSON.stringify({
					title: 'CoAP Gateway - Data Received.',
					device: payloadObj.device,
					data: payload
				}));

				if (isEmpty(clients[payloadObj.device]))
					clients[payloadObj.device] = response;
			}
			else if (url === options.message_url) {
				if (isEmpty(payloadObj.target) || isEmpty(payloadObj.message)) {
					platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is the a registered Device ID. "message" is the payload.'));

					return d.exit();
				}

				platform.sendMessageToDevice(payloadObj.target, payloadObj.message);

				platform.log(JSON.stringify({
					title: 'CoAP Gateway - Message Sent.',
					source: payloadObj.device,
					target: payloadObj.target,
					message: payloadObj.message
				}));
			}
			else if (url === options.groupmessage_url) {
				if (isEmpty(payloadObj.target) || isEmpty(payloadObj.message)) {
					platform.handleException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is the a registered Device ID. "message" is the payload.'));

					return d.exit();
				}

				platform.sendMessageToGroup(payloadObj.target, payloadObj.message);

				platform.log(JSON.stringify({
					title: 'CoAP Gateway - Group Message Sent.',
					source: payloadObj.device,
					target: payloadObj.target,
					message: payloadObj.message
				}));
			}
			else {
				platform.handleException(new Error(`Invalid url specified. URL: ${url}`));
			}

			d.exit();
		});
	});

	server.listen(options.port, () => {
		platform.log(`CoAP Gateway initialized on port ${options.port}`);
		platform.notifyReady();
	});
});