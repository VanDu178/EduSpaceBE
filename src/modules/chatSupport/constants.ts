import { isAgentAvailable as isSocketAgentAvailable } from '../../config/socket/socketManager';

class AdminPresenceStore {
  public getStatus() {
    const isOnline = isSocketAgentAvailable();
    return {
      isOnline,
      activeAdminId: null
    };
  }

  public isAgentAvailable(): boolean {
    return isSocketAgentAvailable();
  }
}

export const adminPresenceStore = new AdminPresenceStore();

