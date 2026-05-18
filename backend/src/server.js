const http = require('http');

const { createClient } = require('redis');

const { Server } = require('socket.io');

const { createAdapter } = require('@socket.io/redis-adapter');



const env = require('./config/env');

const { connectDb } = require('./config/db');

const { createApp } = require('./app');

const { logger } = require('./utils/logger');

const { initChatSocket } = require('./sockets/chatSocket');

const { startKafkaConsumer, stopKafkaConsumer } = require('./events/kafkaConsumer');

const { disconnectProducer, getProducer, setMessagingRuntime } = require('./events/kafkaProducer');



async function main() {

  const redisClient = createClient({ url: env.redisUrl });

  redisClient.on('error', (err) => logger.error('Redis Client Error', err));

  await redisClient.connect();



  await connectDb();



  const app = createApp();

  const server = http.createServer(app);



  const io = new Server(server, {

    cors: {

      origin: process.env.CORS_ORIGIN?.split(',') || true,

      credentials: true,

    },

    transports: ['websocket', 'polling'],

  });



  const pubClient = createClient({ url: env.redisUrl });

  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));



  initChatSocket(io, redisClient);



  setMessagingRuntime(io, redisClient);



  if (env.kafkaEnabled) {

    await getProducer();

    await startKafkaConsumer({ io, redis: redisClient });

  } else {

    logger.warn(

      'Kafka disabled (SKIP_KAFKA=true). Messages are saved and broadcast inline — fine for local dev.'

    );

  }



  server.listen(env.port, () => {

    logger.info(`Backend listening on http://localhost:${env.port}`);

  });



  const shutdown = async () => {

    logger.info('Shutting down...');

    await stopKafkaConsumer();

    await disconnectProducer();

    await redisClient.quit();

    process.exit(0);

  };

  process.on('SIGINT', shutdown);

  process.on('SIGTERM', shutdown);

}



main().catch((err) => {

  logger.error(err);

  process.exit(1);

});

