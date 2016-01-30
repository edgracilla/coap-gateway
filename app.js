'use strict';

var platform          = require('./platform'),
	isEmpty           = require('lodash.isempty'),
	clients           = {},
	authorizedDevices = {},
	server;

platform.on('message', function (message) {
	if (clients[message.client]) {
		let client = clients[message.client];

		client.end(new Buffer(message.message));

		platform.sendMessageResponse(message.messageId, 'Message Sent');
		platform.log(JSON.stringify({
			title: 'Message Sent',
			device: message.device,
			messageId: message.messageId,
			message: message.message
		}));
	}
});

platform.on('adddevice', function (device) {
	if (!isEmpty(device) && !isEmpty(device._id)) {
		authorizedDevices[device._id] = device;
		platform.log('Successfully added ' + device._id + ' to the pool of authorized devices.');
	}
	else
		platform.handleException(new Error('Device data invalid. Device not added. ' + device));
});

platform.on('removedevice', function (device) {
	if (!isEmpty(device) && !isEmpty(device._id)) {
		delete authorizedDevices[device._id];
		platform.log('Successfully removed ' + device._id + ' from the pool of authorized devices.');
	}
	else
		platform.handleException(new Error('Device data invalid. Device not removed. ' + device));
});

platform.once('close', function () {
	let d = require('domain').create();

	d.once('error', (error) => {
		console.error(error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(() => {
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

	if (isEmpty(options.data_topic))
		options.data_topic = config.data_topic.default;

	if (isEmpty(options.message_topic))
		options.message_topic = config.message_topic.default;

	if (isEmpty(options.groupmessage_topic))
		options.groupmessage_topic = config.groupmessage_topic.default;

	server = coap.createServer({type: options.socket_type});

	server.on('request', (request, response) => {
		let serverDomain = domain.create();

		serverDomain.once('error', (error) => {
			platform.handleException(error);
			response.end(new Buffer('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));

			serverDomain.exit();
		});

		serverDomain.run(() => {
			var url        = request.url.split('/')[1],
				payload    = request.payload.toString(),
				payloadObj = JSON.parse(request.payload);

			if (isEmpty(payloadObj.device)) {
				platform.handleException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'));

				return serverDomain.exit();
			}

			if (isEmpty(authorizedDevices[payloadObj.device])) {
				platform.log(JSON.stringify({
					title: 'Unauthorized Device',
					device: payloadObj.device
				}));

				response.end(new Buffer('Unauthorized Device.'));

				return serverDomain.exit();
			}

			if (url === options.data_topic) {
				platform.processData(payloadObj.device, payload);
				platform.log(JSON.stringify({
					title: 'Data Received.',
					device: payloadObj.device,
					data: payload
				}));
				if (isEmpty(clients[payloadObj.device])) {
					clients[payloadObj.device] = response;
				}
			}
			else if (url === options.message_topic) {
				platform.sendMessageToDevice(payloadObj.target, payloadObj.message);

				platform.log(JSON.stringify({
					title: 'Message Sent.',
					source: payloadObj.device,
					target: payloadObj.target,
					message: payloadObj.message
				}));

				response.end(new Buffer('Message sent.'));
			}
			else if (url === options.groupmessage_topic) {
				platform.sendMessageToGroup(payloadObj.target, payloadObj.message);

				platform.log(JSON.stringify({
					title: 'Group Message Sent.',
					source: payloadObj.device,
					target: payloadObj.target,
					message: payloadObj.message
				}));

				response.end(new Buffer('Group message sent.'));
			}
			else
				response.end(new Buffer('Invalid topic.'));

			serverDomain.exit();
		});
	});

	server.listen(options.port, () => {
		platform.log('CoAP Gateway initialized on port ' + options.port);
		platform.notifyReady();
	});
});