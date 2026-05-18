const { Kafka } = require('kafkajs');
const env = require('../config/env');
const { logger } = require('../utils/logger');
const { persistIncomingMessage } = require('../services/messagePipeline');

let consumer;

async function persistFromKafkaMessage(io, redis, kafkaMessage) {
  let data;
  try {
    data = JSON.parse(kafkaMessage.value?.toString() || '{}');
  } catch {
    logger.warn('Invalid kafka payload');
    return;
  }
  await persistIncomingMessage(io, redis, data);
}

async function startKafkaConsumer({ io, redis }) {
  if (!env.kafkaEnabled) {
    logger.info('Kafka consumer skipped (SKIP_KAFKA or KAFKA_ENABLED=false)');
    return;
  }

  const kafka = new Kafka({
    clientId: 'backend-consumer',
    brokers: env.kafkaBrokers,
  });

  consumer = kafka.consumer({ groupId: 'chat-message-workers' });
  await consumer.connect();
  await consumer.subscribe({ topic: env.kafkaTopicMessageSent, fromBeginning: false });

  void consumer.run({
    eachMessage: async ({ message }) => {
      try {
        await persistFromKafkaMessage(io, redis, message);
      } catch (err) {
        logger.error('consumer eachMessage error', err);
      }
    },
  });

  logger.info('Kafka consumer running');
}

async function stopKafkaConsumer() {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}

module.exports = { startKafkaConsumer, stopKafkaConsumer };
