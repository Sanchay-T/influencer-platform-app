import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// Removed Link to avoid nested anchors
import { useState } from "react";
import { Loader2, Search, FileText, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CampaignCard({ campaign }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCardClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    router.push(`/campaigns/${campaign.id}`);
  };

  const goTo = (e, href) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(href);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={`border border-transparent surface-brand transition-all cursor-pointer group relative ${isLoading ? 'opacity-70' : ''}`}
    >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg z-10">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        )}
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-zinc-100 group-hover:text-zinc-300">
                {campaign.name}
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-zinc-400">
                {campaign.description}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {campaign.status || 'draft'}
              </Badge>
              {/* Removed duplicate search-type badge (e.g., "Keyword Search") to avoid redundancy */}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-0 pb-4">
          <div className="text-xs text-zinc-500">
            Created {new Date(campaign.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="soft"
              onClick={(e) => goTo(e, `/campaigns/${campaign.id}`)}
              className="inline-flex"
            >
              <ExternalLink className="h-4 w-4 mr-1" /> View
            </Button>
            <Button
              type="button"
              size="sm"
              variant="soft"
              onClick={(e) => goTo(e, `/campaigns/search/similar?campaignId=${campaign.id}`)}
              className="inline-flex"
            >
              <Search className="h-4 w-4 mr-1" /> Similar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="soft"
              onClick={(e) => goTo(e, `/campaigns/search/keyword?campaignId=${campaign.id}`)}
              className="inline-flex"
            >
              <FileText className="h-4 w-4 mr-1" /> Keyword
            </Button>
          </div>
        </CardContent>
    </Card>
  );
} 
