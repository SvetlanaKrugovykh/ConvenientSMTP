const axios = require('axios')
const logger = require('./logger')
require('dotenv').config()

/**
 * Notify Telegram group about a failed delivery.
 * Returns true on success, false on failure.
 */
module.exports = async function notifyDeliveryFailure({ recipient, sender, subject, error }) {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const chatId = (process.env.GROUP_CHAT_ID || '').trim()

  if (!botToken || !chatId) {
    logger.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN or GROUP_CHAT_ID not set')
    return false
  }

  // quick sanity checks
  if (!/^[-\d]+$/.test(chatId) && !/^@/.test(chatId)) {
    logger.warn(`GROUP_CHAT_ID looks suspicious: "${chatId}"`)
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
    reason = reason.replace(/[^\x20-\x7E]/g, '') // keep ASCII printable only
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

    // debug info (do not print full token)
    logger.info(`notifyDeliveryFailure: sending to chat ${chatId}, token len=${botToken.length}`)

    // try once, then one quick retry
    try {
      const resp = await axios.post(url, payload, { timeout: 8000 })
      logger.info('Telegram notify response status:', resp.status)
    } catch (err) {
      logger.warn('First attempt to notify Telegram failed, retrying once:', err && (err.message || err.code || err))
      // detailed log of first error
      if (err) {
        logger.warn('err.code:', err.code)
        if (err.request) logger.warn('err.request: present')
        if (err.response) {
          logger.warn('err.response.status:', err.response.status)
          try { logger.warn('err.response.data:', JSON.stringify(err.response.data)) } catch (e) { }
        }
      }
      // retry
      const resp2 = await axios.post(url, payload, { timeout: 8000 })
      logger.info('Telegram notify response status (retry):', resp2.status)
    }

    logger.info(`Notified Telegram group about delivery failure to ${recipient}`)
    return true
  } catch (notifyErr) {
    logger.warn('Failed to send delivery failure notification to Telegram:')
    logger.warn('notify error message:', notifyErr && (notifyErr.message || notifyErr.code || String(notifyErr)))
    if (notifyErr && notifyErr.response) {
      logger.warn('notify response status:', notifyErr.response.status)
      try { logger.warn('notify response data:', JSON.stringify(notifyErr.response.data)) } catch (e) { }
    }
    if (notifyErr && notifyErr.request) {
      logger.warn('notify request was made but no response received (network/timeout)')
    }
    return false
  }
}