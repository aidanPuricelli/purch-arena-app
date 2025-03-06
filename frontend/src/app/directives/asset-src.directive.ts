import { Directive, ElementRef, Input, OnInit } from '@angular/core';
import { AssetPathService } from '../services/asset-path.service';

@Directive({
  selector: '[assetSrc]'
})
export class AssetSrcDirective implements OnInit {
  @Input('assetSrc') assetPath: string = '';

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private assetPathService: AssetPathService
  ) {}

  ngOnInit() {
    if (this.assetPath) {
      const fullPath = this.assetPathService.getAssetPath(this.assetPath);
      this.el.nativeElement.src = fullPath;
    }
  }
} 