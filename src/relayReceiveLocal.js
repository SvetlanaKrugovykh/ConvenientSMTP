const logger = require('./logger')
const simpleParser = require('mailparser').simpleParser
const { processEmail } = require('./processEmail')

module.exports.relayReceiveLocal = async function (stream, session, callback, configData) {
  const recipients = session.envelope.rcptTo.map((rcpt) => rcpt.address.trim().toLowerCase())
  const sender = session.envelope.mailFrom.address.trim().toLowerCase()
  let emailBody = ''

  logger.info('relayReceiveLocal called for local incoming mail')
  logger.info('Checking recipients:', recipients.join(', '))
  logger.info('Checking sender:', sender)

  if (!recipients.some((recipient) => configData.forwardingRules.validRecipients.map((e) => e.trim()).includes(recipient))) {
    logger.info('No valid recipients found')
    return callback(new Error('No valid recipients found'))
  }

  if (configData.forwardingRules.blacklist.map((e) => e.trim()).includes(sender)) {
    logger.info('Sender is blacklisted')
    return callback(new Error('Sender is blacklisted'))
  }

  stream.on('data', (chunk) => {
    emailBody += chunk.toString()
  })

  stream.on('end', async () => {
    logger.info(`Received email from ${sender} to ${recipients.join(', ')}`)

    try {
      const parsed = await simpleParser(emailBody)
      const subject = parsed.subject || 'No Subject'
      const text = parsed.text || parsed.html || ''
      const attachments = parsed.attachments || []
      const messageId = parsed.messageId
      const inReplyTo = parsed.inReplyTo
      const references = Array.isArray(parsed.references) ? parsed.references : []

      const relayHeader = parsed.headers.get('x-relay-processed')
      if (relayHeader === 'true') {
        logger.info('Skipping email with X-Relay-Processed header to avoid loop')
        return callback()
      }

      logger.info('Email received and parsed. Attachments:', attachments.map((a) => a.filename))
      logger.info(`Message-ID: ${messageId}`)
      logger.info(`In-Reply-To: ${inReplyTo}`)
      logger.info(`References: ${references.join(', ')}`)

      await processEmail(recipients, sender, subject, text, attachments, configData, {
        messageId,
        inReplyTo,
        references,
      })

      logger.info('Email processed successfully for all recipients')
    } catch (error) {
      logger.error('Error processing email:', error)
    }

    callback()
  })
}