import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  HttpStatus,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/configuration';
import { Reflector } from '@nestjs/core';
// import { UsersService } from 'src/users/users.service';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { USABILITY_KEY } from '../decorators/usability.decotator';

@Injectable()
export class UsabilitiesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
    // @Inject() private readonly userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // obtenemos la usabilidad del
    const usability = this.reflector.getAllAndOverride<string>(USABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // parent id siempre vendra en la peticion ya que es el padre de la entidad modelo que se va a crear.
    const { parent_id } = context.switchToHttp().getRequest();

    try {
      // obtenemos la suscripción
      const subscription = await firstValueFrom(
        this.client.send('validate_user_subscription', parent_id),
      );

      if (subscription && subscription.error)
        throw new RpcException({
          code: HttpStatus.FORBIDDEN,
          message: subscription.message,
        });

      const { usabilities } = subscription;

      // validamos los usos del plan
      if (usabilities && usabilities.length > 0) {
        const planHaveUsability = usabilities.find(
          (el) => el.name.toLocaleLowerCase() === usability.toLocaleLowerCase(),
        );

        // validamos si puede acceder a esa usability
        if (!planHaveUsability)
          throw new RpcException({
            status: HttpStatus.FORBIDDEN,
            message: 'Your plan can´t access this function',
          });

        // validamos la cantidad de usos disponibles
        const { count } = planHaveUsability;

        // 
      }

      // passa la solicitud
      return true;
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.FORBIDDEN,
        message: error.message,
      });
    }
  }
}
