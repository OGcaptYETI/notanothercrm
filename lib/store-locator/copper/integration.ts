import { CopperContext } from '@/types';

declare global {
  interface Window {
    Copper: any;
  }
}

class CopperIntegration {
  private sdk: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private context: CopperContext | null = null;

  constructor() {
    // Auto-initialize when in iframe with required params
    if (typeof window !== 'undefined') {
      try {
        const isInIframe = window.self !== window.top;
        const params = new URLSearchParams(window.location.search);
        const hasParams = !!(params.get('parentOrigin') || params.get('origin'));
        
        if (isInIframe && hasParams) {
          this.init();
        }
      } catch {}
    }
  }

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.isInitialized) return Promise.resolve();

    this.initPromise = new Promise((resolve, reject) => {
      let isInIframe = false;
      try { 
        isInIframe = window.self !== window.top; 
      } catch { 
        isInIframe = true; 
      }
      
      const params = new URLSearchParams(window.location.search);
      const hasParams = !!(params.get('parentOrigin') || params.get('origin'));

      if (!isInIframe || !hasParams) {
        console.log('Not in Copper iframe, skipping SDK initialization');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = process.env.NEXT_PUBLIC_COPPER_SDK_URL ||
                   'https://cdn.jsdelivr.net/npm/copper-sdk@latest/dist/copper-sdk.min.js';

      script.onload = () => {
        this.initializeSdk()
          .then(() => resolve())
          .catch(reject);
      };

      script.onerror = () => {
        console.error('Failed to load Copper SDK');
        reject(new Error('Failed to load Copper SDK'));
      };

      document.head.appendChild(script);
    });

    return this.initPromise;
  }

  private async initializeSdk(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 20;

    while (!window.Copper && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.Copper) {
      throw new Error('Copper SDK not available');
    }

    try {
      this.sdk = window.Copper.init();
      this.isInitialized = true;
      console.log('✓ Copper SDK initialized');

      await this.refreshContext();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize Copper SDK:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.sdk) return;

    this.sdk.on('contextUpdated', async (context: any) => {
      console.log('Copper context updated:', context);
      await this.refreshContext();
    });
  }

  async refreshContext(): Promise<void> {
    if (!this.sdk) return;

    try {
      const result = await this.sdk.getContext();
      this.context = result.context;
    } catch (error) {
      console.error('Failed to get Copper context:', error);
    }
  }

  getContext(): CopperContext | null {
    return this.context;
  }

  async logActivity(data: {
    parentType: string;
    parentId: number;
    type: string;
    details: string;
  }) {
    if (!this.sdk) return;

    try {
      await this.sdk.api('/activities', {
        method: 'POST',
        body: JSON.stringify({
          parent: {
            type: data.parentType,
            id: data.parentId,
          },
          type: { category: 'user', name: data.type },
          details: data.details,
        }),
      });
    } catch (error) {
      console.error('Failed to log Copper activity:', error);
    }
  }

  isInCopperIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }
}

export const copperIntegration = new CopperIntegration();
