import storage from '../utils/storage';

interface QueueOperation {
  type: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export const cardQueue = {
  async addToQueue(operation: QueueOperation) {
    try {
      const queue = await this.getQueue();
      queue.push(operation);
      await storage.setItem('card_operations_queue', JSON.stringify(queue));
    } catch (error) {
      console.error('Error adding to queue:', error);
    }
  },

  async getQueue(): Promise<QueueOperation[]> {
    try {
      const queue = await storage.getItem('card_operations_queue');
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  },

  async clearQueue() {
    try {
      await storage.setItem('card_operations_queue', JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  }
};