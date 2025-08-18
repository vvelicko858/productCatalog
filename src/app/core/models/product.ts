export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  noteGeneral?: string;
  noteSpecial?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateProductDto {
  name: string;
  category: string;
  description: string;
  price: string;
  noteGeneral?: string;
  noteSpecial?: string;
}

export interface UpdateProductDto {
  name?: string;
  category?: string;
  description?: string;
  price?: string;
  noteGeneral?: string;
  noteSpecial?: string;
}
