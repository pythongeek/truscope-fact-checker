import { db } from '@vercel/postgres';

/**
 * Vercel Postgres SDK client.
 * The SDK automatically handles connection pooling and error management.
 * This exported client can be used throughout the application to interact with the database.
 * It is configured via environment variables (e.g., POSTGRES_URL).
 */
export { db };
