import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    HttpException,
    HttpStatus,
  } from '@nestjs/common';
  import { CartService, CartItemService } from './cart.service';
  import { Cart as CartModel } from 'prisma/generated/cart';
  import { MessagePattern } from '@nestjs/microservices';
  
  @Controller('cart')
  export class CartController {
    constructor(
      private readonly cartService: CartService,
      private readonly cartItemService: CartItemService,
    ) {}
  
    
  @Get(':userId')
  async getCart(@Param('userId') userId: number): Promise<CartModel> {
    const user = await this.cartService.getUser(userId);
    if (!user) {
      throw new HttpException('Người dùng không tồn tại', HttpStatus.NOT_FOUND);
    }
    
    let cart = await this.cartService.getCartByUserId(userId);

    // Nếu không có giỏ hàng, tạo mới
    if (!cart) {
      cart = await this.cartService.createCart({
        totalItems: 0,
        totalPrice: 0,
        userId: userId
      });
    }

    return cart;
  }
  
    @Post()
    async addToCart(
      @Body() productData: { userId: number; productId: number; quantity: number },
    ): Promise<CartModel> {
      const { userId, productId, quantity } = productData;
  
      // Kiểm tra người dùng có tồn tại
      const user = await this.cartService.getUser(userId);
      if (!user) {
        throw new HttpException('Người dùng không tồn tại', HttpStatus.NOT_FOUND);
      }
  
      // Kiểm tra sản phẩm
      const product = await this.cartService.getProduct(productId);
      if (!product) {
        throw new HttpException('Không tìm thấy sản phẩm', HttpStatus.NOT_FOUND);
      }
      if (quantity > product.stock) {
        throw new HttpException('Số lượng sản phẩm không đủ', HttpStatus.BAD_REQUEST);
      }
      if (quantity < 0) {
        throw new HttpException('Số lượng không được bé hơn 0', HttpStatus.BAD_REQUEST);
      }
  
      // Lấy giỏ hàng của người dùng
      let cart = await this.cartService.getCartByUserId(userId);

    if (!cart) {
      // Tạo cart mới
      cart = await this.cartService.createCart({
        totalItems: quantity,
        totalPrice: product.price * quantity,
        userId: userId
      });

      // Sau khi tạo cart, tạo cart item
      await this.cartItemService.createCartItem({
        quantity: quantity,
        productId: productId,
        cartId: cart.id,
      });

      // Lấy lại cart đã cập nhật
      return this.cartService.getCartByUserId(userId);
    } else {
        const existingCartItem = cart.cartItems.find((item) => item.productId === productId);
  
        if (existingCartItem) {
          const newQuantity = existingCartItem.quantity + quantity;
  
          if (newQuantity <= 0) {
            await this.cartItemService.deleteCartItem({ id: existingCartItem.id });
  
            return this.cartService.updateCart({
              where: { id: cart.id },
              data: {
                totalItems: cart.totalItems - existingCartItem.quantity,
                totalPrice: cart.totalPrice - (product.price * existingCartItem.quantity),
              },
            });
          }
  
          await this.cartItemService.updateCartItem({
            where: { id: existingCartItem.id },
            data: { quantity: newQuantity },
          });
  
          const quantityDiff = newQuantity - existingCartItem.quantity;
          return this.cartService.updateCart({
            where: { id: cart.id },
            data: {
              totalItems: cart.totalItems + quantityDiff,
              totalPrice: cart.totalPrice + (product.price * quantityDiff),
            },
          });
        } else {
            await this.cartItemService.createCartItem({
                quantity: quantity,
                cartId: cart.id,
                productId: productId
              });
  
          return this.cartService.updateCart({
            where: { id: cart.id },
            data: {
              totalItems: cart.totalItems + quantity,
              totalPrice: cart.totalPrice + (product.price * quantity),
            },
          });
        }
      }
      return cart;
    }
  
    @MessagePattern({ cmd: 'get_cart_by_user_id' })
    async getCartByUserId(userId: number): Promise<CartModel | null> {
      return this.cartService.getCartByUserId(userId);
    }
  
    @MessagePattern({ cmd: 'get_user' })
    async getUser(userId: number): Promise<any> {
      return this.cartService.getUser(userId);
    }
  
    @MessagePattern({ cmd: 'delete_cart' })
    async deleteCart(id: number): Promise<CartModel> {
      return this.cartService.deleteCart(id);
    }
  }
  