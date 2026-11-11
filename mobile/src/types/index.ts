export interface User {
  id: number;
  name: string;
  email: string;
  roles: string[];
  branchId?: number | null;
  tenantId?: number;
  mustChangePassword?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ProductSummary {
  id: number;
  name: string;
  price: number | string;
  basePrice: number | string;
  finalPrice: number | string;
  discount: { type: string, value: number, amount: number } | null;
  categoryId: number;
  categoryName: string;
  collectionName?: string | null;
  seasonName?: string | null;
  imageUrl: string | null;
  arEnabled?: boolean;
  arImageUrl?: string | null;
  arTorsoUrl?: string | null;
  arLeftSleeveUrl?: string | null;
  arRightSleeveUrl?: string | null;
  arType?: string | null;
}

export interface VariantInfo {
  id: number;
  sku: string;
  sizeId: number;
  sizeName: string;
  colorId: number;
  colorName: string;
  colorHexCode?: string;
  previewImageUrl?: string;
  previewArImageUrl?: string;
}

export interface ProductDetail {
  id: number;
  name: string;
  price: number | string;
  basePrice: number | string;
  finalPrice: number | string;
  discount: { type: string, value: number, amount: number } | null;
  categoryName: string;
  collectionName?: string | null;
  seasonName?: string | null;
  imageUrl: string | null;
  arEnabled?: boolean;
  arImageUrl?: string | null;
  arTorsoUrl?: string | null;
  arLeftSleeveUrl?: string | null;
  arRightSleeveUrl?: string | null;
  arType?: string | null;
  variants: VariantInfo[];
}

export interface BranchAvailability {
  branchId: number;
  branchName: string;
  cityId: number;
  cityName: string;
  available: number;
  status: 'AVAILABLE' | 'LOW_STOCK';
}

export interface ReservationSummary {
  id: number;
  date: string;
  approximateTime: string | null;
  branch: { id: number; name: string };
  status: string;
  items: any[];
}

export interface ReservationItemDetail {
  id: number;
  quantity: number;
  variant: {
    id: number;
    sku: string;
    product: { id: number; name: string; imageUrl: string | null };
    size: { name: string };
    color: { name: string };
  };
}

export interface ReservationDetail {
  id: number;
  date: string;
  approximateTime: string | null;
  status: string;
  branch: { id: number; name: string };
  items: ReservationItemDetail[];
  paymentSummary?: {
    total: number | string;
    paidAmount: number | string;
    remainingAmount: number | string;
    paymentState: string;
  };
}

export interface PurchaseSummary {
  id: number;
  date: string;
  branchName: string;
  channel: string;
  status: string;
  total: number | string;
  itemsCount: number;
}

export interface PurchaseItemDetail {
  id: number;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  productName: string;
  imageUrl: string | null;
  sizeName: string;
  colorName: string;
}

export interface PurchasePaymentDetail {
  id: number;
  method: string;
  status: string;
  amount: number | string;
}

export interface PurchaseDetail {
  id: number;
  date: string;
  branchName: string;
  channel: string;
  status: string;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  items: PurchaseItemDetail[];
  payments: PurchasePaymentDetail[];
}

export type ClientDrawerParamList = {
  HomeTab: undefined;
  CatalogTab: undefined;
  CartTab: undefined;
  ReservationsTab: undefined;
  PurchasesTab: undefined;
  ProfileTab: undefined;
  PosTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  ProductDetail: { productId: number };
  CreateReservation: {
    productId: number;
    productName: string;
    price: number | string;
    variantId: number;
    sizeName: string;
    colorName: string;
    branchId: number;
    branchName: string;
    quantity: number;
  };
  ReservationDetail: { reservationId: number };
  PurchaseDetail: { purchaseId: number };
  Login: { pendingReservation?: any } | undefined;
  Register: { pendingReservation?: any } | undefined;
  ActivateAccount: { email?: string } | undefined;
  Checkout: undefined;
  TryOn: { variantId: number };
};
