import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight, Check } from "lucide-react"

export function FoundersDeal() {
    return (
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
    )
}
