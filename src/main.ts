import { NestFactory } from '@nestjs/core';
import { CartModule } from './cart/cart.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(CartModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'http://127.0.0.1:15672'],
      queue: 'cart_queue',
      queueOptions: { durable: false },
    },
  });

  app.startAllMicroservices().catch(error => console.error('Microservice error:', error));
  await app.listen(3003);
}

bootstrap();
