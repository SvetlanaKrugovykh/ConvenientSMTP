const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  user: process.env.PAY_DB_USER,
  host: process.env.PAY_DB_HOST,
  database: process.env.PAY_DB_NAME,
  password: process.env.PAY_DB_PASSWORD,
  port: process.env.PAY_DB_PORT,
})

module.exports.registerUser = async function (email, password, doOrNot) {
  if (!doOrNot) return null
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const checkQuery = {
      text: 'SELECT id FROM users WHERE email = $1',
      values: [email]
    }
    const checkResult = await pool.query(checkQuery)

    if (checkResult.rows.length > 0) {
      console.error('Error registering user: Email already exists')
      return { error: 'Email already exists' }
    }
    const query = {
      text: 'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
      values: [email, hashedPassword]
    }
    const result = await pool.query(query)

    if (result.rows.length > 0) {
      console.log(`User registered: ${email} id: ${result.rows[0].id}`)
      return result.rows[0]
    } else {
      console.error('Error registering user: No rows returned')
      return null
    }
  } catch (error) {
    console.error('Error registering user:', error)
    return { error: error.message }
  }
}