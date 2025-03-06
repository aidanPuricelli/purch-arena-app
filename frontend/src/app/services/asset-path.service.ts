import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    electronAssetPath?: string;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AssetPathService {
  private readonly isElectron: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Check if we're running in Electron
    this.isElectron = isPlatformBrowser(this.platformId) && 
                      typeof window !== 'undefined' && 
                      window.electronAssetPath !== undefined;
    console.log('AssetPathService initialized, running in Electron:', this.isElectron);
  }

  getAssetPath(relativePath: string): string {
    console.log('Getting asset path for:', relativePath);
    
    // Remove leading slash if present
    relativePath = relativePath.replace(/^\//, '');
    
    // In Electron (production)
    if (this.isElectron && window.electronAssetPath) {
      // Ensure the path is properly formatted for the OS
      const normalizedPath = window.electronAssetPath.replace(/\\/g, '/');
      const fullPath = `${normalizedPath}/assets/${relativePath}`;
      
      // For images and other assets, use the asset:// protocol
      const assetUrl = `asset://${fullPath}`;
      console.log('Constructed asset URL:', assetUrl);
      
      return assetUrl;
    }

    // In development or SSR
    return `/assets/${relativePath}`;
  }
} 