'use strict';

const PORT       = 8080,
	  DEVICE_ID1 = '567827489028375',
	  DEVICE_ID2 = '567827489028376';

var cp     = require('child_process'),
	assert = require('assert'),
	coap   = require('coap'),
	gateway;

describe('IPV4 Gateway', function () {
	this.slow(5000);

	after('terminate child process', function (done) {
		this.timeout(5000);

		gateway.send({
			type: 'close'
		});

		setTimeout(function () {
			gateway.kill('SIGKILL');
			done();
		}, 4000);
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			assert.ok(gateway = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 5 seconds', function (done) {
			this.timeout(5000);

			gateway.on('message', function (message) {
				if (message.type === 'ready')
					done();
			});

			gateway.send({
				type: 'ready',
				data: {
					options: {
						port: PORT,
						socket_type: 'udp4',
						data_url: 'coapTestData',
						message_url: 'coapTestMessage',
						groupmessage_url: 'CoapTestGroupMessage'
					},
					devices: [{_id: DEVICE_ID1}, {_id: DEVICE_ID2}]
				}
			}, function (error) {
				assert.ifError(error);
			});
		});
	});
});