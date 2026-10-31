// Usage: node scripts/hash-password.js "YourNewPassword"
// Prints a bcrypt hash to paste into the users table.
const bcrypt = require('bcryptjs');

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error('Usage: node scripts/hash-password.js "password-of-10+-chars"');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 10));
