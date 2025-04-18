class QueueManager {
  constructor(terra) {
    this.terra = terra;
    this.logger = this.terra.logger.child({ name: 'QueueManager' });
    this.queue = [];
    this.processing = false;
    this.lastMessageTime = 0;
    this.messageDelay = 1000; // Delay between messages to prevent rate limiting
  }

  /**
   * Add a task to the messaging queue
   * @param {Function} task Function that returns a promise
   * @returns {Promise} Promise that resolves with the task result
   */
  async addToQueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the message queue
   * @private
   */
  async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const { task, resolve, reject } = this.queue.shift();

    try {
      // Wait if needed to prevent rate limiting
      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;
      
      if (timeSinceLastMessage < this.messageDelay) {
        await new Promise(r => setTimeout(r, this.messageDelay - timeSinceLastMessage));
      }

      // Execute the task
      const result = await task();
      this.lastMessageTime = Date.now();
      resolve(result);
    } catch (error) {
      this.logger.error('Error processing queued task:', error);
      reject(error);
    }

    // Continue processing the queue
    setTimeout(() => this.processQueue(), 0);
  }

  /**
   * Clear the message queue
   */
  clearQueue() {
    const pending = this.queue.length;
    this.queue = [];
    this.logger.info(`Cleared message queue (${pending} pending tasks)`);
  }
}

module.exports = QueueManager;