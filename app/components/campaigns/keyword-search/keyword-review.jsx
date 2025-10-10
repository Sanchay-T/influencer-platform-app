'use client'

import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

const MAX_KEYWORDS = 10;

export default function KeywordReview({ onSubmit, isLoading }) {
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddKeyword = (e) => {
    e.preventDefault();
    const trimmedKeyword = newKeyword.trim();
    
    if (!trimmedKeyword) return;

    // Check if keyword already exists (case-insensitive)
    const keywordExists = keywords.some(
      keyword => keyword.toLowerCase() === trimmedKeyword.toLowerCase()
    );

    if (keywordExists) {
      toast.error("This keyword already exists");
      setNewKeyword("");
      return;
    }

    if (keywords.length >= MAX_KEYWORDS) {
      toast.error("Maximum number of keywords reached");
      setNewKeyword("");
      return;
    }

    setKeywords([...keywords, trimmedKeyword]);
    setNewKeyword("");
  };

  const handleRemoveKeyword = (keywordToRemove) => {
    setKeywords(keywords.filter(k => k !== keywordToRemove));
  };

  const handleSubmit = async () => {
    if (keywords.length === 0) {
      toast.error("Please add at least one keyword");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(keywords);
    } catch (error) {
      console.error('Error submitting keywords:', error);
      toast.error(error.message || "Failed to submit campaign. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-zinc-900/80 border border-zinc-700/50">
      <CardHeader>
        <CardTitle>Review Your Keywords</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="px-3 py-1">
                {keyword}
                <button
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="ml-2 hover:text-destructive"
                  disabled={isSubmitting}
                >
                  <X size={14} />
                </button>
              </Badge>
            ))}
          </div>

          <form onSubmit={handleAddKeyword} className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Add a keyword..."
              className="flex-1"
              disabled={isSubmitting || keywords.length >= MAX_KEYWORDS}
            />
            <Button 
              type="submit" 
              disabled={isSubmitting || keywords.length >= MAX_KEYWORDS}
            >
              Add
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground">
            You can use single words or phrases with spaces (e.g., &ldquo;airpods pro&rdquo;).
          </p>

          <Button 
            onClick={handleSubmit}
            className="w-full"
            disabled={isLoading || isSubmitting || keywords.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting Campaign...
              </>
            ) : (
              'Submit Campaign'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 
