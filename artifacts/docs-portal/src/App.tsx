import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Pages
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Search from "@/pages/search";
import Categories from "@/pages/categories";
import CategoryDetail from "@/pages/category-detail";
import ArticleDetail from "@/pages/article-detail";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Features from "@/pages/features";
import FeatureDetail from "@/pages/feature-detail";

// Admin Pages
import AdminDashboard from "@/pages/admin/dashboard";
import AdminArticles from "@/pages/admin/articles/index";
import ArticleEditor from "@/pages/admin/articles/editor";
import AdminCategories from "@/pages/admin/categories/index";
import AdminProjects from "@/pages/admin/projects/index";
import ProjectEditor from "@/pages/admin/projects/editor";
import AdminFeatures from "@/pages/admin/features/index";
import FeatureEditor from "@/pages/admin/features/editor";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/categories" component={Categories} />
      <Route path="/category/:slug" component={CategoryDetail} />
      <Route path="/articles/:slug" component={ArticleDetail} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:slug" component={ProjectDetail} />
      <Route path="/features" component={Features} />
      <Route path="/features/:slug" component={FeatureDetail} />
      
      {/* Admin routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/articles" component={AdminArticles} />
      <Route path="/admin/articles/new" component={ArticleEditor} />
      <Route path="/admin/articles/:id/edit" component={ArticleEditor} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/projects" component={AdminProjects} />
      <Route path="/admin/projects/new" component={ProjectEditor} />
      <Route path="/admin/projects/:id/edit" component={ProjectEditor} />
      <Route path="/admin/features" component={AdminFeatures} />
      <Route path="/admin/features/new" component={FeatureEditor} />
      <Route path="/admin/features/:id/edit" component={FeatureEditor} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
