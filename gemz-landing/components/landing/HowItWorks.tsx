"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    TrendingUp,
    Mail,
    Monitor,
    Users,
    Check,
    BarChart3,
    User,
    Eye,
    Globe,
} from "lucide-react"

export function HowItWorks() {
    const [activeStep, setActiveStep] = useState(1)

    return (
        <section className="relative z-10 bg-black py-24 px-6 lg:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black" />

            <div className="relative z-10 max-w-7xl mx-auto">
                <div className="text-center mb-16 space-y-6">
                    <div className="flex justify-center">
                        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                            <TrendingUp className="h-4 w-4 text-white" />
                            <span className="text-white text-sm font-medium">PROCESS</span>
                        </div>
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-normal text-white">How It Works</h2>
                    <p className="text-white/70 text-lg">
                        Everything you need to collaborate, create, and scale, all in one place.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-12 max-w-4xl mx-auto">
                    <button
                        onClick={() => setActiveStep(1)}
                        className={`py-4 px-6 rounded-lg border transition-all ${activeStep === 1 ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10"
                            }`}
                    >
                        <span className="text-white/70 text-sm font-medium">STEP 1</span>
                    </button>
                    <button
                        onClick={() => setActiveStep(2)}
                        className={`py-4 px-6 rounded-lg border transition-all ${activeStep === 2 ? "bg-white/10 border-blue-500/50" : "bg-white/5 border-white/10 hover:bg-white/10"
                            }`}
                    >
                        <span className="text-white/70 text-sm font-medium">STEP 2</span>
                    </button>
                    <button
                        onClick={() => setActiveStep(3)}
                        className={`py-4 px-6 rounded-lg border transition-all ${activeStep === 3 ? "bg-white/10 border-blue-500/50" : "bg-white/5 border-white/10 hover:bg-white/10"
                            }`}
                    >
                        <span className="text-white/70 text-sm font-medium">STEP 3</span>
                    </button>
                </div>
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                    {/* Step 1 Content */}
                    {activeStep === 1 && (
                        <>
                            {/* Left Side - Dashboard */}
                            <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8">
                                <div className="space-y-6">
                                    {/* Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-white/70 text-xs">Influencers</span>
                                                <span className="text-green-400 text-xs">+Growth</span>
                                            </div>
                                            <div className="text-3xl font-bold text-white">80%</div>
                                            <div className="mt-2 h-12 flex items-end space-x-1">
                                                {[30, 45, 35, 50, 40, 55, 45, 60].map((height, i) => (
                                                    <div key={i} className="flex-1 bg-white/20 rounded-t" style={{ height: `${height}%` }} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-white/70 text-xs">Engagement Rate</span>
                                                <span className="text-green-400 text-xs">+Growth</span>
                                            </div>
                                            <div className="text-3xl font-bold text-white">6.5%</div>
                                            <div className="mt-2 h-12 flex items-end space-x-1">
                                                {[40, 35, 50, 45, 55, 50, 60, 55].map((height, i) => (
                                                    <div key={i} className="flex-1 bg-white/20 rounded-t" style={{ height: `${height}%` }} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <Mail className="h-4 w-4 text-white/50" />
                                                <span className="text-white/70 text-xs">Campaigns</span>
                                            </div>
                                            <div className="flex items-baseline space-x-2">
                                                <span className="text-2xl font-bold text-white">42</span>
                                                <span className="text-green-400 text-xs">+7%</span>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <Monitor className="h-4 w-4 text-white/50" />
                                                <span className="text-white/70 text-xs">Posts</span>
                                            </div>
                                            <div className="flex items-baseline space-x-2">
                                                <span className="text-2xl font-bold text-white">314</span>
                                                <span className="text-green-400 text-xs">+12%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Weakest Topics */}
                                    <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                        <div className="text-white/70 text-sm mb-4">Weakest Topics</div>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center">👔</div>
                                                        <span className="text-white/90">Fashion</span>
                                                    </div>
                                                    <span className="text-white/70">62% Score</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-white/40 rounded-full" style={{ width: "62%" }} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center">💄</div>
                                                        <span className="text-white/90">Beauty</span>
                                                    </div>
                                                    <span className="text-white/70">54% Score</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-white/40 rounded-full" style={{ width: "54%" }} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center">💪</div>
                                                        <span className="text-white/90">Fitness</span>
                                                    </div>
                                                    <span className="text-white/70">73% Score</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-white/40 rounded-full" style={{ width: "73%" }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Right Side - Description */}
                            <div className="space-y-6">
                                <div className="text-6xl font-bold text-white/20">01</div>
                                <h3 className="text-4xl font-bold text-white">Discover & Analyze</h3>
                                <p className="text-white/70 text-lg leading-relaxed">
                                    Search through keywords or discover similar creators across TikTok, Instagram, and YouTube. Our
                                    AI-powered discovery instantly surfaces influencers who match your brand and campaign goals.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Step 2 Content */}
                    {activeStep === 2 && (
                        <>
                            {/* Left Side - Creator Profile */}
                            <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8 hover:bg-white/10 transition-all">
                                <div className="space-y-6">
                                    {/* Other Creators Section */}
                                    <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                        <div className="text-white/70 text-sm mb-4">Other Creators</div>
                                        <div className="grid grid-cols-3 gap-4 mb-6">
                                            <div className="flex flex-col items-center space-y-2">
                                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                                    <User className="h-6 w-6 text-white/70" />
                                                </div>
                                                <span className="text-white/90 text-xs">Users</span>
                                            </div>
                                            <div className="flex flex-col items-center space-y-2">
                                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                                    <Monitor className="h-6 w-6 text-white/70" />
                                                </div>
                                                <span className="text-white/90 text-xs">Campaigns</span>
                                            </div>
                                            <div className="flex flex-col items-center space-y-2">
                                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                                    <Users className="h-6 w-6 text-white/70" />
                                                </div>
                                                <span className="text-white/90 text-xs">Influencers</span>
                                            </div>
                                        </div>

                                        {/* Top Creator Card */}
                                        <div className="p-4 bg-black/60 rounded-lg border border-white/10">
                                            <div className="text-white/70 text-xs mb-3">Top Creator</div>
                                            <div className="flex items-start space-x-4">
                                                <Avatar className="w-16 h-16">
                                                    <AvatarImage src="/testimonial-creator-1.jpg" />
                                                    <AvatarFallback>PA</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 space-y-2">
                                                    <div>
                                                        <div className="text-white font-semibold">Paris Adamson</div>
                                                        <div className="text-white/70 text-xs">Travel</div>
                                                    </div>
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex items-center space-x-2 text-white/70">
                                                            <Mail className="h-3 w-3" />
                                                            <span>paris@travel.co</span>
                                                        </div>
                                                        {/* CHANGE: Updated views from 53 View/Post to 15k views/post */}
                                                        <div className="flex items-center space-x-2 text-white/70">
                                                            <Eye className="h-3 w-3" />
                                                            <span>15k views/post</span>
                                                        </div>
                                                        <div className="flex items-center space-x-2 text-white/70">
                                                            <Globe className="h-3 w-3" />
                                                            <span>Travel.co</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Right Side - Description */}
                            <div className="space-y-6">
                                <div className="text-6xl font-bold text-white/20">02</div>
                                <h3 className="text-4xl font-bold text-white">Discover High Performing Influencers</h3>
                                <p className="text-white/70 text-lg leading-relaxed">
                                    Search by keyword, niche, or brand name and instantly uncover creators who match your campaign
                                    goals. Our AI analyzes performance metrics like engagement, views, and audience fit, delivering
                                    results you can act on fast.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Step 3 Content */}
                    {activeStep === 3 && (
                        <>
                            {/* Left Side - List Creation & Export Dashboard */}
                            <Card className="backdrop-blur-md bg-white/5 border-white/10 p-8 hover:bg-white/10 transition-all">
                                <div className="space-y-6">
                                    {/* Selected Influencers List */}
                                    <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="text-white font-semibold">Selected Influencers</div>
                                            <div className="text-white/70 text-xs">24 selected</div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between p-2 bg-black/60 rounded border border-white/10">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                                    <span className="text-white/90 text-sm">@fashionista_maya</span>
                                                </div>
                                                <Check className="h-3 w-3 text-green-400" />
                                            </div>
                                            <div className="flex items-center justify-between p-2 bg-black/60 rounded border border-white/10">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                                    <span className="text-white/90 text-sm">@tech_reviewer_pro</span>
                                                </div>
                                                <Check className="h-3 w-3 text-green-400" />
                                            </div>
                                            <div className="flex items-center justify-between p-2 bg-black/60 rounded border border-white/10">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                                    <span className="text-white/90 text-sm">@lifestyle_emma</span>
                                                </div>
                                                <Check className="h-3 w-3 text-green-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Export Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-black/40 rounded-lg border border-white/10">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <Users className="h-4 w-4 text-white/50" />
                                                <span className="text-white/70 text-xs">Total Lists</span>
                                            </div>
                                            <div className="text-2xl font-bold text-white">12</div>
                                        </div>
                                        <div className="p-3 bg-black/40 rounded-lg border border-white/10">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <BarChart3 className="h-4 w-4 text-white/50" />
                                                <span className="text-white/70 text-xs">Exported</span>
                                            </div>
                                            <div className="text-2xl font-bold text-white">847</div>
                                        </div>
                                    </div>

                                    {/* Export Options */}
                                    <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                                        <div className="text-white font-semibold mb-4">Export Data</div>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center space-x-2">
                                                        <Check className="h-3 w-3 text-white/50" />
                                                        <span className="text-white/90">Bio & Email</span>
                                                    </div>
                                                    <span className="text-green-400">Included</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-400/60 rounded-full" style={{ width: "100%" }} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center space-x-2">
                                                        <Check className="h-3 w-3 text-white/50" />
                                                        <span className="text-white/90">Engagement Metrics</span>
                                                    </div>
                                                    <span className="text-green-400">Included</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-400/60 rounded-full" style={{ width: "100%" }} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center space-x-2">
                                                        <Check className="h-3 w-3 text-white/50" />
                                                        <span className="text-white/90">Social Links</span>
                                                    </div>
                                                    <span className="text-green-400">Included</span>
                                                </div>
                                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-400/60 rounded-full" style={{ width: "100%" }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Right Side - Description */}
                            <div className="space-y-6">
                                <div className="text-6xl font-bold text-white/20">03</div>
                                <h3 className="text-4xl font-bold text-white">Build Lists & Export to CSV</h3>
                                <p className="text-white/70 text-lg leading-relaxed">
                                    Create curated lists of your perfect influencer matches: Export complete profiles with bio, email,
                                    engagement metrics, and social links in one click. Take your data anywhere: CRM, email tools, or
                                    spreadsheets, and launch campaigns instantly.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    )
}
