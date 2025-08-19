import { envs } from './configuration';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, RpcException, Transport } from '@nestjs/microservices';

const logger = new Logger();

async function bootstrap() {
  // create app
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [envs.nats_server],
      },
    },
  );

  // use global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const formattedErrors = errors.map((err) => ({
          field: err.property,
          errors: Object.values(err.constraints || {}),
        }));
        return new RpcException({
          status: 'validation_error',
          message: 'Validation failed',
          errors: formattedErrors,
        });
      },
    }),
  );

  // app listen
  await app.listen();
  logger.log(`Orders microservice running on port: ${envs.port}`);
}
bootstrap();
