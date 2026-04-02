import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRoute, useLocation, Link } from "wouter";
import { 
  useCreateDocFeature, 
  useUpdateDocFeature,
  useGetDocProjects,
  useGetDocCategories,
  CreateDocFeatureStatus,
  getGetDocFeaturesQueryKey
} from "@workspace/api-client-react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

const featureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  status: z.nativeEnum(CreateDocFeatureStatus),
  projectId: z.number().nullable().optional(),
  categoryId: z.number().nullable().optional(),
});

type FeatureFormValues = z.infer<typeof featureSchema>;

export default function FeatureEditor() {
  const [, setLocation] = useLocation();
  const [matchEdit, editParams] = useRoute("/admin/features/:id/edit");
  const isEditing = matchEdit && editParams?.id;
  const featureId = isEditing ? parseInt(editParams.id) : null;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createMutation = useCreateDocFeature();
  const updateMutation = useUpdateDocFeature();
  
  const { data: projects } = useGetDocProjects();
  const { data: categories } = useGetDocCategories();

  const form = useForm<FeatureFormValues>({
    resolver: zodResolver(featureSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      status: "stable",
      projectId: null,
      categoryId: null,
    }
  });

  const watchName = form.watch("name");
  useEffect(() => {
    if (!isEditing && !form.getFieldState("slug").isDirty && watchName) {
      const generated = watchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      form.setValue("slug", generated, { shouldValidate: true });
    }
  }, [watchName, isEditing, form]);

  const onSubmit = async (data: FeatureFormValues) => {
    try {
      if (isEditing && featureId) {
        await updateMutation.mutateAsync({ id: featureId, data });
        toast({ title: "Feature updated" });
      } else {
        await createMutation.mutateAsync({ data });
        toast({ title: "Feature created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetDocFeaturesQueryKey() });
      setLocation("/admin/features");
    } catch (e) {
      toast({ title: "Error saving feature", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/features">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Edit Feature" : "New Feature"}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl bg-card border rounded-xl shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feature Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Booking Flow" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="booking-flow" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="stable">Stable</SelectItem>
                      <SelectItem value="beta">Beta</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid sm:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Project</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                      defaultValue={field.value?.toString() || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects?.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                      defaultValue={field.value?.toString() || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories?.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief overview of this feature..." 
                      className="resize-none h-24"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link href="/admin/features">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                Save Feature
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}
