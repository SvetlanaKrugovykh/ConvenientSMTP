const axios = require('axios')
const logger = require('./logger')
require('dotenv').config()

module.exports = async function notifyDeliveryFailure({ recipient, sender, subject, error }) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.GROUP_CHAT_ID

    if (!botToken || !chatId) {
      logger.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN or GROUP_CHAT_ID not set')
      return
    }

    let reason = ''
    if (error) {
      if (error.response && error.response.data) {
        try {
          reason = typeof error.response.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response.data)
        } catch (e) {
          reason = String(error.response.data)
        }
      } else {
        reason = error.message || String(error)
      }
    } else {
      reason = 'Unknown error'
    }

    reason = reason.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    reason = reason.replace(/[^\x20-\x7E]/g, '')

    const MAX_REASON = 800
    if (reason.length > MAX_REASON) reason = reason.slice(0, MAX_REASON) + '...'

    const message =
      `Delivery failed\n` +
      `To: ${recipient}\n` +
      `From: ${sender}\n` +
      `Subject: ${subject || 'N/A'}\n` +
      `Reason: ${reason}`

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message
    })

    logger.info(`Notified Telegram group about delivery failure to ${recipient}`)
  } catch (notifyErr) {
    logger.warn('Failed to send delivery failure notification to Telegram:', notifyErr && (notifyErr.message || notifyErr))
  }
}