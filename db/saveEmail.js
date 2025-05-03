const { Pool } = require('pg')
const dotenv = require('dotenv')
const logger = require('../src/logger')

dotenv.config()

const pool = new Pool({
  user: process.env.PAY_DB_USER,
  host: process.env.PAY_DB_HOST,
  database: process.env.PAY_DB_NAME,
  password: process.env.PAY_DB_PASSWORD,
  port: process.env.PAY_DB_PORT,
})

module.exports.saveEmail = async function (to, from, subject, body, attachments = [], metadata = {}) {
  const { messageId, inReplyTo, references } = metadata
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const emailResult = await client.query(
      'INSERT INTO emails (from_email, to_email, subject, body, message_id, in_reply_to, "references") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [from, to, subject, body, messageId, inReplyTo, references ? references.join(', ') : null]
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
