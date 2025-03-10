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

module.exports.registerUser = async function (email, password) {
  const hashedPassword = await bcrypt.hash(password, 10)

  try {

    const query = {
      text: 'INSERT INTO users (email, password) VALUES ($1, $2)',
      values: [email, hashedPassword]
    }
    console.log(`user registered: ${email} id: ${result.rows[0].id}`)
    return pool.query(query)
  } catch (error) {
    console.error('Error registering user:', error)
    return error
  }
}
