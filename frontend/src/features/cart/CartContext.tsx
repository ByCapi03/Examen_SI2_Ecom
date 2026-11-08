import React, { createContext, useContext, useState, useEffect } from 'react';

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

const CART_STORAGE_KEY = 'boutique_cart';

const initialCart: Cart = {
  branchId: null,
  branchName: null,
  items: []
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse cart from localStorage', e);
    }
    return initialCart;
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  const addToCart = (newItem: CartItem, branchId: number, branchName: string) => {
    // Single branch rule:
    if (cart.items.length > 0 && cart.branchId !== null && cart.branchId !== branchId) {
      return {
        success: false,
        message: 'Tu carrito contiene productos de otra sucursal. Vacía el carrito o selecciona la misma sucursal para continuar.'
      };
    }

    let updatedItems = [...cart.items];
    const existingIndex = updatedItems.findIndex(i => i.variantId === newItem.variantId);

    if (existingIndex > -1) {
      const existingItem = updatedItems[existingIndex];
      const potentialQuantity = existingItem.quantity + newItem.quantity;
      if (potentialQuantity > newItem.available) {
        return {
          success: false,
          message: `No puedes agregar más de ${newItem.available} unidades en total para esta sucursal.`
        };
      }
      updatedItems[existingIndex] = {
        ...existingItem,
        quantity: potentialQuantity,
        available: newItem.available,
        price: newItem.price
      };
    } else {
      if (newItem.quantity > newItem.available) {
        return {
          success: false,
          message: `No puedes agregar más de ${newItem.available} unidades.`
        };
      }
      updatedItems.push(newItem);
    }

    setCart({
      branchId,
      branchName,
      items: updatedItems
    });

    return { success: true };
  };

  const removeFromCart = (variantId: number) => {
    const updatedItems = cart.items.filter(i => i.variantId !== variantId);
    if (updatedItems.length === 0) {
      setCart(initialCart);
    } else {
      setCart(prev => ({
        ...prev,
        items: updatedItems
      }));
    }
  };

  const updateQuantity = (variantId: number, quantity: number) => {
    setCart(prev => {
      const updatedItems = prev.items.map(item => {
        if (item.variantId === variantId) {
          const validQty = Math.max(1, Math.min(quantity, item.available > 0 ? item.available : 1));
          return { ...item, quantity: validQty };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const updateItemAvailability = (variantId: number, available: number) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.map(item => item.variantId === variantId ? { ...item, available } : item)
    }));
  };

  const clearCart = () => {
    setCart(initialCart);
  };

  const totalItems = cart.items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      updateItemAvailability,
      totalItems
    }}>
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
