import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { UsersService } from './modules/users/users.service';
import { seedDemoAccounts } from './seed/seed-demo-accounts';
import { HistoricalService } from './modules/historical/historical.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: false,
  });

  // WebSocket support
  app.useWebSocketAdapter(new WsAdapter(app));

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------
  const corsOrigin =
    process.env.CORS_ORIGIN || 'http://localhost:5173';

  const allowedOrigins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header
      // (for example, server-to-server requests)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Allow localhost during development
      const isLocalhost =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      if (isLocalhost || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },

    credentials: true,
  });

  // --------------------------------------------------
  // Security / Compression
  // --------------------------------------------------
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(compression());

  // --------------------------------------------------
  // Validation
  // --------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // --------------------------------------------------
  // Global Exception Filter
  // --------------------------------------------------
  app.useGlobalFilters(new HttpExceptionFilter());

  // --------------------------------------------------
  // API Prefix
  // --------------------------------------------------
  app.setGlobalPrefix('api');

  // --------------------------------------------------
  // Swagger
  // --------------------------------------------------
  const config = new DocumentBuilder()
    .setTitle('MarineVision AI API')
    .setDescription(
      'SIH26057 - AI-Powered Automated Underwater Marine Debris and Anomaly ' +
        'Detection System using Side-Scan Sonar Imagery. All data returned by ' +
        'this API is sourced from MongoDB, uploaded sonar files, or AI model ' +
        'inference. Historical/demo records are always tagged accordingly.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  // --------------------------------------------------
  // Demo / Historical Data Seeding
  // --------------------------------------------------
  //
  // Enable explicitly with:
  // AUTO_SEED_DEMO=true
  //
  // This works even when NODE_ENV=production,
  // which is useful for the Railway SIH demo deployment.
  //
  const autoSeed = process.env.AUTO_SEED_DEMO === 'true';

  if (autoSeed) {
    const usersService = app.get(UsersService);

    await seedDemoAccounts(usersService, {
      log: (msg: string) =>
        console.log(`[SeedDemoAccounts] ${msg}`),
    });

    if (process.env.AUTO_SEED_HISTORICAL !== 'false') {
      const historicalService = app.get(HistoricalService);

      const seeded = await historicalService.seedDefaults();

      console.log(
        `[SeedHistorical] upserted=${seeded.upserted} modified=${seeded.modified}`,
      );
    }
  }

  // --------------------------------------------------
  // Railway Server
  // --------------------------------------------------
  //
  // Railway provides PORT automatically.
  // 4000 is used only as a local fallback.
  //
  const port = Number(process.env.PORT) || 4000;

  await app.listen(port, '0.0.0.0');

  // --------------------------------------------------
  // Startup Logs
  // --------------------------------------------------
  console.log(
    `MarineVision AI backend listening on port ${port}`,
  );

  console.log(
    `API base path: /api`,
  );

  console.log(
    `Swagger docs: /api/docs`,
  );
}

bootstrap();
