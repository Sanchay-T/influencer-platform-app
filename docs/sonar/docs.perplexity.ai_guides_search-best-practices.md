[Skip to main content](https://docs.perplexity.ai/guides/search-best-practices#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Search

Best Practices

Search docs

Ctrl K

- [Forum](https://community.perplexity.ai/)
- [Blog](https://perplexity.ai/blog)
- [Changelog](https://docs.perplexity.ai/changelog/changelog)

##### Getting Started

- [Overview](https://docs.perplexity.ai/getting-started/overview)
- [Pricing](https://docs.perplexity.ai/getting-started/pricing)

##### Perplexity SDK

- [Quickstart](https://docs.perplexity.ai/guides/perplexity-sdk)
- Guides


##### Search

- [Quickstart](https://docs.perplexity.ai/guides/search-quickstart)
- [Best Practices](https://docs.perplexity.ai/guides/search-best-practices)

##### Grounded LLM

- [Quickstart](https://docs.perplexity.ai/getting-started/quickstart)
- [Models](https://docs.perplexity.ai/getting-started/models)
- [Chat Completions SDK](https://docs.perplexity.ai/guides/chat-completions-sdk)
- [OpenAI Compatibility](https://docs.perplexity.ai/guides/chat-completions-guide)
- Prompting & Output Control

- Search & Filtering

- Working with Attachments

- Integration & Extensibility


##### Admin

- [API Groups & Billing](https://docs.perplexity.ai/getting-started/api-groups)
- [API Key Management](https://docs.perplexity.ai/guides/api-key-management)
- [Rate Limits & Usage Tiers](https://docs.perplexity.ai/guides/rate-limits-usage-tiers)

##### Help & Resources

- [Changelog](https://docs.perplexity.ai/changelog/changelog)
- [Get in Touch](https://docs.perplexity.ai/discussions/discussions)
- [API Roadmap](https://docs.perplexity.ai/feature-roadmap)
- [Frequently Asked Questions](https://docs.perplexity.ai/faq/faq)
- [System Status](https://docs.perplexity.ai/status/status)
- [Privacy & Security](https://docs.perplexity.ai/guides/privacy-security)
- [Perplexity Crawlers](https://docs.perplexity.ai/guides/bots)

On this page

- [Overview](https://docs.perplexity.ai/guides/search-best-practices#overview)
- [Query Optimization](https://docs.perplexity.ai/guides/search-best-practices#query-optimization)
- [Async Usage](https://docs.perplexity.ai/guides/search-best-practices#async-usage)
- [Advanced Async Patterns](https://docs.perplexity.ai/guides/search-best-practices#advanced-async-patterns)
- [Rate-Limited Concurrent Processing](https://docs.perplexity.ai/guides/search-best-practices#rate-limited-concurrent-processing)
- [Error Handling in Async Operations](https://docs.perplexity.ai/guides/search-best-practices#error-handling-in-async-operations)
- [Performance Optimization Tips](https://docs.perplexity.ai/guides/search-best-practices#performance-optimization-tips)
- [Related Resources](https://docs.perplexity.ai/guides/search-best-practices#related-resources)

## [​](https://docs.perplexity.ai/guides/search-best-practices\#overview)  Overview

This guide covers essential best practices for getting the most out of Perplexity’s Search API, including query optimization techniques and efficient async usage patterns for high-performance applications.

## [​](https://docs.perplexity.ai/guides/search-best-practices\#query-optimization)  Query Optimization

1

Write specific queries

Use highly specific queries for more targeted results. For example, instead of searching for “AI”, use a detailed query like “artificial intelligence machine learning healthcare applications 2024”.

Python

TypeScript

Copy

Ask AI

```
# Better: Specific query
search = client.search.create(
    query="artificial intelligence medical diagnosis accuracy 2024",
    max_results=10
)

# Avoid: Vague query
search = client.search.create(
    query="AI medical",
    max_results=10
)

```

Specific queries with context, time frames, and precise terminology yield more relevant and actionable results.

2

Use multi-query for comprehensive research

Break your main topic into related sub-queries to cover all aspects of your research. Use the multi-query search feature to run multiple related queries in a single request for more comprehensive and relevant information.

Python

TypeScript

Copy

Ask AI

```
from perplexity import Perplexity

client = Perplexity()

# Comprehensive research with related queries
search = client.search.create(
    query=[\
        "artificial intelligence medical diagnosis accuracy 2024",\
        "machine learning healthcare applications FDA approval",\
        "AI medical imaging radiology deployment hospitals"\
    ],
    max_results=5
)

# Access results for each query
for i, query_results in enumerate(search.results):
    print(f"Results for query {i+1}:")
    for result in query_results:
        print(f"  {result.title}: {result.url}")
    print("---")

```

You can include up to 5 queries in a single multi-query request for efficient batch processing.

3

Handle rate limits efficiently

Implement exponential backoff for rate limit errors and use appropriate batching strategies.

Python

TypeScript

Copy

Ask AI

```
import time
import random
from perplexity import RateLimitError

def search_with_retry(client, query, max_retries=3):
    for attempt in range(max_retries):
        try:
            return client.search.create(query=query)
        except RateLimitError:
            if attempt < max_retries - 1:
                # Exponential backoff with jitter
                delay = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(delay)
            else:
                raise

# Usage
try:
    search = search_with_retry(client, "AI developments")
    for result in search.results:
        print(f"{result.title}: {result.url}")
except RateLimitError:
    print("Maximum retries exceeded for search")

```

4

Process concurrent searches efficiently

Use async for concurrent requests while respecting rate limits.

Python

TypeScript

Copy

Ask AI

```
import asyncio
from perplexity import AsyncPerplexity

async def batch_search(queries, batch_size=3, delay_ms=1000):
    async with AsyncPerplexity() as client:
        results = []

        for i in range(0, len(queries), batch_size):
            batch = queries[i:i + batch_size]

            batch_tasks = [\
                client.search.create(query=query, max_results=5)\
                for query in batch\
            ]

            batch_results = await asyncio.gather(*batch_tasks)
            results.extend(batch_results)

            # Add delay between batches
            if i + batch_size < len(queries):
                await asyncio.sleep(delay_ms / 1000)

        return results

# Usage
queries = ["AI developments", "climate change", "space exploration"]
results = asyncio.run(batch_search(queries))
print(f"Processed {len(results)} searches")

```

## [​](https://docs.perplexity.ai/guides/search-best-practices\#async-usage)  Async Usage

For high-performance applications requiring concurrent requests, use the async client:

Python

TypeScript

JavaScript

Copy

Ask AI

```
import asyncio
from perplexity import AsyncPerplexity

async def main():
    async with AsyncPerplexity() as client:
        # Concurrent searches for better performance
        tasks = [\
            client.search.create(\
                query="artificial intelligence trends 2024",\
                max_results=5\
            ),\
            client.search.create(\
                query="machine learning breakthroughs",\
                max_results=5\
            ),\
            client.search.create(\
                query="deep learning applications",\
                max_results=5\
            )\
        ]

        results = await asyncio.gather(*tasks)

        for i, search in enumerate(results):
            print(f"Query {i+1} results:")
            for result in search.results:
                print(f"  {result.title}: {result.url}")
            print("---")

asyncio.run(main())

```

### [​](https://docs.perplexity.ai/guides/search-best-practices\#advanced-async-patterns)  Advanced Async Patterns

#### [​](https://docs.perplexity.ai/guides/search-best-practices\#rate-limited-concurrent-processing)  Rate-Limited Concurrent Processing

For large-scale applications, implement controlled concurrency with rate limiting:

Python

TypeScript

Copy

Ask AI

```
import asyncio
from perplexity import AsyncPerplexity

class SearchManager:
    def __init__(self, max_concurrent=5, delay_between_batches=1.0):
        self.max_concurrent = max_concurrent
        self.delay_between_batches = delay_between_batches
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def search_single(self, client, query):
        async with self.semaphore:
            return await client.search.create(query=query, max_results=5)

    async def search_many(self, queries):
        async with AsyncPerplexity() as client:
            tasks = [\
                self.search_single(client, query)\
                for query in queries\
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Filter out exceptions and return successful results
            successful_results = [\
                result for result in results\
                if not isinstance(result, Exception)\
            ]

            return successful_results

# Usage
async def main():
    manager = SearchManager(max_concurrent=3)
    queries = [\
        "AI research 2024",\
        "quantum computing advances",\
        "renewable energy innovations",\
        "biotechnology breakthroughs",\
        "space exploration updates"\
    ]

    results = await manager.search_many(queries)
    print(f"Successfully processed {len(results)} out of {len(queries)} searches")

asyncio.run(main())

```

#### [​](https://docs.perplexity.ai/guides/search-best-practices\#error-handling-in-async-operations)  Error Handling in Async Operations

Implement robust error handling for async search operations:

Python

TypeScript

Copy

Ask AI

```
import asyncio
import logging
from perplexity import AsyncPerplexity, APIStatusError, RateLimitError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def resilient_search(client, query, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = await client.search.create(query=query, max_results=5)
            logger.info(f"Search successful for: {query}")
            return result

        except RateLimitError as e:
            if attempt < max_retries - 1:
                delay = 2 ** attempt
                logger.warning(f"Rate limited for '{query}', retrying in {delay}s")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Max retries exceeded for: {query}")
                return None

        except APIStatusError as e:
            logger.error(f"API error for '{query}': {e}")
            return None

        except Exception as e:
            logger.error(f"Unexpected error for '{query}': {e}")
            return None

async def main():
    async with AsyncPerplexity() as client:
        queries = ["AI developments", "invalid query", "tech trends"]

        tasks = [resilient_search(client, query) for query in queries]
        results = await asyncio.gather(*tasks)

        successful_results = [r for r in results if r is not None]
        print(f"Successful searches: {len(successful_results)}/{len(queries)}")

asyncio.run(main())

```

## [​](https://docs.perplexity.ai/guides/search-best-practices\#performance-optimization-tips)  Performance Optimization Tips

1

Optimize result count

Request only the number of results you actually need. More results = longer response times.

Copy

Ask AI

```
# Good: Request only what you need
search = client.search.create(query="tech news", max_results=5)

# Avoid: Over-requesting results
search = client.search.create(query="tech news", max_results=50)

```

2

Cache frequently used searches

Implement caching for queries that don’t need real-time results.

Python

TypeScript

Copy

Ask AI

```
import time
from typing import Dict, Tuple, Optional

class SearchCache:
    def __init__(self, ttl_seconds=3600):  # 1 hour default
        self.cache: Dict[str, Tuple[any, float]] = {}
        self.ttl = ttl_seconds

    def get(self, query: str) -> Optional[any]:
        if query in self.cache:
            result, timestamp = self.cache[query]
            if time.time() - timestamp < self.ttl:
                return result
            else:
                del self.cache[query]
        return None

    def set(self, query: str, result: any):
        self.cache[query] = (result, time.time())

# Usage
cache = SearchCache(ttl_seconds=1800)  # 30 minutes

def cached_search(client, query):
    cached_result = cache.get(query)
    if cached_result:
        return cached_result

    result = client.search.create(query=query)
    cache.set(query, result)
    return result

```

## [​](https://docs.perplexity.ai/guides/search-best-practices\#related-resources)  Related Resources

[**Quickstart** \\
\\
Get started with basic search functionality](https://docs.perplexity.ai/guides/search-quickstart) [**Perplexity SDK** \\
\\
Explore the full SDK capabilities for enhanced performance](https://docs.perplexity.ai/guides/perplexity-sdk) [**API Reference** \\
\\
Complete Search API documentation](https://docs.perplexity.ai/api-reference/search-post)

Was this page helpful?

YesNo

[Quickstart\\
\\
Previous](https://docs.perplexity.ai/guides/search-quickstart) [Quickstart\\
\\
Next](https://docs.perplexity.ai/getting-started/quickstart)

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.