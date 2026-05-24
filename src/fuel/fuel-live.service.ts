import { Response } from 'express';
import { randomUUID } from 'crypto';
import { fuelService } from './fuel.service';

type FuelNowSessionStatus = 'PENDING' | 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'NO_CHEF_AVAILABLE';

type FuelNowCandidate = {
  id: string;
  name: string;
  kitchen_name?: string | null;
  distance: number;
};

type FuelNowSession = {
  id: string;
  user_id: string;
  plan_id?: string;
  item_name?: string;
  latitude: number;
  longitude: number;
  candidates: FuelNowCandidate[];
  current_candidate_index: number;
  offered_chef_id?: string;
  accepted_chef_id?: string;
  status: FuelNowSessionStatus;
  created_at: string;
  expires_at?: string;
};

type ChefClient = {
  chefId: string;
  response: Response;
};

const OFFER_SECONDS = 120;

export class FuelLiveService {
  private chefClients = new Map<string, Set<ChefClient>>();
  private sessions = new Map<string, FuelNowSession>();
  private sessionTimers = new Map<string, NodeJS.Timeout>();
  private countdownTimers = new Map<string, NodeJS.Timeout>();

  connectChef(chefId: string, response: Response) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.write('\n');

    const client = { chefId, response };
    if (!this.chefClients.has(chefId)) {
      this.chefClients.set(chefId, new Set());
    }
    this.chefClients.get(chefId)!.add(client);

    this.sendToClient(client, 'connected', {
      chef_id: chefId,
      message: 'Fuel NOW live stream connected',
    });

    response.on('close', () => {
      this.chefClients.get(chefId)?.delete(client);
      if (this.chefClients.get(chefId)?.size === 0) {
        this.chefClients.delete(chefId);
      }
    });
  }

  private sendToChef(chefId: string, event: string, data: unknown) {
    const clients = this.chefClients.get(chefId);
    if (!clients?.size) return false;

    for (const client of clients) {
      this.sendToClient(client, event, data);
    }
    return true;
  }

  private sendToClient(client: ChefClient, event: string, data: unknown) {
    client.response.write(`event: ${event}\n`);
    client.response.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  async startDispatch(data: {
    user_id: string;
    latitude: number;
    longitude: number;
    plan_id?: string;
    item_name?: string;
    time_slot?: string;
  }) {
    const candidates = await fuelService.findFuelNowChefs(
      data.latitude,
      data.longitude,
      data.time_slot,
    );

    const session: FuelNowSession = {
      id: randomUUID(),
      user_id: data.user_id,
      plan_id: data.plan_id,
      item_name: data.item_name,
      latitude: data.latitude,
      longitude: data.longitude,
      candidates,
      current_candidate_index: -1,
      status: candidates.length ? 'PENDING' : 'NO_CHEF_AVAILABLE',
      created_at: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);

    if (candidates.length) {
      this.offerNextChef(session.id);
    }

    return session;
  }

  getSession(id: string) {
    return this.sessions.get(id);
  }

  respond(sessionId: string, chefId: string, accepted: boolean) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      const error: any = new Error('Fuel NOW dispatch session not found');
      error.status = 404;
      throw error;
    }

    if (session.offered_chef_id !== chefId || session.status !== 'OFFERED') {
      const error: any = new Error('This Fuel NOW offer is no longer active for this chef');
      error.status = 409;
      throw error;
    }

    this.clearTimers(sessionId);

    if (accepted) {
      session.status = 'ACCEPTED';
      session.accepted_chef_id = chefId;
      this.sendToChef(chefId, 'fuel_now_accepted', session);
      return session;
    }

    session.status = 'REJECTED';
    this.sendToChef(chefId, 'fuel_now_rejected', session);
    this.offerNextChef(sessionId);
    return this.sessions.get(sessionId);
  }

  private offerNextChef(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.clearTimers(sessionId);
    session.current_candidate_index += 1;

    if (session.current_candidate_index >= session.candidates.length) {
      session.status = 'NO_CHEF_AVAILABLE';
      session.offered_chef_id = undefined;
      return;
    }

    const candidate = session.candidates[session.current_candidate_index];
    session.status = 'OFFERED';
    session.offered_chef_id = candidate.id;
    session.expires_at = new Date(Date.now() + OFFER_SECONDS * 1000).toISOString();

    const delivered = this.sendToChef(candidate.id, 'fuel_now_offer', {
      session_id: session.id,
      expires_at: session.expires_at,
      seconds_to_accept: OFFER_SECONDS,
      plan_id: session.plan_id,
      item_name: session.item_name,
      user_location: {
        latitude: session.latitude,
        longitude: session.longitude,
      },
      chef: candidate,
    });

    if (!delivered) {
      this.offerNextChef(sessionId);
      return;
    }

    let secondsRemaining = OFFER_SECONDS;
    const countdown = setInterval(() => {
      secondsRemaining -= 1;
      if (secondsRemaining <= 0) return;
      this.sendToChef(candidate.id, 'fuel_now_countdown', {
        session_id: session.id,
        seconds_remaining: secondsRemaining,
      });
    }, 1000);

    const timeout = setTimeout(() => {
      const current = this.sessions.get(sessionId);
      if (!current || current.status !== 'OFFERED') return;
      this.sendToChef(candidate.id, 'fuel_now_expired', { session_id: session.id });
      current.status = 'EXPIRED';
      this.offerNextChef(sessionId);
    }, OFFER_SECONDS * 1000);

    this.countdownTimers.set(sessionId, countdown);
    this.sessionTimers.set(sessionId, timeout);
  }

  private clearTimers(sessionId: string) {
    const timeout = this.sessionTimers.get(sessionId);
    const countdown = this.countdownTimers.get(sessionId);
    if (timeout) clearTimeout(timeout);
    if (countdown) clearInterval(countdown);
    this.sessionTimers.delete(sessionId);
    this.countdownTimers.delete(sessionId);
  }
}

export const fuelLiveService = new FuelLiveService();
