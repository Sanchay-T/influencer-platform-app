import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sparkles } from "lucide-react"

export function Testimonials() {
    return (
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
    )
}
