const { SMTPServer } = require('smtp-server')
const configData = require('./src/config')
const logger = require('./src/logger')
const path = require('path')
const auth = require('./src/auth')
const { relay } = require('./src/relay')
require('dotenv').config()
const updateTables = require('./db/tablesUpdate').updateTables

try {
  updateTables()
} catch (err) {
  logger.info(err)
}

logger.info('Allowed relay IPs:', configData.forwardingRules.allowedRelayIPs)
logger.info('Blacklist:', configData.forwardingRules.blacklist)
logger.info('Valid recipients:', configData.forwardingRules.validRecipients)

function handleOnData(stream, session, callback) {
  logger.info('onData called')
  relay(stream, session, callback, configData, this)
  stream.on('end', () => callback())
}

function handleOnAuth(authData, session, callback) {
  logger.info('onAuth called')
  logger.info('Auth data:', authData)
  auth(authData, session, callback)
}

function handleOnConnect(session, callback) {
  logger.info('onConnect called')
  callback()
}

function handleOnMailFrom(address, session, callback) {
  logger.info('onMailFrom called')
  logger.info(`Client IP: ${session.remoteAddress}`)
  if (!configData.forwardingRules.allowedRelayIPs.includes(session.remoteAddress)) {
    logger.info('IP not allowed for relay')
    return callback(new Error('IP not allowed for relay'))
  }
  callback()
}

const server = new SMTPServer({
  onData: handleOnData,
  onAuth: handleOnAuth,
  onConnect: handleOnConnect,
  onMailFrom: handleOnMailFrom,
  logger: true,
  disabledCommands: ['STARTTLS'],
})

module.exports.server = server

module.exports.startServer = function () {
  server.listen(configData.port, () => {
    logger.info('SMTP server started on server ' + configData.server + ' and port ' + configData.port)
  })

  server.on('error', (err) => {
    logger.error('Server ERROR: ' + err.message)
  })
}