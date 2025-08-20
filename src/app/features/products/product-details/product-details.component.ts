import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormatPricePipe } from '../../../shared/pipes/format-price.pipe';
import { TruncatePipe } from '../../../shared/pipes/truncate.pipe';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule, FormatPricePipe, TruncatePipe],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss'
})
export class ProductDetailsComponent {
  @Input() product: any = null;

}
