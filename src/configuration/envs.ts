import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  DB_URL: string;
  APP_ENV: string;
  APP_URL: string;
  ATLAS_URL: string;
  NATS_URL: string;
  NATH_SERVICE: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
}

const envsSchema = joi.object({
  ATLAS_URL: joi.optional(),
  PORT: joi.number().required(),
  DB_URL: joi.string().required(),
  APP_ENV: joi.string().required(),
  APP_URL: joi.string().required(),
  NATS_URL: joi.string().required(),
  NATH_SERVICE: joi.string().required(),
  REDIS_HOST: joi.string().required(),
  REDIS_PORT: joi.number().required(),
})
.unknown(true);

const { error, value } = envsSchema.validate({ 
  ...process.env,
});


if ( error ) {
  throw new Error(`Config validation error: ${ error.message }`);
}

const envVars:EnvVars = value;


export const envs = {
  port: envVars.PORT,
  app_env: envVars.APP_ENV,
  db_url: envVars.DB_URL,
  atlas_url: envVars.ATLAS_URL,
  app_url: envVars.APP_URL,
  nats_server: envVars.NATS_URL,
  nats_service_name: envVars.NATH_SERVICE,
  redis_host: envVars.REDIS_HOST,
  redis_port: envVars.REDIS_PORT,
}