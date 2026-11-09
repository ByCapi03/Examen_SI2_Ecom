import { getCurrentTenantId } from '../../common/tenancy/tenant-context';
import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CloudinaryService } from '../../common/cloudinary.service';

import {
  CreateProductDto, UpdateProductDto,
  CreateVariantDto, UpdateVariantDto,
  CreateCategoryDto, UpdateCategoryDto,
  CreateSizeDto, UpdateSizeDto,
  CreateColorDto, UpdateColorDto,
  CreateSeasonDto, UpdateSeasonDto,
  CreateCollectionDto, UpdateCollectionDto,
  CreatePromotionDto, UpdatePromotionDto
} from './catalog.dto';

import { Category } from './category.entity';
import { Size } from './size.entity';
import { Color } from './color.entity';
import { Product } from './product.entity';
import { Variant } from './variant.entity';
import { Season } from './season.entity';
import { Collection } from './collection.entity';
import { Promotion } from './promotion.entity';
import { Supplier } from '../inventory/supplier.entity';
import { CatalogPricingService } from './catalog-pricing.service';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Category) private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Size) private readonly sizeRepository: Repository<Size>,
    @InjectRepository(Color) private readonly colorRepository: Repository<Color>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Variant) private readonly variantRepository: Repository<Variant>,
    @InjectRepository(Season) private readonly seasonRepository: Repository<Season>,
    @InjectRepository(Collection) private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Promotion) private readonly promotionRepository: Repository<Promotion>,
    private cloudinaryService: CloudinaryService,
    private catalogPricingService: CatalogPricingService
  ) {}

  /** Tenant autenticado (JWT). Todos los catálogos de negocio son por empresa. */
  private tenant(): number {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new ForbiddenException('Aislamiento SaaS: tenant no identificado');
    return tenantId;
  }

  // --- CATEGORIES ---
  async createCategory(createCategoryDto: CreateCategoryDto) {
    const tenantId = this.tenant();
    const existing = await this.categoryRepository.findOneBy({ tenantId, name: createCategoryDto.name });
    if (existing) throw new ConflictException(`La categoría ${createCategoryDto.name} ya existe`);
    const category = this.categoryRepository.create({ ...createCategoryDto, tenantId });
    return this.categoryRepository.save(category);
  }
  async findAllCategories() {
    return this.categoryRepository.find({ where: { tenantId: this.tenant() }, order: { id: 'ASC' } });
  }
  async findOneCategory(id: number) {
    const category = await this.categoryRepository.findOneBy({ id, tenantId: this.tenant() });
    if (!category) throw new NotFoundException(`Categoría #${id} no encontrada`);
    return category;
  }
  async updateCategory(id: number, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOneCategory(id);
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existing = await this.categoryRepository.findOneBy({ tenantId: category.tenantId, name: updateCategoryDto.name });
      if (existing) throw new ConflictException(`La categoría ${updateCategoryDto.name} ya existe`);
    }
    Object.assign(category, updateCategoryDto, { tenantId: category.tenantId });
    return this.categoryRepository.save(category);
  }
  async removeCategory(id: number) {
    const category = await this.findOneCategory(id);
    category.active = false;
    await this.categoryRepository.save(category);
    return { success: true, message: `Categoría ${id} desactivada` };
  }

  // --- SIZES ---
  async createSize(createSizeDto: CreateSizeDto) {
    const tenantId = this.tenant();
    const existing = await this.sizeRepository.findOneBy({ tenantId, name: createSizeDto.name });
    if (existing) throw new ConflictException(`La talla ${createSizeDto.name} ya existe`);
    const size = this.sizeRepository.create({ ...createSizeDto, tenantId });
    return this.sizeRepository.save(size);
  }
  async findAllSizes() {
    return this.sizeRepository.find({ where: { tenantId: this.tenant() }, order: { id: 'ASC' } });
  }
  async findOneSize(id: number) {
    const size = await this.sizeRepository.findOneBy({ id, tenantId: this.tenant() });
    if (!size) throw new NotFoundException(`Talla #${id} no encontrada`);
    return size;
  }
  async updateSize(id: number, updateSizeDto: UpdateSizeDto) {
    const size = await this.findOneSize(id);
    if (updateSizeDto.name && updateSizeDto.name !== size.name) {
      const existing = await this.sizeRepository.findOneBy({ tenantId: size.tenantId, name: updateSizeDto.name });
      if (existing) throw new ConflictException(`La talla ${updateSizeDto.name} ya existe`);
    }
    Object.assign(size, updateSizeDto, { tenantId: size.tenantId });
    return this.sizeRepository.save(size);
  }
  async removeSize(id: number) {
    const size = await this.findOneSize(id);
    size.active = false;
    await this.sizeRepository.save(size);
    return { success: true, message: `Talla ${id} desactivada` };
  }

  // --- COLORS ---
  async createColor(createColorDto: CreateColorDto) {
    const tenantId = this.tenant();
    const existing = await this.colorRepository.findOneBy({ tenantId, name: createColorDto.name });
    if (existing) throw new ConflictException(`El color ${createColorDto.name} ya existe`);
    const color = this.colorRepository.create({ ...createColorDto, tenantId });
    return this.colorRepository.save(color);
  }
  async findAllColors() {
    return this.colorRepository.find({ where: { tenantId: this.tenant() }, order: { id: 'ASC' } });
  }
  async findOneColor(id: number) {
    const color = await this.colorRepository.findOneBy({ id, tenantId: this.tenant() });
    if (!color) throw new NotFoundException(`Color #${id} no encontrado`);
    return color;
  }
  async updateColor(id: number, updateColorDto: UpdateColorDto) {
    const color = await this.findOneColor(id);
    if (updateColorDto.name && updateColorDto.name !== color.name) {
      const existing = await this.colorRepository.findOneBy({ tenantId: color.tenantId, name: updateColorDto.name });
      if (existing) throw new ConflictException(`El color ${updateColorDto.name} ya existe`);
    }
    Object.assign(color, updateColorDto, { tenantId: color.tenantId });
    return this.colorRepository.save(color);
  }
  async removeColor(id: number) {
    const color = await this.findOneColor(id);
    color.active = false;
    await this.colorRepository.save(color);
    return { success: true, message: `Color ${id} desactivado` };
  }

  // --- PRODUCTS ---
  async createProduct(createProductDto: CreateProductDto, tenantId?: number) {
    if (createProductDto.arEnabled && !createProductDto.arType) {
      throw new BadRequestException('El tipo de prenda AR (arType) es obligatorio si AR está habilitado');
    }

    const category = await this.categoryRepository.findOneBy({ id: createProductDto.categoryId, tenantId: tenantId ?? this.tenant() });
    if (!category) throw new NotFoundException(`Categoría #${createProductDto.categoryId} no encontrada`);
    if (createProductDto.collectionId) await this.findOneCollection(createProductDto.collectionId);

    const product = this.productRepository.create({
      ...createProductDto,
      // El tenant proviene exclusivamente del JWT (nunca del body)
      tenantId,
    });
    return this.productRepository.save(product);
  }
  async findAllProducts(tenantId?: number) {
    const whereClause: any = {};
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const products = await this.productRepository.find({
      where: whereClause,
      relations: { category: true, variants: true, collection: { season: true }, promotions: true },
      order: { id: 'ASC' }
    });

    return products.map(p => {
      const pricing = this.catalogPricingService.getEffectivePrice(p);
      return {
        ...p,
        basePrice: pricing.basePrice,
        finalPrice: pricing.finalPrice,
        discount: pricing.discount,
        winningPromotion: pricing.promotion
      };
    });
  }
  async findOneProduct(id: number, tenantId: number | undefined = getCurrentTenantId()) {
    const whereClause: any = { id };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    const product = await this.productRepository.findOne({
      where: whereClause,
      relations: { category: true, variants: true, collection: true, promotions: true }
    });
    if (!product) throw new NotFoundException(`Producto #${id} no encontrado`);
    return product;
  }
  async updateProduct(id: number, updateProductDto: UpdateProductDto, tenantId?: number) {
    const product = await this.findOneProduct(id, tenantId);

    const isArEnabled = updateProductDto.arEnabled !== undefined ? updateProductDto.arEnabled : product.arEnabled;
    const currentArType = updateProductDto.arType !== undefined ? updateProductDto.arType : product.arType;
    if (isArEnabled && !currentArType) {
      throw new BadRequestException('El tipo de prenda AR (arType) es obligatorio si AR está habilitado');
    }

    if (updateProductDto.categoryId) {
      const category = await this.categoryRepository.findOneBy({ id: updateProductDto.categoryId, tenantId: product.tenantId });
      if (!category) throw new NotFoundException(`Categoría #${updateProductDto.categoryId} no encontrada`);
    }
    if (updateProductDto.collectionId) await this.findOneCollection(updateProductDto.collectionId);
    // El tenant del producto nunca cambia, aunque venga en el body
    Object.assign(product, updateProductDto, { tenantId: product.tenantId });
    // Las relaciones cargadas no deben sobrescribir los ids nuevos al guardar
    if (updateProductDto.categoryId) delete (product as any).category;
    if (updateProductDto.collectionId !== undefined) delete (product as any).collection;
    return this.productRepository.save(product);
  }

  async uploadProductImage(id: number, file: any) {
    const product = await this.findOneProduct(id);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadImage(file);

    // Si ya tena una imagen, borrar la anterior en Cloudinary
    if (product.imagePublicId) {
      await this.cloudinaryService.deleteImage(product.imagePublicId);
    }

    product.imageUrl = uploadResult.secure_url;
    product.imagePublicId = uploadResult.public_id;

    return this.productRepository.save(product);
  }

  async uploadProductArImage(id: number, file: any) {
    const product = await this.findOneProduct(id);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadImage(file);

    // Si ya tenia una imagen AR, borrar la anterior en Cloudinary
    if (product.arImagePublicId) {
      await this.cloudinaryService.deleteImage(product.arImagePublicId);
    }

    product.arImageUrl = uploadResult.secure_url;
    product.arImagePublicId = uploadResult.public_id;

    return this.productRepository.save(product);
  }

  async uploadProductArPartImage(id: number, file: any, part: 'torso' | 'leftSleeve' | 'rightSleeve') {
    const product = await this.findOneProduct(id);
    const uploadResult = await this.cloudinaryService.uploadImage(file);

    if (part === 'torso') {
      if (product.arTorsoPublicId) await this.cloudinaryService.deleteImage(product.arTorsoPublicId);
      product.arTorsoUrl = uploadResult.secure_url;
      product.arTorsoPublicId = uploadResult.public_id;
    } else if (part === 'leftSleeve') {
      if (product.arLeftSleevePublicId) await this.cloudinaryService.deleteImage(product.arLeftSleevePublicId);
      product.arLeftSleeveUrl = uploadResult.secure_url;
      product.arLeftSleevePublicId = uploadResult.public_id;
    } else if (part === 'rightSleeve') {
      if (product.arRightSleevePublicId) await this.cloudinaryService.deleteImage(product.arRightSleevePublicId);
      product.arRightSleeveUrl = uploadResult.secure_url;
      product.arRightSleevePublicId = uploadResult.public_id;
    }

    return this.productRepository.save(product);
  }

  async removeProductArPart(id: number, part: string) {
    const product = await this.findOneProduct(id);
    
    if (part === 'torso' && product.arTorsoPublicId) {
      await this.cloudinaryService.deleteImage(product.arTorsoPublicId);
      product.arTorsoUrl = null as any;
      product.arTorsoPublicId = null as any;
    } else if (part === 'leftSleeve' && product.arLeftSleevePublicId) {
      await this.cloudinaryService.deleteImage(product.arLeftSleevePublicId);
      product.arLeftSleeveUrl = null as any;
      product.arLeftSleevePublicId = null as any;
    } else if (part === 'rightSleeve' && product.arRightSleevePublicId) {
      await this.cloudinaryService.deleteImage(product.arRightSleevePublicId);
      product.arRightSleeveUrl = null as any;
      product.arRightSleevePublicId = null as any;
    } else if (part === 'rigid' && product.arImagePublicId) {
      await this.cloudinaryService.deleteImage(product.arImagePublicId);
      product.arImageUrl = null as any;
      product.arImagePublicId = null as any;
    }

    await this.productRepository.save(product);
    return { success: true };
  }

  async removeProduct(id: number) {
    const product = await this.findOneProduct(id);
    product.active = false;
    await this.productRepository.save(product);
    return { success: true, message: `Producto ${id} desactivado` };
  }

  // --- VARIANTS ---
  async createVariant(createVariantDto: CreateVariantDto) {
    const tenantId = this.tenant();
    const existing = await this.variantRepository.findOneBy({ tenantId, sku: createVariantDto.sku });
    if (existing) throw new ConflictException(`El SKU ${createVariantDto.sku} ya está en uso`);

    const product = await this.productRepository.findOneBy({ id: createVariantDto.productId, tenantId });
    if (!product) throw new NotFoundException(`Producto #${createVariantDto.productId} no encontrado`);
    await this.findOneSize(createVariantDto.sizeId);
    await this.findOneColor(createVariantDto.colorId);

    const variant = this.variantRepository.create({ ...createVariantDto, tenantId });
    return this.variantRepository.save(variant);
  }
  async findAllVariants() {
    return this.variantRepository.find({
      where: { tenantId: this.tenant() },
      relations: { product: true, size: true, color: true },
      order: { id: 'ASC' }
    });
  }
  async findOneVariant(id: number) {
    const variant = await this.variantRepository.findOne({
      where: { id, tenantId: this.tenant() },
      relations: { product: true, size: true, color: true }
    });
    if (!variant) throw new NotFoundException(`Variante #${id} no encontrada`);
    return variant;
  }
  async updateVariant(id: number, updateVariantDto: UpdateVariantDto) {
    const variant = await this.findOneVariant(id);
    const tenantId = variant.tenantId;

    if (updateVariantDto.sku && updateVariantDto.sku !== variant.sku) {
      const existing = await this.variantRepository.findOneBy({ tenantId, sku: updateVariantDto.sku });
      if (existing) throw new ConflictException(`El SKU ${updateVariantDto.sku} ya está en uso`);
    }
    if (updateVariantDto.productId) {
      const product = await this.productRepository.findOneBy({ id: updateVariantDto.productId, tenantId });
      if (!product) throw new NotFoundException(`Producto #${updateVariantDto.productId} no encontrado`);
    }
    if (updateVariantDto.sizeId) await this.findOneSize(updateVariantDto.sizeId);
    if (updateVariantDto.colorId) await this.findOneColor(updateVariantDto.colorId);

    Object.assign(variant, updateVariantDto, { tenantId });
    // Evita que las relaciones cargadas sobrescriban los nuevos ids
    delete (variant as any).product; delete (variant as any).size; delete (variant as any).color;
    return this.variantRepository.save(variant);
  }
  async removeVariant(id: number) {
    const variant = await this.findOneVariant(id);
    variant.active = false;
    await this.variantRepository.save(variant);
    return { success: true, message: `Variante ${id} desactivada` };
  }

  // --- SEASONS ---
  async createSeason(createSeasonDto: CreateSeasonDto) {
    if (new Date(createSeasonDto.startDate) >= new Date(createSeasonDto.endDate)) {
      throw new BadRequestException('startDate debe ser menor que endDate');
    }
    const season = this.seasonRepository.create({ ...createSeasonDto, tenantId: this.tenant() });
    return this.seasonRepository.save(season);
  }
  async findAllSeasons() {
    return this.seasonRepository.find({ where: { tenantId: this.tenant() }, order: { id: 'ASC' } });
  }
  async findOneSeason(id: number) {
    const season = await this.seasonRepository.findOneBy({ id, tenantId: this.tenant() });
    if (!season) throw new NotFoundException(`Temporada #${id} no encontrada`);
    return season;
  }
  async updateSeason(id: number, updateSeasonDto: UpdateSeasonDto) {
    const season = await this.findOneSeason(id);
    Object.assign(season, updateSeasonDto, { tenantId: season.tenantId });

    if (new Date(season.startDate) >= new Date(season.endDate)) {
      throw new BadRequestException('startDate debe ser menor que endDate');
    }

    return this.seasonRepository.save(season);
  }
  async removeSeason(id: number) {
    const season = await this.findOneSeason(id);
    season.active = false;
    await this.seasonRepository.save(season);
    return { success: true, message: `Temporada ${id} desactivada` };
  }

  // --- COLLECTIONS ---
  async createCollection(createCollectionDto: CreateCollectionDto) {
    const season = await this.findOneSeason(createCollectionDto.seasonId);
    const collection = this.collectionRepository.create({ ...createCollectionDto, tenantId: season.tenantId });
    return this.collectionRepository.save(collection);
  }
  async findAllCollections() {
    return this.collectionRepository.find({ where: { tenantId: this.tenant() }, relations: { season: true }, order: { id: 'ASC' } });
  }
  async findOneCollection(id: number) {
    const collection = await this.collectionRepository.findOne({ where: { id, tenantId: this.tenant() }, relations: { season: true } });
    if (!collection) throw new NotFoundException(`Colección #${id} no encontrada`);
    return collection;
  }
  async updateCollection(id: number, updateCollectionDto: UpdateCollectionDto) {
    const collection = await this.findOneCollection(id);
    if (updateCollectionDto.seasonId) {
      collection.season = await this.findOneSeason(updateCollectionDto.seasonId);
    }
    Object.assign(collection, updateCollectionDto, { tenantId: collection.tenantId });
    return this.collectionRepository.save(collection);
  }
  async removeCollection(id: number) {
    const collection = await this.findOneCollection(id);
    collection.active = false;
    await this.collectionRepository.save(collection);
    return { success: true, message: `Colección ${id} desactivada` };
  }

  // --- PROMOTIONS ---
  /** Solo se pueden asociar productos de la misma empresa; ids ajenos → 404. */
  private async loadOwnProducts(productIds: number[], tenantId: number) {
    const unique = [...new Set(productIds.map(Number))];
    const products = await this.productRepository.find({ where: { id: In(unique), tenantId } });
    if (products.length !== unique.length) {
      const found = new Set(products.map((p) => p.id));
      throw new NotFoundException(`Productos no encontrados: ${unique.filter((id) => !found.has(id)).join(', ')}`);
    }
    return products;
  }

  async createPromotion(createPromotionDto: CreatePromotionDto) {
    if (new Date(createPromotionDto.startDate) >= new Date(createPromotionDto.endDate)) {
      throw new BadRequestException('startDate debe ser menor que endDate');
    }
    if (createPromotionDto.type === 'PERCENTAGE' && (createPromotionDto.value <= 0 || createPromotionDto.value > 100)) {
      throw new BadRequestException('Para PERCENTAGE, el valor debe estar entre 1 y 100');
    }
    if (createPromotionDto.type === 'FIXED' && createPromotionDto.value <= 0) {
      throw new BadRequestException('Para FIXED, el valor debe ser mayor a 0');
    }

    const tenantId = this.tenant();
    const { productIds, ...promoData } = createPromotionDto;
    const promotion = this.promotionRepository.create({ ...promoData, tenantId });
    if (productIds && productIds.length > 0) {
      promotion.products = await this.loadOwnProducts(productIds, tenantId);
    }
    return this.promotionRepository.save(promotion);
  }
  async findAllPromotions() {
    return this.promotionRepository.find({ where: { tenantId: this.tenant() }, relations: { products: true }, order: { id: 'ASC' } });
  }
  async findOnePromotion(id: number) {
    const promotion = await this.promotionRepository.findOne({ where: { id, tenantId: this.tenant() }, relations: { products: true } });
    if (!promotion) throw new NotFoundException(`Promoción #${id} no encontrada`);
    return promotion;
  }
  async updatePromotion(id: number, updatePromotionDto: UpdatePromotionDto) {
    const promotion = await this.findOnePromotion(id);
    const { productIds, ...promoData } = updatePromotionDto;

    Object.assign(promotion, promoData, { tenantId: promotion.tenantId });

    if (new Date(promotion.startDate) >= new Date(promotion.endDate)) {
      throw new BadRequestException('startDate debe ser menor que endDate');
    }
    if (promotion.type === 'PERCENTAGE' && (promotion.value <= 0 || promotion.value > 100)) {
      throw new BadRequestException('Para PERCENTAGE, el valor debe estar entre 1 y 100');
    }
    if (promotion.type === 'FIXED' && promotion.value <= 0) {
      throw new BadRequestException('Para FIXED, el valor debe ser mayor a 0');
    }

    if (productIds) {
      promotion.products = await this.loadOwnProducts(productIds, promotion.tenantId);
    }
    return this.promotionRepository.save(promotion);
  }
  async removePromotion(id: number) {
    const promotion = await this.findOnePromotion(id);
    promotion.active = false;
    await this.promotionRepository.save(promotion);
    return { success: true, message: `Promoción ${id} desactivada` };
  }
}
