import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { TenantContextMiddleware } from './common/tenancy/tenant-context.middleware';
import { jwtSecret } from './common/config/jwt-secret';

async function bootstrap() {
  jwtSecret(); // en producción falla al arrancar si falta JWT_SECRET
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody: verificación de firma de los webhooks de Stripe
  // CORS_ORIGINS="https://mi-web.onrender.com,https://otra.com" limita quién puede llamar al API desde un navegador.
  // Sin definirlo queda abierto (desarrollo). Los clientes móviles nativos no se ven afectados por CORS.
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
  app.enableCors(origins.length ? { origin: origins, credentials: true } : undefined);
  // Contexto multitenant por petición (AsyncLocalStorage)
  const tenantMiddleware = new TenantContextMiddleware(app.get(DataSource));
  app.use((req: any, res: any, next: () => void) => tenantMiddleware.use(req, res, next));
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
