/**
 * NOTIFICATIONS SERVICE
 * Lógica Core: Envía emails usando el MailService (Nodemailer) y Notificaciones Push 
 * usando Firebase (FCM). También persiste en la base de datos (in-app notifications).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { onLowStock } from '../inventory/stock-alert.subscriber';
import { Notification, NotificationDevice } from './notification.entity';
import { User } from '../auth/user.entity';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service';
import { SendResponse } from 'firebase-admin/messaging';
import { MailService } from '../../common/mail.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationDevice) private deviceRepo: Repository<NotificationDevice>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  private lowStockTimer?: NodeJS.Timeout;

  onModuleInit() {
    onLowStock((inventoryId) => { void this.notifyLowStock(inventoryId); });
    // Revisión periódica: avisa del stock que YA estaba bajo (no solo cuando cruza el mínimo).
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => { void this.syncLowStockAlerts(); }, 30_000).unref?.();
      this.lowStockTimer = setInterval(() => { void this.syncLowStockAlerts(); }, 6 * 3_600_000);
      this.lowStockTimer.unref?.();
    }
  }

  /**
   * Resumen por sucursal del stock crítico (disponible <= mínimo). Crea UNA notificación por sucursal y
   * destinatario (encargado de la sucursal + administradores), como máximo cada 24 h, para no saturar.
   * `tenantId` limita la revisión a una empresa (cuando la dispara el panel).
   */
  async syncLowStockAlerts(tenantId?: number) {
    try {
      const rows = await this.dataSource.query(
        `SELECT i.id, i.stock, i.reserved, i."stockMin", i."branchId", b."tenantId", b.name AS "branchName", p.name AS "productName"
           FROM inventory i
           JOIN branches b ON b.id = i."branchId" AND b.active = true
           JOIN tenants t ON t.id = b."tenantId" AND t.active = true
           JOIN variants v ON v.id = i."variantId"
           JOIN products p ON p.id = v."productId"
          WHERE (i.stock - i.reserved) <= i."stockMin" ${tenantId ? 'AND b."tenantId" = $1' : ''}
          ORDER BY b."tenantId", i."branchId", (i.stock - i.reserved)`,
        tenantId ? [tenantId] : []);
      if (!rows.length) return { branches: 0, notified: 0 };

      const byBranch = new Map<number, any[]>();
      for (const r of rows) byBranch.set(r.branchId, [...(byBranch.get(r.branchId) ?? []), r]);

      let notified = 0;
      for (const [branchId, items] of byBranch) {
        const tenant = Number(items[0].tenantId);
        const users = await this.userRepo.find({ where: { tenantId: tenant, active: true }, relations: { userRoles: { role: true } } });
        const targets = users.filter((u) => u.userRoles?.some((ur) => ur.active && (
          ur.role.name === 'ADMIN' || (ur.role.name === 'ENCARGADO' && u.branchId === branchId))));
        if (!targets.length) continue;

        const recent = await this.notificationRepo.createQueryBuilder('n')
          .where('n.branchId = :branchId', { branchId })
          .andWhere("n.type IN ('LOW_STOCK','LOW_STOCK_DIGEST')")
          .andWhere("n.createdAt > NOW() - INTERVAL '24 hours'")
          .andWhere('n.userId IN (:...ids)', { ids: targets.map((u) => u.id) })
          .getMany();
        const already = new Set(recent.map((n) => n.userId));
        const pending = targets.filter((u) => !already.has(u.id));
        if (!pending.length) continue;

        const out = items.filter((i) => Number(i.stock) - Number(i.reserved) <= 0).length;
        const names = [...new Set(items.map((i: any) => i.productName))];
        const title = `Stock crítico en ${items[0].branchName}: ${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;
        const message = `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` y ${names.length - 3} más` : ''}.${out ? ` ${out} agotado${out === 1 ? '' : 's'}.` : ''} Revisa Inventario.`;

        await this.notificationRepo.save(pending.map((u) => this.notificationRepo.create({
          userId: u.id, type: 'LOW_STOCK_DIGEST', title, message, branchId,
        })));
        const devices = await this.deviceRepo.createQueryBuilder('device')
          .where('device.userId IN (:...ids)', { ids: pending.map((u) => u.id) }).andWhere('device.active = true').getMany();
        await this.sendPushNotification(devices.map((d) => d.token), {
          title, message, data: { type: 'LOW_STOCK', branchId: String(branchId), route: '/dashboard/inventory' },
        });
        notified += pending.length;
      }
      return { branches: byBranch.size, notified };
    } catch (error) {
      this.logger.error('Error en la revisión de stock bajo', error as any);
      return { branches: 0, notified: 0 };
    }
  }

  /** Estado de la configuración de push para el usuario (diagnóstico). */
  async pushStatus(userId: number) {
    const devices = await this.deviceRepo.find({ where: { userId, active: true } });
    const isExpo = (t: string) => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken');
    const expoDevices = devices.filter((d) => isExpo(d.token)).length;
    const webDevices = devices.length - expoDevices;
    // Los teléfonos (token de Expo) se envían por el servicio de Expo y no necesitan Firebase en el servidor;
    // solo los navegadores (token FCM) lo requieren.
    const needsFirebase = webDevices > 0;
    return {
      serverPushReady: this.firebaseAdmin.isReady(),
      devices: devices.length,
      expoDevices,
      webDevices,
      platforms: [...new Set(devices.map((d) => d.platform))],
      hint: devices.length === 0
        ? 'Este usuario no tiene dispositivos registrados: active las notificaciones en la web o inicie sesión en la app móvil compilada (no Expo Go).'
        : needsFirebase && !this.firebaseAdmin.isReady()
          ? 'Hay navegadores registrados pero falta configurar Firebase en el servidor (GOOGLE_APPLICATION_CREDENTIALS). Los teléfonos no lo necesitan.'
          : 'OK',
    };
  }

  /**
   * Avisa de stock bajo al ENCARGADO de la sucursal y a los ADMIN de la empresa.
   * Se re-lee el inventario para confirmar que la transacción se confirmó y sigue bajo el mínimo.
   */
  async notifyLowStock(inventoryId: number) {
    try {
      const rows = await this.dataSource.query(
        `SELECT i.id, i.stock, i.reserved, i."stockMin", i."branchId", b."tenantId", b.name AS "branchName",
                p.name AS "productName", s.name AS "sizeName", c.name AS "colorName"
           FROM inventory i
           JOIN branches b ON b.id = i."branchId"
           JOIN variants v ON v.id = i."variantId"
           JOIN products p ON p.id = v."productId"
           LEFT JOIN sizes s ON s.id = v."sizeId"
           LEFT JOIN colors c ON c.id = v."colorId"
          WHERE i.id = $1`, [inventoryId]);
      const inv = rows[0];
      if (!inv) return;
      const available = Number(inv.stock) - Number(inv.reserved);
      if (available > Number(inv.stockMin)) return; // se revirtió o ya se repuso

      const users = await this.userRepo.find({
        where: { tenantId: Number(inv.tenantId), active: true },
        relations: { userRoles: { role: true } },
      });
      const targets = users.filter((u) => u.userRoles?.some((ur) => ur.active && (
        ur.role.name === 'ADMIN' || (ur.role.name === 'ENCARGADO' && u.branchId === inv.branchId)
      )));
      if (!targets.length) return;

      const detail = [inv.productName, inv.sizeName, inv.colorName].filter(Boolean).join(' · ');
      const out = available <= 0;
      const title = out ? `Producto agotado en ${inv.branchName}` : `Stock bajo en ${inv.branchName}`;
      const message = out
        ? `${detail}: sin unidades disponibles (mínimo ${inv.stockMin}).`
        : `${detail}: quedan ${available} unidades (mínimo ${inv.stockMin}).`;

      await this.notificationRepo.save(targets.map((u) =>
        this.notificationRepo.create({ userId: u.id, type: 'LOW_STOCK', title, message, inventoryId, branchId: Number(inv.branchId) })));

      const devices = await this.deviceRepo.createQueryBuilder('device')
        .where('device.userId IN (:...ids)', { ids: targets.map((u) => u.id) })
        .andWhere('device.active = true').getMany();
      await this.sendPushNotification(devices.map((d) => d.token), {
        title, message, data: { type: 'LOW_STOCK', inventoryId: String(inventoryId), route: '/dashboard/inventory' },
      });
    } catch (error) {
      this.logger.error(`Error notificando stock bajo (inventario ${inventoryId})`, error as any);
    }
  }

  async findMyNotifications(userId: number) {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50 // Limit to recent 50 to avoid massive payloads
    });
  }

  async markAsRead(id: number, userId: number) {
    await this.notificationRepo.update({ id, userId }, { read: true });
    return { success: true };
  }

  async markAllAsRead(userId: number) {
    await this.notificationRepo.update({ userId, read: false }, { read: true });
    return { success: true };
  }

  async registerDevice(userId: number, token: string, platform: string) {
    let device = await this.deviceRepo.findOne({ where: { userId, token } });
    if (!device) {
      device = this.deviceRepo.create({ userId, token, platform, active: true });
    } else {
      device.active = true;
      device.platform = platform;
    }
    return this.deviceRepo.save(device);
  }

  private async sendPushNotification(tokens: string[], payload: { title: string; message: string; data?: Record<string, string> }) {
    const results: any = { tokens, fcm: [], expo: [] };
    if (!tokens.length) return results;

    const fcmTokens = tokens.filter(t => !t.startsWith('ExponentPushToken') && !t.startsWith('ExpoPushToken'));
    const expoTokens = tokens.filter(t => t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'));
    
    // Send to FCM
    if (fcmTokens.length > 0) {
      try {
        const messaging = this.firebaseAdmin.getMessaging();
        const message = {
          tokens: fcmTokens,
          notification: {
            title: payload.title,
            body: payload.message,
          },
          data: payload.data || {},
        };

        const response = await messaging.sendEachForMulticast(message);
        this.logger.log(`[PUSH FCM] Success: ${response.successCount}, Failures: ${response.failureCount}`);

        if (response.failureCount > 0) {
          const failedTokens: string[] = [];
          response.responses.forEach((resp: SendResponse, idx: number) => {
            if (!resp.success) {
              const errCode = resp.error?.code;
              if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
                failedTokens.push(fcmTokens[idx]);
              }
            }
          });

          if (failedTokens.length > 0) {
            await this.deviceRepo.update(
              { token: In(failedTokens) },
              { active: false }
            );
          }
        }
        results.fcm.push(response);
      } catch (err) {
        this.logger.error('Failed to send push notification via FCM', err);
        results.fcm.push({ error: (err as any).message || err });
      }
    }

    // Send to Expo
    if (expoTokens.length > 0) {
      try {
        const messages = expoTokens.map(token => ({
          to: token,
          sound: 'default',
          channelId: 'default',
          priority: 'high',
          title: payload.title,
          body: payload.message,
          data: payload.data || {},
        }));
        
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        const data = await res.json();
        // Expo responde 200 aunque la entrega falle: el resultado real está en cada "ticket".
        const tickets: any[] = Array.isArray(data?.data) ? data.data : [];
        const errors = tickets
          .map((t, i) => (t?.status === 'error' ? { token: expoTokens[i], error: t.details?.error ?? 'error', message: t.message } : null))
          .filter(Boolean) as { token: string; error: string; message: string }[];
        this.logger.log(`[PUSH EXPO] Enviadas ${expoTokens.length}, con error ${errors.length}. HTTP ${res.status}`);
        for (const e of errors) this.logger.warn(`[PUSH EXPO] ${e.error}: ${e.message}`);
        const dead = errors.filter((e) => e.error === 'DeviceNotRegistered').map((e) => e.token);
        if (dead.length) await this.deviceRepo.update({ token: In(dead) }, { active: false });
        results.expo.push({ status: res.status, data, tokens: expoTokens, errors });
      } catch (err) {
        this.logger.error('Failed to send push notification via Expo', err);
        results.expo.push({ error: (err as any).message || err });
      }
    }
    return results;
  }

  async notifyReservationCreated(branchId: number, reservation: any, clientName: string) {
    try {
      // Find Encargados in the given branch
      const staffMembers = await this.userRepo.find({
        where: { branchId, active: true },
        relations: { userRoles: { role: true } }
      });

      const targetUsers = staffMembers.filter(user => 
        user.userRoles.some(ur => ur.active && ur.role.name === 'ENCARGADO')
      );

      if (targetUsers.length === 0) return;

      const title = `Nueva reserva #${reservation.id}`;
      const message = `${clientName} realizó una nueva reserva.`;

      const newNotifications = targetUsers.map(user => 
        this.notificationRepo.create({
          userId: user.id,
          type: 'RESERVATION_CREATED',
          title,
          message,
          reservationId: reservation.id
        })
      );

      await this.notificationRepo.save(newNotifications);

      // Get devices for these users
      const targetUserIds = targetUsers.map(u => u.id);
      const devices = await this.deviceRepo.createQueryBuilder('device')
        .where('device.userId IN (:...userIds)', { userIds: targetUserIds })
        .andWhere('device.active = true')
        .getMany();

      const tokens = devices.map(d => d.token);
      
      // Attempt to push
      await this.sendPushNotification(tokens, { 
        title, 
        message, 
        data: { 
          type: "RESERVATION_CREATED",
          reservationId: String(reservation.id),
          route: "/dashboard/reservations"
        } 
      });

    } catch (error) {
      this.logger.error(`Error notifying new reservation (Branch: ${branchId}, Res: ${reservation.id})`, error);
      // We swallow the error so we don't break the calling transaction flow
    }
  }

  async notifyReservationPaid(branchId: number, reservation: any, clientName: string, clientUserId: number, paymentAmount?: number, paymentMethod?: string, paymentReference?: string) {
    try {
      // 1. Notify Client
      const clientTitle = `Pago confirmado para tu reserva #${reservation.id}`;
      const clientMessage = `Pago confirmado para tu reserva #${reservation.id}`;

      const clientNotification = this.notificationRepo.create({
        userId: clientUserId,
        type: 'RESERVATION_CONFIRMED',
        title: clientTitle,
        message: clientMessage,
        reservationId: reservation.id
      });
      await this.notificationRepo.save(clientNotification);

      const clientDevices = await this.deviceRepo.find({ where: { userId: clientUserId, active: true }});
      if (clientDevices.length > 0) {
        await this.sendPushNotification(clientDevices.map(d => d.token), {
          title: clientTitle,
          message: clientMessage,
          data: { type: 'RESERVATION_CONFIRMED', reservationId: String(reservation.id), route: "/reservations" }
        });
      }

      // 1.5 Notify Client via Email
      let targetEmail = reservation?.client?.email;
      if (!targetEmail && clientUserId) {
        const clientUser = await this.userRepo.findOne({ where: { id: clientUserId } });
        if (clientUser) targetEmail = clientUser.email;
      }

      if (targetEmail) {
        await this.mailService.sendPaymentConfirmation(
          targetEmail,
          clientName,
          paymentAmount || 0,
          paymentMethod || 'Desconocido',
          paymentReference || 'N/A'
        ).catch(err => this.logger.error('Error enviando email de confirmación', err));
      }

      // 2. Notify Encargado
      const staffMembers = await this.userRepo.find({
        where: { branchId, active: true },
        relations: { userRoles: { role: true } }
      });
      const targetUsers = staffMembers.filter(user => 
        user.userRoles.some(ur => ur.active && ur.role.name === 'ENCARGADO')
      );

      if (targetUsers.length > 0) {
        const title = `Nueva reserva confirmada #${reservation.id}`;
        const message = `Nueva reserva confirmada #${reservation.id}`;

        const newNotifications = targetUsers.map(user => 
          this.notificationRepo.create({
            userId: user.id,
            type: 'RESERVATION_CONFIRMED',
            title,
            message,
            reservationId: reservation.id
          })
        );
        await this.notificationRepo.save(newNotifications);

        const targetUserIds = targetUsers.map(u => u.id);
        const devices = await this.deviceRepo.createQueryBuilder('device')
          .where('device.userId IN (:...userIds)', { userIds: targetUserIds })
          .andWhere('device.active = true')
          .getMany();

        if (devices.length > 0) {
          await this.sendPushNotification(devices.map(d => d.token), {
            title,
            message,
            data: { type: 'RESERVATION_CONFIRMED', reservationId: String(reservation.id), route: "/dashboard/reservations" }
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error notifying reservation paid (Res: ${reservation.id})`, error);
    }
  }

  async notifyReservationDelivered(branchId: number, reservation: any, cashierName: string, clientUserId: number) {
    try {
      // 1. Notify Client
      const clientTitle = `Reserva entregada #${reservation.id}`;
      const clientMessage = `Tu reserva #${reservation.id} fue entregada correctamente.`;

      const clientNotification = this.notificationRepo.create({
        userId: clientUserId,
        type: 'RESERVATION_ATTENDED',
        title: clientTitle,
        message: clientMessage,
        reservationId: reservation.id
      });
      await this.notificationRepo.save(clientNotification);

      const clientDevices = await this.deviceRepo.find({ where: { userId: clientUserId, active: true }});
      if (clientDevices.length > 0) {
        await this.sendPushNotification(clientDevices.map(d => d.token), {
          title: clientTitle,
          message: clientMessage,
          data: { type: 'RESERVATION_ATTENDED', reservationId: String(reservation.id), route: "/reservations" }
        });
      }

      // 2. Notify Encargado
      const staffMembers = await this.userRepo.find({
        where: { branchId, active: true },
        relations: { userRoles: { role: true } }
      });
      const targetUsers = staffMembers.filter(user => 
        user.userRoles.some(ur => ur.active && ur.role.name === 'ENCARGADO')
      );

      if (targetUsers.length > 0) {
        const title = `Reserva #${reservation.id} atendida`;
        const message = `Reserva #${reservation.id} atendida`;

        const newNotifications = targetUsers.map(user => 
          this.notificationRepo.create({
            userId: user.id,
            type: 'RESERVATION_ATTENDED',
            title,
            message,
            reservationId: reservation.id
          })
        );
        await this.notificationRepo.save(newNotifications);

        const targetUserIds = targetUsers.map(u => u.id);
        const devices = await this.deviceRepo.createQueryBuilder('device')
          .where('device.userId IN (:...userIds)', { userIds: targetUserIds })
          .andWhere('device.active = true')
          .getMany();

        if (devices.length > 0) {
          await this.sendPushNotification(devices.map(d => d.token), {
            title,
            message,
            data: { type: 'RESERVATION_ATTENDED', reservationId: String(reservation.id), route: "/dashboard/reservations" }
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error notifying reservation delivered (Res: ${reservation.id})`, error);
    }
  }

  async notifyReservationStatusUpdated(branchId: number, reservation: any, clientUserId: number, newStatus: string) {
    try {
      let clientTitle = `Estado de reserva #${reservation.id}`;
      let clientMessage = `Tu reserva ha cambiado a estado: ${newStatus}.`;

      if (newStatus === 'PREPARANDO') {
        clientTitle = `Preparando reserva #${reservation.id}`;
        clientMessage = `Estamos preparando tu reserva #${reservation.id}`;
      } else if (newStatus === 'LISTA') {
        clientTitle = `Reserva lista #${reservation.id}`;
        clientMessage = `Tu reserva #${reservation.id} está lista para recoger`;
      }

      const clientNotification = this.notificationRepo.create({
        userId: clientUserId,
        type: `RESERVATION_STATUS`,
        title: clientTitle,
        message: clientMessage,
        reservationId: reservation.id
      });
      await this.notificationRepo.save(clientNotification);

      const clientDevices = await this.deviceRepo.find({ where: { userId: clientUserId, active: true }});
      if (clientDevices.length > 0) {
        await this.sendPushNotification(clientDevices.map(d => d.token), {
          title: clientTitle,
          message: clientMessage,
          data: { type: 'RESERVATION_STATUS', reservationId: String(reservation.id), route: "/reservations" }
        });
      }

      if (newStatus === 'LISTA') {
        console.log({
          event: 'reservation.ready',
          reservationId: reservation.id,
          clientUserId,
          branchId
        });
        
        // Notify Cajeros of the branch
        const staffMembers = await this.userRepo.find({
          where: { branchId, active: true },
          relations: { userRoles: { role: true } }
        });
        const targetUsers = staffMembers.filter(user => 
          user.userRoles.some(ur => ur.active && ur.role.name === 'CAJERO')
        );

        if (targetUsers.length > 0) {
          const clientName = reservation.client ? `${reservation.client.name} ${reservation.client.lastName}` : 'Cliente';
          const cajeroTitle = `Reserva #${reservation.id} lista para entrega`;
          const cajeroMessage = `Reserva #${reservation.id} lista para entrega`;

          const cajeroNotifications = targetUsers.map(u => 
            this.notificationRepo.create({
              userId: u.id,
              type: 'RESERVATION_READY',
              title: cajeroTitle,
              message: cajeroMessage,
              reservationId: reservation.id
            })
          );
          await this.notificationRepo.save(cajeroNotifications);

          const targetUserIds = targetUsers.map(u => u.id);
          const devices = await this.deviceRepo.createQueryBuilder('device')
            .where('device.userId IN (:...userIds)', { userIds: targetUserIds })
            .andWhere('device.active = true')
            .getMany();

          console.log({
            devicesFound: devices.length,
            tokens: devices.map(d => d.token)
          });

          if (devices.length > 0) {
            await this.sendPushNotification(devices.map(d => d.token), {
              title: cajeroTitle,
              message: cajeroMessage,
              data: { type: 'RESERVATION_READY', reservationId: String(reservation.id), route: "/pos" }
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error notifying status update (Res: ${reservation.id})`, error);
    }
  }

  // TEMPORARY FOR TESTING
  async testPushNotification(userId: number) {
    const title = 'Prueba de notificación';
    const message = 'Las notificaciones push están funcionando.';

    const notification = this.notificationRepo.create({
      userId,
      type: 'TEST',
      title,
      message,
    });
    await this.notificationRepo.save(notification);

    const devices = await this.deviceRepo.find({
      where: { userId, active: true }
    });

    const tokens = devices.map(d => d.token);

    if (tokens.length > 0) {
      const results = await this.sendPushNotification(tokens, {
        title,
        message,
        data: {
          type: 'TEST',
          route: '/dashboard'
        }
      });
      const expoErrors: { token: string; error: string; message: string }[] = (results.expo ?? []).flatMap((x: any) => x.errors ?? []);
      const sendFailed = (results.expo ?? []).some((x: any) => x.error) || (results.fcm ?? []).some((x: any) => x.error);
      const delivered = !sendFailed && expoErrors.length === 0;
      return {
        success: delivered,
        message: delivered
          ? `Notificación enviada a ${tokens.length} dispositivo(s)`
          : `No se pudo entregar: ${expoErrors[0] ? `${expoErrors[0].error} — ${expoErrors[0].message}` : 'error al contactar el servicio de push'}`,
        details: results,
      };
    }

    return { success: false, message: 'No active devices found' };
  }
}
