import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { seedRoles } from './seeds/roles.seed';
import { seedDefaultCatalog } from '../modules/tenants/default-catalog';

async function runSeed() {
  console.log('Initializing Seed Runner...');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);

    console.log('Seeding Roles...');
    await seedRoles(dataSource);

    // Tallas y colores son catálogos de cada empresa: se siembran por tenant
    const tenants = await dataSource.query('SELECT id FROM tenants ORDER BY id');
    for (const t of tenants) {
      console.log(`Seeding Sizes and Colors for tenant ${t.id}...`);
      await seedDefaultCatalog(dataSource, Number(t.id));
    }

    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await app.close();
  }
}

runSeed();
