const mysql = require('mysql2/promise');
const { db: dbConfig } = require('../config');

const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
});

module.exports = pool;
