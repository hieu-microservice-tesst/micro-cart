import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CartService } from './cart/cart.service';
import { CartModule } from './cart/cart.module';

@Module({
  imports: [CartModule],
  controllers: [AppController],
  providers: [AppService, CartService],
})
export class AppModule {}
