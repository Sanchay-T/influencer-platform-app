import { ArrowRight } from "lucide-react"

export function CTA() {
    return (
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
    )
}
