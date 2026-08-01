import * as Prisma from '@prisma/client';

import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';

export class GpsDriver implements IAttendanceDriver {
  readonly method: Prisma.AttendanceMethod = Prisma.AttendanceMethod.GPS;

  async validate(
    _rawPayload: Record<string, any>,
    _ctx: DriverValidationContext
  ): Promise<DriverValidationResult> {
    return {
      valid: false,
      errorCode: 'NOT_IMPLEMENTED',
      errorMessage: 'GPS-based attendance is not yet implemented. Coming soon.',
    };
  }

  async buildIntent(
    _rawPayload: Record<string, any>,
    _ctx: DriverValidationContext
  ): Promise<AttendanceIntent> {
    throw new AppError('GPS-based attendance is not yet implemented', 501);
  }
}
