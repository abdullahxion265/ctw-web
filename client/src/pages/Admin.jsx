import { useState, useEffect } from 'react';
import {
  LayoutDashboard, PlusCircle, Package, Trash2,
  Shirt, LogOut, ChevronRight, Pencil, Smartphone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import ProductForm from '../components/ProductForm';
import { photosOf } from '../utils/photos';
import ApkManager from '../components/ApkManager';
import { API_BASE, CATEGORIES } from '../config';
import { formatMoney, getPrice } from '../utils/currency';



export default function Admin() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('add');
  const [toast, setToast] = useState(null);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState(null);   // the product being edited, or null

  const showToast = (message, type = 'success') => setToast({ message, type });

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchProducts = async (cat = 'all') => {
    setProductsLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (cat !== 'all') params.set('category', cat);
      const res = await fetch(`${API_BASE}/products?${params}`);
      const data = await res.json();
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // Brands already used, offered as one-tap suggestions next to the default
  const loadBrands = async () => {
    try {
      const res = await fetch(`${API_BASE}/products/brands`);
      const data = await res.json();
      setBrands(Array.isArray(data) ? data.filter((b) => typeof b === 'string' && b) : []);
    } catch { setBrands([]); }
  };

  useEffect(() => { fetchProducts(); loadBrands(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this product?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE', headers: authHeaders });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Product removed.');
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch {
      showToast('Could not delete product.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const catFilteredProducts = categoryFilter === 'all' ? products : products.filter(p => p.category === categoryFilter);


  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-primary-dark)' }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Admin header ─────────────────────────────────────── */}
      <header style={{ paddingTop: '80px', borderBottom: '1px solid rgba(170,124,17,0.15)', background: 'var(--color-secondary-dark)' }}>
        <div className="container-max" style={{ padding: '2rem 1.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <LayoutDashboard size={18} style={{ color: 'var(--color-accent-gold)' }} />
              <span className="font-mono" style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--color-muted-gold)', textTransform: 'uppercase' }}>
                Admin Panel
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-muted-gray)' }}>
                <span style={{ color: 'var(--color-accent-gold)' }}>{user?.name}</span>
              </span>
              <button onClick={handleLogout} className="btn-outline-gold" style={{ fontSize: '0.76rem', padding: '0.45rem 0.9rem' }}>
                <LogOut size={13} /> <span>Logout</span>
              </button>
            </div>
          </div>

          <h1 className="font-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 700, color: 'var(--color-neutral-light)', marginBottom: '1.75rem' }}>
            Inventory Dashboard
          </h1>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none' }}>
            {[
              { id: 'add', label: 'Add Product', icon: PlusCircle },
              { id: 'inventory', label: `Inventory (${products.length})`, icon: Package },
              { id: 'apk', label: 'App (APK)', icon: Smartphone },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setEditing(null); setActiveTab(id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.7rem 1.1rem', flexShrink: 0,
                  fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-body)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: activeTab === id ? '2px solid var(--color-accent-gold)' : '2px solid transparent',
                  color: activeTab === id ? 'var(--color-accent-gold)' : 'var(--color-muted-gray)',
                  marginBottom: '-1px',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="section-pad">
        <div className="container-max">

          {/* ── EDIT PRODUCT ────────────────────────────────── */}
          {editing && (
            <ProductForm
              key={editing.id}
              product={editing}
              token={token}
              brands={brands}
              onSaved={(saved) => {
                showToast(`${saved.name} updated.`);
                fetchProducts(categoryFilter);
                loadBrands();
                setEditing(null);
                setActiveTab('inventory');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onCancel={() => setEditing(null)}
            />
          )}

          {/* ── ADD PRODUCT ─────────────────────────────────── */}
          {!editing && activeTab === 'add' && (
            <ProductForm
              token={token}
              brands={brands}
              onCreated={(product) => {
                showToast(`${product.name} added to inventory.`);
                fetchProducts(categoryFilter);
                loadBrands();
              }}
              onViewInventory={() => setActiveTab('inventory')}
            />
          )}

          {/* ── ANDROID APP ─────────────────────────────────── */}
          {!editing && activeTab === 'apk' && <ApkManager token={token} showToast={showToast} />}

          {/* ── INVENTORY ────────────────────────────────────── */}
          {!editing && activeTab === 'inventory' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
                <h2 className="font-display" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--color-neutral-light)' }}>All Products</h2>
                <button className="btn-outline-gold" style={{ fontSize: '0.76rem' }} onClick={() => fetchProducts(categoryFilter)}>
                  <ChevronRight size={13} /> <span>Refresh</span>
                </button>
              </div>

              {/* Category filter */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
                {CATEGORIES.map(({ id: cat }) => (
                  <button
                    key={cat}
                    className={`filter-pill ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => { setCategoryFilter(cat); fetchProducts(cat); }}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>

              {productsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: '72px', borderRadius: '8px' }} />
                  ))}
                </div>
              ) : catFilteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-muted-gray)' }}>
                  <Package size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <p>No products in this category yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {catFilteredProducts.map(p => (
                    <div
                      key={p.id}
                      className="inv-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.9rem 1.2rem',
                        background: 'var(--color-secondary-dark)',
                        border: '1px solid rgba(170,124,17,0.1)',
                        borderRadius: '8px',
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{ position: 'relative', width: '54px', height: '54px', flexShrink: 0 }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '6px', overflow: 'hidden', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {photosOf(p)[0]
                            ? <img src={photosOf(p)[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <Shirt size={20} style={{ color: 'var(--color-muted-gold)', opacity: 0.4 }} />
                          }
                        </div>
                        {photosOf(p).length > 1 && (
                          <span className="font-mono" title={`${photosOf(p).length} photos`} style={{ position: 'absolute', right: '-6px', bottom: '-6px', background: 'var(--color-accent-gold)', color: '#0D0D0D', borderRadius: '999px', fontSize: '0.58rem', fontWeight: 700, padding: '1px 5px', border: '2px solid var(--color-secondary-dark)' }}>
                            {photosOf(p).length}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="inv-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="brand-label">{p.brand}</span>
                          <span style={{
                            padding: '0.15rem 0.55rem', borderRadius: '999px',
                            fontSize: '0.58rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase',
                            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.18)',
                            color: 'var(--color-accent-gold)',
                          }}>
                            {p.category}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-neutral-light)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3, wordBreak: 'break-word', marginTop: '0.15rem' }}>
                          {p.name}
                        </p>
                      </div>

                      <div className="inv-meta">
                      <span className="price-display inv-price" style={{ flexShrink: 0, fontSize: '0.85rem', textAlign: 'right', lineHeight: 1.35 }}>
                        {getPrice(p, 'ZAR') !== null ? formatMoney(getPrice(p, 'ZAR'), 'ZAR') : 'R: not set'}
                        <br />
                        {getPrice(p, 'MWK') !== null ? formatMoney(getPrice(p, 'MWK'), 'MWK') : 'MK: not set'}
                      </span>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => { setEditing(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        aria-label={`Edit ${p.name}`}
                        title="Edit"
                        style={{
                          flexShrink: 0, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.3)',
                          color: 'var(--color-accent-gold)', borderRadius: '6px', padding: '0.45rem 0.6rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                          fontSize: '0.78rem', fontFamily: 'var(--font-body)', transition: 'all 0.2s ease',
                        }}
                      >
                        <Pencil size={14} /><span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        style={{
                          flexShrink: 0, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
                          color: '#ef4444', borderRadius: '6px', padding: '0.45rem',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s ease', opacity: deletingId === p.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
