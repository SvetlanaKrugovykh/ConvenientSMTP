const axios = require('axios')
const logger = require('./logger')
require('dotenv').config()

module.exports = async function notifyDeliveryFailure({ recipient, sender, subject, error }) {
  const botToken = (process.env.TELEGRAM_BOT_NOTIFY_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const chatId = (process.env.GROUP_CHAT_ID || '').trim()
  if (!botToken || !chatId) return false

  function escapeMarkdownV2(str = '') {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!')
  }

  try {
    let reason = 'Unknown error'
    if (error) {
      if (error.response && error.response.data) {
        try { reason = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data) } catch (e) { reason = String(error.response.data) }
      } else {
        reason = error.message || String(error)
      }
    }

    reason = reason.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    reason = reason.replace(/https?:\/\/support\.google\.com\/[^\s)]+/gi, 'https://support.google.com/mail/?p=NoSuchUser')
    reason = reason.replace(/Google\s*\([\s\S]*?https?:\/\/support\.google\.com[^\s)]*\)[^\n]*/gi, 'Google Help: https://support.google.com/mail/?p=NoSuchUser')
    reason = reason.replace(/Fix bounced or rejected emails[\s\S]*/i, 'See: https://support.google.com/mail/?p=NoSuchUser')
    reason = reason.replace(/[^\x20-\x7E]/g, '')
    const MAX = 800
    if (reason.length > MAX) reason = reason.slice(0, MAX) + '...'

    const reasonClean = reason.replace(/`/g, "'")
    const lines = [
      '*Delivery failed*',
      `*To:* ${escapeMarkdownV2(recipient)}`,
      `*From:* ${escapeMarkdownV2(sender)}`,
      `*Subject:* ${escapeMarkdownV2(subject || 'N/A')}`,
      '*Reason:*',
      '```',
      escapeMarkdownV2(reasonClean),
      '```'
    ]
    const message = lines.join('\n')

    const urlBase = `https://api.telegram.org/bot${botToken}`
    const postUrl = `${urlBase}/sendMessage`
    const payload = { chat_id: chatId, text: message, parse_mode: 'MarkdownV2' }

    logger.info(`notifyDeliveryFailure: sending to chat ${chatId}, token len=${botToken.length}`)
    const preview = message.length > 1000 ? message.slice(0, 1000) + '...' : message
    logger.info(`notifyDeliveryFailure: message length=${message.length}, preview: ${preview}`)

    try {
      const resp = await axios.post(postUrl, payload, { timeout: 8000 })
      logger.info('Telegram notify response status:', resp.status)
      return true
    } catch (postErr) {
      logger.warn('First attempt to notify Telegram failed:', postErr && (postErr.message || postErr.code || postErr))
      if (postErr && postErr.request) logger.warn('postErr.request: present')
      if (postErr && postErr.response) {
        logger.warn('postErr.response.status:', postErr.response.status)
        try { logger.warn('postErr.response.data:', JSON.stringify(postErr.response.data)) } catch (e) { }
      } else {
        logger.warn('No response received for POST (possible network/timeout/proxy)')
      }

      try {
        const getUrl = `${urlBase}/sendMessage?chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(message)}`
        logger.info('notifyDeliveryFailure: attempting fallback GET request')
        const resp2 = await axios.get(getUrl, { timeout: 8000 })
        logger.info('Telegram notify response status (GET fallback):', resp2.status)
        return true
      } catch (getErr) {
        logger.warn('Fallback GET also failed:', getErr && (getErr.message || getErr.code || getErr))
        if (getErr && getErr.response) {
          try { logger.warn('getErr.response.data:', JSON.stringify(getErr.response.data)) } catch (e) { }
        } else {
          logger.warn('No response received for GET (network/timeout/proxy)')
        }
        return false
      }
    }
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
