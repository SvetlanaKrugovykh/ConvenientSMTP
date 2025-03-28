const { Pool } = require('pg')
const dotenv = require('dotenv')
const logger = require('../src/logger')
const configData = require('../src/config')
const axios = require('axios')

dotenv.config()

const pool = new Pool({
  user: process.env.PAY_DB_USER,
  host: process.env.PAY_DB_HOST,
  database: process.env.PAY_DB_NAME,
  password: process.env.PAY_DB_PASSWORD,
  port: process.env.PAY_DB_PORT,
})

module.exports.saveEmail = async function (to, from, subject, body, attachments = []) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const emailResult = await client.query(
      'INSERT INTO emails (from_email, to_email, subject, body) VALUES ($1, $2, $3, $4) RETURNING id',
      [from, to, subject, body]
    )

    const emailId = emailResult.rows[0].id

    for (const filePath of attachments) {
      await client.query('INSERT INTO attachments (email_id, file_path) VALUES ($1, $2)', [emailId, filePath])
    }

    await client.query('COMMIT')
    logger.info('Email saved successfully:', emailId)
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error('Error saving email:', err)
  } finally {
    client.release()
  }
}

module.exports.reSendToTheTelegram = async function (to, from, subject, text, attachmentPaths) {
  try {
    const tgId = configData.forwardingRules.rcptToTg[to]
    if (tgId) {

      const tgMessage = `Received email from ${from} to ${to}\nSubject: ${subject}\n\n${text}`
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
    } else {
      logger.info(`No Telegram ID found for recipient ${to}`)
    }
  } catch (error) {
    logger.error('Error saving email or sending to Telegram:', error)
  }
}