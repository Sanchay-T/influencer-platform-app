import { Hero } from "@/components/landing/Hero"

export default function HeroTestPage() {
    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-black to-black">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-black to-black" />
            </div>
            <div className="relative z-10">
                <Hero />
            </div>
        </div>
    )
}
