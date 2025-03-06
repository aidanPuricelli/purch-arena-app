import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetSrcDirective } from './asset-src.directive';

@NgModule({
  declarations: [AssetSrcDirective],
  imports: [CommonModule],
  exports: [AssetSrcDirective]
})
export class AssetModule {} 