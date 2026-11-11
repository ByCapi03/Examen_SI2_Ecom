import { useState } from 'react';
import { ProductsSection } from './components/ProductsSection';
import { VariantsSection } from './components/VariantsSection';
import { AttributesSection } from './components/AttributesSection';
import { SeasonsSection } from './components/SeasonsSection';
import { CollectionsSection } from './components/CollectionsSection';
import { PromotionsSection } from './components/PromotionsSection';
import { DashStyles, PageHeader, PlanBadge } from '../../components/dashboard/ui';
import '../../styles/admin.css';

type Tab = 'products' | 'variants' | 'attributes' | 'seasons' | 'collections' | 'promotions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'products', label: 'Productos' },
  { key: 'variants', label: 'Variantes' },
  { key: 'attributes', label: 'Categorías · Tallas · Colores' },
  { key: 'seasons', label: 'Temporadas' },
  { key: 'collections', label: 'Colecciones' },
  { key: 'promotions', label: 'Promociones' },
];

export const ProductsAdminPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('products');

  return (
    <div className="dz-page adm-scope">
      <DashStyles />
      <PageHeader
        title="Catálogo de productos"
        subtitle="Administra los productos, variantes y atributos disponibles"
        badge={<PlanBadge />}
      />

      <div className="adm-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            className={`adm-tab${activeTab === t.key ? ' on' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'products' && <ProductsSection />}
      {activeTab === 'variants' && <VariantsSection />}
      {activeTab === 'attributes' && <AttributesSection />}
      {activeTab === 'seasons' && <SeasonsSection />}
      {activeTab === 'collections' && <CollectionsSection />}
      {activeTab === 'promotions' && <PromotionsSection />}
    </div>
  );
};
