'use client';

import { structuredConsole } from '@/lib/logging/console-proxy';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

const MAX_KEYWORDS = 10;
const MIN_SUGGEST_LENGTH = 3;
const SUGGESTION_FETCH_DELAY = 350;
const INSTAGRAM_HANDLE_REGEX = /^[a-z0-9._]{1,30}$/;

// [KeywordReview] Rendered by keyword search wizard step 2 to capture keywords/handles prior to submission.
export default function KeywordReview({ onSubmit, isLoading, platform }) {
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [streamingPreview, setStreamingPreview] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const streamControllerRef = useRef(null);
  const suggestionRegistryRef = useRef(new Set());
  const keywordsRef = useRef([]);
  const debounceRef = useRef(null);
  const normalizedPlatform = useMemo(
    () => (platform || '').toString().toLowerCase(),
    [platform]
  );
  const isInstagramSimilarMode = useMemo(
    () =>
      [
        'instagram-similar',
        'instagram_similar',
        'instagram similar'
      ].includes(normalizedPlatform),
    [normalizedPlatform]
  );
  const availableSlots = MAX_KEYWORDS - keywords.length;
  const normalizedExisting = useMemo(
    () => keywords.map((keyword) => keyword.toLowerCase()),
    [keywords]
  );

  const sanitizeInstagramHandle = (rawValue) => {
    if (typeof rawValue !== 'string') return '';
    return rawValue.trim().replace(/^@+/, '').toLowerCase();
  };

  const validateInstagramHandle = (handle) => {
    if (!handle) {
      toast.error('Please enter an Instagram handle');
      return false;
    }
    if (!INSTAGRAM_HANDLE_REGEX.test(handle)) {
      toast.error('Handles can include letters, numbers, underscores, and periods only (max 30 characters)');
      return false;
    }
    return true;
  };

  useEffect(() => {
    keywordsRef.current = keywords;
  }, [keywords]);

  const abortSuggestionStream = useCallback((reset = false) => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
    }
    if (reset) {
      suggestionRegistryRef.current = new Set();
      setSuggestions([]);
      setStreamingPreview("");
    }
    setIsSuggesting(false);
  }, []);

  const handleSuggestionEvent = (event) => {
    if (!event || typeof event !== 'object') return;

    if (event.type === 'token') {
      const token = typeof event.payload === 'string' ? event.payload : '';
      if (token) {
        setStreamingPreview((prev) => (prev + token).slice(-160));
      }
      return;
    }

    if (event.type === 'suggestion') {
      const payload = event.payload ?? {};
      const keyword = typeof payload.keyword === 'string' ? payload.keyword.trim() : '';
      if (!keyword || keyword.length < MIN_SUGGEST_LENGTH) return;
      const currentKeywords = keywordsRef.current;
      if (currentKeywords.some((item) => item.toLowerCase() === keyword.toLowerCase())) return;
      if (suggestionRegistryRef.current.has(keyword.toLowerCase())) return;
      suggestionRegistryRef.current.add(keyword.toLowerCase());
      setSuggestions((current) => {
        if (current.some((item) => item.keyword.toLowerCase() === keyword.toLowerCase())) {
          return current;
        }
        const next = [...current, { ...payload, keyword }];
        const remainingSlots = Math.max(0, MAX_KEYWORDS - currentKeywords.length);
        if (remainingSlots <= 0) {
          return current;
        }
        return next.slice(0, remainingSlots);
      });
      return;
    }

    if (event.type === 'error') {
      const message = typeof event.message === 'string' ? event.message : 'Suggestion stream error';
      structuredConsole.warn('[KeywordSuggestions] stream error', message);
      toast.error(message);
      return;
    }

    if (event.type === 'complete') {
      setStreamingPreview("");
    }
  };

  const startSuggestionStream = useCallback((seed) => {
    if (isInstagramSimilarMode) {
      abortSuggestionStream(true);
      return;
    }
    if (!seed || seed.length < MIN_SUGGEST_LENGTH || availableSlots <= 0) {
      abortSuggestionStream(true);
      return;
    }

    abortSuggestionStream(true);
    suggestionRegistryRef.current = new Set();
    setIsSuggesting(true);

    const controller = new AbortController();
    streamControllerRef.current = controller;

    (async () => {
      try {
        const response = await fetch('/api/keywords/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed,
            existingKeywords: keywordsRef.current,
            limit: Math.max(0, Math.min(availableSlots, 8)),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let message = 'Suggestion stream failed';
          try {
            const errorPayload = await response.json();
            if (errorPayload?.error) {
              message = errorPayload.error;
            }
          } catch {
            // ignore parsing errors
          }
          throw new Error(message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let separatorIndex = buffer.indexOf('\n\n');
          while (separatorIndex !== -1) {
            const rawEvent = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);

            const trimmed = rawEvent.trim();
            if (trimmed.startsWith('data:')) {
              const payload = trimmed.slice(5).trim();
              if (payload) {
                try {
                  const event = JSON.parse(payload);
                  handleSuggestionEvent(event);
                } catch (error) {
                  structuredConsole.warn('[KeywordSuggestions] failed to parse event', error);
                }
              }
            }

            separatorIndex = buffer.indexOf('\n\n');
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          structuredConsole.warn('[KeywordSuggestions] stream failed', error);
          toast.error(error instanceof Error ? error.message : 'Suggestion stream error');
        }
      } finally {
        if (streamControllerRef.current === controller) {
          streamControllerRef.current = null;
        }
        setIsSuggesting(false);
        setStreamingPreview("");
      }
    })();
  }, [abortSuggestionStream, availableSlots, isInstagramSimilarMode]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (isInstagramSimilarMode) {
      abortSuggestionStream(true);
      return;
    }

    if (!newKeyword || newKeyword.trim().length < MIN_SUGGEST_LENGTH || availableSlots <= 0) {
      abortSuggestionStream(true);
      return;
    }

    const seed = newKeyword.trim();
    debounceRef.current = window.setTimeout(() => {
      startSuggestionStream(seed);
    }, SUGGESTION_FETCH_DELAY);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [newKeyword, availableSlots, keywords, isInstagramSimilarMode, abortSuggestionStream, startSuggestionStream]);

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    abortSuggestionStream();
  }, [abortSuggestionStream]);

  useEffect(() => {
    if (isInstagramSimilarMode) {
      abortSuggestionStream(true);
      setSuggestions([]);
      setStreamingPreview("");
    }
  }, [abortSuggestionStream, isInstagramSimilarMode]);

  const handleAddKeyword = (e) => {
    e.preventDefault();
    const rawValue = newKeyword;
    const trimmedKeyword = rawValue.trim();

    if (!trimmedKeyword) return;

    if (keywords.length >= MAX_KEYWORDS) {
      toast.error(isInstagramSimilarMode ? 'Maximum number of handles reached' : 'Maximum number of keywords reached');
      setNewKeyword("");
      return;
    }

    if (isInstagramSimilarMode) {
      const sanitized = sanitizeInstagramHandle(rawValue);
      if (!validateInstagramHandle(sanitized)) {
        return;
      }
      if (normalizedExisting.includes(sanitized)) {
        toast.error('This handle is already added');
        setNewKeyword("");
        return;
      }
      setKeywords([...keywords, sanitized]);
      setNewKeyword("");
      return;
    }

    const keywordExists = keywords.some(
      keyword => keyword.toLowerCase() === trimmedKeyword.toLowerCase()
    );

    if (keywordExists) {
      toast.error("This keyword already exists");
      setNewKeyword("");
      return;
    }

    setKeywords([...keywords, trimmedKeyword]);
    setNewKeyword("");
    setSuggestions((current) =>
      current.filter((item) => item.keyword.toLowerCase() !== trimmedKeyword.toLowerCase())
    );
  };

  const handleRemoveKeyword = (keywordToRemove) => {
    setKeywords(keywords.filter(k => k !== keywordToRemove));
  };

  const handleSubmit = async () => {
    if (keywords.length === 0) {
      toast.error(isInstagramSimilarMode ? 'Please add at least one Instagram handle' : 'Please add at least one keyword');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = isInstagramSimilarMode
        ? { usernames: keywords }
        : { keywords };
      await onSubmit(payload);
    } catch (error) {
      structuredConsole.warn('[KeywordReview] submission failed', error);
      toast.error(error.message || "Failed to submit campaign. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (isInstagramSimilarMode) {
      return;
    }
    if (keywords.length >= MAX_KEYWORDS) {
      toast.error("Keyword limit reached");
      return;
    }

    const normalized = suggestion.keyword.trim();
    if (!normalized) {
      return;
    }

    if (normalizedExisting.includes(normalized.toLowerCase())) {
      toast.error("Keyword already added");
      return;
    }

    setKeywords([...keywords, normalized]);
    setSuggestions((current) =>
      current.filter((item) => item.keyword.toLowerCase() !== normalized.toLowerCase())
    );
  };

  const handleRefreshSuggestions = () => {
    if (isInstagramSimilarMode) {
      toast.error('Suggestions are unavailable for Instagram handles');
      return;
    }
    if (!newKeyword || newKeyword.trim().length < MIN_SUGGEST_LENGTH) {
      toast.error("Type at least three characters to get suggestions");
      return;
    }
    startSuggestionStream(newKeyword.trim());
  };

  const handleInputChange = (value) => {
    if (isInstagramSimilarMode) {
      const restricted = value.replace(/[^a-zA-Z0-9._@]/g, '');
      setNewKeyword(restricted);
      return;
    }
    setNewKeyword(value);
  };

  const renderKeywordLabel = (keyword) => (isInstagramSimilarMode ? `@${keyword}` : keyword);
  const cardTitle = isInstagramSimilarMode ? 'Review Instagram Handles' : 'Review Your Keywords';
  const inputPlaceholder = isInstagramSimilarMode ? 'Add an Instagram handle...' : 'Add a keyword...';
  const helperCopy = isInstagramSimilarMode
    ? 'Enter up to ten Instagram handles. We’ll remove the @ symbol and validate characters automatically.'
    : 'You can use single words or phrases with spaces (e.g., “airpods pro”).';

  return (
    <Card className="bg-zinc-900/80 border border-zinc-700/50">
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="px-3 py-1">
                {renderKeywordLabel(keyword)}
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
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={inputPlaceholder}
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
          
          <p className="text-xs text-muted-foreground">{helperCopy}</p>

          {!isInstagramSimilarMode && (
            <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200">AI Suggestions</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshSuggestions}
                disabled={isSuggesting || keywords.length >= MAX_KEYWORDS}
              >
                {isSuggesting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Generating
                  </>
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
            {suggestions.length === 0 && !isSuggesting && !streamingPreview && (
              <p className="text-xs text-muted-foreground">
                Start typing to see recommended keywords that can boost your creator results.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {streamingPreview && (
                <Badge
                  key="streaming-placeholder"
                  variant="outline"
                  className="px-3 py-1 text-xs text-zinc-300 border-dashed border-zinc-600/60 bg-zinc-900/40 animate-pulse"
                >
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Crafting ideas…
                </Badge>
              )}
              {suggestions.map((suggestion) => (
                <Badge
                  key={suggestion.keyword}
                  variant="secondary"
                  title={suggestion.rationale || undefined}
                  className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <span>+ {suggestion.keyword}</span>
                  {typeof suggestion.confidence === 'number' && (
                    <span className="ml-2 text-[10px] font-medium text-emerald-300/80">
                      {(suggestion.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </Badge>
              ))}
            </div>
            </div>
          )}

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
