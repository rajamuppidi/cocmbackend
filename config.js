// // config.js
// const crypto = require('crypto');
// const dotenv = require('dotenv');

// dotenv.config(); // Ensure this line is present to load environment variables

// const secretToken = crypto.randomBytes(16).toString('hex');

// console.log('Database Host:', process.env.DATABASE_HOST);
// console.log('Database User:', process.env.DATABASE_USER);
// console.log('Database Password:', process.env.DATABASE_PASSWORD);
// console.log('Database Name:', process.env.DATABASE_NAME);

// module.exports = {
//     db: {
//         host: process.env.DATABASE_HOST || 'localhost',
//         user: process.env.DATABASE_USER || 'root',
//         password: process.env.DATABASE_PASSWORD || 'Python@4650',
//         database: process.env.DATABASE_NAME || 'caseload_tracker'
//     },
//     jwtSecret: process.env.JWT_SECRET || secretToken
// };

// config.js
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const secretToken = crypto.randomBytes(16).toString('hex');

console.log('Database Host:', process.env.DATABASE_HOST);
console.log('Database User:', process.env.DATABASE_USER);
console.log('Database Password:', process.env.DATABASE_PASSWORD);
console.log('Database Name:', process.env.DATABASE_NAME);

module.exports = {
  db: {
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'Python@4650',
    database: process.env.DATABASE_NAME || 'caseload_tracker',
  },
  jwtSecret: process.env.JWT_SECRET || secretToken,
};
