'use strict';

const PORT       = 8081,
	  DEVICE_ID1 = '567827489028375',
	  DEVICE_ID2 = '567827489028376';

var cp     = require('child_process'),
	assert = require('assert'),
	coap   = require('coap'),
	gateway;

describe('IPV6 Gateway', function () {
	this.slow(5000);

	after('terminate child process', function (done) {
		this.timeout(5000);

		gateway.send({
			type: 'close'
		});

		setTimeout(function () {
			gateway.kill('SIGKILL');
			done();
		}, 2000);
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
						socket_type: 'udp6',
						data_topic: 'coapTestData',
						message_topic: 'coapTestMessage',
						groupmessage_topic: 'CoapTestGroupMessage',
						authorized_topics: 'coapTestData,coapTestMessage,CoapTestGroupMessage'
					},
					devices: [{_id: DEVICE_ID1}, {_id: DEVICE_ID2}]
				}
			}, function (error) {
				assert.ifError(error);
			});
		});
	});

	describe('#message', function () {
		it('it should route the data to the target device', function (done) {
			this.timeout(5000);

			var req = coap.request(`coap://localhost:${PORT}/coapTestData`);
			req.on('response', function (res) {
				assert.equal(res.payload.toString('utf8'), 'TURNOFF');
				done();
			});
			req.end(new Buffer(JSON.stringify({device: '567827489028376', data: 'test data'})));

			setTimeout(function () {
				gateway.send({
					type: 'message',
					data: {
						client: '567827489028376',
						messageId: '55fce1455167c470abeedae2',
						message: 'TURNOFF'
					}
				});
			}, 2000);
		});
	});
});