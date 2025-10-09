[Skip to main content](https://docs.perplexity.ai/guides/search-guide#content-area)

[Perplexity home page![light logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=78a7baffae224c1a8db2616f1547ff5d)![dark logo](https://mintcdn.com/perplexity/ydog55Ez6JQ_5Px7/logo/Perplexity_API_Platform_Light.svg?fit=max&auto=format&n=ydog55Ez6JQ_5Px7&q=85&s=d20039b09af08a25f5bf6c497f549e2e)](https://docs.perplexity.ai/getting-started/overview)

[Docs](https://docs.perplexity.ai/getting-started/overview) [Examples](https://docs.perplexity.ai/cookbook) [API Reference](https://docs.perplexity.ai/api-reference/search-post)

Search...

Navigation

Search API

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

- [Overview](https://docs.perplexity.ai/guides/search-guide#overview)
- [Installation](https://docs.perplexity.ai/guides/search-guide#installation)
- [Basic Usage](https://docs.perplexity.ai/guides/search-guide#basic-usage)
- [Multi-Query Search](https://docs.perplexity.ai/guides/search-guide#multi-query-search)
- [Content Extraction Control](https://docs.perplexity.ai/guides/search-guide#content-extraction-control)
- [Error Handling](https://docs.perplexity.ai/guides/search-guide#error-handling)
- [Async Usage](https://docs.perplexity.ai/guides/search-guide#async-usage)
- [Best Practices](https://docs.perplexity.ai/guides/search-guide#best-practices)
- [Query Optimization](https://docs.perplexity.ai/guides/search-guide#query-optimization)

## [​](https://docs.perplexity.ai/guides/search-guide\#overview)  Overview

The Search API gives ranked results from Perplexity’s continuously refreshed index.

We recommend using our official SDKs for a more convenient and type-safe way to interact with the Search API.

## [​](https://docs.perplexity.ai/guides/search-guide\#installation)  Installation

Install the SDK for your preferred language:

Python

TypeScript/JavaScript

Copy

Ask AI

```
pip install perplexityai

```

### [​](https://docs.perplexity.ai/guides/search-guide\#basic-usage)  Basic Usage

Start with a basic search query to get relevant web results:

Python

TypeScript

JavaScript

cURL

Copy

Ask AI

```
from perplexity import Perplexity

client = Perplexity()

search = client.search.create(
    query="latest AI developments 2024",
    max_results=5,
    max_tokens_per_page=1024
)

for result in search.results:
    print(f"{result.title}: {result.url}")

```

Response

Copy

Ask AI

```
{
  "results": [\
    {\
      "title": "The Top Artificial Intelligence Trends - IBM",\
      "url": "https://www.ibm.com/think/insights/artificial-intelligence-trends",\
      "snippet": "Approaching the midpoint of 2025, we can look back at the prevailing artificial intelligence trends of the year so far—and look ahead to what the rest of the year might bring.\n\nGiven the breadth and depth of AI development, no roundup of AI trends can hope to be exhaustive. This piece is no exception. We’ve narrowed things down to a list of 10: 5 developments that have driven the first half of the year, and 5 more that we expect to play a major role in the months to come.\n\nTrends in AI are driven not only by advancements in AI models and algorithms themselves, but by the ever-expanding array of use cases to which generative AI (gen AI) capabilities are being applied. As models grow more capable, versatile and efficient, so too do the AI applications, AI tools and other AI-powered workflows they enable. A true understanding of how today’s AI ecosystem is evolving therefore requires a contextual understanding of the causes and effects of machine learning breakthroughs.\n\nThis article primarily explores ongoing trends whose real-world impact might be realized on a horizon of months: in other words, trends with tangible impact mostly on or in the year 2025. There are, of course, other AI initiatives that are more evergreen and familiar. For example, though there has been recent movement on fully self-driving vehicles in isolated pockets—robotaxi pilots have been launched in a handful of U.S. cities, with additional trials abroad in Oslo, Geneva and 16 Chinese cities—they’re likely still years away from ubiquity.... One study estimates the pace of algorithmic improvement at roughly 400% per year: in other words, today’s results can be achieved a year later using one fourth of the compute—and that’s\n\n*without *accounting for simultaneous improvements in computing (see: Moore’s Law) or synthetic training data. The original GPT-4, rumored to have around 1.8 trillion parameters, 1 achieved a score of 67% on HumanEval, a popular benchmark for coding performance. IBM Granite 3.3 2B Instruct, released 2 years later and *900 times smaller, *achieved a score of 80.5%. 2\n\nThis exponential expansion of model economy, more than anything, is what empowers the emerging era of AI agents. Large language models (LLMs) are becoming more practical even faster than they’re becoming more capable, which enables the deployment of complex multi-agent systems in which a cadre of models can plan, execute and coordinate on complex tasks autonomously—without skyrocketing inference costs.\n\nThe release of OpenAI’s o1 introduced a new avenue for increasing model performance. Its head-turning improvement over prior state-of-the-art performance on highly technical math and coding benchmarks initiated an arms race in so-called “reasoning models.” Their enhanced performance on tasks requiring logical decision-making figures to play an important role in the development of agentic AI. But as is often the case with AI technology, the initial frenzy over raw performance has more recently given way to a search for the most practical implementation.... That focus seems to have changed in the aftermath of DeepSeek-R1. DeepSeek-R1, and the DeepSeek-V3 base model it was fine-tuned from, demonstrated conclusively that MoE models were perfectly capable of delivering cutting edge performance to complement their already-proven computational efficiency.\n\nThat reinvigorated interest in sparse MoE models is evident in the current wave of next-generation models—including (but not limited to) Meta Llama 4, Alibaba’s Qwen3 and IBM Granite 4.0—using the architecture. It’s also possible that some leading closed models from the likes of OpenAI, Anthropic or Google are MoEs, though such information about closed model architecture is rarely disclosed.\n\nAs impressive capacity and performance become increasingly commodified in the coming years, the inference speed and efficiency offered by sparse models are likely to become a higher priority.\n\nThe future is always hard to predict. The breakneck pace of improvement in prior generations of AI models had many expecting the generation of models to be released in 2025 to make meaningful steps toward artificial general intelligence (AGI). While the latest models from OpenAI, Meta and the other most-funded players in the AI space are no doubt impressive, they’re certainly short of revolutionary.\n\nOn the practical implementation side, progress has been uneven. Many business leaders who were bullish on their organization’s AI adoption outlook at the end of 2023 spent 2024 realizing that their organization’s IT infrastructure wasn’t ready to scale AI yet.... The reality is that there is no best benchmark. The best practice is probably for organizations to develop their own benchmarks that best reflect performance on the tasks they care about. A business wouldn’t hire an employee based solely on an IQ test and it shouldn’t choose a model based only on standardized tests either.\n\nFirst introduced in 2017, transformer models are largely responsible for the era of generative AI, and they continue to be the backbone of everything from image generation to time series models to LLMs. Though transformers are certainly not going anywhere anytime soon, they’re about to have some company.\n\nTransformers have a crucial weakness: their computational needs scale quadratically with context. In other words, each time your context length doubles, self-attention doesn’t just use double the resources—it uses\n\n*quadruple *the resources. This “quadratic bottleneck” inherently limits the speed and efficiency of conventional LLMs, especially on longer sequences or when incorporating information from earlier in an extended exchange. Continued optimization of the transformer architecture continues to yield stronger frontier models, but they’re getting extremely expensive.\n\n**Mamba**, first introduced in 2023, is a different type of model architecture altogether—a *state space model,* specifically—and it’s poised to give transformers their first serious competition in the world of LLMs. The architecture has proven capable of matching transformers on most language modeling tasks (with the exception of in-context learning tasks like few-shot prompting) and its computational needs scale *linearly *with context length. Put simply, the way Mamba understands context is inherently more efficient: transformer’s *self-attention *mechanism must look at every single token and repeatedly decide which to pay attention to; Mamba’s *selectivity *mechanism only retains the tokens it determines to be important.... When it comes to transformers or mamba, the future of AI is not probably an “either/or” situation: in fact, research suggests that a hybrid of the two is better than either on their own. Several mamba or hybrid mamba/transformer models have been released in the past year. Most have been academic research-only models, with notable exceptions including Mistral AI’s Codestral Mamba and AI2I’s hybrid Jamba series. More recently, the upcoming IBM Granite 4.0 series will be using a hybrid of transformer and Mamba-2 architectures.\n\nMost importantly, the reduced hardware requirements of Mamba and hybrid models will significantly reduce hardware costs, which in turn will help continue to democratize AI access.\n\nThe advent of multimodal AI models marked the expansion of LLMs beyond text, but the next frontier of AI development aims to bring those multimodal abilities into the physical world.\n\nThis emerging field largely falls under the heading of “Embodied AI.” Venture capital firms are increasingly pouring funding into startups pursuing advanced, generative AI-driven humanoid robotics, such as Skild AI, Physical Intelligence, and 1X Technologies.\n\nAnother stream of research is focusing on “world models” that aim to model real-world interactions directly and holistically, rather than indirectly and discretely through the mediums of language, image and video data. World Labs, a startup headed by Stanford’s Fei-Fei Li—famed for, among other things, the ImageNet dataset that helped pave a path for modern computer vision—raised USD 230 million at the end of last year.... Some labs in this space are conducting experiments in “virtual worlds,” like video games: Google DeepMind’s Genie 2, for example, is “a foundation world model capable of generating an endless variety of action-controllable, playable 3D environments. The video game industry might, naturally, be the first direct beneficiaries of world models’ economic potential.\n\nMany (but not all) leading AI experts, including Yann LeCun, Meta’s chief AI scientist and one of the three “godfathers of deep learning,\"\n\n7 believe that world models, not LLMs, are the true path to AGI. In public comments, LeCun often alludes to Moravec’s paradox, the counterintuitive notion that in AI, complex reasoning skills are straightforward but simple sensorimotor and perception tasks that a child can do easily are not. 8\n\nAlong these lines, some interesting research endeavors are aiming to teach AI to understand\n\n*concepts, *rather than just *words*, by embodying that AI in a robot and teaching it the way we teach things to infants.\n\nThe long-term promise of AI agents is that they’ll use AI to carry out complex, context-specific tasks autonomously with little to no human intervention. To be able to personalize its decision-making to the specific, contextually intricate needs of a given workplace or situation—the way a competent employee or assistant would—an AI agent needs to learn on the job. In other words, it must retain a robust history of every AI-generated interaction and how it went.",\
      "date": "2025-05-21",\
      "last_updated": "2025-08-29"\
    },\
    {\
      "title": "2024: A year of extraordinary progress and advancement in AIblog.google › technology › 2024-ai-extraordinary-progress-advancement",\
      "url": "https://blog.google/technology/ai/2024-ai-extraordinary-progress-advancement/",\
      "snippet": "# 2024: A year of extraordinary progress and advancement in AI\n\nAs we move into 2025, we wanted to take a moment to recognize the astonishing progress of the last year. From new Gemini models built for the agentic era and empowering creativity, to an AI system that designs novel, high-strength protein binders, AI–enabled neuroscience and even landmark advances in quantum computing, we’ve been boldly and responsibly advancing the frontiers of artificial intelligence and all the ways it can benefit humanity.\n\nAs we and our colleagues wrote two years ago in an essay titled\n\n*Why we focus on AI*:\n\n\n\n*Our approach to developing and harnessing the potential of AI is grounded in our founding mission — to organize the world’s information and make it universally accessible and useful — and it is shaped by our commitment to improve the lives of as many people as possible*.”\n\nThis remains as true today as it was when we first wrote it.\n\nIn this 2024 Year-in-Review post, we look back on a year's worth of extraordinary progress in AI, made possible by the many incredible teams across Google, that helped deliver on that mission and commitment — progress that sets the stage for more to come this year.... ## Relentless innovation in models, products and technologies\n\n2024 was a year of experimenting, fast shipping, and putting our latest technologies in the hands of developers.\n\nIn December 2024, we released the first models in our Gemini 2.0 experimental series — AI models designed for the agentic era. First out of the gate was Gemini 2.0 Flash, our workhorse model, followed by prototypes from the frontiers of our agentic research including: an updated Project Astra, which explores the capabilities of a universal AI assistant; Project Mariner, an early prototype capable of taking actions in Chrome as an experimental extension; and Jules, an AI-powered code agent. We're looking forward to bringing Gemini 2.0’s powerful capabilities to our flagship products — in Search, we’ve already started testing in AI Overviews, which are now used by over a billion people to ask new types of questions.\n\nWe also released Deep Research, a new agentic feature in Gemini Advanced that saves people hours of research work by creating and executing multi-step plans for finding answers to complicated questions; and introduced Gemini 2.0 Flash Thinking Experimental, an experimental model that explicitly shows its thoughts.\n\nThese advances followed swift progress earlier in the year, from incorporating Gemini’s capabilities into more Google products to the release of Gemini 1.5 Pro and Gemini 1.5 Flash — a model optimized for speed and efficiency. 1.5 Flash’s compact size made it more cost-efficient to serve, and in 2024 it became our most popular model for developers.... ## The architecture of intelligence: advances in robotics, hardware and computing\n\nAs our multimodal models become more capable and gain a better understanding of the world and its physics, they are making possible incredible new advances in robotics and bringing us closer to our goal of ever-more capable and helpful robots.\n\nWith ALOHA Unleashed, our robot learned to tie a shoelace, hang a shirt, repair another robot, insert a gear and even clean a kitchen.\n\nAt the beginning of the year, we introduced AutoRT, SARA-RT and RT-Trajectory, extensions of our Robotics Transformers work intended to help robots better understand and navigate their environments, and make decisions faster. We also published ALOHA Unleashed, a breakthrough in teaching robots on how to use two robotic arms in coordination, and DemoStart, which uses a reinforcement learning algorithm to improve real-world performance on a multi-fingered robotic hand by using simulations.\n\nRobotic Transformer 2 (RT-2) is a novel vision-language-action model that learns from both web and robotics data.\n\nBeyond robotics, our AlphaChip reinforcement learning method for accelerating and improving chip floorplanning is transforming the design process for chips found in data centers, smartphones and more. To accelerate adoption of these techniques, we released a pre-trained checkpoint to enable external parties to more easily make use of the AlphaChip open source release for their own chip designs. And we made Trillium, our sixth-generation and most performant TPU to date, generally available to Google Cloud customers. Advances in computer chips have accelerated AI. And now, AI can return the favor.... AlphaChip can learn the relationships between interconnected chip components and generalize across chips, letting AlphaChip improve with each layout it designs.\n\nOur research also focused on correcting the errors in the physical hardware of today's quantum computers. In November, we launched AlphaQubit, an AI-based decoder that identifies quantum computing errors with state-of-the-art accuracy. This collaborative work brought together Google DeepMind’s ML knowledge and Google Research’s error correction expertise to accelerate progress on building a reliable quantum computer. In tests, it made 6% fewer errors than tensor network methods and 30% fewer errors than correlated matching.\n\nThen in December, the Google Quantum AI team, part of Google Research, announced Willow, our latest quantum chip which can perform in under five minutes a benchmark computation that would take one of today’s fastest supercomputers 10 septillion years. Willow can reduce errors exponentially as it scales up using more qubits. In fact, it used our quantum error correction to cut the error rate in half, solving a 30+ year challenge known in the field as “below threshold.” This leap forward won the Physics Breakthrough of the Year award.\n\nWillow has state-of-the-art performance across a number of metrics.... ## Uncovering new solutions: progress in science, biology and mathematics\n\nWe continued to push the envelope on accelerating scientific progress with AI-based approaches, releasing a series of tools and papers this year that showed just how useful and powerful a tool AI is for advancing science and mathematics. We're sharing a few highlights.\n\nIn January, we introduced AlphaGeometry, an AI system engineered to solve complex geometry problems. Our updated version, AlphaGeometry 2, and AlphaProof, a reinforcement-learning-based system for formal math reasoning, achieved the same level as a silver medalist in July 2024’s International Mathematical Olympiad.\n\nAlphaGeometry 2 solved Problem 4 in July 2024’s International Mathematical Olympiad within 19 seconds after receiving its formalization. Problem 4 asked to prove the sum of ∠KIL and ∠XPY equals 180°.\n\nIn collaboration with Isomorphic Labs, we introduced AlphaFold 3, our latest model which predicts the structure and interactions of all of life’s molecules. By accurately predicting the structure of proteins, DNA, RNA, ligands and more, and how they interact, we hope it will transform our understanding of the biological world and drug discovery.\n\nAlphaFold 3’s capabilities come from its next-generation architecture and training that now covers all of life’s molecules.... ## AI for the benefit of humanity\n\nThis year, we made a number of product advances and published research that showed how AI can benefit people directly and immediately, ranging from preventative and diagnostic medicine to disaster readiness and recovery to learning.\n\nIn healthcare, AI holds the promise of democratizing quality of care in key areas, such as early detection of cardiovascular disease. Our research demonstrated how using a simple fingertip device that measures variations in blood flow, combined with basic metadata, can predict heart health risks. We built on previous AI-enabled diagnostic research for tuberculosis, demonstrating how AI models can be used for accurate TB screenings in populations with high rates of TB and HIV. This is important to reducing the prevalence of TB (more than 10 million people fall ill with it each year), as roughly 40% of people with TB go undiagnosed.\n\nOn the MedQA (USMLE-style) benchmark, Med-Gemini attains a new state-of-the-art score, surpassing our prior best (Med-PaLM 2) by a significant margin of 4.6%.\n\nOur Gemini model is a powerful tool for professionals generally, but our teams are also working to create fine-tuned models for other domains. For example, we introduced Med-Gemini, a new family of next-generation models that combine training on de-identified medical data with Gemini’s reasoning, multimodal and long-context abilities. On the MedQA US Medical Licensing Exam (USMLE)-style question benchmark, Med-Gemini achieves a state-of-the-art performance of 91.1% accuracy, surpassing our prior best of Med-PaLM 2 by 4.6% (shown above).... We are exploring how machine learning can help medical fields struggling with access to imaging expertise, such as radiology, dermatology and pathology. In the past year, we released two research tools, Derm Foundation and Path Foundation, that can help develop models for diagnostic tasks, image indexing and curation and biomarker discovery and validation. We collaborated with physicians at Stanford Medicine on an open-access, inclusive Skin Condition Image Network (SCIN) dataset. And we unveiled CT Foundation, a medical imaging embedding tool used for rapidly training models for research.\n\nWith regard to learning, we explored new generative AI tools to support educators and learners. We introduced LearnLM, our new family of models fine-tuned for learning and used it to enhance learning experiences in products like Search, YouTube and Gemini; a recent report showed LearnLM outperformed other leading AI models. We also made it available to developers as an experimental model in AI Studio. Our new conversational learning companion, LearnAbout, uses AI to help you dive deeper into any topic you’re curious about, while Illuminate lets you turn content into engaging AI-generated audio discussions.\n\nIn the fields of disaster forecasting and preparedness, we announced several breakthroughs. We introduced GenCast, our new high-resolution AI ensemble model, which improves day-to-day weather and extreme events forecasting across all possible weather trajectories. We also introduced our NeuralGCM model, able to simulate over 70,000 days of the atmosphere in the time it would take a physics-based model to simulate only 19 days. And GraphCast won the 2024 MacRobert Award for engineering innovation.",\
      "date": "2025-01-23",\
      "last_updated": "2025-09-08"\
    },\
    {\
      "title": "AI Pulse: Top AI Trends from 2024 - A Look Back | Trend Micro (US)",\
      "url": "https://www.trendmicro.com/en_us/research/25/a/top-ai-trends-from-2024-review.html",\
      "snippet": "AI Comes Into Its Own\n\n2024 may go down as the year AI stopped being a technological novelty and became—more consequentially—a Fact of Life. Big names like Microsoft, Salesforce, and Intuit built AI into mainstream enterprise solutions; specialized AI apps and services sprung up for everything from copywriting to data analysis; and governments, think tanks, and regulators poured effort into setting up meaningful guardrails for AI development and use. Meanwhile, bad actors made good on finding new ways to dupe, intimidate, and extort using AI tools.\n\nThis special issue of\n\n*AI Pulse* looks back over the AI trends in 2024 and what they mean for the year ahead.\n\nAI Trends in 2024\n\n**AI Advances by Leaps and Bounds\n\n**Our previous\n\n*AI Pulse*was dedicated mostly to agentic AI—for good reason. Autonomous, cooperative machine-based problem solving is widely seen as an essential step along the path to artificial general intelligence (AGI). All the big AI players spotlighted R&D efforts in the agentic arena over the course of 2024—and non-AI players moved in to offer AI agents as a service (AIAaaS).\n\n**Teaching computers to use computers\n\n**One of the year’s big agentic releases was the public beta of Computer Use for Anthropic’s Claude 3.5 Sonnet model. As the name suggests, Computer Use allows Claude 3.5 Sonnet to use a computer by ‘looking’ at the screen, manipulating the cursor, clicking on links, and entering text. Other developers are also working on web-savvy agents, though assessing performance at scale is a widely recognized challenge. The research company ServiceNow is aiming to change that with its AgentLab offering—an open-source Python package launched in December that’s capable of running large-scale web agent experiments in parallel across a diversity of online environments.... **From RAGs to AI riches\n\n**AI systems need relevant data to solve problems effectively. Retrieval-augmented generation (RAG) provides that by giving systems access to contextually significant information instead of broad, unfocused data sets. On its own, RAG has been found to reduce AI hallucinations and outperform alternative approaches such as long-context transformers and fine-tuning. Combining RAG with fine-tuning produces even better results.\n\nAnthropic announced its own spin on RAG earlier this fall with “contextual retrieval”—said to make information retrieval more successful—and a new Model Context Protocol (MCP) for connecting AI assistants to data systems in a reliable and scalable way.\n\nTrend Micro has found RAG isn’t without its risks. Exposed vector stores and LLM-hosting platforms can give way to data leaks and unauthorized access. Security issues such as data validation bugs and denial-of-service (DoS) attacks are common across RAG components. Beyond authentication, Trend recommends implementing transport layer security (TLS) encryption and zero-trust networking to prevent unauthorized access and manipulation.\n\n**‘Smallifying’ AI models\n\n**Hand in hand with the shift to agentic AI is the need for smaller, nimbler, faster models purpose-built for specific tasks. Again, lots of work went into this in 2024. In October, Meta released updates to its Llama AI model that are as much as four times faster and 56% smaller than their precursors, enabling sophisticated AI features on devices as small as smartphones. And Nvidia released its Nemotron-Mini-4B Instruct small language model (SLM), which gets VRAM usage down to about 2GB for far faster speeds than LLMs.... Smaller models aren’t only more nimble: they’re also more energy-efficient than LLMs—and more affordable, too. That in turn makes them more widely accessible. All of this aligns well with the UN Sustainable Development Goals.\n\nAI Fraud and Cybercrime: Seeing is no Longer Believing\n\nMost experts agree AI can’t yet generate wholly novel threats, but in 2024 it certainly proved it can make existing attack vectors a lot more potent—especially large-scale, highly targeted phishing schemes. Deepfake propaganda took a toll on the public discourse. AI-abetted cybercrimes cost businesses millions if not billions. And phenomena like virtual kidnappings ushered in a new era of do-it-from-your-desktop extortion.\n\n**Deception gets an upgrade\n\n**2024 kicked off with the story of an employee in Hong Kong who paid US$25 million to fraudsters because he thought his CEO told him to—when really it was a video deepfake. Scammers in India put a businessman under ‘house arrest’ and staged a fake online court proceeding to fleece him of more than US$800,000. Virtual kidnappings became a real-world threat with deepfake media convincing victims their loved ones had been abducted and would be harmed unless a ransom was paid. And in November, Forbes profiled a new deepfake tool that can circumvent two-factor authentication, allowing criminals to open illegitimate accounts to access credit and loans, claim government benefits, and more.... - Ensure U.S. leadership in the development of safe, trustable AI\n\n- Advance U.S. national security with AI\n\n- Drive international agreements on AI use and governance\n\nIn November, the National Institute of Standards and Technology (NIST) formed a taskforce— Testing Risks of AI for National Security (TRAINS)—to deal with AI’s national security and public safety implications. TRAINS members represent the Departments of Defense, Energy, and Homeland Security as well as the National Institutes of Health and will facilitate coordinated assessment and testing of AI models in areas of national security concern such as radiological, nuclear, chemical, and biological security, cybersecurity, and more.\n\nAlso in November, the Departments of Commerce and State co-convened the International Network of AI Safety Institutes for the first time, focusing on synthetic content risks, foundation model testing, and advanced AI risk assessment.\n\n**Across the equator: AI regs in Latin America... MIT also contributed to the effort to track AI risks. In August, it launched a public AI Risk Repository with more than 700 risks based on over 40 different frameworks, with citations and risk taxonomies.\n\nAI Can do Good, Too\n\nWhile it’s important to be clear about the risks of AI, it’s just as important to stay mindful of the benefits—and a number of efforts sought to highlight those positive capabilities in 2024.\n\n**Beating the bad guys to it\n\n**Using AI to discover vulnerabilities and exploits got a fair bit of attention throughout the year. While AI isn’t always needed, in situations where complexity is high and unknowns abound, it can deliver excellent results. The Frontier Model Forum found vulnerability discovery and patching is an emerging area of AI strength, due partly to increased use of coding examples in post-training and partly because of expanding context windows. AI can also support open-source intelligence gathering and reporting through real-time monitoring and analysis, trend identification, and more.\n\nAs predicted by Trend Micro for 2025, agentic AI could expand on those capabilities with a combination of tooling, data, and planning that reduce the amount of human brain time involved. Combining agentic use of reverse-engineering tools such as Ida, Ghidra, and Binary Ninja with code similarity, architectural RAG, and algorithm identification for compiled code could be a powerful lever in the cybersecurity arms race.... **Promoting public peace\n\n**Trend took part in the 2024 Paris Peace Forum and announced its partnership with the Forum on developing guidance for secure AI adoption and implementation. As Martin Tisné, CEO of the AI Collaborative, said at the Forum meeting, what’s most important is to ensure that AI is outcomes-based from the start, so that its development and uses coincide with the good it can bring to society.\n\nWhat’s ahead?\n\nThis time of year is rife with predictions and we’ll be sharing more of our own in the weeks to come. Clear from the AI trends in 2024 is that innovation won’t be slowing down anytime soon: the full agentic revolution is still about to hit, and with it will come new choices for regulators, new capabilities for cybercriminals to weaponize—and new opportunities for cyber-defenders to proactively secure the digital world.\n\nMore perspective from Trend Micro\n\nCheck out all our 2024 issues of\n\n*AI Pulse*:\n\n- AI Pulse: Siri Says Hi to OpenAI, Deepfake Olympics & more\n\n- AI Pulse: Brazil Gets Bold with Meta, Interpol’s Red Flag & more\n\n- AI Pulse: Sticker Shock, Rise of the Agents, Rogue AI\n\n- AI Pulse: What's new in AI regulations?\n\n- AI Pulse: Election Deepfakes, Disasters, Scams & more\n\n- AI Pulse: The Good from AI and the Promise of Agentic",\
      "date": "2025-01-03",\
      "last_updated": "2025-09-08"\
    },\
    {\
      "title": "The state of AI: How organizations are rewiring to capture value - McKinseywww.mckinsey.com › capabilities › quantumblack › our-insights › the-stat...",\
      "url": "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai",\
      "snippet": "**Organizations are starting to make** organizational changes designed to generate future value from gen AI, and large companies are leading the way. The latest McKinsey Global Survey on AI finds that organizations are beginning to take steps that drive bottom-line impact—for example, redesigning workflows as they deploy gen AI and putting senior leaders in critical roles, such as overseeing AI governance. The findings also show that organizations are working to mitigate a growing set of gen-AI-related risks and are hiring for new AI-related roles while they retrain employees to participate in AI deployment. Companies with at least $500 million in annual revenue are changing more quickly than smaller organizations. Overall, the use of AI—that is, gen AI as well as analytical AI—continues to build momentum: More than three-quarters of respondents now say that their organizations use AI in at least one business function. The use of gen AI in particular is rapidly increasing.\n\n## How companies are organizing their gen AI deployment—and who’s in charge... ### Organizations are selectively centralizing elements of their AI deployment\n\nThe survey findings also shed light on how organizations are structuring their AI deployment efforts. Some essential elements for deploying AI tend to be fully or partially centralized (Exhibit 1). For risk and compliance, as well as data governance, organizations often use a fully centralized model such as a center of excellence. For tech talent and adoption of AI solutions, on the other hand, respondents most often report using a hybrid or partially centralized model, with some resources handled centrally and others distributed across functions or business units—though respondents at organizations with less than $500 million in annual revenues are more likely than others to report fully centralizing these elements.\n\n### Organizations vary widely in how they monitor gen AI outputs\n\nOrganizations have employees overseeing the quality of gen AI outputs, though the extent of that oversight varies widely. Twenty-seven percent of respondents whose organizations use gen AI say that employees review all content created by gen AI before it is used—for example, before a customer sees a chatbot’s response or before an AI-generated image is used in marketing materials (Exhibit 2). A similar share says that 20 percent or less of gen-AI-produced content is checked before use. Respondents working in business, legal, and other professional services are much more likely than those in other industries to say that all outputs are reviewed.\n\n### Organizations are addressing more gen-AI-related risks\n\nMany organizations are ramping up their efforts to mitigate gen-AI-related risks. Respondents are more likely than in early 2024 to say their organizations are actively managing risks related to inaccuracy, cybersecurity, and intellectual property infringement (Exhibit 3)—three of the gen-AI-related risks that respondents most commonly say have caused negative consequences for their organizations.\n\n2\n\nRespondents at larger organizations report mitigating more risks than respondents from other organizations do. They are much more likely than others to say their organizations are managing potential cybersecurity and privacy risks, for example, but they are not any more likely to be addressing risks relating to the accuracy or explainability of AI outputs.... ## AI is shifting the skills that organizations need\n\nThis survey also examines the state of AI-related hiring and other ways AI affects the workforce. Respondents working for organizations that use AI are about as likely as they were in the early 2024 survey to say their organizations hired individuals for AI-related roles in the past 12 months. The only roles that differ this year are data-visualization and design specialists, which respondents are significantly less likely than in the previous survey to report hiring. The findings also indicate several new risk-related roles that are becoming part of organizations’ AI deployment processes. Thirteen percent of respondents say their organizations have hired AI compliance specialists, and 6 percent report hiring AI ethics specialists. Respondents at larger companies are more likely than their peers at smaller organizations to report hiring a broad range of AI-related roles, with the largest gaps seen in hiring AI data scientists, machine learning engineers, and data engineers.\n\nRespondents continue to see these roles as largely challenging to fill, though a smaller share of respondents than in the past two years describe hiring for many roles as “difficult” or “very difficult” (Exhibit 5). One exception is AI data scientists, who will continue to be in high demand in the year ahead: Half of respondents whose organizations use AI say their employers will need more data scientists than they have now.... ## AI use continues to climb\n\nReported use of AI increased in 2024.\n\n3 In the latest survey, 78 percent of respondents say their organizations use AI in at least one business function, up from 72 percent in early 2024 and 55 percent a year earlier (Exhibit 8). Respondents most often report using the technology in the IT and marketing and sales functions, followed by service operations. The business function that saw the largest increase in AI use in the past six months is IT, where the share of respondents reporting AI use jumped from 27 percent to 36 percent.\n\nOrganizations are also using AI in more business functions than in the previous State of AI survey. For the first time, most survey respondents report the use of AI in more than one business function (Exhibit 9). Responses show organizations using AI in an average of three business functions—an increase from early 2024, but still a minority of functions.\n\nThe use of gen AI has seen a similar jump since early 2024: 71 percent of respondents say their organizations regularly use gen AI in at least one business function, up from 65 percent in early 2024.\n\n4 (Individuals’ use of gen AI has also grown. See sidebar, “C-level executives are using gen AI more than others.”) Responses show that organizations are most often using gen AI in marketing and sales, product and service development, service operations, and software engineering—business functions where gen AI deployment would likely generate the most value, according to previous McKinsey research—as well as in IT.... ## C-level executives are using gen AI more than others\n\n**Individual use of gen AI** by our respondents also increased significantly in 2024, with C-level executives leading the way (exhibit). Fifty-three percent of surveyed executives say they are regularly using gen AI at work, compared with 44 percent of midlevel managers. While we see variation in individuals’ use of gen AI across industries and regions, the data largely show widening use across the board.\n\nWhile organizations in all sectors are most likely to use gen AI in marketing and sales, deployment within other functions varies greatly according to industry (Exhibit 10). Organizations are applying the technology where it can generate the most value—for example, service operations for media and telecommunication companies, software engineering for technology companies, and knowledge management for professional-services organizations.\n\n5 Gen AI deployment also varies by company size. Responses show that companies with more than $500 million in annual revenues are using gen AI throughout more of their organizations than smaller companies are.\n\nMost respondents reporting use of gen AI—63 percent—say that their organizations are using gen AI to create text outputs, but organizations are also experimenting with other modalities. More than one-third of respondents say their organizations are generating images, and more than one-quarter use it to create computer code (Exhibit 11). Respondents in the technology sector report the widest range of gen AI outputs, while respondents in advanced industries (such as automotive, aerospace, and semiconductors) are more likely than others to use gen AI to create images and audio.... An increasing share of respondents report value creation within the business units using gen AI. Compared with early 2024, larger shares of respondents say that their organizations’ gen AI use cases have increased revenue within the business units deploying them (Exhibit 12). Respondents report similar revenue increases from gen AI as they did from analytical AI activities in the previous survey. This emphasizes the need for companies to have a comprehensive approach across both AI and gen AI solutions to capture the full potential value.\n\nOverall, respondents are also more likely than in the previous survey to say they are seeing meaningful cost reductions within the business units using gen AI (Exhibit 13).\n\nIn early 2024, among respondents reporting use of gen AI in specific business functions, a minority saw cost reductions from its use.\n\n6\n\nThe latest survey finds that, for use of gen AI in most business functions, a majority of respondents report cost reductions.Exhibit 13\n\nYet gen AI’s reported effects on bottom-line impact are not yet material at the enterprise-wide level. More than 80 percent of respondents say their organizations aren’t seeing a tangible impact on enterprise-level EBIT from their use of gen AI.\n\n7\n\nOrganizations have been experimenting with gen AI tools. Use continues to surge, but from a value capture standpoint, these are still early days—few are experiencing meaningful bottom-line impacts. Larger companies are doing more organizationally to help realize that value. They invest more heavily in AI talent. They mitigate more gen-AI-related risks. We have seen organizations move since early last year, and the technology also continues to evolve, with a view toward agentic AI as the next frontier for AI innovation. It will be interesting to see what happens when more companies begin to follow the road map for successful gen AI implementation in 2025 and beyond.",\
      "date": "2025-03-12",\
      "last_updated": "2025-09-08"\
    },\
    {\
      "title": "Generative AI Developments & Trends in 2024: A Timeline",\
      "url": "https://www.channelinsider.com/managed-services/generative-ai-developments-trends-year-in-review/",\
      "snippet": "Cloudbrink expands Personal SASE with identity services and Crowdstrike integration, unifying user and device security for zero-trust access control.\n\nMalwarebytes adds AI-powered email protection to ThreatDown, unifying endpoint and email security for MSPs via IRONSCALES tech and Nebula console.\n\nGalactic Advisors uncovered critical flaws in Kaseya’s Network Detective; both firms moved fast to patch issues and highlight MSP risk assessment best practices.\n\nStibo Systems unveils AI-driven MDM tools to reduce manual work, boost data accuracy, and accelerate operations for global enterprises and partners.\n\nSentinelOne acquires Prompt Security to secure GenAI use, adding real-time visibility, control, and protection across AI tools and enterprise systems.\n\nNoma Security raises $100M Series B to help enterprises govern and secure autonomous AI agents as demand for agent oversight rapidly accelerates.\n\nApiiro launches AutoFix AI Agent to auto-remediate code and design risks in IDEs using runtime context, bridging AI coding and secure development.\n\nThe expanded alliance emphasizes AI-driven defenses, sovereign cloud capabilities, and new anti-scam protections for businesses worldwide.\n\nArctera updates Insight to help organizations capture, chronicle & contain AI data, easing compliance and unlocking insights from LLM interactions.\n\nStorage Guardian cut its data center footprint by 80% with StorONE. CEO Omry Farajun explains how efficiency and flexibility drive modern MSP success.... Galactic Advisors patents a user-activated, credential-free pen testing tool, boosting MSP security with risk-free, forensic-grade assessments.Link to Flashpoint Mid-Year Report: Cyber Threats are EscalatingFlashpoint Mid-Year Report: Cyber Threats are Escalating\n\nFlashpoint’s 2025 Midyear Index reveals an 800% rise in info-stealing malware and significant surges in ransomware, vulnerabilities, and breaches.Link to Cloudbrink Adds Native ID Management, Crowdstrike IntegrationCloudbrink Adds Native ID Management, Crowdstrike Integration\n\nCloudbrink expands Personal SASE with identity services and Crowdstrike integration, unifying user and device security for zero-trust access control.Link to Malwarebytes Launches New Email Security ModuleMalwarebytes Launches New Email Security Module\n\nMalwarebytes adds AI-powered email protection to ThreatDown, unifying endpoint and email security for MSPs via IRONSCALES tech and Nebula console.Link to Galactic Advisors on Addressing Vulnerabilities in the ChannelGalactic Advisors on Addressing Vulnerabilities in the Channel\n\nGalactic Advisors uncovered critical flaws in Kaseya’s Network Detective; both firms moved fast to patch issues and highlight MSP risk assessment best practices.\n\n- AI Related TopicsLink to Stibo Systems Launches New AI Capabilities Across PortfolioStibo Systems Launches New AI Capabilities Across Portfolio... Stibo Systems unveils AI-driven MDM tools to reduce manual work, boost data accuracy, and accelerate operations for global enterprises and partners.Link to Shadow AI Meets Its Match in SentinelOne’s Latest MoveShadow AI Meets Its Match in SentinelOne’s Latest Move\n\nSentinelOne acquires Prompt Security to secure GenAI use, adding real-time visibility, control, and protection across AI tools and enterprise systems.Link to Guardrails for AI Agents: Noma Secures $100M BoostGuardrails for AI Agents: Noma Secures $100M Boost\n\nNoma Security raises $100M Series B to help enterprises govern and secure autonomous AI agents as demand for agent oversight rapidly accelerates.Link to Apiiro Launches AutoFix AI to Fix Design and Code RisksApiiro Launches AutoFix AI to Fix Design and Code Risks\n\nApiiro launches AutoFix AI Agent to auto-remediate code and design risks in IDEs using runtime context, bridging AI coding and secure development.Link to Trend Micro and Google Cloud Double Down on AI SecurityTrend Micro and Google Cloud Double Down on AI Security\n\nThe expanded alliance emphasizes AI-driven defenses, sovereign cloud capabilities, and new anti-scam protections for businesses worldwide.Link to Arctera Updates Platform to Reduce AI Compliance RisksArctera Updates Platform to Reduce AI Compliance Risks",\
      "date": "2024-11-14",\
      "last_updated": "2025-08-08"\
    }\
  ],
  "id": "4c9c9aa2-0526-4d73-9d67-84085475e2c5"
}

```

The `max_results` parameter accepts values from 1 to 20, with a default maximum of 20 results per search.

### [​](https://docs.perplexity.ai/guides/search-guide\#multi-query-search)  Multi-Query Search

By using a list as the `query` parameter, you can run multiple related queries in a single request for comprehensive research:

Python

TypeScript

JavaScript

cURL

Copy

Ask AI

```
from perplexity import Perplexity

client = Perplexity()

search = client.search.create(
    query=[\
        "renewable energy trends 2024",\
        "solar power innovations",\
        "wind energy developments"\
    ],
    max_results=10
)

for result in search.results:
    print(f"{result.title}: {result.url}")
    print(f"Snippet: {result.snippet[:100]}...")
    print("---")

```

## [​](https://docs.perplexity.ai/guides/search-guide\#content-extraction-control)  Content Extraction Control

The `max_tokens_per_page` parameter controls how much content is extracted from each webpage during search processing. This allows you to balance between comprehensive content coverage and processing efficiency.

Python

TypeScript

cURL

Copy

Ask AI

```
from perplexity import Perplexity

client = Perplexity()

# Extract more content for comprehensive analysis
detailed_search = client.search.create(
    query="artificial intelligence research methodology",
    max_results=5,
    max_tokens_per_page=2048
)

# Use default extraction for faster processing
quick_search = client.search.create(
    query="AI news headlines",
    max_results=10,
    max_tokens_per_page=512
)

for result in detailed_search.results:
    print(f"{result.title}: {result.snippet[:100]}...")

```

The `max_tokens_per_page` parameter defaults to 1024 tokens. Higher values provide more comprehensive content extraction but may increase processing time. Lower values enable faster processing with more focused content.

Use higher `max_tokens_per_page` values (1500-2048) for research tasks requiring detailed content analysis, and lower values (256-512) for quick information retrieval or when processing large result sets.

### [​](https://docs.perplexity.ai/guides/search-guide\#error-handling)  Error Handling

Handle search-specific errors gracefully to build robust applications:

Python

TypeScript

JavaScript

Copy

Ask AI

```
from perplexity import Perplexity, BadRequestError, RateLimitError, APIStatusError

client = Perplexity()

try:
    search = client.search.create(
        query="",  # Empty query will cause error
        max_results=5
    )
except BadRequestError as e:
    print(f"Invalid search parameters: {e}")
except RateLimitError as e:
    print("Search rate limit exceeded - please wait before retrying")
except APIStatusError as e:
    print(f"Search API error {e.status_code}: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")

```

## [​](https://docs.perplexity.ai/guides/search-guide\#async-usage)  Async Usage

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

## [​](https://docs.perplexity.ai/guides/search-guide\#best-practices)  Best Practices

### [​](https://docs.perplexity.ai/guides/search-guide\#query-optimization)  Query Optimization

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

2

Use multi-query for comprehensive research

Break your main topic into related sub-queries to cover all aspects of your research. Use the [multi-query search](https://docs.perplexity.ai/guides/search-guide#multi-query-search) feature to run multiple related queries in a single request for more comprehensive and relevant information.

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
    client = AsyncPerplexity()
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

Was this page helpful?

YesNo

CtrlI

Assistant

Responses are generated using AI and may contain mistakes.