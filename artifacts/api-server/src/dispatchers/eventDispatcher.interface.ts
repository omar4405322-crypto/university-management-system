import { CreateActivityEventData } from '../repositories/activity.repository';

export interface IEventDispatcher {
  dispatch(eventData: CreateActivityEventData): Promise<void>;
}
