import { connectDB, disconnectDB } from '../config/db.js';
import { runWithoutTenant } from '../utils/tenantContext.js';
import { User } from '../models/User.js';

async function main() {
  const [, , email, password, name = 'Platform Super Admin'] = process.argv;
  if (!email || !password) {
    console.error('Usage: node src/scripts/createSuperAdmin.js <email> <password> [name]');
    process.exit(1);
  }

  const db = await connectDB();
  if (!db) {
    throw new Error('Database connection failed. Ensure MongoDB is running and MONGODB_URI is correctly configured in server/.env.');
  }
  await runWithoutTenant(async () => {
    const passHash = await User.hashPassword(password);
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { name, email: email.toLowerCase(), passwordHash: passHash, role: 'super_admin', schoolId: null, isActive: true },
      { upsert: true, new: true }
    );
    console.log(`Super Admin ready: ${user.email}`);
  });
  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
