const { SMTPServer } = require('smtp-server')
const configData = require('./src/config')
const logger = require('./src/logger')
const path = require('path')
const auth = require('./src/auth')
const { relay: relayReceive } = require('./src/relayReceive')
const { relaySend } = require('./src/relaySend')
const { checkBlacklists, checkSPF, checkPTR } = require('./src/security')
require('dotenv').config()
const updateTables = require('./db/tablesUpdate').updateTables

try {
  updateTables()
} catch (err) {
  logger.info(err)
}

logger.info('Valid recipients:', configData.forwardingRules.validRecipients)

function handleOnData(stream, session, callback) {
  logger.info('onData called')

  const sender = session.envelope.mailFrom.address.toLowerCase()
  const recipients = session.envelope.rcptTo.map((rcpt) => rcpt.address.toLowerCase())
  logger.info('Sender:', sender)
  logger.info('Recipients:', recipients.join(', '))

  if (recipients.some((recipient) => configData.forwardingRules.validRecipients.includes(recipient))) {
    logger.info('Handling as relayReceive (incoming mail)')
    relayReceive(stream, session, callback, configData, this)
  } else if (configData.forwardingRules.validRecipients.includes(sender)) {
    logger.info('Handling as relaySend (outgoing mail)')
    console.log('relaySend:', relaySend)
    relaySend(stream, session, callback, configData)
  } else {
    logger.warn('Neither sender nor recipients match validRecipients. Rejecting.')
    return callback(new Error('Unauthorized relay attempt'))
  }

  stream.on('end', () => callback())
}

function handleOnAuth(authData, session, callback) {
  logger.info('onAuth called')
  logger.info('Auth data:', authData)
  auth(authData, session, callback)
}

async function handleOnConnect(session, callback) {
  logger.info(`Incoming connection from ${session.remoteAddress}`)

  try {
    const blacklisted = await checkBlacklists(session.remoteAddress)
    if (blacklisted) {
      logger.warn(`Blocked IP: ${session.remoteAddress}`)
      return callback(new Error('Your IP is blacklisted'))
    }

    const ptrValid = await checkPTR(session.remoteAddress)
    if (!ptrValid) {
      logger.warn(`Invalid PTR record for ${session.remoteAddress}`)
      return callback(new Error('PTR record check failed'))
    }

  } catch (err) {
    logger.error(`DNS check failed: ${err.message}`)
    return callback(new Error('Temporary error, try later'))
  }

  callback()
}

async function handleOnMailFrom(address, session, callback) {
  logger.info(`Mail from: ${address.address} | IP: ${session.remoteAddress}`)
  logger.info(`Client IP: ${session.remoteAddress}`)

  if (configData.forwardingRules.allowedRelayIPs.includes(session.remoteAddress)) {
    logger.info(`SPF check skipped for allowed IP: ${session.remoteAddress}`)
    return callback()
  }

  const spfValid = await checkSPF(address.address, session.remoteAddress)
  if (!spfValid) {
    logger.warn(`SPF check failed for ${address.address}`)
    return callback(new Error('SPF check failed'))
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
  server.listen(configData.port, configData.server, () => {
    console.log(`${configData.server}:${configData.port}`)
    logger.info('SMTP server started on server ' + configData.server + ' and port ' + configData.port)
  })

  server.on('error', (err) => {
    logger.error('Server ERROR: ' + err.message)
  })
}