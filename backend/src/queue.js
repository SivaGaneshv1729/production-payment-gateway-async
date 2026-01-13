const Queue = require('bull');

const redisConfig = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Queues
const paymentQueue = new Queue('payment-queue', redisConfig);
const webhookQueue = new Queue('webhook-queue', redisConfig);
const refundQueue = new Queue('refund-queue', redisConfig);

module.exports = {
    paymentQueue,
    webhookQueue,
    refundQueue
};