import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CampaignCard({ campaign }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    router.push(`/campaigns/${campaign.id}`);
  };

  return (
    <Link href={`/campaigns/${campaign.id}`} onClick={handleClick}>
      <Card className={`border-none bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer group relative ${isLoading ? 'opacity-70' : ''}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 rounded-lg z-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
          </div>
        )}
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-gray-700">
                {campaign.name}
              </CardTitle>
              <CardDescription className="mt-1 text-sm text-gray-500">
                {campaign.description}
              </CardDescription>
            </div>
            <Badge variant={campaign.searchType === 'similar' ? 'secondary' : 'default'}>
              {campaign.searchType === 'similar' ? 'Similar Search' : 'Keyword Search'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xs text-gray-500">
            Created {new Date(campaign.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
} 