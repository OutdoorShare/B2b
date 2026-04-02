import { Badge } from "@/components/ui/badge";

type ArticleType = "guide" | "faq" | "troubleshooting" | "release-notes" | "reference";
type FeatureStatus = "stable" | "beta" | "deprecated";
type ProjectStatus = "active" | "beta" | "deprecated" | "planned";

export function ArticleTypeBadge({ type }: { type: ArticleType | string }) {
  switch (type) {
    case "guide":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-transparent">Guide</Badge>;
    case "faq":
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-transparent">FAQ</Badge>;
    case "troubleshooting":
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-transparent">Troubleshooting</Badge>;
    case "release-notes":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-transparent">Release Notes</Badge>;
    case "reference":
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-transparent">Reference</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export function FeatureStatusBadge({ status }: { status: FeatureStatus | string }) {
  switch (status) {
    case "stable":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-transparent">Stable</Badge>;
    case "beta":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent">Beta</Badge>;
    case "deprecated":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-transparent">Deprecated</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus | string }) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-transparent">Active</Badge>;
    case "beta":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-transparent">Beta</Badge>;
    case "deprecated":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-transparent">Deprecated</Badge>;
    case "planned":
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100 border-transparent">Planned</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
