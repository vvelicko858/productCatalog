import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss'
})
export class ProductDetailsComponent {
  @Input() product: any = null;

  getProductDetails() {
    if (!this.product) return null;
    
    return {
      description: this.product.description,
      price: this.product.price,
      noteGeneral: this.product.noteGeneral,
      noteSpecial: this.product.noteSpecial
    };
  }
}
