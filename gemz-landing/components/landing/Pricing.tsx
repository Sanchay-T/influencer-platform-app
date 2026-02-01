import { ArrowRight, Check, Crown } from "lucide-react"

export function Pricing() {
    return (
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
    )
}
