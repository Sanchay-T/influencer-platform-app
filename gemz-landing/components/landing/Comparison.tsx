import { BarChart3, Check, Sparkles, X } from "lucide-react"

export function Comparison() {
    return (
        <section className="relative z-10 bg-black py-24 px-6 lg:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/15 via-zinc-900/30 to-black" />

            <div className="relative z-10 max-w-7xl mx-auto">
                <div className="text-center mb-16 space-y-6">
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
    )
}
