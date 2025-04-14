const { SMTPServer } = require('smtp-server')
const configData = require('./src/config')
const logger = require('./src/logger')
const path = require('path')
const auth = require('./src/auth')
const { relayReceiveLocal } = require('./src/relayReceiveLocal')
const { relayReceiveExternal } = require('./src/relayReceiveExternal')
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
  try {
    const sender = session.envelope.mailFrom.address.toLowerCase()
    const recipients = session.envelope.rcptTo.map((rcpt) => rcpt.address.toLowerCase())
    const remoteIP = session.remoteAddress

    logger.info('Sender:', sender)
    logger.info('Recipients:', recipients.join(', '))
    logger.info('Remote IP:', remoteIP)

    const isValidRecipient = (addr) => configData.forwardingRules.validRecipients.includes(addr)
    const isAllowedRelayIP = configData.forwardingRules.allowedRelayIPs.includes(remoteIP)

    if (remoteIP === configData.server) {
      if (
        recipients.some((recipient) => !isValidRecipient(recipient))
      ) {
        logger.info('Handling as relaySend (outgoing mail from local server or allowed IP)')
        relaySend(stream, session, callback, configData)
      } else {
        logger.info('Handling as relayReceiveLocal (local incoming mail)')
        relayReceiveLocal(stream, session, callback, configData)
      }
    } else if (recipients.some(isValidRecipient)) {
      logger.info('Handling as relayReceiveExternal (external incoming mail)')
      relayReceiveExternal(stream, session, callback, configData)
    } else if (
      isValidRecipient(sender) || isAllowedRelayIP
    ) {
      logger.info('Handling as relaySend (outgoing mail from allowed external IP)')
      relaySend(stream, session, callback, configData)
    } else {
      logger.warn('Neither sender nor recipients match validRecipients. Rejecting.')
      return callback(new Error('Unauthorized relay attempt'))
    }

    stream.on('end', () => callback())
  } catch (err) {
    logger.error('Error in handleOnData:', err)
    callback(err)
  }
}

function handleOnAuth(authData, session, callback) {
  logger.info('onAuth called')
  logger.info('Auth data:', authData)

  const recipients = session.envelope.rcptTo?.map((rcpt) => rcpt.address.toLowerCase()) || []

  // 👇 Если явно сказано, что auth не нужен (например, внешний сервер)
  if (session.authNotRequired && recipients.some((recipient) =>
    configData.forwardingRules.validRecipients.includes(recipient))) {
    logger.info('Authentication skipped for valid recipient from external server')
    return callback(null, { user: 'anonymous' })
  }

  // в остальных случаях — обычная проверка
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

    if (isIncomingMail(session)) session.authNotRequired = true
  } catch (err) {
    logger.error(`DNS check failed: ${err.message}`)
    return callback(new Error('Temporary error, try later'))
  }

  callback()
}


function isIncomingMail(session) {
  return true //TODO
}


async function handleOnMailFrom(address, session, callback) {
  logger.info('handleOnMailFrom called')
  logger.info(`Mail from: ${address.address} | IP: ${session.remoteAddress}`)
  logger.info(`Session envelope:`, session.envelope)

  const recipients = session.envelope.rcptTo?.map((rcpt) => rcpt.address.toLowerCase()) || []
  if (recipients.some((recipient) => configData.forwardingRules.validRecipients.includes(recipient))) {
    logger.info('Skipping authentication for external incoming mail')
    return callback()
  }

  if (configData.forwardingRules.allowedRelayIPs.includes(session.remoteAddress)) {
    logger.info(`SPF check skipped for allowed IP: ${session.remoteAddress}`)
    return callback()
  }

  // const spfValid = await checkSPF(address.address, session.remoteAddress)
  // if (!spfValid) {
  //   logger.warn(`SPF check failed for ${address.address}`)
  //   return callback(new Error('SPF check failed'))
  // }

  callback()
}

const server = new SMTPServer({
  onData: handleOnData,
  onAuth: handleOnAuth,
  onConnect: handleOnConnect,
  onMailFrom: handleOnMailFrom,
  logger: true,
  disabledCommands: ['STARTTLS'],
  authOptional: true,
  socketTimeout: 60000,
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

  server.on('clientError', (err, socket) => {
    logger.warn('Client ERROR: ' + err.message)
    socket.end('400 Bad Request\r\n')
  })
}