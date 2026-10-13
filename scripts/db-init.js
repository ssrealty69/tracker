// scripts/db-init.js
// Automatically pushes schema and seeds database if cloud DATABASE_URL is present during build
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || '';
const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

if (dbUrl && !isLocalhost) {
  console.log('🔄 Cloud DATABASE_URL detected on build. Initializing PostgreSQL...');
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
    console.log('✅ PostgreSQL schema successfully pushed.');

    try {
      execSync('npx ts-node --compiler-options "{\\"module\\":\\"CommonJS\\"}" prisma/seed.ts', { stdio: 'inherit' });
      console.log('✅ SS Realty database seeded successfully.');
    } catch (seedErr) {
      console.warn('⚠️ Seeding notice (continuing):', seedErr.message);
    }
  } catch (err) {
    console.warn('⚠️ Prisma db push notice (continuing build):', err.message);
  }
} else {
  console.log('ℹ️ Local/offline DATABASE_URL detected. Skipping cloud DB push during build.');
}
