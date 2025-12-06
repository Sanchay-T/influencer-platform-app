export function Footer() {
    return (
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
    )
}
