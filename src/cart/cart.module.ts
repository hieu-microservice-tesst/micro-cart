import { Module } from '@nestjs/common';
import { CartService, CartItemService } from './cart.service';
import { CartController } from './cart.controller';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqps://dtqrsesy:bT2AyYaZpfFNd-qcnGeY2B_QWLwCOQbD@vulture.rmq.cloudamqp.com/dtqrsesy'],
          queue: 'user_queue',
          queueOptions: {
            durable: true
          }
        },
      },
      {
        name: 'PRODUCT_SERVICE', 
        transport: Transport.RMQ,
        options: {
          urls: ['amqps://dtqrsesy:bT2AyYaZpfFNd-qcnGeY2B_QWLwCOQbD@vulture.rmq.cloudamqp.com/dtqrsesy'],
          queue: 'product_queue',
          queueOptions: {
            durable: true
          }
        },
      },
      {
        name: 'CART_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqps://dtqrsesy:bT2AyYaZpfFNd-qcnGeY2B_QWLwCOQbD@vulture.rmq.cloudamqp.com/dtqrsesy'],
          queue: 'cart_queue',
          queueOptions: {
            durable: true
          }
        },
      }
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartItemService],
})
export class CartModule {}
