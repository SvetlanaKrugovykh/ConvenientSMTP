const configData = require('../src/config')
const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')
const logger = require('../src/logger')
require('dotenv').config()

module.exports.reSendToTheTelegram = async function (to, from, subject, text, attachmentPaths, forwardArray, metadata) {
  try {
    const recipients = [...(forwardArray || []), to]

    for (const recipient of recipients) {
      if (recipient.includes(process.env.DOMEN)) {
        const tgIds = configData.forwardingRules.rcptToTg[recipient]?.split(',').map(id => id.trim())
        if (tgIds && tgIds.length > 0) {
          for (const tgId of tgIds) {
            let tgMessage = `📧 *Received Email*\n\n` +
              `*From:* ${from}\n` +
              `*To:* ${recipient}\n` +
              `*Subject:* ${subject}\n\n` +
              `*Message Body:*\n${text}\n\n` +
              `*Message-ID:* ${metadata.messageId || 'N/A'}\n` +
              `*In-Reply-To:* ${metadata.inReplyTo || 'N/A'}\n` +
              `*References:* ${metadata.references ? metadata.references.join(', ') : 'N/A'}`

            tgMessage = tgMessage.replace(/[\u0000-\u001F\u007F-\u009F]/g, (char) => {
              return ['\n', '\r'].includes(char) ? char : ''
            })

            if (tgMessage.length > 4096) {
              logger.warn(`Message exceeds Telegram limit and will be truncated: ${tgMessage.length} characters`)
              tgMessage = tgMessage.slice(0, 4093) + '...'
            }

            try {
              await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: tgId,
                text: part,
                parse_mode: 'Markdown',
              })
              logger.info(`Message part sent to Telegram ID ${tgId}`)
            } catch (error) {
              logger.error(`Failed to send message part to Telegram ID ${tgId}:`, error.response?.data || error.message)
            }


            for (const filePath of attachmentPaths) {
              if (fs.existsSync(filePath)) {
                const formData = new FormData()
                formData.append('chat_id', tgId)
                formData.append('document', fs.createReadStream(filePath))

                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, formData, {
                  headers: formData.getHeaders(),
                })
                logger.info(`File sent to Telegram ID ${tgId}: ${filePath}`)
              } else {
                logger.warn(`File not found: ${filePath}`)
              }
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