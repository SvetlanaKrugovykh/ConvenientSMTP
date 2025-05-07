require('dotenv').config()
const fs = require('fs')
const path = require('path')
const logger = require('./logger')
const { saveEmail } = require('../db/saveEmail')
const { reSendToTheTelegram } = require('./reSendToTheTg')
const { forwardEmail } = require('./forwardEmail')

module.exports.processEmail = async function (recipients, sender, subject, text, attachments, configData, metadata) {

  if (!metadata.messageId) {
    const messageId = `<${Date.now()}-${Math.random().toString(36).substring(2)}@${sender.split('@')[1]}>`
    console.log(`Generated Message-ID: ${messageId}`)
    metadata.messageId = messageId
  }

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

  logger.info('Attachments saved:', attachmentPaths)

  for (const recipient of recipients) {
    const forwardArray = configData.forwardingRules.forwardRules[recipient]

    await saveEmail(
      recipient,
      sender,
      subject,
      text,
      attachmentPaths,
      {
        messageId: metadata.messageId,
        inReplyTo: metadata.inReplyTo,
        references: metadata.references,
      }
    )

    await reSendToTheTelegram(recipient, sender, subject, text, attachmentPaths, forwardArray, metadata)

    if (process.env.DO_FORWARD === 'true' && forwardArray) {
      const letterData = {
        to: recipient,
        from: sender,
        subject,
        text,
        attachmentPaths,
      }
      forwardEmail(recipient, configData, letterData)
    }
  }

  logger.info('Email processed for all recipients')
}