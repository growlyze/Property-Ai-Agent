import { createClient, RedisClientType } from 'redis';
import { config } from '../config/config';
import WebSocketService from './webSocket.service';

class PubSubService {
  private publisher: RedisClientType;
  private subscriber: RedisClientType;

  constructor() {
    this.publisher = createClient({
      url: config.redis.url,
      password: config.redis.password,
    });

    this.subscriber = this.publisher.duplicate();

    this.publisher.on('error', (err) => console.error('Redis Publisher Error', err));
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error', err));

    this.connect();
  }

  // A missing or unreachable Redis must not crash the API process: without
  // this catch the rejected connect() is an unhandled rejection, which
  // terminates Node. Real-time dashboard updates are simply unavailable.
  private async connect() {
    try {
      await this.publisher.connect();
      await this.subscriber.connect();
    } catch (err) {
      console.warn('Redis pub/sub unavailable; real-time dashboard updates disabled:', (err as Error)?.message ?? err);
    }
  }

  async publish(channel: string, message: string) {
    try {
      await this.publisher.publish(channel, message);
    } catch (err) {
      console.warn(`Redis publish to "${channel}" skipped:`, (err as Error)?.message ?? err);
    }
  }

  async subscribe(channel: string, callback: (message: string) => void) {
    try {
      await this.subscriber.subscribe(channel, callback);
    } catch (err) {
      console.warn(`Redis subscribe to "${channel}" skipped:`, (err as Error)?.message ?? err);
    }
  }
}

export const pubSubService = new PubSubService();

pubSubService.subscribe('dashboard-updates', (message) => {
  try {
    const data = JSON.parse(message);
    console.log('Dashboard update received:', data);
  } catch (error) {
    console.error('Error parsing dashboard update:', error);
  }
});
