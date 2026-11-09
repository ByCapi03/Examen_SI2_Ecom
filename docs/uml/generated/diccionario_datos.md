# Diccionario de datos (generado)

_Generado por docs/uml/scripts/gen_entities_uml.py a partir de backend/src/**/*.entity.ts_

## ai_report_logs  (`AiReportLog`, módulo ai-reports)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| userId | `number` |  |  |
| question | `string` |  |  |
| spec | `any` |  | sí |
| engine | `'LLM' | 'REGLAS'` |  |  |
| rowCount | `number` |  |  |
| error | `string | null` |  | sí |
| createdAt | `Date` |  |  |

## audit_logs  (`AuditLog`, módulo audit)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| userId | `number | null` |  | sí |
| userName | `string | null` |  | sí |
| userEmail | `string | null` |  | sí |
| userRoles | `string | null` |  | sí |
| branchId | `number | null` |  | sí |
| action | `string` |  |  |
| entity | `string | null` |  | sí |
| entityId | `string | null` |  | sí |
| summary | `string` |  |  |
| details | `string | null` |  | sí |
| method | `string` |  |  |
| path | `string` |  |  |
| statusCode | `number` |  |  |
| ip | `string | null` |  | sí |
| userAgent | `string | null` |  | sí |
| createdAt | `Date` |  |  |

## roles  (`Role`, módulo auth)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| description | `string` |  | sí |
| active | `boolean` |  |  |

## user_roles  (`UserRole`, módulo auth)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| userId | `number` |  |  |
| roleId | `number` |  |  |
| active | `boolean` |  |  |
| assignedAt | `Date` |  |  |

## users  (`User`, módulo auth)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| name | `string` |  |  |
| email | `string` |  |  |
| passwordHash | `string` |  |  |
| active | `boolean` |  |  |
| mustChangePassword | `boolean` |  |  |
| temporaryPasswordExpiresAt | `Date | null` |  | sí |
| emailVerified | `boolean` |  |  |
| verificationCodeHash | `string | null` |  | sí |
| verificationCodeExpiresAt | `Date | null` |  | sí |
| verificationAttempts | `number` |  |  |
| createdAt | `Date` |  |  |
| branchId | `number` |  | sí |

## branches  (`Branch`, módulo branches)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| name | `string` |  |  |
| address | `string` |  |  |
| phone | `string` |  |  |
| active | `boolean` |  |  |
| createdAt | `Date` |  |  |
| cityId | `number` |  |  |

## cities  (`City`, módulo branches)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| active | `boolean` |  |  |

## categories  (`Category`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| active | `boolean` |  |  |

## collections  (`Collection`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| description | `string` |  | sí |
| seasonId | `number` |  |  |
| active | `boolean` |  |  |

## colors  (`Color`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| hexCode | `string` |  | sí |
| active | `boolean` |  |  |

## products  (`Product`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| name | `string` |  |  |
| price | `number` |  |  |
| active | `boolean` |  |  |
| categoryId | `number` |  |  |
| imageUrl | `string` |  | sí |
| imagePublicId | `string` |  | sí |
| colorizable | `boolean` |  |  |
| sourceColor | `string` |  | sí |
| arEnabled | `boolean` |  |  |
| arImageUrl | `string` |  | sí |
| arImagePublicId | `string` |  | sí |
| arTorsoUrl | `string` |  | sí |
| arTorsoPublicId | `string` |  | sí |
| arLeftSleeveUrl | `string` |  | sí |
| arLeftSleevePublicId | `string` |  | sí |
| arRightSleeveUrl | `string` |  | sí |
| arRightSleevePublicId | `string` |  | sí |
| arType | `ArGarmentType` |  | sí |
| collectionId | `number` |  | sí |

## promotions  (`Promotion`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| type | `'PERCENTAGE' | 'FIXED'` |  |  |
| value | `number` |  |  |
| startDate | `string` |  |  |
| endDate | `string` |  |  |
| active | `boolean` |  |  |

## seasons  (`Season`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| startDate | `string` |  |  |
| endDate | `string` |  |  |
| active | `boolean` |  |  |

## sizes  (`Size`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| active | `boolean` |  |  |

## variants  (`Variant`, módulo catalog)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| sku | `string` |  |  |
| active | `boolean` |  |  |
| productId | `number` |  |  |
| sizeId | `number` |  |  |
| colorId | `number` |  |  |

## clients  (`Client`, módulo clients)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| name | `string` |  |  |
| lastName | `string` |  |  |
| email | `string` |  |  |
| phone | `string` |  | sí |
| registrationDate | `Date` |  |  |
| active | `boolean` |  |  |
| userId | `number` |  | sí |
| activationCodeHash | `string | null` |  | sí |
| activationCodeExpiresAt | `Date | null` |  | sí |

## inventory  (`Inventory`, módulo inventory)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| stock | `number` |  |  |
| reserved | `number` |  |  |
| stockMin | `number` |  |  |
| stockMax | `number` |  | sí |
| updatedAt | `Date` |  |  |
| branchId | `number` |  |  |
| variantId | `number` |  |  |

## inventory_movements  (`InventoryMovement`, módulo inventory)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| quantity | `number` |  |  |
| movementDate | `Date` |  |  |
| type | `MovementType` |  |  |
| observation | `string` |  | sí |
| inventoryId | `number` |  |  |
| userId | `number` |  | sí |

## suppliers  (`Supplier`, módulo inventory)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| name | `string` |  |  |
| nit | `string` |  |  |
| email | `string` |  | sí |
| phone | `string` |  | sí |
| address | `string` |  | sí |
| active | `boolean` |  |  |

## notification_devices  (`NotificationDevice`, módulo notifications)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| userId | `number` |  |  |
| token | `string` |  |  |
| platform | `string` |  |  |
| active | `boolean` |  |  |

## notifications  (`Notification`, módulo notifications)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| userId | `number` |  |  |
| type | `string` |  |  |
| title | `string` |  |  |
| message | `string` |  |  |
| reservationId | `number` |  | sí |
| read | `boolean` |  |  |
| createdAt | `Date` |  |  |

## reservation_items  (`ReservationItem`, módulo reservations)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| quantity | `number` |  |  |
| reservationId | `number` |  |  |
| variantId | `number` |  |  |

## reservations  (`Reservation`, módulo reservations)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| offlineOperationId | `string | null` |  | sí |
| status | `ReservationStatus` |  |  |
| date | `string` |  |  |
| approximateTime | `string` |  | sí |
| registrationDate | `Date` |  |  |
| clientId | `number` |  |  |
| branchId | `number` |  |  |

## cash_registers  (`CashRegister`, módulo sales)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| branchId | `number` |  |  |
| name | `string` |  |  |
| active | `boolean` |  |  |
| createdAt | `Date` |  |  |

## cash_sessions  (`CashSession`, módulo sales)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| branchId | `number` |  |  |
| cashierId | `number` |  |  |
| registerId | `number | null` |  | sí |
| openingAmount | `number` |  |  |
| openedAt | `Date` |  |  |
| closingAmount | `number` |  | sí |
| expectedAmount | `number` |  | sí |
| difference | `number` |  | sí |
| closedAt | `Date` |  | sí |
| openedById | `number | null` |  | sí |
| closedById | `number | null` |  | sí |
| status | `CashSessionStatus` |  |  |

## payments  (`Payment`, módulo sales)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| amount | `number` |  |  |
| method | `PaymentMethod` |  |  |
| status | `PaymentStatus` |  |  |
| date | `Date` |  |  |
| transactionReference | `string` |  | sí |
| stripePaymentIntentId | `string` |  | sí |
| externalReference | `string` |  | sí |
| provider | `string` |  | sí |
| expiresAt | `Date` |  | sí |
| saleId | `number` |  |  |

## sale_items  (`SaleItem`, módulo sales)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| quantity | `number` |  |  |
| unitPrice | `number` |  |  |
| subtotal | `number` |  |  |
| saleId | `number` |  |  |
| variantId | `number` |  |  |

## sales  (`Sale`, módulo sales)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| offlineOperationId | `string | null` |  | sí |
| channel | `SaleChannel` |  |  |
| status | `SaleStatus` |  |  |
| date | `Date` |  |  |
| subtotal | `number` |  |  |
| discount | `number` |  | sí |
| total | `number` |  |  |
| branchId | `number` |  |  |
| clientId | `number` |  | sí |
| userId | `number` |  | sí |
| cashSessionId | `number` |  | sí |
| reservationId | `number` |  | sí |

## offline_sync_operations  (`SyncOperation`, módulo sync)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| operationId | `string` |  |  |
| type | `SyncOperationType` |  |  |
| status | `SyncOperationStatus` |  |  |
| deviceId | `string | null` |  | sí |
| userId | `number` |  |  |
| payload | `any` |  |  |
| result | `any` |  | sí |
| clientCreatedAt | `Date` |  |  |
| receivedAt | `Date` |  |  |

## sync_conflicts  (`SyncConflict`, módulo sync)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| operationId | `string` |  |  |
| type | `SyncConflictType` |  |  |
| status | `SyncConflictStatus` |  |  |
| branchId | `number` |  | sí |
| saleId | `number` |  | sí |
| message | `string` |  |  |
| detail | `any` |  | sí |
| resolutionAction | `string | null` |  | sí |
| resolutionNotes | `string | null` |  | sí |
| resolvedBy | `number` |  | sí |
| resolvedAt | `Date | null` |  | sí |
| createdAt | `Date` |  |  |

## plans  (`Plan`, módulo tenants)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| code | `string` |  | sí |
| name | `string` |  |  |
| priceMonthly | `number` |  |  |
| maxBranches | `number` |  |  |
| aiGenerativeReports | `boolean` |  |  |
| offlineOperations | `boolean` |  |  |
| createdAt | `Date` |  |  |

## subscription_history  (`SubscriptionHistory`, módulo tenants)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| planId | `number` |  |  |
| action | `string` |  |  |
| previousPlanId | `number` |  | sí |
| changedAt | `Date` |  |  |
| notes | `string` |  | sí |

## subscriptions  (`Subscription`, módulo tenants)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| tenantId | `number` |  |  |
| planId | `number` |  |  |
| status | `string` |  |  |
| startDate | `Date` |  |  |
| endDate | `Date` |  | sí |
| updatedAt | `Date` |  |  |

## tenants  (`Tenant`, módulo tenants)

| Campo | Tipo | PK | Nulo |
|---|---|---|---|
| id | `number` | sí |  |
| slug | `string` |  |  |
| name | `string` |  |  |
| taxId | `string` |  | sí |
| active | `boolean` |  |  |
| storeConfig | `json | null` |  | sí |
| createdAt | `Date` |  |  |
| updatedAt | `Date` |  |  |
