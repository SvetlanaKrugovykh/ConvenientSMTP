const { PassThrough } = require('stream')
const logger = require('./logger')
const { saveEmail } = require('../db/saveEmail')
const { reSendToTheTelegram } = require('./reSendToTheTg')
const simpleParser = require('mailparser').simpleParser
const fs = require('fs')
const path = require('path')
const configData = require('./config')
const server = require('../server')
const { forwardEmail } = require('./forwardEmail')
require('dotenv').config()

module.exports.relay = function (stream, session, callback, server) {
  const recipient = session.envelope.rcptTo[0].address.trim()
  const sender = session.envelope.mailFrom.address.trim()
  let emailBody = ''

  logger.info('Checking recipient:', recipient)
  logger.info('Checking sender:', sender)

  if (!configData.forwardingRules.validRecipients.map((e) => e.trim()).includes(recipient)) {
    logger.info('Recipient is not allowed')
    return callback(new Error('Recipient is not allowed'))
  }

  if (configData.forwardingRules.blacklist.map((e) => e.trim()).includes(sender)) {
    logger.info('Sender is blacklisted')
    return callback(new Error('Sender is blacklisted'))
  }

  stream.on('data', (chunk) => {
    emailBody += chunk.toString()
  })

  stream.pipe(process.stdout)

  stream.on('end', async () => {
    const to = session.envelope.rcptTo[0].address
    const from = session.envelope.mailFrom.address
    logger.info(`Received email from ${from} to ${to}`)

    try {
      const parsed = await simpleParser(emailBody)
      const subject = parsed.subject || 'No Subject'
      const text = parsed.html || parsed.text
      const attachments = parsed.attachments || []
      const attachmentPaths = []
      for (const attachment of attachments) {
        const attachmentDir = path.isAbsolute(process.env.ATTACHMENT_PATH)
          ? process.env.ATTACHMENT_PATH
          : path.join(__dirname, process.env.ATTACHMENT_PATH)

        if (!fs.existsSync(attachmentDir)) fs.mkdirSync(attachmentDir, { recursive: true })
        const attachmentPath = path.join(attachmentDir, attachment.filename)

        fs.writeFileSync(attachmentPath, attachment.content)
        attachmentPaths.push(attachmentPath)
      }

      logger.info('Email received and parsed. Attachments:', attachments.map((a) => a.filename))
      await saveEmail(to, from, subject, text, attachmentPaths)
      await reSendToTheTelegram(to, from, subject, text, attachmentPaths)

      if (process.env.DO_FORWARD === 'true' && configData.forwardingRules.forwardRules[recipient]) {
        forwardEmail(stream, session, recipient, server, configData)
      }

      logger.info('Email saved to database')
    } catch (error) {
      logger.error('Error saving email:', error)
    }

    callback()
  })
}