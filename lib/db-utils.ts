import { db } from './db';
import type { User, Article, Claim } from '../types/database';

/**
 * Fetches a user from the database by their email address.
 *
 * @param {string} email - The email of the user to retrieve.
 * @returns {Promise<User | null>} A promise that resolves to the User object or null if not found.
 * @throws {Error} If the database query fails.
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const result = await db.query<User>(`SELECT * FROM users WHERE email = $1`, [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Database Error: Failed to get user by email.', error);
    throw new Error('Failed to fetch user.');
  }
};

/**
 * Creates a new article in the database.
 *
 * @param {Pick<Article, 'title' | 'content' | 'url'>} articleData - An object containing the title, content, and url for the new article.
 * @returns {Promise<Article>} A promise that resolves to the newly created Article object.
 * @throws {Error} If the database query fails.
 */
export const createArticle = async (
  articleData: Pick<Article, 'title' | 'content' | 'url'>
): Promise<Article> => {
  const { title, content, url } = articleData;
  try {
    const result = await db.query<Article>(
      `INSERT INTO articles (title, content, url) VALUES ($1, $2, $3) RETURNING *`,
      [title, content, url]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database Error: Failed to create article.', error);
    throw new Error('Failed to create article.');
  }
};

/**
 * Retrieves all claims associated with a specific article ID.
 *
 * @param {number} articleId - The ID of the article.
 * @returns {Promise<Claim[]>} A promise that resolves to an array of Claim objects.
 * @throws {Error} If the database query fails.
 */
export const getClaimsByArticleId = async (articleId: number): Promise<Claim[]> => {
  try {
    const result = await db.query<Claim>(
      `SELECT * FROM claims WHERE article_id = $1 ORDER BY created_at DESC`,
      [articleId]
    );
    return result.rows;
  } catch (error) {
    console.error(`Database Error: Failed to get claims for article ID ${articleId}.`, error);
    throw new Error('Failed to fetch claims.');
  }
};
