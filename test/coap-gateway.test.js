'use strict';

const PORT              = 8080,
	  METHOD            = 'POST',
	  DATA_PATH         = 'coaptestdatapath',
	  MESSAGE_PATH      = 'coaptestmessagepath',
	  GROUPMESSAGE_PATH = 'coaptestgroupmessagepath',
	  DEVICE_ID1        = '567827489028375',
	  DEVICE_ID2        = '567827489028376';

var cp     = require('child_process'),
	assert = require('assert'),
	coap   = require('coap'),
	coapGateway;

describe('CoAP Gateway', function () {
	this.slow(5000);

	after('terminate child process', function (done) {
		this.timeout(5000);

		coapGateway.send({
			type: 'close'
		});

		setTimeout(function () {
			coapGateway.kill('SIGKILL');
			done();
		}, 4000);
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			assert.ok(coapGateway = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 5 seconds', function (done) {
			this.timeout(5000);

			coapGateway.on('message', function (message) {
				if (message.type === 'ready')
					done();
				else if (message.type === 'requestdeviceinfo') {
					if (message.data.deviceId === DEVICE_ID1 || message.data.deviceId === DEVICE_ID2) {
						coapGateway.send({
							type: message.data.requestId,
							data: {
								_id: message.data.deviceId
							}
						});
					}
				}
			});

			coapGateway.send({
				type: 'ready',
				data: {
					options: {
						port: PORT,
						data_url: DATA_PATH,
						message_url: MESSAGE_PATH,
						groupmessage_url: GROUPMESSAGE_PATH
					}
				}
			}, function (error) {
				assert.ifError(error);
			});
		});
	});

	describe('#data', function () {
		it('should process the data', function (done) {
			this.timeout(5000);

			let req     = coap.request({
					port: PORT,
					pathname: DATA_PATH,
					method: METHOD
				}),
				payload = {
					device: DEVICE_ID1,
					temperature: 40,
					co2_level: 10
				};

			req.write(JSON.stringify(payload));
			req.on('response', (res) => {
				assert.equal('2.05', res.code);
				assert.equal('Data Received\n', res.payload.toString());
				done();
			});
			req.end();
		});
	});

	describe('#message', function () {
		it('should send the message', function (done) {
			this.timeout(5000);

			let req     = coap.request({
					port: PORT,
					pathname: MESSAGE_PATH,
					method: METHOD
				}),
				payload = {
					device: DEVICE_ID1,
					target: DEVICE_ID2,
					message: 'ACTIVATE'
				};

			req.write(JSON.stringify(payload));
			req.on('response', (res) => {
				assert.equal('2.05', res.code);
				assert.equal('Message Received\n', res.payload.toString());
				done();
			});
			req.end();
		});
	});

	describe('#groupmessage', function () {
		it('should send a group message using a device group id', function (done) {
			this.timeout(5000);

			let req     = coap.request({
					port: PORT,
					pathname: GROUPMESSAGE_PATH,
					method: METHOD
				}),
				payload = {
					device: DEVICE_ID1,
					message: 'ACTIVATE',
					target: '575e559e86c77818257d260a'
				};

			req.write(JSON.stringify(payload));
			req.on('response', (res) => {
				assert.equal('2.05', res.code);
				assert.equal('Group Message Received\n', res.payload.toString());
				done();
			});
			req.end();
		});

		it('should send a group message using a device group name', function (done) {
			this.timeout(5000);

			let req     = coap.request({
					port: PORT,
					pathname: GROUPMESSAGE_PATH,
					method: METHOD
				}),
				payload = {
					device: DEVICE_ID1,
					message: 'ACTIVATE',
					target: 'GPS Trackers'
				};

			req.write(JSON.stringify(payload));
			req.on('response', (res) => {
				assert.equal('2.05', res.code);
				assert.equal('Group Message Received\n', res.payload.toString());
				done();
			});
			req.end();
		});
	});
});