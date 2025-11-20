"use client"

import { ChevronDown } from "lucide-react"
import { Hero } from "@/components/landing/Hero"
import { Testimonials } from "@/components/landing/Testimonials"
import { Features } from "@/components/landing/Features"
import { Pricing } from "@/components/landing/Pricing"
import { Comparison } from "@/components/landing/Comparison"
import { CTA } from "@/components/landing/CTA"
import { Footer } from "@/components/landing/Footer"
import { HowItWorks } from "@/components/landing/HowItWorks"

export default function HomePage() {

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
        <Hero />

        <Testimonials />

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

      <Features />

      {/* How It Works Section */}
      {/* How It Works Section */}
      <HowItWorks />

      <Pricing />

      <Comparison />

      <CTA />

      <Footer />
    </div>
  )
}
