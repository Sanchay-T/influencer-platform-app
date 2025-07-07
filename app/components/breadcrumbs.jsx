'use client'

import { ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Breadcrumbs({ items, showBackButton = true }) {
  const router = useRouter();

  const handleBack = () => {
    // Find the campaign item to navigate back to
    const campaignItem = items.find(item => item.type === 'campaign');
    if (campaignItem && campaignItem.href) {
      router.push(campaignItem.href);
    } else {
      // Fallback to dashboard
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <nav className="flex items-center space-x-2 text-sm text-gray-500">
        {items.map((item, index) => (
          <div key={index} className="flex items-center">
            {item.href ? (
              <a 
                href={item.href}
                className="hover:text-gray-700 transition-colors duration-200"
              >
                {item.label}
              </a>
            ) : (
              <span className={index === items.length - 1 ? "text-gray-900 font-medium" : ""}>
                {item.label}
              </span>
            )}
            {index < items.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
            )}
          </div>
        ))}
      </nav>
      
      {showBackButton && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaign
        </Button>
      )}
    </div>
  );
}