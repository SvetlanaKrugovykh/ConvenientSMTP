const configData = require('../src/config')
const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')
const logger = require('../src/logger')
require('dotenv').config()

module.exports.reSendToTheTelegram = async function (to, from, subject, text, attachmentPaths, forwardArray) {
  try {
    const recipients = [...(forwardArray || []), to]

    for (const recipient of recipients) {
      if (recipient.includes(process.env.DOMEN)) {
        const tgIds = configData.forwardingRules.rcptToTg[recipient]?.split(',').map(id => id.trim())
        if (tgIds && tgIds.length > 0) {
          for (const tgId of tgIds) {
            const tgMessage = `Received email from ${from} to ${recipient}\nSubject: ${subject}\n\n${text}`
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              chat_id: tgId,
              text: tgMessage,
            })
            logger.info(`Message sent to Telegram ID ${tgId}`)

            for (const filePath of attachmentPaths) {
              const formData = new FormData()
              formData.append('chat_id', tgId)
              formData.append('document', fs.createReadStream(filePath))

              await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, formData, {
                headers: formData.getHeaders(),
              })
              logger.info(`File sent to Telegram ID ${tgId}: ${filePath}`)
            }
          }
        } else {
          logger.info(`No Telegram ID found for recipient ${recipient}`)
        }
      }
    }
  } catch (error) {
    logger.error('Error saving email or sending to Telegram:', error)
  }
}