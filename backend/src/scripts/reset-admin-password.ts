import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';

async function run() {
  const email = 'admin@cremarketplace.com';
  const password = 'Password123!';
  const hash = await bcrypt.hash(password, 10);
  console.log('New hash generated:', hash);
  
  const result = await query(
    'UPDATE users SET password_hash = $1, role = \'admin\' WHERE email = $2 RETURNING id, email',
    [hash, email]
  );
  
  if (result.rows.length === 0) {
    console.log('Admin user not found. Creating a new one...');
    await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, is_verified)
       VALUES ($1, $2, 'admin', 'Platform', 'Admin', TRUE)`,
      [email, hash]
    );
    console.log('Admin user created successfully.');
  } else {
    console.log('Admin password reset successfully for:', result.rows[0].email);
  }
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
