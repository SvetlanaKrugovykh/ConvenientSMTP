const { PassThrough } = require('stream')
const logger = require('./logger')

module.exports.forwardEmail = function (stream, session, recipient, server, configData) {
  const forwardAddresses = configData.forwardingRules.forwardRules[recipient]
  logger.info('Forwarding email to:', forwardAddresses)

  if (Array.isArray(forwardAddresses)) {
    forwardAddresses.forEach((forwardAddress, index) => {
      logger.info(`Forwarding email to ${forwardAddress} (index: ${index})`)
      if (session.envelope.mailFrom.address.trim() === forwardAddress.trim()) {
        logger.info(`Skipping forwarding to ${forwardAddress} as it matches the sender address`)
        return
      }

      const forwardStream = new PassThrough()
      stream.pipe(forwardStream)

      const forwardSession = {
        envelope: {
          mailFrom: session.envelope.mailFrom,
          rcptTo: [{ address: forwardAddress }],
        },
      }

      logger.info('Forward session:', forwardSession)

      try {
        server.onData(forwardStream, forwardSession, (err) => {
          if (err) {
            logger.error('Error forwarding email: ' + err.message)
            return
          }
          logger.info('Email forwarded to ' + forwardAddress)
        })
      } catch (error) {
        logger.error('Exception in server.onData: ' + error.message)
      }
    })
  } else {
    logger.error('forwardAddresses is not an array:', forwardAddresses)
  }
}