import { Injectable } from '@nestjs/common';

@Injectable()
export class Utils {
  getMonthRange(date: Date) {
    // Inicio de mes
    const startOfMonth = new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    // Fin de mes
    const endOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { startOfMonth, endOfMonth };
  }
}
