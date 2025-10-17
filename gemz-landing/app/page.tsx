"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Check,
  ArrowRight,
  ChevronDown,
  Mail,
  Sparkles,
  Users,
  Code,
  BarChart3,
  X,
  TrendingUp,
  User,
  Monitor,
  Eye,
  Globe,
  Crown,
} from "lucide-react"
import { useState } from "react"

export default function HomePage() {
  const [activeStep, setActiveStep] = useState(1)

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Background Image */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black" />
      </div>

      <div className="absolute top-0 right-0 w-1/2 h-screen pointer-events-none">
        <img
          src="/influencer-makeup-dark.jpg"
          alt=""
          className="absolute right-0 top-1/4 w-full h-auto object-contain opacity-90"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between p-6 lg:px-12">
          <div className="flex items-center">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Untitled%20design-xgVYh1nJmnBlSFX8W4TpFXpigw1vdG.png"
              alt="Gemz"
              className="h-12 w-auto"
            />
          </div>

          <nav className="hidden md:flex items-center">
            <a
              href="#pricing"
              className="text-white/90 hover:text-white transition-colors"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <Button variant="ghost" className="text-white hover:bg-white/10 border border-white/10">
              Sign In
            </Button>
            <Button className="bg-white text-black hover:bg-white/90 font-medium">Sign Up</Button>
          </div>
        </header>

        {/* Main Content */}
        <div className="px-6 lg:px-12 py-6 lg:py-12">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Trust Indicator */}
              <div className="flex items-center space-x-3">
                <div className="flex -space-x-2">
                  <Avatar className="w-8 h-8 border-2 border-white">
                    <AvatarImage src="/influencer-profile-1.jpg" />
                    <AvatarFallback>U1</AvatarFallback>
                  </Avatar>
                  <Avatar className="w-8 h-8 border-2 border-white">
                    <AvatarImage src="/influencer-profile-2.jpg" />
                    <AvatarFallback>U2</AvatarFallback>
                  </Avatar>
                  <Avatar className="w-8 h-8 border-2 border-white">
                    <AvatarImage src="/influencer-profile-3.jpg" />
                    <AvatarFallback>U3</AvatarFallback>
                  </Avatar>
                </div>
                <span className="text-white/90 text-sm">10,000+ influencers sourced weekly</span>
              </div>

              {/* Hero Text */}
              <div className="space-y-6">
                <h1 className="text-5xl lg:text-7xl font-normal leading-tight text-balance bg-gradient-to-r from-white/80 via-white to-white/90 bg-clip-text text-transparent">
                  Find the{" "}
                  <span
                    className="underline decoration-2"
                    style={{ textDecorationColor: "#FF10F0", textUnderlineOffset: "8px" }}
                  >
                    Right
                  </span>{" "}
                  Influencer,
                  <br />
                  Fast. <span className="italic">With AI.</span>
                </h1>
                <p className="text-xl text-white/80 max-w-lg text-pretty">
                  Find creators before your competitors do. Gemz helps brands identify high-performing creators in real
                  time — before anyone else does.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 font-semibold transition-all"
                  style={{
                    boxShadow: "0 20px 60px rgba(255, 255, 255, 0.5), 0 10px 30px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  Get Started for Free
                </Button>
              </div>
            </div>

            {/* Right Column - Pricing Card */}
            <div className="lg:justify-self-end">
              <Card className="backdrop-blur-md bg-white/3 border-white/10 p-8 max-w-sm">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Founders Deal — Limited to 50 Brands</h3>
                    <ArrowRight className="h-5 w-5 text-white" />
                  </div>

                  <p className="text-white/80 text-sm">
                    If you're scaling influencer marketing and want early access to Gemz' fastest creator discovery
                    platform:
                  </p>

                  <div className="px-3 py-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30 inline-block">
                    <span className="text-pink-400 text-sm font-semibold">💥 50% Off Viral Surge Plan</span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-4xl font-bold text-white">
                      $124
                      <span className="text-lg font-normal text-white/70"> / Per Month</span>
                    </div>
                    <div className="text-sm text-white/50 line-through">(normally $249/mo)</div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Check className="h-4 w-4 text-white" />
                      <span className="text-white/90 text-sm">10 Campaigns</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Check className="h-4 w-4 text-white" />
                      <span className="text-white/90 text-sm">10,000 Creators</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Check className="h-4 w-4 text-white" />
                      <span className="text-white/90 text-sm">Advanced Analytics</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Check className="h-4 w-4 text-white" />
                      <span className="text-white/90 text-sm">All Glow Up Features</span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white font-semibold transition-all"
                    style={{
                      boxShadow: "0 20px 60px rgba(236, 72, 153, 0.4), 0 10px 30px rgba(236, 72, 153, 0.3)",
                    }}
                  >
                    Get Deal
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>

                  <div className="pt-4 border-t border-white/10">
                    <p className="text-white/60 text-xs">🕒 Once-in-a-lifetime pricing for the first 50 brands only.</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Testimonials Section */}
        <section className="relative z-10 bg-black py-20 px-6 lg:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black" />

          <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <Sparkles className="h-4 w-4 text-white" />
                <span className="text-white text-sm font-medium">ai influencer search agent</span>
              </div>
            </div>

            {/* Main Text */}
            <div className="space-y-6">
              <div
                className="inline-block"
                style={{
                  filter: "drop-shadow(0 0 80px rgba(255, 255, 255, 0.1))",
                }}
              >
                <p className="text-3xl lg:text-4xl text-white/70 leading-relaxed text-balance">
                  Forget outdated <span className="italic">directories</span>. Gemz uses{" "}
                  <span className="italic">real-time</span> search and AI learning to instantly surface influencers who
                  actually perform for your brand, your niche, and <span className="italic">right now.</span>
                </p>
              </div>
            </div>

            {/* Attribution */}
            <div className="flex items-center justify-center space-x-3 pt-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src="/testimonial-creator-1.jpg" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <span className="text-white/90 text-sm">Co-founder & AI Strategy Lead</span>
            </div>
          </div>
        </section>

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 p-6 lg:px-12">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            {/* Scroll Indicator */}
            <div className="flex items-center space-x-2 text-white/80">
              <ChevronDown className="h-4 w-4" />
              <span className="text-sm">Scroll to Explore</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
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

      {/* How It Works Section */}
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
              className={`py-4 px-6 rounded-lg border transition-all ${
                activeStep === 1 ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <span className="text-white/70 text-sm font-medium">STEP 1</span>
            </button>
            <button
              onClick={() => setActiveStep(2)}
              className={`py-4 px-6 rounded-lg border transition-all ${
                activeStep === 2 ? "bg-white/10 border-blue-500/50" : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <span className="text-white/70 text-sm font-medium">STEP 2</span>
            </button>
            <button
              onClick={() => setActiveStep(3)}
              className={`py-4 px-6 rounded-lg border transition-all ${
                activeStep === 3 ? "bg-white/10 border-blue-500/50" : "bg-white/5 border-white/10 hover:bg-white/10"
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

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 bg-black py-24 px-6 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-black to-black" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-normal text-white">All Available Plans</h2>
            <p className="text-white/70 text-lg">Compare all plans and upgrade anytime</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Glow Up Plan */}
            <div className="bg-black border border-zinc-800 rounded-3xl p-8">
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white">Glow Up</h3>

                <div>
                  <span className="text-5xl font-bold text-white">$99</span>
                  <span className="text-white/50 text-base ml-2">/month</span>
                </div>

                <button
                  className="w-full py-3 px-4 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 transition-all text-white font-medium flex items-center justify-center space-x-2"
                  style={{
                    boxShadow: "0 20px 80px rgba(255, 255, 255, 0.4), 0 10px 40px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <span>Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="border-t border-white/10" />

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">3 campaigns</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">1,000 creators</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">CSV export</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">Bio extraction</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Viral Surge Plan */}
            <div className="bg-black border-2 border-pink-500 rounded-3xl p-8 relative">
              <div className="absolute top-6 right-6">
                <div className="px-3 py-1.5 rounded-full bg-zinc-800 text-white text-xs font-medium">Most Popular</div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white">Viral Surge</h3>

                <div>
                  <span className="text-5xl font-bold text-white">$249</span>
                  <span className="text-white/50 text-base ml-2">/month</span>
                </div>

                <button
                  className="w-full py-3 px-4 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 transition-all text-white font-medium flex items-center justify-center space-x-2 relative"
                  style={{
                    boxShadow: "0 20px 80px rgba(255, 255, 255, 0.4), 0 10px 40px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <span>Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="border-t border-white/10" />

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">10 campaigns</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">10,000 creators</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">Advanced analytics</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">All Glow Up features</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fame Flex Plan */}
            <div className="bg-black border border-zinc-800 rounded-3xl p-8 relative">
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Crown className="h-5 w-5 text-white" />
                  <h3 className="text-xl font-semibold text-white">Fame Flex</h3>
                </div>

                <div>
                  <span className="text-5xl font-bold text-white">$499</span>
                  <span className="text-white/50 text-base ml-2">/month</span>
                </div>

                <button
                  className="w-full py-3 px-4 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 transition-all text-white font-medium flex items-center justify-center space-x-2"
                  style={{
                    boxShadow: "0 20px 80px rgba(255, 255, 255, 0.4), 0 10px 40px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <span>Free Trial</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="border-t border-white/10" />

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">Unlimited campaigns</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">Unlimited creators</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">API access</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-zinc-500" />
                    <span className="text-zinc-400 text-sm">Priority support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="relative z-10 bg-black py-24 px-6 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/15 via-zinc-900/30 to-black" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-6">
            {/* Pagination Dots */}
            {/* <div className="flex justify-center space-x-2 mb-4">
                  <div className="w-16 h-1 rounded-full bg-blue-500" />
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                </div> */}

            <div className="flex justify-center">
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <BarChart3 className="h-4 w-4 text-white" />
                <span className="text-white text-sm font-medium">COMPARISON</span>
              </div>
            </div>
            <h2 className="text-4xl lg:text-5xl font-normal text-white">
              Why Choose Us{" "}
              <span className="italic bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500 bg-clip-text text-transparent">
                Over Others
              </span>
            </h2>
            <p className="text-white/70 text-lg">See how we compare against others in performance, growth</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
            {/* Gemz Card */}
            <div className="relative">
              {/* Glow effect behind card */}
              <div className="absolute inset-0 bg-white/20 blur-3xl rounded-3xl" />

              <div className="relative bg-black border border-zinc-800 rounded-3xl p-8">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white italic">Gemz</h3>
                </div>

                <div className="space-y-0">
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      <span className="text-white text-base">Fast setup with ready AI workflows</span>
                    </div>
                  </div>
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      <span className="text-white text-base">Built to grow and adapt with you</span>
                    </div>
                  </div>
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      <span className="text-white text-base">Real-time, AI-powered analytics</span>
                    </div>
                  </div>
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      <span className="text-white text-base">Automates tasks, reducing overhead</span>
                    </div>
                  </div>
                  <div className="py-4">
                    <div className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-white mt-0.5 flex-shrink-0" />
                      <span className="text-white text-base">Expert support + AI guidance</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Others Card */}
            <div className="relative">
              {/* Glow effect behind card */}
              <div className="absolute inset-0 bg-white/20 blur-3xl rounded-3xl" />

              <div className="relative bg-black border border-zinc-800 rounded-3xl p-8">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <div className="flex flex-col space-y-0.5">
                      <div className="w-4 h-0.5 bg-white/50 rounded" />
                      <div className="w-4 h-0.5 bg-white/50 rounded" />
                      <div className="w-4 h-0.5 bg-white/50 rounded" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-semibold text-white italic">Others</h3>
                </div>

                <div className="space-y-0">
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <X className="h-5 w-5 text-zinc-600 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-500 text-base">Slower execution and manual setup</span>
                    </div>
                  </div>
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <X className="h-5 w-5 text-zinc-600 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-500 text-base">Requires manual updates as you scale</span>
                    </div>
                  </div>
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <X className="h-5 w-5 text-zinc-600 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-500 text-base">Limited or delayed reporting</span>
                    </div>
                  </div>
                  <div className="py-4 border-b border-white/10">
                    <div className="flex items-start space-x-3">
                      <X className="h-5 w-5 text-zinc-600 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-500 text-base">Higher labor costs, less automation</span>
                    </div>
                  </div>
                  <div className="py-4">
                    <div className="flex items-start space-x-3">
                      <X className="h-5 w-5 text-zinc-600 mt-0.5 flex-shrink-0" />
                      <span className="text-zinc-500 text-base">Generic support or none at all</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 bg-black py-24 px-6 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/15 via-zinc-900/30 to-black" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-12">
          <div className="flex items-center justify-center space-x-4">
            <div className="h-px w-24 bg-gradient-to-r from-transparent to-white/20" />
            <span className="text-white/70 text-sm italic">Reach out anytime</span>
            <div className="h-px w-24 bg-gradient-to-l from-transparent to-white/20" />
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl lg:text-6xl font-normal text-white leading-tight">
              Ready to 10x Your Influencer Pipeline?
            </h2>
            <h3 className="text-4xl lg:text-5xl font-normal">
              <span className="text-white">Let's </span>
              <span className="italic bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500 bg-clip-text text-transparent">
                Scale Together
              </span>
            </h3>
          </div>
          <div className="flex justify-center">
            <button
              className="py-4 px-8 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 transition-all text-white text-lg font-medium flex items-center space-x-3"
              style={{
                boxShadow: "0 20px 80px rgba(255, 255, 255, 0.3), 0 10px 40px rgba(255, 255, 255, 0.2)",
              }}
            >
              <span>Free Trial</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
          <div className="pt-4">
            <a href="mailto:support@usegemz.io" className="text-white/70 hover:text-white transition-colors">
              support@usegemz.io
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-black border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between py-8">
            <div className="flex items-center">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Untitled%20design-xgVYh1nJmnBlSFX8W4TpFXpigw1vdG.png"
                alt="Gemz"
                className="h-10 w-auto"
              />
            </div>
          </div>
          <div className="py-8 border-t border-white/10">
            <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <a
                href="#pricing"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })
                }}
              >
                Pricing
              </a>
              <a href="#privacy" className="text-zinc-400 hover:text-white transition-colors text-sm">
                Privacy
              </a>
              <a href="#terms" className="text-zinc-400 hover:text-white transition-colors text-sm">
                Terms
              </a>
            </nav>
          </div>
          <div className="py-6 border-t border-white/10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-zinc-400 text-sm">© 2025 Gemz</p>
              {/* CHANGE: Removed "Made by Framebase" text and adjusted layout */}
              <a href="mailto:support@usegemz.io" className="text-zinc-400 hover:text-white transition-colors text-sm">
                support@usegemz.io
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
