import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRoute, useLocation, Link } from "wouter";
import { 
  useCreateDocProject, 
  useUpdateDocProject,
  CreateDocProjectStatus,
  getGetDocProjectsQueryKey
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

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  status: z.nativeEnum(CreateDocProjectStatus),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function ProjectEditor() {
  const [, setLocation] = useLocation();
  const [matchEdit, editParams] = useRoute("/admin/projects/:id/edit");
  const isEditing = matchEdit && editParams?.id;
  const projectId = isEditing ? parseInt(editParams.id) : null;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createMutation = useCreateDocProject();
  const updateMutation = useUpdateDocProject();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      status: "active",
    }
  });

  const watchName = form.watch("name");
  useEffect(() => {
    if (!isEditing && !form.getFieldState("slug").isDirty && watchName) {
      const generated = watchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      form.setValue("slug", generated, { shouldValidate: true });
    }
  }, [watchName, isEditing, form]);

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      if (isEditing && projectId) {
        await updateMutation.mutateAsync({ id: projectId, data });
        toast({ title: "Project updated" });
      } else {
        await createMutation.mutateAsync({ data });
        toast({ title: "Project created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetDocProjectsQueryKey() });
      setLocation("/admin/projects");
    } catch (e) {
      toast({ title: "Error saving project", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Edit Project" : "New Project"}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl bg-card border rounded-xl shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="OutdoorShare Mobile App" {...field} />
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
                    <Input placeholder="outdoorshare-mobile-app" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="beta">Beta</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                      <SelectItem value="planned">Planned</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief overview of what this project covers..." 
                      className="resize-none h-24"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link href="/admin/projects">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                Save Project
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}
