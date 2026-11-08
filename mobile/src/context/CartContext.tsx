import React, { createContext, useContext, useState, useEffect } from 'react';
import { cartRepository } from '../database/cart.repository';

export interface CartItem {
  productId: number;
  variantId: number;
  productName: string;
  imageUrl: string | null;
  size: string;
  color: string;
  price: number;
  basePrice?: number;
  quantity: number;
  available: number;
}

export interface Cart {
  branchId: number | null;
  branchName: string | null;
  items: CartItem[];
}

interface CartContextType {
  cart: Cart;
  addToCart: (item: CartItem, branchId: number, branchName: string) => { success: boolean; message?: string };
  removeFromCart: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  clearCart: () => void;
  updateItemAvailability: (variantId: number, available: number) => void;
  totalItems: number;
}

const initialCart: Cart = {
  branchId: null,
  branchName: null,
  items: [],
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart>(initialCart);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const initializeCart = async () => {
      try {
        // 1. Migrar desde AsyncStorage si existe versión antigua
        await cartRepository.migrateFromAsyncStorage();

        // 2. Cargar carrito persistido desde SQLite
        const savedCart = await cartRepository.loadCart();
        setCart(savedCart);
      } catch (e) {
        console.error('[CartContext] Error cargando carrito desde SQLite:', e);
      } finally {
        setLoaded(true);
      }
    };

    initializeCart();
  }, []);

  useEffect(() => {
    if (loaded) {
      cartRepository.saveCart(cart).catch((e) =>
        console.error('[CartContext] Error guardando carrito en SQLite:', e)
      );
    }
  }, [cart, loaded]);

  const addToCart = (newItem: CartItem, branchId: number, branchName: string) => {
    // Regla de sucursal única:
    if (cart.items.length > 0 && cart.branchId !== null && cart.branchId !== branchId) {
      return {
        success: false,
        message: 'Tu carrito contiene productos de otra sucursal. Vacía el carrito o selecciona la misma sucursal para continuar.',
      };
    }

    let updatedItems = [...cart.items];
    const existingIndex = updatedItems.findIndex((i) => i.variantId === newItem.variantId);

    if (existingIndex > -1) {
      const currentItem = updatedItems[existingIndex];
      const newQuantity = currentItem.quantity + newItem.quantity;

      if (newQuantity > currentItem.available) {
        return {
          success: false,
          message: `Stock insuficiente. Disponible: ${currentItem.available}`,
        };
      }

      updatedItems[existingIndex] = {
        ...currentItem,
        quantity: newQuantity,
      };
    } else {
      if (newItem.quantity > newItem.available) {
        return {
          success: false,
          message: `Stock insuficiente. Disponible: ${newItem.available}`,
        };
      }
      updatedItems.push(newItem);
    }

    setCart({
      branchId,
      branchName,
      items: updatedItems,
    });

    return { success: true };
  };

  const removeFromCart = (variantId: number) => {
    const updatedItems = cart.items.filter((i) => i.variantId !== variantId);
    setCart({
      branchId: updatedItems.length === 0 ? null : cart.branchId,
      branchName: updatedItems.length === 0 ? null : cart.branchName,
      items: updatedItems,
    });
  };

  const updateQuantity = (variantId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(variantId);
      return;
    }

    const updatedItems = cart.items.map((item) => {
      if (item.variantId === variantId) {
        if (quantity > item.available) {
          return item;
        }
        return { ...item, quantity };
      }
      return item;
    });

    setCart({
      ...cart,
      items: updatedItems,
    });
  };

  const clearCart = () => {
    setCart(initialCart);
    cartRepository.clearCart().catch((e) =>
      console.error('[CartContext] Error limpiando carrito en SQLite:', e)
    );
  };

  const updateItemAvailability = (variantId: number, available: number) => {
    setCart((prev) => {
      const items = prev.items.map((item) => {
        if (item.variantId === variantId) {
          return {
            ...item,
            available,
            quantity: item.quantity > available ? (available > 0 ? available : 1) : item.quantity,
          };
        }
        return item;
      });
      return { ...prev, items };
    });
  };

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        updateItemAvailability,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
