import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Mail,
    X,
    Sparkles,
    Users,
    ArrowRight,
    Code,
    BarChart3,
} from "lucide-react"

export function Features() {
    return (
        <section className="relative z-10 bg-black py-24 px-6 lg:px-12">
            <div className="max-w-7xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-4xl lg:text-5xl font-normal text-white">
                        Built Different: AI That <span className="italic">Searches for You</span>
                    </h2>
                    <p className="text-white/70 text-lg">Everything you need to automate influencer operations and boost ROI</p>
                </div>

                {/* Features Grid */}
                <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    {/* Live Influencer Search */}
                    <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8 hover:bg-white/10 transition-all">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                        <h4 className="text-white text-sm font-semibold mb-1">Keyword-Based Search</h4>
                                        <p className="text-white/60 text-xs">Discover creators using keywords, hashtags, and phrases.</p>
                                    </div>
                                    <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                        <h4 className="text-white text-sm font-semibold mb-1">Similar Creator Search</h4>
                                        <p className="text-white/60 text-xs">
                                            Find lookalike creators based on a handle you already know.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-semibold text-white">Live Influencer Search</h3>
                                <p className="text-white/70">Enter a keyword or product. Get live results from across platforms.</p>
                            </div>
                        </div>
                    </Card>

                    {/* Signal Based Relevance */}
                    <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8 hover:bg-white/10 transition-all">
                        <div className="space-y-6">
                            <div className="relative h-48 flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="grid grid-cols-3 gap-8 opacity-40">
                                        <Mail className="h-6 w-6 text-white/50" />
                                        <div className="h-6 w-6" />
                                        <div className="h-6 w-6" />
                                        <div className="h-6 w-6" />
                                        <div className="h-6 w-6" />
                                        <X className="h-6 w-6 text-white/50" />
                                    </div>
                                </div>
                                <div
                                    className="relative z-10 w-24 h-24 rounded-full bg-black border-2 border-white/20 flex items-center justify-center"
                                    style={{
                                        boxShadow: "0 0 60px rgba(255, 255, 255, 0.3), 0 0 30px rgba(255, 255, 255, 0.2)",
                                    }}
                                >
                                    <Sparkles className="h-10 w-10 text-white" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-semibold text-white">Signal Based Relevance</h3>
                                <p className="text-white/70">
                                    Matches are ranked by relevance to your brand and audience, not by vanity metrics.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Bottom Row - 3 Cards */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* AI Learning Engine */}
                    <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8 hover:bg-white/10 transition-all">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-white/70 text-xs">Research anything...</span>
                                        <Button size="sm" className="bg-white/20 text-white text-xs h-7">
                                            Creators
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center space-x-2">
                                                <Users className="h-3 w-3 text-white/50" />
                                                <span className="text-white/70">Software & App Industry</span>
                                            </div>
                                            <ArrowRight className="h-3 w-3 text-white/50" />
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center space-x-2">
                                                <Users className="h-3 w-3 text-white/50" />
                                                <span className="text-white/70">Beauty Industry</span>
                                            </div>
                                            <ArrowRight className="h-3 w-3 text-white/50" />
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center space-x-2">
                                                <Users className="h-3 w-3 text-white/50" />
                                                <span className="text-white/70">Food and Beverage</span>
                                            </div>
                                            <ArrowRight className="h-3 w-3 text-white/50" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold text-white">AI Learning Engine</h3>
                                <p className="text-white/70 text-sm">The more you search, the more Gemz knows who works for you.</p>
                            </div>
                        </div>
                    </Card>

                    {/* Zero Setup */}
                    <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8 hover:bg-white/10 transition-all">
                        <div className="space-y-6">
                            <div className="p-4 bg-black/40 rounded-lg border border-white/10 font-mono text-xs">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-white/50">Code</span>
                                        <Code className="h-3 w-3 text-white/50" />
                                    </div>
                                </div>
                                <div className="space-y-1 text-white/60">
                                    <div>class AutomationAgent:</div>
                                    <div className="pl-4">def __init__(self, activation_limit):</div>
                                    <div className="pl-8">self.activation_limit =</div>
                                    <div className="pl-12">activation_limit</div>
                                    <div className="pl-8">self.current_mode = "idle"</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold text-white">Zero Setup</h3>
                                <p className="text-white/70 text-sm">
                                    No onboarding, no CRM, no manual workflows. Just search → find → activate.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* AI Strategy Consulting */}
                    <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8 hover:bg-white/10 transition-all">
                        <div className="space-y-6">
                            <div className="relative h-32 flex items-center justify-center">
                                <div className="absolute left-8 top-4">
                                    <BarChart3 className="h-12 w-12 text-white/30" />
                                </div>
                                <div
                                    className="absolute right-8 bottom-4 w-16 h-16 rounded-full bg-black border-2 border-white/20 flex items-center justify-center"
                                    style={{
                                        boxShadow: "0 0 40px rgba(255, 255, 255, 0.2)",
                                    }}
                                >
                                    <Sparkles className="h-6 w-6 text-white" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-semibold text-white">AI Strategy Consulting</h3>
                                <p className="text-white/70 text-sm">
                                    Get expert guidance to implement AI solutions that drive business growth
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    )
}
