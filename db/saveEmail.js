const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  user: process.env.PAY_DB_USER,
  host: process.env.PAY_DB_HOST,
  database: process.env.PAY_DB_NAME,
  password: process.env.PAY_DB_PASSWORD,
  port: process.env.PAY_DB_PORT,
})

async function saveEmail(to, from, subject, body, attachments = []) {
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
    console.log('Email saved successfully:', emailId)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Error saving email:', err)
  } finally {
    client.release()
  }
}
