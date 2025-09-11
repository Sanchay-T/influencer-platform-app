import { NextRequest, NextResponse } from 'next/server';
import { OpenRouterService } from '@/lib/ai/openrouter-service';

export async function POST(request: NextRequest) {
  try {
    const { query, maxResults = 12, includeAISuggestions = false, searchMode = 'single' } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const startTime = Date.now();
    let aiSuggestions = null;
    
    // AI-enhanced search modes
    if (searchMode === 'bulk' || includeAISuggestions) {
      const aiService = new OpenRouterService();
      
      if (searchMode === 'bulk') {
        // Full bulk search with multiple keywords
        const bulkResults = await aiService.bulkSearchInstagramReels(query, maxResults);
        
        return NextResponse.json({
          success: true,
          searchMode: 'bulk',
          query,
          maxResults,
          totalResults: bulkResults.totalResults,
          totalFetched: bulkResults.totalFetched,
          duplicatesRemoved: bulkResults.duplicatesRemoved,
          results: bulkResults.results,
          aiEnhancements: {
            expandedKeywords: bulkResults.expandedKeywords,
            keywordStats: bulkResults.keywordStats,
            searchEfficiency: `${(bulkResults.totalResults / bulkResults.totalApiCalls).toFixed(1)} unique reels per API call`
          },
          pagination: bulkResults.pagination,
          searchTime: Date.now() - startTime
        });
      } else if (includeAISuggestions) {
        // Generate AI keyword suggestions for the normal search
        try {
          const expandedKeywords = await aiService.generateKeywordExpansions(query, 5);
          aiSuggestions = {
            originalKeyword: query,
            suggestedKeywords: expandedKeywords.slice(1), // Exclude original
            totalSuggestions: expandedKeywords.length - 1
          };
        } catch (aiError) {
          console.warn('AI suggestions failed:', aiError);
          // Continue with normal search even if AI fails
        }
      }
    }

    // Normal Instagram API search (existing implementation)
    const url = "https://instagram-premium-api-2023.p.rapidapi.com/v2/search/reels";
    const headers = {
      "x-rapidapi-key": "958382f6a1msh6ee05542f311bb3p1eebeajsne632eef2fa54",
      "x-rapidapi-host": "instagram-premium-api-2023.p.rapidapi.com"
    };

    // Calculate how many pages we need (12 results per page)
    const pagesNeeded = Math.ceil(maxResults / 12);
    const allResults: any[] = [];
    let nextMaxId: string | undefined = undefined;
    let currentPage = 0;

    console.log(`Fetching ${pagesNeeded} pages for query: "${query}" to get ${maxResults} results`);

    // Fetch multiple pages
    for (let page = 0; page < pagesNeeded; page++) {
      const querystring: any = { query };
      
      // Add pagination parameters if we have them
      if (nextMaxId && page > 0) {
        querystring.max_id = nextMaxId;
        querystring.page_index = page;
      }

      console.log(`Fetching page ${page + 1}/${pagesNeeded}`, querystring);

      const response = await fetch(`${url}?${new URLSearchParams(querystring)}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`API request failed on page ${page + 1}: ${response.status}`);
      }

      const pageData = await response.json();
      const clips = pageData.reels_serp_modules?.[0]?.clips || [];
      
      console.log(`Page ${page + 1} returned ${clips.length} clips`);
      
      // Add clips to our results
      allResults.push(...clips);
      
      // Check if we have enough results or if there are no more pages
      if (allResults.length >= maxResults || !pageData.has_more || clips.length === 0) {
        console.log(`Stopping: ${allResults.length} results collected, has_more: ${pageData.has_more}`);
        break;
      }
      
      // Set up for next page
      nextMaxId = pageData.reels_max_id;
      currentPage = pageData.page_index || (page + 1);
      
      // Small delay between requests to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Process results (same as original)
    const processedResults = allResults.slice(0, maxResults).map((clip: any) => {
      const media = clip.media;
      return {
        id: media.pk,
        code: media.code,
        username: media.user?.username || 'N/A',
        fullName: media.user?.full_name || 'N/A',
        isVerified: media.user?.is_verified || false,
        profilePicUrl: media.user?.profile_pic_url || '',
        caption: media.caption?.text || 'No caption',
        playCount: media.play_count || 0,
        likeCount: media.like_count || 0,
        commentCount: media.comment_count || 0,
        takenAt: new Date(media.taken_at * 1000).toISOString(),
        videoUrl: media.video_versions?.[0]?.url || '',
        thumbnailUrl: media.image_versions2?.candidates?.[0]?.url || '',
        instagramUrl: `https://instagram.com/p/${media.code}/`,
        tags: media.usertags?.in?.map((tag: any) => ({
          username: tag.user?.username,
          fullName: tag.user?.full_name,
          isVerified: tag.user?.is_verified
        })) || []
      };
    });

    // Remove duplicates based on ID
    const uniqueResults = processedResults.reduce((acc: any[], current: any) => {
      const isDuplicate = acc.some(result => result.id === current.id);
      if (!isDuplicate) {
        acc.push(current);
      }
      return acc;
    }, []);

    const duplicates = processedResults.length - uniqueResults.length;
    const endTime = Date.now();

    return NextResponse.json({
      success: true,
      searchMode: searchMode === 'bulk' ? 'bulk' : 'enhanced',
      query,
      maxResults,
      totalResults: uniqueResults.length,
      duplicatesRemoved: duplicates,
      pagesFetched: Math.min(pagesNeeded, currentPage + 1),
      searchTime: endTime - startTime,
      results: uniqueResults,
      aiEnhancements: aiSuggestions,
      pagination: {
        requested: maxResults,
        delivered: uniqueResults.length,
        pagesNeeded: pagesNeeded,
        pagesFetched: Math.min(pagesNeeded, currentPage + 1)
      }
    });

  } catch (error) {
    console.error('Enhanced Instagram Reels API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Instagram Reels data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}