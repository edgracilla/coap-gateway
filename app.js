'use strict'

const reekoh = require('reekoh')
const plugin = new reekoh.plugins.Gateway()

const async = require('async')
const isEmpty = require('lodash.isempty')

let server = null

plugin.once('ready', () => {
  let config = require('./config.json')
  let options = plugin.config
  let coap = require('coap')

  if (isEmpty(options.dataUrl)) {
    options.dataUrl = config.dataUrl.default
  } else if (!options.dataUrl.startsWith('/')) {
    options.dataUrl = `/${options.dataUrl}`
  }

  if (isEmpty(options.commandUrl)) {
    options.commandUrl = config.commandUrl.default
  } else if (!options.commandUrl.startsWith('/')) {
    options.commandUrl = `/${options.commandUrl}`
  }

  server = coap.createServer()

  server.once('error', function (error) {
    console.error('CoAP Gateway Error', error)
    plugin.logException(error)

    setTimeout(() => {
      server.close(() => {
        server.removeAllListeners()
        process.exit()
      })
    }, 5000)
  })

  server.once('close', function () {
    plugin.log(`CoAP Gateway closed on port ${options.port}`)
  })

  server.on('request', (request, response) => {
    let payload = request.payload.toString()

    async.waterfall([
      async.constant(payload || '{}'),
      async.asyncify(JSON.parse)
    ], (error, obj) => {
      if (error || isEmpty(obj.device)) {
        response.code = '4.00'
        response.end('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.\n')
        return plugin.logException(new Error('Invalid data sent. Data must be a valid JSON String with at least a "device" field which corresponds to a registered Device ID.'))
      }

      return plugin.requestDeviceInfo(obj.device).then((deviceInfo) => {
        if (isEmpty(deviceInfo)) {
          response.code = '4.01'
          response.end(`Device not registered. Device ID: ${obj.device}\n`)

          return plugin.log(JSON.stringify({
            title: 'CoAP Gateway - Access Denied. Device not registered.',
            device: obj.device
          }))
        }

        let url = `${request.url}`.substr(`${request.url}`.indexOf('/'))

        if (url === options.dataUrl && request.method === 'POST') {
          return plugin.pipe(obj).then(() => {
            response.code = '2.05'
            response.end(`Data Received. Device ID: ${obj.device}. Data: ${payload}\n`)

            return plugin.log(JSON.stringify({
              title: 'CoAP Gateway - Data Received',
              device: obj.device,
              data: obj
            }))
          })
        } else if (url === options.commandUrl && request.method === 'POST') {
          if (isEmpty(obj.target) || isEmpty(obj.command)) {
            return plugin.logException(new Error('Invalid message or command. Message must be a valid JSON String with "target" and "message" fields. "target" is a registered Device ID. "message" is the payload.'))
          }

          return plugin.relayCommand(obj.command, obj.target, obj.deviceGroup).then(() => {
            response.code = '2.05'
            response.end(`Message Received. Device ID: ${obj.device}. Message: ${payload}\n`)

            return plugin.log(JSON.stringify({
              title: 'CoAP Gateway - Message Received',
              source: obj.device,
              target: obj.target,
              message: obj.message
            }))
          })
        } else {
          response.code = '4.04'
          response.end(`Path not found. Kindly check your request path and method. URL: ${request.url}\n`)
          return plugin.logException(new Error(`Invalid url specified. URL: ${url}`))
        }
      }).catch((err) => {
        if (err.message === 'Request for device information has timed out.') {
          response.code = '4.01'
          response.end(`Device not registered. Device ID: ${obj.device}\n`)
        }

        plugin.logException(err)
        console.error(err)
      })
    })
  })

  server.listen(options.port, () => {
    plugin.log(`CoAP Gateway initialized on port ${options.port}`)
    plugin.emit('init')
  })
})

module.exports = plugin
