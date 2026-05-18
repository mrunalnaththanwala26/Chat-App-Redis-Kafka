const { Kafka, Partitioners } = require('kafkajs');
const env = require('../config/env');
const { logger } = require('../utils/logger');
const { persistIncomingMessage } = require('../services/messagePipeline');

let producer;
let runtimeIo;
let runtimeRedis;

function setMessagingRuntime(io, redis) {
  runtimeIo = io;
  runtimeRedis = redis;
}

async function getProducer() {
  if (!env.kafkaEnabled) {
    return null;
  }
  if (producer) return producer;
  const kafka = new Kafka({
    clientId: 'backend',
    brokers: env.kafkaBrokers,
  });
  producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
    allowAutoTopicCreation: true,
  });
  await producer.connect();
  logger.info('Kafka producer connected');
  return producer;
}

async function produceMessageSent(payload) {
  if (!env.kafkaEnabled) {
    if (!runtimeIo || !runtimeRedis) {
      throw new Error('Messaging runtime not initialized');
    }
    await persistIncomingMessage(runtimeIo, runtimeRedis, payload);
    return;
  }
  const p = await getProducer();
  await p.send({
    topic: env.kafkaTopicMessageSent,
    messages: [
      {
        key: payload.senderId,
        value: JSON.stringify(payload),
      },
    ],
  });
}

async function disconnectProducer() {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}

module.exports = {
  produceMessageSent,
  disconnectProducer,
  getProducer,
  setMessagingRuntime,
};
