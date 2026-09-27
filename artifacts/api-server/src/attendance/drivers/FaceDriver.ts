import * as Prisma from '@prisma/client';

import {
  IAttendanceDriver,
  DriverValidationContext,
  DriverValidationResult,
  AttendanceIntent,
} from './IAttendanceDriver';
import { AppError } from '../../utils/appError';

export class FaceDriver implements IAttendanceDriver {
  readonly method: Prisma.AttendanceMethod = Prisma.AttendanceMethod.FACE;

  async validate(
    _rawPayload: Record<string, any>,
    _ctx: DriverValidationContext
  ): Promise<DriverValidationResult> {
    if (process.env.ENABLE_FACE_ATTENDANCE !== 'true') {
      return {
        valid: false,
        errorCode: 'FEATURE_DISABLED',
        errorMessage: 'Face Recognition attendance is disabled by default.',
      };
    }
    return {
      valid: false,
      errorCode: 'NOT_IMPLEMENTED',
      errorMessage: 'Face Recognition attendance is not yet implemented.',
    };
  }

  async buildIntent(
    _rawPayload: Record<string, any>,
    _ctx: DriverValidationContext
  ): Promise<AttendanceIntent> {
    if (process.env.ENABLE_FACE_ATTENDANCE !== 'true') {
      throw new AppError('Face Recognition attendance is disabled by default. Configure ENABLE_FACE_ATTENDANCE=true to enable.', 403);
    }
    throw new AppError('Face Recognition attendance is not yet implemented', 501);
  }
}
