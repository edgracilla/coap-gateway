/* global describe, it, after, before */
'use strict'

const coap = require('coap')
const async = require('async')
const amqp = require('amqplib')
const should = require('should')
const isEmpty = require('lodash.isempty')

const Broker = require('../node_modules/reekoh/lib/broker.lib')

const PORT = 8182
const PLUGIN_ID = 'demo.gateway'
const BROKER = 'amqp://guest:guest@127.0.0.1/'
const OUTPUT_PIPES = 'demo.outpipe1,demo.outpipe2'
const COMMAND_RELAYS = 'demo.relay1,demo.relay2'

let conf = {
  port: PORT,

  method: 'POST',
  dataUrl: 'test/coaptestdatapath',
  commandUrl: 'test/coaptestcmdpath',

  deviceId1: '567827489028375',
  deviceId2: '567827489028376'
}

let _app = null
let _conn = null
let _broker = null
let _channel = null

describe('CoAP Gateway', () => {
  before('init', () => {
    process.env.BROKER = BROKER
    process.env.PLUGIN_ID = PLUGIN_ID
    process.env.OUTPUT_PIPES = OUTPUT_PIPES
    process.env.COMMAND_RELAYS = COMMAND_RELAYS
    process.env.CONFIG = JSON.stringify(conf)

    _broker = new Broker()

    amqp.connect(BROKER).then((conn) => {
      _conn = conn
      return conn.createChannel()
    }).then((channel) => {
      _channel = channel
    }).catch((err) => {
      console.log(err)
    })
  })

  after('terminate', function () {
    _conn.close()
  })

  describe('#start', function () {
    it('should start the app', function (done) {
      this.timeout(10000)
      _app = require('../app')
      _app.once('init', done)
    })
  })

  describe('#test RPC preparation', () => {
    it('should connect to broker', (done) => {
      _broker.connect(BROKER).then(() => {
        return done() || null
      }).catch((err) => {
        done(err)
      })
    })

    it('should spawn temporary RPC server', (done) => {
      // if request arrives this proc will be called
      let sampleServerProcedure = (msg) => {
        return new Promise((resolve, reject) => {
          async.waterfall([
            async.constant(msg.content.toString('utf8')),
            async.asyncify(JSON.parse)
          ], (err, parsed) => {
            if (err) return reject(err)
            parsed.foo = 'bar'
            resolve(JSON.stringify(parsed))
          })
        })
      }

      _broker.createRPC('server', 'deviceinfo').then((queue) => {
        return queue.serverConsume(sampleServerProcedure)
      }).then(() => {
        // Awaiting RPC requests
        done()
      }).catch((err) => {
        done(err)
      })
    })
  })

  describe('#data', function () {
    it('should process the data', function (done) {
      this.timeout(10000)

      let req = coap.request({
          port: conf.port,
          pathname: conf.dataUrl,
          method: conf.method
        }),
        payload = {
          device: conf.deviceId1,
          temperature: 40,
          co2_level: 10
        }

      req.write(JSON.stringify(payload))
      req.on('response', (res) => {
        should.equal('2.05', res.code)
        should.ok(res.payload.toString().startsWith('Data Received.'))
        done()
      })

      req.end()
    })
  })

  describe('#command', function () {
    it('should create commandRelay listener', function (done) {
      this.timeout(10000)

      let cmdRelays = `${COMMAND_RELAYS || ''}`.split(',').filter(Boolean)

      async.each(cmdRelays, (cmdRelay, cb) => {
        _channel.consume(cmdRelay, (msg) => {
          if (!isEmpty(msg)) {
            async.waterfall([
              async.constant(msg.content.toString('utf8') || '{}'),
              async.asyncify(JSON.parse)
            ], (err, obj) => {
              if (err) return console.log('parse json err. supplied invalid data')

              let devices = []

              if (Array.isArray(obj.devices)) {
                devices = obj.devices
              } else {
                devices.push(obj.devices)
              }

              // if (obj.deviceGroup) {
                // get devices from platform agent
                // then push to devices[]
              // }

              async.each(devices, (device, cb) => {
                _channel.publish('amq.topic', `${cmdRelay}.topic`, new Buffer(JSON.stringify({
                  sequenceId: obj.sequenceId,
                  commandId: new Date().getTime().toString(), // uniq
                  command: obj.command,
                  device: device
                })))
                cb()
              }, (err) => {
                should.ifError(err)
              })
            })

            // _channel.publish('amq.topic', `${cmdRelay}.topic`, new Buffer(msg.content.toString('utf8')))
          }
          _channel.ack(msg)
        }).then(() => {
          return cb()
        }).catch((err) => {
          should.ifError(err)
        })
      }, done)
    })

    it('should be able to send command to device', function (done) {
      this.timeout(10000)

      let req = coap.request({
          port: conf.port,
          pathname: conf.commandUrl,
          method: conf.method
        }),
        payload = {
          device: conf.deviceId1,
          target: conf.deviceId2,
          deviceGroup: '',
          command: 'ACTIVATE'
        }

      req.write(JSON.stringify(payload))
      req.on('response', (res) => {
        should.equal('2.05', res.code)
        should.ok(res.payload.toString().startsWith('Message Received.'))
        done()
      })

      req.end()
    })

    /*

     NOTE: not testable yet since we cant pull devices from group yet

    it('should be able to send command to group of device', function (done) {
      this.timeout(10000)

      _ws.send(JSON.stringify({
        topic: 'command',
        deviceGroup: 'group123',
        command: 'ACTIVATE'
      }))

      _app.once('command.ok', () => {
        setTimeout(done, 5000)
      })
    })

     */
  })
})
