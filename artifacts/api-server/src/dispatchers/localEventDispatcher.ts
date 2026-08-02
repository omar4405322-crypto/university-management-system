import { IEventDispatcher } from './eventDispatcher.interface';
import { ActivityRepository, CreateActivityEventData } from '../repositories/activity.repository';

export class LocalEventDispatcher implements IEventDispatcher {
  async dispatch(eventData: CreateActivityEventData): Promise<void> {
    // Non-blocking asynchronous process execution using setImmediate
    setImmediate(async () => {
      try {
        await ActivityRepository.create(eventData);
      } catch (error) {
        console.error(
          '[LocalEventDispatcher] Failed to save activity timeline event:',
          error
        );
      }
    });
  }
}
