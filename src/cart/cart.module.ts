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
          urls: [process.env.RABBITMQ_URL],
          queue: 'user_queue',
          queueOptions: {
            durable: false
          }
        },
      },
      {
        name: 'PRODUCT_SERVICE', 
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'product_queue',
          queueOptions: {
            durable: false
          }
        },
      },
      {
        name: 'CART_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'cart_queue',
          queueOptions: {
            durable: false
          }
        },
      }
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartItemService],
})
export class CartModule {}
