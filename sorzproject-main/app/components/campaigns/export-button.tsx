import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "react-hot-toast";

interface ExportButtonProps {
  jobId?: string;
  campaignId?: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export default function ExportButton({ 
  jobId, 
  campaignId,
  disabled = false, 
  className,
  variant = "default" 
}: ExportButtonProps) {
  const handleExport = async () => {
    try {
      toast.loading('Preparing export...', { id: 'export-loading' });
      let url = '';
      if (campaignId) {
        url = `/api/export/csv?campaignId=${campaignId}`;
        console.log(`Initiating export for campaign ID: ${campaignId}`);
      } else if (jobId) {
        url = `/api/export/csv?jobId=${jobId}`;
        console.log(`Initiating export for job ID: ${jobId}`);
      } else {
        toast.error('No job or campaign selected', { id: 'export-loading' });
        return;
      }
      const response = await fetch(url);
      console.log(`Export API response status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = 'Error exporting data';
        try {
          const errorData = await response.json();
          console.error('Export error details:', errorData);
          errorMessage = errorData.error || errorData.details || errorMessage;
          
          if (errorData.details) {
            errorMessage = `${errorMessage}: ${errorData.details}`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorMessage = `Export failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      // Get CSV blob
      const blob = await response.blob();
      console.log(`Export blob size: ${blob.size} bytes`);
      
      if (blob.size === 0) {
        throw new Error('Exported file is empty');
      }
      
      // Create download URL
      url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creators-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('CSV file exported successfully', { id: 'export-loading' });
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Error exporting CSV', { id: 'export-loading' });
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled}
      className={className}
      variant={variant}
    >
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  );
} 