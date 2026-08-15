import { Injectable } from '@angular/core';
import { UdemyStatus } from './models';

/** What electron/preload.js exposes. Absent when the UI runs in a plain browser. */
interface DesktopBridge {
  isDesktop: boolean;
  udemyConnect(): Promise<UdemyStatus>;
  udemySync(): Promise<UdemyStatus>;
  udemyDisconnect(): Promise<UdemyStatus>;
}

/**
 * Thin typed wrapper over the Electron bridge, so components never touch `window`.
 * The Udemy session lives in the shell — the browser side only asks for actions.
 */
@Injectable({ providedIn: 'root' })
export class DesktopService {
  private get bridge(): DesktopBridge | undefined {
    return (window as unknown as { learnmore?: DesktopBridge }).learnmore;
  }

  get isDesktop() {
    return this.bridge?.isDesktop === true;
  }

  connectUdemy() {
    return this.require().udemyConnect();
  }

  syncUdemy() {
    return this.require().udemySync();
  }

  disconnectUdemy() {
    return this.require().udemyDisconnect();
  }

  private require(): DesktopBridge {
    const bridge = this.bridge;
    if (!bridge) throw new Error('Open the LearnMore desktop app to manage your Udemy connection.');
    return bridge;
  }
}
