import { Module } from '@nestjs/common';
import { envs } from 'src/configuration';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: envs.nats_service_name,
        transport: Transport.NATS,
        options: {
          servers: [envs.nats_server],
        },
      },
    ]),
  ],
  exports: [
    ClientsModule,
  ],
})
export class NatsModule {}
