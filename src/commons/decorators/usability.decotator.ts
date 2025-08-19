import { SetMetadata } from '@nestjs/common';

export const USABILITY_KEY = 'usability';
export const Usability = (usability: string) => SetMetadata(USABILITY_KEY, usability);
