'use client';
import { useEffect, useState } from 'react';
import { 
  Plus, Search, Edit2, Trash2, UploadCloud, X, Image as ImageIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/browser';
import { getCurrentAdmin } from '@/lib/supabase/admin';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

interface Product {
  id: string;
  name: string;
  price: number;
  discount: number;
  category: string;
  stock: number;
  sizes: string[];
  colors: string[];
  image: string;
  description: string;
  variants: { size: string; stock: number }[];
}

type UploadedImage = {
  path: string;
  url: string;
  sortOrder: number;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sizeStock, setSizeStock] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '', price: '', discount: '', category: '', description: ''
  });

  const [supabase] = useState(() => createClient());

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_images(*), product_variants(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setProducts((data || []).map((product: any) => ({
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      discount: 0,
      category: product.category || '',
      stock: (product.product_variants || []).reduce((sum: number, variant: any) => sum + Number(variant.stock || 0), 0),
      sizes: (product.product_variants || []).map((variant: any) => variant.size),
      colors: ['Black'],
      image: product.product_images?.[0]?.url || '',
      description: product.description || '',
      variants: product.product_variants || [],
    })));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const refresh = () => loadProducts();

    const channel = supabase
      .channel('admin:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_images' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, refresh)
      .subscribe();

    const intervalId = window.setInterval(refresh, 30000);

    return () => {
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const validateForm = () => {
    const errors: string[] = [];
    const price = Number(formData.price);

    if (!formData.name.trim()) errors.push('Product name is required.');
    if (!formData.category.trim()) errors.push('Category is required.');
    if (!formData.description.trim()) errors.push('Description is required.');
    if (!Number.isFinite(price) || price <= 0) errors.push('Price must be greater than 0.');
    if (selectedSizes.length === 0) errors.push('Choose at least one available size.');
    if (!editingProd && selectedFiles.length === 0) errors.push('At least one product image is required.');

    selectedSizes.forEach((size) => {
      const stock = Number(sizeStock[size]);
      if (!Number.isInteger(stock) || stock <= 0) {
        errors.push(`${size} stock must be a whole number greater than 0.`);
      }
    });

    selectedFiles.forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        errors.push(`${file.name} must be JPEG, PNG, WEBP, or GIF.`);
      }
      if (file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name} must be 5MB or less.`);
      }
    });

    return errors;
  };

  const formErrors = validateForm();
  const canSave = formErrors.length === 0 && !isSaving;

  const handleOpenModal = (prod?: Product) => {
    setStatusMessage('');
    if (prod) {
      setEditingProd(prod);
      const nextSizes = prod.variants.filter((variant) => variant.stock > 0).map((variant) => variant.size);
      const nextStock = prod.variants.reduce((acc, variant) => ({
        ...acc,
        [variant.size]: String(variant.stock || 0),
      }), {} as Record<string, string>);
      setFormData({
        name: prod.name, price: prod.price.toString(), discount: prod.discount.toString(),
        category: prod.category, description: prod.description
      });
      setSelectedSizes(nextSizes);
      setSizeStock(nextStock);
    } else {
      setEditingProd(null);
      setFormData({ name: '', price: '', discount: '', category: '', description: '' });
      setSelectedSizes([]);
      setSizeStock({});
    }
    setSelectedFiles([]);
    setIsModalOpen(true);
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((current) => {
      if (current.includes(size)) {
        return current.filter((item) => item !== size);
      }
      setSizeStock((stock) => ({ ...stock, [size]: stock[size] || '1' }));
      return [...current, size];
    });
  };

  const saveVariants = async (productId: string) => {
    const variants = DEFAULT_SIZES.map((size) => ({
      product_id: productId,
      size,
      stock: selectedSizes.includes(size) ? Number(sizeStock[size]) : 0,
    }));

    const { error: variantsError } = await supabase
      .from('product_variants')
      .upsert(variants, { onConflict: 'product_id,size' });
    if (variantsError) throw variantsError;
  };

  const handleSave = async () => {
    setStatusMessage('');

    const errors = validateForm();
    if (errors.length) {
      setStatusMessage(errors[0]);
      return;
    }

    setIsSaving(true);

    const { isAdmin } = await getCurrentAdmin();
    if (!isAdmin) {
      setStatusMessage('Your Supabase user is not an active admin. Set profiles.role = admin for this account, then sign in again.');
      setIsSaving(false);
      return;
    }

    const payload = {
      name: formData.name,
      slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description: formData.description,
      price: parseFloat(formData.price) || 0,
      category: formData.category,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let uploadedImages: UploadedImage[] = [];
    let createdProductId = '';
    let currentStep = 'checking admin access';

    try {
      if (editingProd) {
        currentStep = 'updating product row';
        const { error: updateError } = await supabase.from('products').update(payload).eq('id', editingProd.id);
        if (updateError) throw updateError;

        currentStep = 'saving size stock rows';
        await saveVariants(editingProd.id);

        if (selectedFiles.length) {
          currentStep = 'uploading product images to Storage';
          uploadedImages = await uploadProductImages(editingProd.id);
          currentStep = 'saving product image rows';
          await insertProductImages(editingProd.id, formData.name, uploadedImages);
        }
      } else {
        const productId = crypto.randomUUID();
        currentStep = 'uploading product images to Storage';
        uploadedImages = await uploadProductImages(productId);

        currentStep = 'creating product row';
        const { data: created, error: createError } = await supabase.from('products').insert({
          id: productId,
          ...payload,
        }).select('id,name').single();
        if (createError) throw createError;

        if (created) {
          createdProductId = created.id;
          currentStep = 'saving product image rows';
          await insertProductImages(created.id, created.name, uploadedImages);
          currentStep = 'saving size stock rows';
          await saveVariants(created.id);
        }
      }
    } catch (error: any) {
      if (createdProductId) {
        await supabase.from('products').delete().eq('id', createdProductId);
      }
      if (uploadedImages.length) {
        await supabase.storage.from('product-images').remove(uploadedImages.map((image) => image.path));
      }
      setStatusMessage(`${currentStep}: ${error.message || 'Product could not be saved.'}`);
      setIsSaving(false);
      return;
    }

    setIsModalOpen(false);
    setIsSaving(false);
    setSelectedFiles([]);
    setStatusMessage('Product saved.');
    await loadProducts();
  };

  const uploadProductImages = async (productId: string) => {
    const uploaded: UploadedImage[] = [];

    for (const [index, file] of selectedFiles.entries()) {
      const extension = file.name.split('.').pop() || 'jpg';
      const path = `${productId}/${Date.now()}-${index}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('product-images').getPublicUrl(path);
      uploaded.push({
        path,
        url: data.publicUrl,
        sortOrder: index,
      });
    }

    return uploaded;
  };

  const insertProductImages = async (productId: string, productName: string, images: UploadedImage[]) => {
    if (!images.length) return;

    const { error } = await supabase.from('product_images').insert(images.map((image) => ({
      product_id: productId,
      url: image.url,
      alt: productName,
      sort_order: image.sortOrder,
    })));

    if (error) throw error;
  };

  const performDelete = async (id: string) => {
    setStatusMessage('');
    setIsDeletingId(id);

    const { data: images, error: imageFetchError } = await supabase
      .from('product_images')
      .select('url')
      .eq('product_id', id);

    if (imageFetchError) {
      setIsDeletingId('');
      setStatusMessage(`loading product images: ${imageFetchError.message}`);
      return;
    }

    const storagePaths = (images || [])
      .map((image: any) => getStoragePathFromPublicUrl(image.url))
      .filter(Boolean) as string[];

    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from('product-images')
        .remove(storagePaths);

      if (storageError) {
        setIsDeletingId('');
        setStatusMessage(`deleting product images from Storage: ${storageError.message}`);
        return;
      }
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    setIsDeletingId('');
    if (error) {
      setStatusMessage(`deleting product row: ${error.message}`);
      return;
    }

    setProducts((current) => current.filter((product) => product.id !== id));
    setStatusMessage('Product permanently deleted.');
    await loadProducts();
  };

  const handleDelete = async (id: string) => {
    setDeleteTargetId(id);
  };

  const getStoragePathFromPublicUrl = (url: string) => {
    const marker = '/product-images/';
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return '';
    return decodeURIComponent(url.slice(markerIndex + marker.length));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-syncopate font-bold tracking-widest">PRODUCTS</h1>
          <p className="text-white/50 mt-2">Manage your inventory and catalog.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-white text-black font-syncopate text-xs font-bold tracking-widest px-6 py-3 rounded-md hover:bg-white/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> ADD PRODUCT
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          {statusMessage}
        </div>
      )}

      {/* TOOLBAR */}
      <div className="flex bg-[#0a0a0a] border border-white/10 p-4 rounded-xl">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input 
            type="text" 
            placeholder="Search products..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 border-b border-white/10 text-xs font-syncopate tracking-widest text-white/50">
              <tr>
                <th className="px-6 py-4 font-normal">PRODUCT</th>
                <th className="px-6 py-4 font-normal">CATEGORY</th>
                <th className="px-6 py-4 font-normal">PRICE</th>
                <th className="px-6 py-4 font-normal">STOCK</th>
                <th className="px-6 py-4 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredProducts.map(prod => (
                <tr key={prod.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-black border border-white/10 rounded-md overflow-hidden shrink-0 flex items-center justify-center">
                      {prod.image ? (
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-white/20" />
                      )}
                    </div>
                    <span className="font-bold">{prod.name}</span>
                  </td>
                  <td className="px-6 py-4 text-white/70">{prod.category}</td>
                  <td className="px-6 py-4 font-bold">LE {prod.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${prod.stock > 0 ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                      {prod.stock > 0 ? `${prod.stock} IN STOCK` : 'OUT OF STOCK'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(prod)} className="p-2 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(prod.id)} disabled={isDeletingId === prod.id} className="p-2 hover:bg-red-500/10 rounded-md transition-colors text-white/50 hover:text-red-500 disabled:opacity-40" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-[2000] backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-xl p-6 z-[2001] max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-white/10">
                <h2 className="text-xl font-bold font-syncopate tracking-widest">{editingProd ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {statusMessage && (
                <div className="mb-6 rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  {statusMessage}
                </div>
              )}

              {formErrors.length > 0 && (
                <div className="mb-6 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                  {formErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Image Upload Area */}
                <div className="space-y-4">
                  <label className="block text-xs font-syncopate text-white/70 tracking-widest">PRODUCT IMAGES</label>
                  <label htmlFor="productImages" className="border-2 border-dashed border-white/20 rounded-xl h-64 flex flex-col items-center justify-center hover:bg-white/5 transition-colors cursor-pointer group">
                    <input
                      id="productImages"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                    />
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-6 h-6 text-white/50" />
                    </div>
                    <p className="text-sm font-bold">Click to upload images</p>
                    <p className="text-xs text-white/50 mt-1">{selectedFiles.length ? `${selectedFiles.length} image(s) selected` : 'JPEG, PNG up to 5MB'}</p>
                  </label>
                  <div className="flex gap-2">
                    {(selectedFiles.length ? selectedFiles : [null, null, null]).slice(0, 3).map((file, i) => (
                      <div key={i} className="w-16 h-16 border border-white/10 rounded-md bg-white/5 flex items-center justify-center overflow-hidden">
                        {file ? (
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-white/20" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Area */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">PRODUCT NAME</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors" placeholder="e.g. EXTRA HOODIE" />
                  </div>
                  <div>
                    <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">DESCRIPTION</label>
                    <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors" placeholder="Product details..."></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">PRICE (LE)</label>
                      <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">DISCOUNT (%)</label>
                      <input type="number" value={formData.discount} onChange={e => setFormData({...formData, discount: e.target.value})} className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">CATEGORY</label>
                    <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">SIZES</label>
                      <div className="flex gap-2 flex-wrap">
                        {DEFAULT_SIZES.map(s => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => toggleSize(s)}
                            className={`w-10 h-10 rounded-md border font-bold text-xs transition-colors ${selectedSizes.includes(s) ? 'bg-white text-black border-white' : 'border-white/10 bg-white/5 hover:bg-white hover:text-black'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedSizes.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedSizes.map((size) => (
                        <div key={size}>
                          <label className="block text-xs font-syncopate text-white/70 tracking-widest mb-2">{size} STOCK</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={sizeStock[size] || ''}
                            onChange={e => setSizeStock({ ...sizeStock, [size]: e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-white/40 transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 border-t border-white/10 pt-6 mt-8">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-md font-syncopate text-xs tracking-widest font-bold text-white/70 hover:text-white transition-colors">
                  CANCEL
                </button>
                <button onClick={handleSave} disabled={!canSave} className="bg-white text-black font-syncopate text-xs font-bold tracking-widest px-8 py-2 rounded-md hover:bg-white/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {isSaving ? 'SAVING...' : 'SAVE PRODUCT'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteTargetId}
        title="DELETE PRODUCT"
        message="Are you sure you want to permanently delete this product? This cannot be undone."
        confirmText="DELETE"
        danger
        busy={!!isDeletingId}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={async () => {
          const id = deleteTargetId;
          setDeleteTargetId(null);
          if (id) await performDelete(id);
        }}
      />
    </div>
  );
}
