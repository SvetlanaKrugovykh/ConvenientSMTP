const axios = require('axios')
const logger = require('./logger')
require('dotenv').config()

module.exports = async function notifyDeliveryFailure({ recipient, sender, subject, error }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.GROUP_CHAT_ID

  if (!botToken || !chatId) {
    logger.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN or GROUP_CHAT_ID not set')
    return false
  }

  try {
    let reason = 'Unknown error'
    if (error) {
      if (error.response && error.response.data) {
        try {
          reason = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)
        } catch (e) {
          reason = String(error.response.data)
        }
      } else {
        reason = error.message || String(error)
      }
    }

    reason = reason.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    reason = reason.replace(/[^\x20-\x7E]/g, '')
    const MAX = 800
    if (reason.length > MAX) reason = reason.slice(0, MAX) + '...'

    const message =
      `Delivery failed\n` +
      `To: ${recipient}\n` +
      `From: ${sender}\n` +
      `Subject: ${subject || 'N/A'}\n` +
      `Reason: ${reason}`

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const payload = { chat_id: chatId, text: message }

    try {
      await axios.post(url, payload, { timeout: 8000 })
    } catch (err) {
      logger.warn('First attempt to notify Telegram failed, retrying once:', err.message || err)
      await axios.post(url, payload, { timeout: 8000 })
    }

    logger.info(`Notified Telegram group about delivery failure to ${recipient}`)
    return true
  } catch (notifyErr) {
    logger.warn('Failed to send delivery failure notification to Telegram:')
    logger.warn('notify error message:', notifyErr && notifyErr.message)
    if (notifyErr && notifyErr.response) {
      logger.warn('notify response status:', notifyErr.response.status)
      logger.warn('notify response data:', JSON.stringify(notifyErr.response.data))
    }
    return false
  }
}