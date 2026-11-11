import { existsSync } from 'fs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private messaging: Messaging;

  onModuleInit() {
    try {
      if (!getApps().length) {
        // En hosting sin archivos: FIREBASE_SERVICE_ACCOUNT_JSON con el contenido del JSON de la cuenta de servicio.
        const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        initializeApp({
          credential: json ? cert(JSON.parse(json)) : applicationDefault(),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      }
      this.messaging = getMessaging();
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      // We don't throw here to prevent crashing the entire app if credentials are missing
      // But we will log it clearly.
    }
  }

  /** ¿Firebase Admin quedó inicializado (credenciales válidas)? */
  isReady() {
    // applicationDefault() no falla al iniciar aunque falten credenciales: se comprueba el archivo.
    const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasCredentials = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || (!!file && existsSync(file));
    return !!this.messaging && hasCredentials;
  }

  getMessaging() {
    if (!this.messaging) {
      throw new Error('Firebase Admin Messaging is not initialized. Check your GOOGLE_APPLICATION_CREDENTIALS.');
    }
    return this.messaging;
  }
}
