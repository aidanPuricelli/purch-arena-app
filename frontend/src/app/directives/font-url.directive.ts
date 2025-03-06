import { Directive, ElementRef, OnInit } from '@angular/core';
import { AssetPathService } from '../services/asset-path.service';

declare global {
  interface Document {
    fonts: FontFaceSet;
  }
}

@Directive({
  selector: '[fontUrl]'
})
export class FontUrlDirective implements OnInit {
  constructor(
    private el: ElementRef,
    private assetPathService: AssetPathService
  ) {}

  ngOnInit() {
    // Create a new style element
    const style = document.createElement('style');
    document.head.appendChild(style);

    const fontFaces = [
      {
        family: 'Beleren Bold',
        path: 'fonts/Beleren-Bold.ttf',
        weight: 'bold',
        style: 'normal',
        className: 'beleren-bold'
      },
      {
        family: 'MPlantin',
        path: 'fonts/MPlantin.ttf',
        weight: 'normal',
        style: 'normal',
        className: 'mplantin-text'
      },
      {
        family: 'MPlantin-Italic',
        path: 'fonts/MPlantin-Italic.ttf',
        weight: 'normal',
        style: 'italic',
        className: 'mplantin-italic'
      }
    ];

    // Build the complete CSS string
    let cssRules = '';
    fontFaces.forEach(font => {
      const fontUrl = this.assetPathService.getAssetPath(font.path);
      console.log(`Attempting to load font '${font.family}' from: ${fontUrl}`);

      cssRules += `
        @font-face {
          font-family: '${font.family}';
          src: url('${fontUrl}') format('truetype');
          font-weight: ${font.weight};
          font-style: ${font.style};
          font-display: block;
        }

        .${font.className} {
          font-family: '${font.family}', sans-serif;
        }
      `;

      // Create a test element to verify font loading
      const testEl = document.createElement('div');
      testEl.style.opacity = '0';
      testEl.style.position = 'absolute';
      testEl.style.left = '-9999px';
      testEl.style.fontFamily = `'${font.family}', sans-serif`;
      testEl.textContent = 'Test Font Loading';
      document.body.appendChild(testEl);

      // Check if font loaded
      if ('fonts' in document) {
        document.fonts.ready.then(() => {
          const fontLoaded = document.fonts.check(`12px '${font.family}'`);
          console.log(`Font '${font.family}' loaded:`, fontLoaded);
          document.body.removeChild(testEl);
        });
      } else {
        // Fallback for browsers that don't support document.fonts
        setTimeout(() => {
          console.log(`Font '${font.family}' loading status unknown (browser doesn't support font loading API)`);
          document.body.removeChild(testEl);
        }, 1000);
      }
    });

    // Add all font-face rules at once
    style.textContent = cssRules;
  }
} 