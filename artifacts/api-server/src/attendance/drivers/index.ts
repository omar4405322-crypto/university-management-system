import { AttendanceMethod } from '@prisma/client';
import { IAttendanceDriver } from './IAttendanceDriver';
import { ManualDriver } from './ManualDriver';
import { QrDriver } from './QrDriver';
import { RfidDriver } from './RfidDriver';
import { FaceDriver } from './FaceDriver';
import { GpsDriver } from './GpsDriver';

class DriverRegistry {
  private drivers: Map<AttendanceMethod, IAttendanceDriver> = new Map();

  constructor() {
    this.register(new ManualDriver());
    this.register(new QrDriver());
    this.register(new RfidDriver());
    this.register(new FaceDriver());
    this.register(new GpsDriver());
  }

  register(driver: IAttendanceDriver): void {
    this.drivers.set(driver.method, driver);
  }

  get(method: AttendanceMethod): IAttendanceDriver | undefined {
    return this.drivers.get(method);
  }

  has(method: AttendanceMethod): boolean {
    return this.drivers.has(method);
  }

  all(): IAttendanceDriver[] {
    return Array.from(this.drivers.values());
  }

  supportedMethods(): AttendanceMethod[] {
    return Array.from(this.drivers.keys());
  }
}

export const driverRegistry = new DriverRegistry();
export default driverRegistry;
