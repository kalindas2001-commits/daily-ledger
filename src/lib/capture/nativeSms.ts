import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PhoneSms } from './sms';
export const nativeSmsAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
interface SmsPlugin {
  checkPermissions(): Promise<{ sms: string }>;
  requestPermissions(): Promise<{ sms: string }>;
  setCollection(options: { enabled: boolean; owner?: string }): Promise<void>;
  readPending(options: { owner: string }): Promise<{ messages: PhoneSms[] }>;
  acknowledge(options: { owner: string; id: string }): Promise<void>;
  readMessages(options: { after: number; afterId: string; limit: number }): Promise<{ messages: PhoneSms[]; cursor: { after: number; afterId: string }; hasMore: boolean }>;
}
export const PhoneMessages = registerPlugin<SmsPlugin>('PhoneMessages');