import { env } from './config/env.js';
import { connectDB, isDbConnected } from './config/db.js';
import { createApp } from './app.js';
import { initScheduledJobs } from './jobs/nightly.js';

async function bootstrap() {
  const db = await connectDB();
  if (db) {
    console.log('✅ Connected to Firebase Database');
    initScheduledJobs();
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
    console.log(`Swagger docs at http://localhost:${env.PORT}/api/docs`);
    console.log(`Database Explorer API at http://localhost:${env.PORT}/api/v1/database/stats`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err.message || err);
  process.exit(1);
});
