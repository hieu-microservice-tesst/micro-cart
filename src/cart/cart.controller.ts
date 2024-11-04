import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    HttpStatus,
    HttpException,
} from '@nestjs/common';
import { CartService, CartItemService } from './cart.service';
import { Cart as CartModel } from 'prisma/generated/cart';
import { MessagePattern } from '@nestjs/microservices';

@Controller('cart')
export class CartController {
    constructor(
        private readonly cartService: CartService,
        private readonly cartItemService: CartItemService,
    ) { }

    @Get(':userId')
    async getCart(@Param('userId') userId: number): Promise<CartModel> {
        const user = await this.cartService.getUser(userId);
        if (!user) {
            throw new HttpException('Người dùng không tồn tại', HttpStatus.NOT_FOUND);
        }
        const cart = await this.cartService.getCartByUserId(userId);

        if (!cart) {
            return this.cartService.createCart({
                totalItems: 0,
                totalPrice: 0,
                userId: userId,
                cartItems: [],
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

    // Thay đổi từ cart() sang getCartByUserId()
    let cart = await this.cartService.getCartByUserId(userId);

    if (!cart) {
        const cartUser = await this.cartService.createCart({
            totalItems: quantity,
            totalPrice: product.price * quantity,
            userId: userId,
            cartItems: [
                { productId, quantity },
            ],
        });
        return cartUser;
    }

    // Phần code còn lại giữ nguyên...
    const existingCartItem = cart.cartItems?.find((item) => item.productId === productId);

        if (existingCartItem) {
            const newQuantity = quantity;

            if (newQuantity <= 0) {
                await this.cartItemService.deleteCartItem({ id: existingCartItem.id });

                const { totalItems, totalPrice } = await this.cartService.recalculateCartTotals(cart.id);

                return this.cartService.updateCart({
                    where: { id: cart.id },
                    data: {
                        totalItems,
                        totalPrice,
                    },
                });
            }

            await this.cartItemService.updateCartItem({
                where: { id: existingCartItem.id },
                data: { quantity: newQuantity },
            });

            const { totalItems, totalPrice } = await this.cartService.recalculateCartTotals(cart.id);

            return this.cartService.updateCart({
                where: { id: cart.id },
                data: {
                    totalItems,
                    totalPrice,
                },
            });
        } else {
            await this.cartItemService.createCartItem({
                cartId: cart.id,
                productId: productId,
                quantity,
            });

            const { totalItems, totalPrice } = await this.cartService.recalculateCartTotals(cart.id);

            return this.cartService.updateCart({
                where: { id: cart.id },
                data: {
                    totalItems,
                    totalPrice,
                },
            });
        }
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
