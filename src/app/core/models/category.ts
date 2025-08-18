export interface Category {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryDto {
  name: string;
  description: string;
  isActive?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}
