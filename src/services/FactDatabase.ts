import { APIErrorHandler } from '../utils/APIErrorHandler';

export class FactDatabase {
  private cache: Map<string, any> = new Map();
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.loadFromBlob();
      console.log(`Loaded ${this.cache.size} facts into cache`);
    } catch (error) {
      console.warn('Failed to load fact database, starting fresh:', error.message);
    }

    this.isInitialized = true;
  }

  private async loadFromBlob() {
    try {
      const response = await fetch('/api/fact-database');
      if (response.ok) {
        const data = await response.json();
        if (data.facts) {
          data.facts.forEach((fact: any) => {
            this.cache.set(fact.id, fact);
          });
        }
      } else {
        throw new Error(`Database load failed with status: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Database load failed: ${error.message}`);
    }
  }

  async saveFact(key: string, data: any) {
    // Save to cache immediately
    this.cache.set(key, { ...data, id: key, timestamp: Date.now() });

    // Persist to blob storage
    try {
      await this.persistToStorage();
      console.log('✅ Fact saved to database for future use');
    } catch (error) {
      console.error('Failed to persist fact database:', error);
    }
  }

  private async persistToStorage() {
    const allFacts = Array.from(this.cache.values());
    const dbData = {
      facts: allFacts,
      metadata: {
        updated: new Date().toISOString(),
        total_facts: allFacts.length
      }
    };

    await APIErrorHandler.handleBlobOperation(async () => {
      const response = await fetch('/api/blob/save-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    });
  }
}