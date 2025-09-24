// Global error handler for API calls
export class APIErrorHandler {
  static async handleBlobOperation(operation: () => Promise<any>): Promise<any> {
    try {
      return await operation();
    } catch (error) {
      if (error.message.includes('No token found')) {
        throw new Error('Blob storage is not properly configured. Please check environment variables.');
      }
      if (error.message.includes('500')) {
        throw new Error('Server error occurred. Please try again.');
      }
      throw error;
    }
  }
}