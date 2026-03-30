import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { 
  useGetListing, 
  useCreateListing, 
  useUpdateListing,
  useGetCategories,
  getGetListingQueryKey,
  getGetListingsQueryKey,
  getGetCategoriesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X } from "lucide-react";
import { AddonManager } from "@/components/addon-manager";

export default function AdminListingsForm() {
  const [match, params] = useRoute("/admin/listings/:id/edit");
  const isEditing = match;
  const id = params?.id ? parseInt(params.id) : 0;
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() }
  });

  const { data: listing, isLoading: isLoadingListing } = useGetListing(id, {
    query: { enabled: isEditing && !!id, queryKey: getGetListingQueryKey(id) }
  });

  const createListing = useCreateListing();
  const updateListing = useUpdateListing();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: null as number | null,
    status: 'draft' as any,
    pricePerDay: 0,
    pricePerWeek: 0,
    pricePerHour: 0,
    depositAmount: 0,
    quantity: 1,
    imageUrls: [] as string[],
    location: '',
    weight: '',
    dimensions: '',
    brand: '',
    model: '',
    condition: 'good' as any,
    includedItems: [] as string[],
    requirements: '',
    ageRestriction: null as number | null
  });

  const [includedItemInput, setIncludedItemInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');

  useEffect(() => {
    if (isEditing && listing) {
      setFormData({
        title: listing.title,
        description: listing.description,
        categoryId: listing.categoryId || null,
        status: listing.status,
        pricePerDay: listing.pricePerDay,
        pricePerWeek: listing.pricePerWeek || 0,
        pricePerHour: listing.pricePerHour || 0,
        depositAmount: listing.depositAmount || 0,
        quantity: listing.quantity,
        imageUrls: listing.imageUrls || [],
        location: listing.location || '',
        weight: listing.weight || '',
        dimensions: listing.dimensions || '',
        brand: listing.brand || '',
        model: listing.model || '',
        condition: listing.condition || 'good',
        includedItems: listing.includedItems || [],
        requirements: listing.requirements || '',
        ageRestriction: listing.ageRestriction || null
      });
    }
  }, [isEditing, listing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? Number(value) : 0) : value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: name === 'categoryId' && value ? Number(value) : value
    }));
  };

  const addIncludedItem = () => {
    if (includedItemInput.trim() && !formData.includedItems.includes(includedItemInput.trim())) {
      setFormData(prev => ({ ...prev, includedItems: [...prev.includedItems, includedItemInput.trim()] }));
      setIncludedItemInput('');
    }
  };

  const removeIncludedItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      includedItems: prev.includedItems.filter((_, i) => i !== index)
    }));
  };

  const addImageUrl = () => {
    if (imageUrlInput.trim() && !formData.imageUrls.includes(imageUrlInput.trim())) {
      setFormData(prev => ({ ...prev, imageUrls: [...prev.imageUrls, imageUrlInput.trim()] }));
      setImageUrlInput('');
    }
  };

  const removeImageUrl = (index: number) => {
    setFormData(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up empty optional number fields if needed
    const payload = { ...formData };
    
    if (isEditing) {
      updateListing.mutate(
        { id, data: payload },
        {
          onSuccess: (data) => {
            queryClient.setQueryData(getGetListingQueryKey(id), data);
            queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
            toast({ title: "Listing updated successfully" });
            setLocation("/admin/listings");
          },
          onError: () => {
            toast({ title: "Failed to update listing", variant: "destructive" });
          }
        }
      );
    } else {
      createListing.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
            toast({ title: "Listing created successfully" });
            setLocation("/admin/listings");
          },
          onError: () => {
            toast({ title: "Failed to create listing", variant: "destructive" });
          }
        }
      );
    }
  };

  if (isEditing && isLoadingListing) {
    return <div className="p-8">Loading listing details...</div>;
  }

  const isPending = createListing.isPending || updateListing.isPending;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isEditing ? 'Edit Listing' : 'Create Listing'}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isEditing ? 'Update listing information and pricing.' : 'Add a new listing to your rental inventory.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Title, category, and description for this listing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                  <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.categoryId?.toString() || ""} onValueChange={(v) => handleSelectChange('categoryId', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => handleSelectChange('status', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={5} required />
                </div>
              </CardContent>
            </Card>

            {/* Pricing & Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing & Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pricePerDay">Price / Day ($) <span className="text-destructive">*</span></Label>
                    <Input id="pricePerDay" name="pricePerDay" type="number" min="0" step="0.01" value={formData.pricePerDay} onChange={handleChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricePerWeek">Price / Week ($)</Label>
                    <Input id="pricePerWeek" name="pricePerWeek" type="number" min="0" step="0.01" value={formData.pricePerWeek || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depositAmount">Deposit ($)</Label>
                    <Input id="depositAmount" name="depositAmount" type="number" min="0" step="0.01" value={formData.depositAmount || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Total Quantity <span className="text-destructive">*</span></Label>
                    <Input id="quantity" name="quantity" type="number" min="1" value={formData.quantity} onChange={handleChange} required />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Details & Specs */}
            <Card>
              <CardHeader>
                <CardTitle>Specifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input id="brand" name="brand" value={formData.brand} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" value={formData.model} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input id="weight" name="weight" placeholder="e.g. 5 lbs" value={formData.weight} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dimensions">Dimensions</Label>
                    <Input id="dimensions" name="dimensions" placeholder="L x W x H" value={formData.dimensions} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select value={formData.condition} onValueChange={(v) => handleSelectChange('condition', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent / Like New</SelectItem>
                        <SelectItem value="good">Good / Used</SelectItem>
                        <SelectItem value="fair">Fair / Heavy Wear</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <Label>Included Items</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={includedItemInput} 
                      onChange={(e) => setIncludedItemInput(e.target.value)}
                      placeholder="e.g. Carry bag, 2 paddles"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIncludedItem())}
                    />
                    <Button type="button" variant="secondary" onClick={addIncludedItem}>Add</Button>
                  </div>
                  {formData.includedItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {formData.includedItems.map((item, idx) => (
                        <div key={idx} className="bg-muted px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                          {item}
                          <button type="button" onClick={() => removeIncludedItem(idx)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-8">
            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
                <CardDescription>Add image URLs for this listing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input 
                      value={imageUrlInput} 
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://..."
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImageUrl())}
                    />
                    <Button type="button" variant="secondary" onClick={addImageUrl}>
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {formData.imageUrls.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {formData.imageUrls.map((url, idx) => (
                      <div key={idx} className="relative group rounded-md overflow-hidden border">
                        <img src={url} alt={`Preview ${idx}`} className="w-full aspect-[4/3] object-cover" />
                        <button 
                          type="button" 
                          onClick={() => removeImageUrl(idx)}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Additional Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ageRestriction">Age Restriction (Optional)</Label>
                  <Input id="ageRestriction" name="ageRestriction" type="number" min="0" placeholder="e.g. 18" value={formData.ageRestriction || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="requirements">Special Requirements</Label>
                  <Textarea id="requirements" name="requirements" placeholder="e.g. Must have a valid driver's license" value={formData.requirements} onChange={handleChange} rows={3} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => setLocation("/admin/listings")}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Listing')}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Add-ons manager — only available after the listing is created */}
      {isEditing && id ? (
        <div className="max-w-2xl mt-8">
          <AddonManager listingId={id} />
        </div>
      ) : (
        <div className="max-w-2xl mt-6 p-4 border border-dashed rounded-xl text-sm text-muted-foreground text-center">
          Save the listing first, then you can add optional or required add-ons (insurance, GPS, helmets, etc.)
        </div>
      )}
    </div>
  );
}
