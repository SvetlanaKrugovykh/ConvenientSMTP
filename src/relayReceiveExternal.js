const logger = require('./logger')
const simpleParser = require('mailparser').simpleParser
const { processEmail } = require('./processEmail')

module.exports.relayReceiveExternal = async function (stream, session, callback, configData) {
  const recipients = session.envelope.rcptTo.map((rcpt) => rcpt.address.trim().toLowerCase())
  const sender = session.envelope.mailFrom.address.trim().toLowerCase()
  let emailBody = ''

  logger.info('relayReceiveExternal called for external incoming mail')
  logger.info('Checking recipients:', recipients.join(', '))
  logger.info('Checking sender:', sender)

  const isSpam = configData.forwardingRules.antispamList.some((entry) => {
    return sender === entry || sender.endsWith(entry)
  })

  if (isSpam) {
    logger.warn(`Blocked spam email from ${sender}`);
    return callback(new Error('Your email was identified as spam and rejected.'))
  }

  if (!recipients.some((recipient) => configData.forwardingRules.validRecipients.map((e) => e.trim()).includes(recipient))) {
    logger.info('No valid recipients found for external email')
    return callback(new Error('No valid recipients found'))
  }

  if (configData.forwardingRules.blacklist.map((e) => e.trim()).includes(sender)) {
    logger.info('Sender is blacklisted (external)')
    return callback(new Error('Sender is blacklisted'))
  }

  stream.on('data', (chunk) => {
    emailBody += chunk.toString()
  })

  stream.on('end', async () => {
    logger.info(`Received external email from ${sender} to ${recipients.join(', ')}`)

    try {
      const parsed = await simpleParser(emailBody)
      const subject = parsed.subject || 'No Subject'
      const text = parsed.text || parsed.html || ''
      const attachments = parsed.attachments || []
      const messageId = parsed.messageId
      const inReplyTo = parsed.inReplyTo
      const references = parsed.references || []

      logger.info(`Parsed external email from ${sender} to ${recipients.join(', ')}`)
      logger.info(`Message-ID: ${messageId}`)
      logger.info(`In-Reply-To: ${inReplyTo}`)
      logger.info(`References: ${references.join(', ')}`)

      await processEmail(recipients, sender, subject, text, attachments, configData, {
        messageId,
        inReplyTo,
        references,
      })

      logger.info('External email processed successfully for all recipients')
    } catch (error) {
      logger.error('Error processing external email:', error)
    }

    callback()
  })
}
