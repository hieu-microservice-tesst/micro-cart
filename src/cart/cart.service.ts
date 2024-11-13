import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { PrismaClient, Cart, CartItem, Prisma } from 'prisma/generated/cart';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class CartService {
  private prisma: PrismaClient;

  constructor(
    @Inject('PRODUCT_SERVICE') private readonly productServiceClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userServiceClient: ClientProxy,
  ) {
    this.prisma = new PrismaClient();
  }

  // Lấy thông tin Cart
  async cart(params: { where: Prisma.CartWhereUniqueInput; include?: Prisma.CartInclude; }): Promise<any> {
    try {
      const { where, include } = params;
      const cart = await this.prisma.cart.findUnique({
        where,
        include: {
          cartItems: true,
          ...include
        },
      });

      if (!cart) {
        throw new HttpException('Giỏ hàng không tồn tại', HttpStatus.NOT_FOUND);
      }

      // Lấy thông tin product cho mỗi cart item
      const cartItems = await Promise.all(
        cart.cartItems.map(async (item) => {
          const product = await this.getProduct(item.productId);
          return {
            ...item,
            product
          };
        })
      );

      return {
        ...cart,
        cartItems
      };
    } catch (error) {
      console.error('Error in CartService.cart:', error);
      throw new HttpException('Lỗi khi lấy thông tin giỏ hàng', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Tạo Cart mới
  async createCart(data: { totalItems: number; totalPrice: number; userId: number; cartItems?: Prisma.CartItemCreateInput[] }): Promise<any> {
    try {
      const cart = await this.prisma.cart.create({
        data: {
          totalItems: data.totalItems,
          totalPrice: data.totalPrice,
          userId: data.userId,
          cartItems: {
            create: data.cartItems
          }
        },
        include: {
          cartItems: true
        }
      });

      // Lấy thông tin product cho các cart items
      const cartItems = await Promise.all(
        cart.cartItems.map(async (item) => {
          const product = await this.getProduct(item.productId);
          return {
            ...item,
            product
          };
        })
      );

      return {
        ...cart,
        cartItems
      };
    } catch (error) {
      console.error('Error in CartService.createCart:', error);
      throw new HttpException('Lỗi khi tạo giỏ hàng', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Cập nhật Cart
  async updateCart(params: { where: Prisma.CartWhereUniqueInput; data: Prisma.CartUpdateInput; }): Promise<any> {
    try {
      const cart = await this.prisma.cart.update({
        where: params.where,
        data: params.data,
        include: {
          cartItems: true
        }
      });

      const cartItems = await Promise.all(
        cart.cartItems.map(async (item) => {
          const product = await this.getProduct(item.productId);
          return {
            ...item,
            product
          };
        })
      );

      return {
        ...cart,
        cartItems
      };
    } catch (error) {
      console.error('Error in CartService.updateCart:', error);
      throw new HttpException('Lỗi khi cập nhật giỏ hàng', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Xóa Cart
  async deleteCart(id: number): Promise<Cart> {
    try {
      return await this.prisma.cart.delete({
        where: { id: Number(id) },
        include: {
          cartItems: true
        }
      });
    } catch (error) {
      console.error('Error in CartService.deleteCart:', error);
      throw new HttpException('Lỗi khi xóa giỏ hàng', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Lấy thông tin Product từ microservice
  async getProduct(productId: number): Promise<any> {
    try {
      const product = await this.productServiceClient
        .send({ cmd: 'get_product' }, productId)
        .toPromise();

      if (!product) {
        throw new HttpException('Không tìm thấy sản phẩm', HttpStatus.NOT_FOUND);
      }

      return product;
    } catch (error) {
      console.error('Error in CartService.getProduct:', error);
      throw new HttpException('Lỗi khi lấy thông tin sản phẩm', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Lấy thông tin người dùng từ microservice
  async getUser(userId: number): Promise<any> {
    try {
      const user = await this.userServiceClient
        .send({ cmd: 'get_user' }, userId)
        .toPromise();

      if (!user) {
        console.log('User not found for userId:', userId);
        throw new HttpException('Người dùng không tồn tại', HttpStatus.NOT_FOUND);
      }
      return user;
    } catch (error) {
      throw new HttpException('Lỗi khi lấy thông tin người dùng', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Lấy Cart theo userId
  async getCartByUserId(userId: number): Promise<any> {
    try {
      const cart = await this.prisma.cart.findFirst({
        where: { userId: Number(userId) },
        include: {
          cartItems: true
        }
      });

      // Nếu không tìm thấy cart, trả về null thay vì throw exception
      if (!cart) {
        return null;
      }

      // Nếu có cart, lấy thêm thông tin product
      const cartItems = await Promise.all(
        cart.cartItems.map(async (item) => {
          const product = await this.getProduct(item.productId);
          return {
            ...item,
            product
          };
        })
      );

      return {
        ...cart,
        cartItems
      };

    } catch (error) {
      console.error('Error in CartService.getCartByUserId:', error);
      throw new HttpException('Lỗi khi lấy giỏ hàng theo userId', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Tính toán lại tổng giá trị Cart
  async recalculateCartTotals(cartId: number): Promise<{ totalItems: number; totalPrice: number }> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: Number(cartId) },
        include: { cartItems: true }
      });

      if (!cart) {
        throw new HttpException('Giỏ hàng không tồn tại', HttpStatus.NOT_FOUND);
      }

      let totalItems = 0;
      let totalPrice = 0;

      for (const item of cart.cartItems) {
        const product = await this.getProduct(item.productId);
        totalItems += item.quantity;
        totalPrice += product.price * item.quantity;
      }

      return { totalItems, totalPrice };
    } catch (error) {
      console.error('Error in CartService.recalculateCartTotals:', error);
      throw new HttpException('Lỗi khi tính toán lại tổng giỏ hàng', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

@Injectable()
export class CartItemService {
  private prisma: PrismaClient;

  constructor(
    @Inject('PRODUCT_SERVICE') private readonly productServiceClient: ClientProxy
  ) {
    this.prisma = new PrismaClient();
  }

  // Tạo CartItem mới
  async createCartItem(data: { productId: number; quantity: number; cartId: number }): Promise<any> {
    const cartItem = await this.prisma.cartItem.create({
      data: {
        productId: data.productId,
        quantity: data.quantity,
        cart: {
          connect: { id: data.cartId }
        }
      }
    });
  
    const product = await this.productServiceClient
      .send({ cmd: 'get_product' }, cartItem.productId)
      .toPromise();
  
    return {
      ...cartItem,
      product
    };
  }
  
  
  // Cập nhật CartItem
  async updateCartItem(params: { where: Prisma.CartItemWhereUniqueInput; data: Prisma.CartItemUpdateInput; }): Promise<any> {
    const cartItem = await this.prisma.cartItem.update({
      where: params.where,
      data: params.data
    });

    const product = await this.productServiceClient
      .send({ cmd: 'get_product' }, cartItem.productId)
      .toPromise();

    return {
      ...cartItem,
      product
    };
  }

  // Xóa CartItem
  async deleteCartItem(params: { id: number }): Promise<CartItem> {
    return this.prisma.cartItem.delete({
      where: { id: params.id }
    });
  }
}