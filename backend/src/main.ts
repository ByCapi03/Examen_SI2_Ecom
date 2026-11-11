import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { TenantContextMiddleware } from './common/tenancy/tenant-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true }); // rawBody: verificación de firma de los webhooks de Stripe
  app.enableCors();
  // Contexto multitenant por petición (AsyncLocalStorage)
  const tenantMiddleware = new TenantContextMiddleware(app.get(DataSource));
  app.use((req: any, res: any, next: () => void) => tenantMiddleware.use(req, res, next));
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
