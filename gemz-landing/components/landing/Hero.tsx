import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FoundersDeal } from "@/components/landing/FoundersDeal"

export function Hero() {
    return (
        <>
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
                        <FoundersDeal />
                    </div>
                </div>
            </div>
        </>
    )
}
