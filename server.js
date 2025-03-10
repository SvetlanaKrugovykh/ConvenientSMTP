const { SMTPServer } = require('smtp-server')
const config = require('./src/config')
const logger = require('./src/logger')
const fs = require('fs')
const path = require('path')
const auth = require('./src/auth')
const { relay } = require('./src/relay')
const { forwardRules } = require('./config/forwarding-rules')
require('dotenv').config()
const updateTables = require('./db/tablesUpdate').updateTables

try {
  updateTables()
} catch (err) {
  logger.info(err)
}

const blacklist = fs
  .readFileSync(path.join(__dirname, './config', 'blacklist.txt'), 'utf-8')
  .split('\n')
  .map(email => email.trim())
  .filter(Boolean)

const allowedRelayIPs = fs
  .readFileSync(path.join(__dirname, './config', 'allowed_ips.txt'), 'utf-8')
  .split('\n')
  .map(ip => ip.trim())
  .filter(Boolean)

const validRecipients = fs
  .readFileSync(path.join(__dirname, './config', 'rcpt_to.in_host_list'), 'utf-8')
  .split('\n')
  .map(email => email.trim())
  .filter(Boolean)

logger.info('Allowed relay IPs:', allowedRelayIPs)
logger.info('Blacklist:', blacklist)
logger.info('Valid recipients:', validRecipients)


module.exports.forwardingRules = {
  blacklist,
  allowedRelayIPs,
  validRecipients,
  forwardRules
}

function handleOnData(stream, session, callback) {
  logger.info('onData called')
  relay(stream, session, callback, this)
  stream.on('end', () => callback())
}


function handleOnAuth(authData, session, callback) {
  logger.info('onAuth called')
  auth(authData, session, callback)
}

function handleOnConnect(session, callback) {
  logger.info('onConnect called')
  callback()
}

function handleOnMailFrom(address, session, callback) {
  logger.info('onMailFrom called')
  logger.info(`Client IP: ${session.remoteAddress}`)
  if (!module.exports.forwardingRules.allowedRelayIPs.includes(session.remoteAddress)) {
    logger.info('IP not allowed for relay')
    return callback(new Error('IP not allowed for relay'))
  }
  callback()
}


module.exports.server = new SMTPServer({
  onData: handleOnData,
  onAuth: handleOnAuth,
  onConnect: handleOnConnect,
  onMailFrom: handleOnMailFrom,
  logger: true,
  disabledCommands: ['STARTTLS'],
})

module.exports.startServer = function () {

  // server.listen(config.server, config.port, () => { //TODO server
  // })

  module.exports.server.listen(config.port, () => {
    logger.info('SMTP server started on server ' + config.server + ' and port ' + config.port)
  })

  module.exports.server.on('error', (err) => {
    logger.error('Server ERROR: ' + err.message)
  })
}

