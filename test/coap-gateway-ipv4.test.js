'use strict';

const PORT = 8080;

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

			let req = coap.request({
				port: PORT,
				pathname: DATA_PATH,
				method: METHOD,
			}),
			payload = {
				device: 'fb4ef414-ff3e-4635-86ff-62079dcf3fed', 
				message: 'Test data',
				target: 'Data target'
			},
			payloadStr = JSON.stringify(payload);
			
			req.write(payloadStr);
			req.on('response', (res) => {
				assert.equal(200, res.code);
				assert.equal('Data Received', res.payload.toString());
				done();
			});
			req.end();
		});
	});

	describe('#message', function () {
		it('should send the message', function (done) {
			this.timeout(5000);

			let req = coap.request({
				port: PORT,
				pathname: MESSAGE_PATH,
				method: METHOD,
			}),
			payload = {
				device: 'fb4ef414-ff3e-4635-86ff-62079dcf3fed', 
				message: 'Test message',
				target: 'Message target'
			},
			payloadStr = JSON.stringify(payload);
			
			req.write(payloadStr);
			req.on('response', (res) => {
				assert.equal(200, res.code);
				assert.equal('Message Received', res.payload.toString());
				done();
			});
			req.end();
		});
	});

	describe('#groupmessage', function () {
		it('should send the group message', function (done) {
			this.timeout(5000);

			let req = coap.request({
				port: PORT,
				pathname: GROUPMESSAGE_PATH,
				method: METHOD,
			}),
			payload = {
				device: 'fb4ef414-ff3e-4635-86ff-62079dcf3fed', 
				message: 'Test Group Message',
				target: 'Group message target'
			},
			payloadStr = JSON.stringify(payload);
			
			req.write(payloadStr);
			req.on('response', (res) => {
				assert.equal(200, res.code);
				assert.equal('Group Message Received', res.payload.toString());
				done();
			});
			req.end();
		});
	});
});