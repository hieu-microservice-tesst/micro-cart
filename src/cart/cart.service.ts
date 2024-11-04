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
  async cart(params: {
    where: Prisma.CartWhereUniqueInput;
    include?: Prisma.CartInclude;
  }): Promise<any> {
    const { where, include } = params;
    const cart = await this.prisma.cart.findUnique({
      where,
      include: {
        cartItems: true,
        ...include
      },
    });

    if (!cart) return null;

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
  }

  // Tạo Cart mới
  async createCart(data: {
    totalItems: number;
    totalPrice: number;
    userId: number;
    cartItems?: { productId: number; quantity: number }[];
  }): Promise<any> {
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
  }

  // Cập nhật Cart
  async updateCart(params: {
    where: Prisma.CartWhereUniqueInput;
    data: Prisma.CartUpdateInput;
  }): Promise<any> {
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
  }

  // Xóa Cart
  async deleteCart(id: number): Promise<Cart> {
    return this.prisma.cart.delete({
      where: { id },
      include: {
        cartItems: true
      }
    });
  }

  // Lấy thông tin Product từ microservice
  async getProduct(productId: number): Promise<any> {
    const product = await this.productServiceClient
      .send({ cmd: 'get_product' }, productId)
      .toPromise();

    if (!product) {
      throw new HttpException('Không tìm thấy sản phẩm', HttpStatus.NOT_FOUND);
    }

    return product;
  }


  async getUser(userId: number): Promise<any> {
    const user = await this.userServiceClient
      .send({ cmd: 'get_user' }, userId)
      .toPromise();

    if (!user) {
      throw new HttpException('Người dùng không tồn tại', HttpStatus.NOT_FOUND);
    }

    return user;
  }

  // Lấy Cart theo userId
  async getCartByUserId(userId: number): Promise<any> {
    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: {
        cartItems: true
      }
    });

    if (!cart) return null;

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
  }

  // Tính toán lại tổng giá trị Cart
  async recalculateCartTotals(cartId: number): Promise<{ totalItems: number; totalPrice: number }> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
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
  async createCartItem(data: {
    cartId: number;
    productId: number;
    quantity: number;
  }): Promise<any> {
    const cartItem = await this.prisma.cartItem.create({
      data
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
  async updateCartItem(params: {
    where: Prisma.CartItemWhereUniqueInput;
    data: Prisma.CartItemUpdateInput;
  }): Promise<any> {
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
