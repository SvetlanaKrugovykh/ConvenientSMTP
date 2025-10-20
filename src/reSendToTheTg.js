const configData = require('../src/config')
const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')
const logger = require('../src/logger')
require('dotenv').config()

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function splitMessage(text, maxLen = 4096) {
  const parts = []
  let current = 0
  while (current < text.length) {
    parts.push(text.slice(current, current + maxLen))
    current += maxLen
  }
  return parts
}

module.exports.reSendToTheTelegram = async function (to, from, subject, text, attachmentPaths, forwardArray, metadata) {
  try {
    const recipients = [...(forwardArray || []), to]

    for (const recipient of recipients) {
      if (recipient.includes(process.env.DOMEN)) {
        const tgIds = configData.forwardingRules.rcptToTg[recipient]?.split(',').map(id => id.trim())
        if (tgIds && tgIds.length > 0) {
          for (const tgId of tgIds) {
            let cleanText = text
            if (/<[a-z][\s\S]*>/i.test(text)) {
              cleanText = text.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim()
            }

            cleanText = fixEncoding(cleanText)
            const fixedSubject = fixEncoding(subject)
            const fixedFrom = fixEncoding(from)

            const references = Array.isArray(metadata?.references)
              ? metadata.references
              : (metadata?.references ? [metadata.references] : [])

            const referencesText = references.length
              ? references.join(', ')
              : 'N/A'

            let tgMessage = `📧 *Received Email*\n\n` +
              `*From:* ${processHeaderField(fixedFrom)}\n` +
              `*To:* ${processHeaderField(recipient)}\n` +
              `*Subject:* ${processHeaderField(fixedSubject)}\n` +
              `*Message Body:*\n${processLinksAndText(cleanText)}\n\n` +
              `*Message-ID:* ${processHeaderField(metadata?.messageId || 'N/A')}\n` +
              `*In-Reply-To:* ${processHeaderField(metadata?.inReplyTo || 'N/A')}\n` +
              `*References:* ${processHeaderField(referencesText)}\n`

            tgMessage = tgMessage.replace(/[\u0000-\u001F\u007F-\u009F]/g, (char) => {
              return ['\n', '\r'].includes(char) ? char : ''
            })

            const messageParts = splitMessage(tgMessage, 4096)

            for (const part of messageParts) {
              try {
                logger.info(`Trying to send message part to Telegram ID ${tgId}`)
                await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                  chat_id: tgId,
                  text: part,
                  parse_mode: 'Markdown'
                })
                logger.info(`Message part sent to Telegram ID ${tgId}`)
                await delay(800)
              } catch (error) {
                logger.warn(`Markdown failed, retrying as plain text: ${error.response?.data || error.message}`)
                try {
                  await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: tgId,
                    text: part
                  })
                  logger.info(`Message part sent as plain text to Telegram ID ${tgId}`)
                } catch (retryError) {
                  logger.error(`Failed to send message part to Telegram ID ${tgId}: ${retryError.response?.data || retryError.message}`)
                }
              }
            }

            for (const filePath of attachmentPaths) {
              if (fs.existsSync(filePath)) {
                const formData = new FormData()
                formData.append('chat_id', tgId)
                formData.append('document', fs.createReadStream(filePath))

                try {
                  await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, formData, {
                    headers: formData.getHeaders(),
                  })
                  logger.info(`File sent to Telegram ID ${tgId}: ${filePath}`)
                  await delay(800)
                } catch (error) {
                  logger.error(`Failed to send file to Telegram ID ${tgId}:`, error.response?.data || error.message, filePath)
                }
              } else {
                logger.warn(`File not found: ${filePath}`)
              }
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error saving email or sending to Telegram:', error)
  }
}

function fixEncoding(text) {
  if (!text) return ''

  if (text.includes('пїЅ') || text.includes('їЅ')) {
    try {
      const iconv = require('iconv-lite')
      const buffer = Buffer.from(text, 'binary')
      return iconv.decode(buffer, 'windows-1251')
    } catch (error) {
      logger.warn('Failed to fix encoding, using original text')
      return text
    }
  }

  return text
}

function processLinksAndText(text) {
  if (!text) return ''
  
  // Find all URLs and temporarily replace them with placeholders
  const urls = []
  const urlRegex = /(https?:\/\/[^\s\]]+)/g
  let tempText = text.replace(urlRegex, (match) => {
    urls.push(match)
    return `__URL_PLACEHOLDER_${urls.length - 1}__`
  })
  
  // Escape only critical markdown characters, preserve normal punctuation
  tempText = tempText.replace(/([_*\[\]()~`>#+=|{}!])/g, '\\$1')
  
  // Restore URLs back
  urls.forEach((url, index) => {
    tempText = tempText.replace(`__URL_PLACEHOLDER_${index}__`, url)
  })
  
  return tempText
}

function processHeaderField(text) {
  if (!text) return ''
  
  // For header fields (From, To, Subject), escape only the most critical characters
  // Preserve dots, commas, colons, and other common email symbols
  return text.replace(/([_*\[\]`])/g, '\\$1')
}

function escapeMarkdown(text) {
  if (!text) return ''
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\$])/g, '\\$1')
}